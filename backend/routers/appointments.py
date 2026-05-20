"""
backend/routers/appointments.py — Роутер для управління записами на прийом

Ендпоінти:
  POST   /appointments/                    — Створення нового запису
  GET    /appointments/{id}               — Деталі конкретного запису
  PATCH  /appointments/{id}/status        — Зміна статусу (скасувати тощо)
  GET    /doctors/{doctor_id}/schedule    — Розклад лікаря на конкретний день
"""

from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

# Залежності та моделі
import sys
sys.path.insert(0, "/app")

from database import get_db
from models import Appointment, AppointmentStatus, Doctor, Patient, QueueEntry, QueueStatus
from schemas import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentScheduleItem,
    AppointmentStatusUpdate,
    DoctorCreate,
    DoctorRead,
)
from sqlalchemy.orm import selectinload

# ---------------------------------------------------------------------------
# Ініціалізація роутера
# prefix та tags автоматично застосовуються до всіх ендпоінтів цього роутера
# ---------------------------------------------------------------------------
router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)

# Окремий роутер для ендпоінтів лікарів (буде включено в main.py)
doctors_router = APIRouter(
    prefix="/doctors",
    tags=["Doctors"],
)


# ===========================================================================
# ДОПОМІЖНІ ФУНКЦІЇ
# ===========================================================================

async def get_appointment_or_404(
    appointment_id: int,
    db: AsyncSession,
) -> Appointment:
    """
    Повертає Appointment за id або піднімає HTTP 404.
    Використовується як внутрішня утиліта роутерів.
    """
    result = await db.execute(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(selectinload(Appointment.patient), selectinload(Appointment.doctor))
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Запис із id={appointment_id} не знайдено",
        )
    return appointment


async def get_doctor_or_404(doctor_id: int, db: AsyncSession) -> Doctor:
    """Повертає Doctor за id або піднімає HTTP 404."""
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Лікаря із id={doctor_id} не знайдено",
        )
    return doctor


async def get_patient_or_404(patient_id: int, db: AsyncSession) -> Patient:
    """Повертає Patient за id або піднімає HTTP 404."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Пацієнта із id={patient_id} не знайдено",
        )
    return patient


# ===========================================================================
# ЕНДПОІНТИ /appointments
# ===========================================================================

@router.post(
    "/",
    response_model=AppointmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Створити новий запис на прийом",
    description="""
Створює новий запис пацієнта до лікаря на вказаний час.

**Бізнес-правила:**
- Пацієнт і лікар мають існувати в системі.
- Запланований час не може бути у минулому.
- Лікар не може мати два активних записи в один і той самий час.
    """,
)
async def create_appointment(
    payload: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
) -> AppointmentRead:
    """POST /appointments/ — Створення нового запису на прийом."""

    # 1. Перевірка існування пацієнта та лікаря
    await get_patient_or_404(payload.patient_id, db)
    await get_doctor_or_404(payload.doctor_id, db)

    # 2. Запланований час не може бути у минулому
    now_utc = datetime.now(timezone.utc)
    scheduled_utc = payload.scheduled_start
    # Якщо час без timezone — вважаємо UTC
    if scheduled_utc.tzinfo is None:
        scheduled_utc = scheduled_utc.replace(tzinfo=timezone.utc)

    if scheduled_utc < now_utc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Запланований час не може бути у минулому",
        )

    # 3. Перевірка на конфлікт у розкладі лікаря
    # Вважаємо конфліктом будь-який активний запис на той самий час
    conflict_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == payload.doctor_id,
                Appointment.scheduled_start == payload.scheduled_start,
                Appointment.status.in_([
                    AppointmentStatus.scheduled,
                ]),
            )
        )
    )
    if conflict_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Лікар вже має активний запис на цей час",
        )

    # 4. Створення запису
    appointment = Appointment(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        scheduled_start=payload.scheduled_start,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        status=AppointmentStatus.scheduled,
    )
    db.add(appointment)
    await db.flush()
    await db.refresh(appointment)

    # Валідуємо модель поки сесія відкрита
    return AppointmentRead.model_validate(appointment)


@router.get(
    "/{appointment_id}",
    response_model=AppointmentRead,
    summary="Отримати деталі запису",
)
async def get_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
) -> AppointmentRead:
    """GET /appointments/{appointment_id} — Деталі конкретного запису."""
    appointment = await get_appointment_or_404(appointment_id, db)
    return AppointmentRead.model_validate(appointment)


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentRead,
    summary="Змінити статус запису",
    description="Дозволяє скасувати запис, позначити як неявку або завершений прийом.",
)
async def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> AppointmentRead:
    """PATCH /appointments/{appointment_id}/status."""
    appointment = await get_appointment_or_404(appointment_id, db)

    # Заборонено змінювати статус вже завершеного або скасованого запису
    # Але дозволено додавати нотатки, якщо статус не завершений
    if payload.status:
        if appointment.status in (AppointmentStatus.completed, AppointmentStatus.cancelled):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Неможливо змінити статус: запис вже '{appointment.status.value}'",
            )
        appointment.status = payload.status

    if payload.notes is not None:
        appointment.notes = payload.notes

    await db.flush()
    await db.refresh(appointment)
    
    return AppointmentRead.model_validate(appointment)


# ===========================================================================
# ЕНДПОІНТИ /doctors (розклад та список)
# ===========================================================================

@doctors_router.get(
    "/",
    response_model=List[DoctorRead],
    summary="Отримати список усіх лікарів",
)
async def get_doctors(
    db: AsyncSession = Depends(get_db),
) -> List[DoctorRead]:
    """GET /doctors/ — Список усіх спеціалістів."""
    result = await db.execute(select(Doctor).order_by(Doctor.full_name.asc()))
    doctors = result.scalars().all()
    return [DoctorRead.model_validate(d) for d in doctors]


@doctors_router.post(
    "/",
    response_model=DoctorRead,
    status_code=status.HTTP_201_CREATED,
    summary="Додати нового лікаря",
)
async def create_doctor(
    payload: DoctorCreate,
    db: AsyncSession = Depends(get_db),
) -> DoctorRead:
    """POST /doctors/ — Реєстрація нового лікаря."""
    # Перевірка на унікальність email
    stmt = select(Doctor).where(Doctor.email == payload.email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Лікар з email {payload.email} вже існує",
        )

    doctor = Doctor(
        full_name=payload.full_name,
        specialty=payload.specialty,
        email=payload.email,
        password_hash=payload.password, # У реальному додатку тут був би хеш
        bio=payload.bio,
    )
    db.add(doctor)
    await db.flush()
    await db.refresh(doctor)
    return DoctorRead.model_validate(doctor)


@doctors_router.get(
    "/{doctor_id}/schedule",
    response_model=List[AppointmentScheduleItem],
    summary="Розклад лікаря на день",
    description="""
Повертає список записів конкретного лікаря на вказаний день.

**Параметри:**
- `doctor_id` — ID лікаря
- `date` (query, optional) — дата у форматі `YYYY-MM-DD`. За замовчуванням — сьогодні.
- `status` (query, optional) — фільтр за статусом (наприклад, `scheduled`).
    """,
)
async def get_doctor_schedule(
    doctor_id: int,
    schedule_date: Optional[date] = Query(
        None,
        alias="date",
        description="Дата розкладу у форматі YYYY-MM-DD (за замовчуванням — сьогодні)",
        examples=["2025-06-15"],
    ),
    filter_status: Optional[AppointmentStatus] = Query(
        None,
        alias="status",
        description="Фільтрувати за статусом запису",
    ),
    db: AsyncSession = Depends(get_db),
) -> List[AppointmentScheduleItem]:
    """GET /doctors/{doctor_id}/schedule — Розклад лікаря на день."""

    # Перевірка існування лікаря
    await get_doctor_or_404(doctor_id, db)

    # За замовчуванням — поточна дата (UTC)
    target_date = schedule_date or date.today()

    # Побудова запиту:
    # Вибираємо всі записи лікаря, де дата `scheduled_start` збігається з target_date
    # DATE() — PostgreSQL-функція для приведення timestamp до дати
    from sqlalchemy import cast, Date as DateType
    query = (
        select(Appointment)
        .where(
            and_(
                Appointment.doctor_id == doctor_id,
                cast(Appointment.scheduled_start, DateType) == target_date,
            )
        )
        .options(
            selectinload(Appointment.patient),
            selectinload(Appointment.queue_entries)
        )
        .order_by(Appointment.scheduled_start.asc())
    )

    # Фільтр за статусом (необов'язковий)
    if filter_status:
        query = query.where(Appointment.status == filter_status)

    result = await db.execute(query)
    appointments = result.scalars().all()

    # Формуємо відповідь з урахуванням стану черги
    response_items = []
    for appt in appointments:
        # Перевіряємо, чи є активний запис у черзі для цього прийому
        has_active_queue = any(
            q.queue_status in (QueueStatus.waiting, QueueStatus.in_progress)
            for q in appt.queue_entries
        )
        
        item = AppointmentScheduleItem.model_validate(appt)
        item.is_checked_in = has_active_queue
        response_items.append(item)

    return response_items


@doctors_router.get(
    "/{doctor_id}/history",
    response_model=List[AppointmentRead],
    summary="Історія всіх прийомів лікаря",
    description="Повертає повну історію всіх записів до лікаря (включаючи завершені, скасовані та майбутні).",
)
async def get_doctor_history(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
) -> List[AppointmentRead]:
    """GET /doctors/{doctor_id}/history — Вся історія прийомів лікаря."""
    await get_doctor_or_404(doctor_id, db)
    
    result = await db.execute(
        select(Appointment)
        .where(Appointment.doctor_id == doctor_id)
        .options(selectinload(Appointment.patient))
        .order_by(Appointment.scheduled_start.desc())
    )
    appointments = result.scalars().all()
    return [AppointmentRead.model_validate(a) for a in appointments]


# ===========================================================================
# ЕНДПОІНТИ ДЛЯ ПАЦІЄНТІВ
# ===========================================================================

@router.get(
    "/patient/{patient_id}",
    response_model=List[AppointmentRead],
    summary="Отримати всі записи пацієнта",
)
async def get_patient_appointments(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
) -> List[AppointmentRead]:
    """GET /appointments/patient/{id} — Історія записів пацієнта."""
    await get_patient_or_404(patient_id, db)
    
    result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .options(selectinload(Appointment.doctor))
        .order_by(Appointment.scheduled_start.desc())
    )
    appointments = result.scalars().all()
    return [AppointmentRead.model_validate(a) for a in appointments]

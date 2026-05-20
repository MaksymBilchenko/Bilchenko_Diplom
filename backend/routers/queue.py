"""
backend/routers/queue.py — Роутер для управління живою чергою

Ендпоінти:
  POST  /queue/check-in/{appointment_id}  — Реєстрація прибуття пацієнта
  GET   /queue/live/{doctor_id}           — Поточний стан черги до лікаря
  PATCH /queue/{entry_id}/status          — Зміна статусу пацієнта у черзі
  DELETE /queue/{entry_id}               — Видалення елемента черги (скасування)
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

import sys
sys.path.insert(0, "/app")

from database import get_db
from models import Appointment, AppointmentStatus, Doctor, QueueEntry, QueueStatus
from schemas import (
    LiveQueueResponse,
    QueueEntryRead,
    QueueEntryStatusUpdate,
)
from sqlalchemy.orm import selectinload

router = APIRouter(
    prefix="/queue",
    tags=["Queue"],
)


# ===========================================================================
# ДОПОМІЖНІ ФУНКЦІЇ
# ===========================================================================

async def get_queue_entry_or_404(entry_id: int, db: AsyncSession) -> QueueEntry:
    """Повертає QueueEntry за id або піднімає HTTP 404."""
    result = await db.execute(
        select(QueueEntry)
        .where(QueueEntry.id == entry_id)
        .options(
            selectinload(QueueEntry.appointment)
            .selectinload(Appointment.patient),
            selectinload(QueueEntry.appointment)
            .selectinload(Appointment.doctor)
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Елемент черги із id={entry_id} не знайдено",
        )
    return entry


# ===========================================================================
# ЕНДПОІНТ 1: Реєстрація прибуття (check-in)
# ===========================================================================

@router.post(
    "/check-in/{appointment_id}",
    response_model=QueueEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Зареєструвати прибуття пацієнта (check-in)",
    description="""
Виконується адміністратором або через self-check-in кіоск у момент,
коли пацієнт фізично прибуває до закладу.

**Що відбувається:**
1. Перевіряється, що запис (Appointment) існує і має статус `scheduled`.
2. Перевіряється, що пацієнт ще не зареєстрований у черзі (дублі заборонені).
3. Створюється елемент черги `QueueEntry` зі статусом `waiting`.
4. Опціонально можна передати `priority` у тілі запиту.
    """,
)
async def check_in(
    appointment_id: int,
    priority: int = Query(
        10,
        ge=0,
        le=100,
        description="Пріоритет пацієнта у черзі (0=екстрений, 10=стандарт)",
    ),
    db: AsyncSession = Depends(get_db),
) -> QueueEntryRead:
    """POST /queue/check-in/{appointment_id} — Реєстрація прибуття пацієнта."""

    # 1. Завантажити запис на прийом
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Запис із id={appointment_id} не знайдено",
        )

    # 2. Запис має бути у статусі "заплановано"
    if appointment.status != AppointmentStatus.scheduled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Check-in неможливий: запис має статус '{appointment.status.value}'. "
                f"Очікується '{AppointmentStatus.scheduled.value}'."
            ),
        )

    # 3. Перевірка дублю: пацієнт вже у черзі (статус waiting або in_progress)
    duplicate_result = await db.execute(
        select(QueueEntry).where(
            and_(
                QueueEntry.appointment_id == appointment_id,
                QueueEntry.queue_status.in_([
                    QueueStatus.waiting,
                    QueueStatus.in_progress,
                ]),
            )
        )
    )
    if duplicate_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пацієнт вже зареєстрований у черзі для цього запису",
        )

    # 4. Створити елемент черги
    queue_entry = QueueEntry(
        appointment_id=appointment_id,
        arrival_time=datetime.now(timezone.utc),
        queue_status=QueueStatus.waiting,
        priority=priority,
    )
    db.add(queue_entry)

    # 5. (Опціонально) Можна також оновити статус appointment — наприклад,
    #    позначити що пацієнт прийшов. Залишаємо scheduled — лікар завершить.
    # appointment.status = AppointmentStatus.scheduled  # без змін

    await db.flush()
    await db.refresh(queue_entry)

    # Валідуємо модель поки сесія відкрита
    return QueueEntryRead.model_validate(queue_entry)


# ===========================================================================
# ЕНДПОІНТ 2: Жива черга до лікаря в реальному часі
# ===========================================================================

@router.get(
    "/live/{doctor_id}",
    response_model=LiveQueueResponse,
    summary="Поточний стан живої черги до лікаря",
    description="""
Повертає актуальний стан черги до конкретного лікаря.
Включає пацієнтів зі статусами `waiting` та `in_progress`.

**Сортування черги:**
1. Спочатку пацієнти з меншим числом `priority` (вищий пріоритет)
2. При однаковому пріоритеті — за часом прибуття (хто раніше прийшов)

Призначений для відображення на моніторі у залі очікування або в кабінеті лікаря.
    """,
)
async def get_live_queue(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
) -> LiveQueueResponse:
    """GET /queue/live/{doctor_id} — Стан живої черги до лікаря."""

    # 1. Перевірка існування лікаря
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id)
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Лікаря із id={doctor_id} не знайдено",
        )

    # 2. Завантажуємо активні елементи черги через JOIN із Appointment
    #
    # Логіка запиту:
    #   QueueEntry JOIN Appointment ON queue_entry.appointment_id = appointment.id
    #   WHERE appointment.doctor_id = {doctor_id}
    #     AND queue_entry.queue_status IN ('waiting', 'in_progress')
    #   ORDER BY queue_entry.priority ASC, queue_entry.arrival_time ASC
    #
    # Статус 'served' не включаємо — пацієнт вже обслужений, йде зі списку.
    queue_result = await db.execute(
        select(QueueEntry)
        .join(Appointment, QueueEntry.appointment_id == Appointment.id)
        .where(
            and_(
                Appointment.doctor_id == doctor_id,
                QueueEntry.queue_status.in_([
                    QueueStatus.waiting,
                    QueueStatus.in_progress,
                ]),
            )
        )
        .options(
            selectinload(QueueEntry.appointment).selectinload(Appointment.patient),
            selectinload(QueueEntry.appointment).selectinload(Appointment.doctor),
        )
        .order_by(
            QueueEntry.priority.asc(),       # Спочатку найвищий пріоритет
            QueueEntry.arrival_time.asc(),   # Потім — хто раніше прийшов
        )
    )
    entries: List[QueueEntry] = list(queue_result.scalars().all())

    # 3. Підрахунок статистики
    total_waiting = sum(1 for e in entries if e.queue_status == QueueStatus.waiting)
    total_in_progress = sum(1 for e in entries if e.queue_status == QueueStatus.in_progress)

    return LiveQueueResponse(
        doctor_id=doctor_id,
        doctor_name=doctor.full_name,
        total_waiting=total_waiting,
        total_in_progress=total_in_progress,
        queue=[QueueEntryRead.model_validate(e) for e in entries],
    )


# ===========================================================================
# ЕНДПОІНТ 3: Зміна статусу пацієнта у черзі
# ===========================================================================

@router.patch(
    "/{entry_id}/status",
    response_model=QueueEntryRead,
    summary="Змінити статус пацієнта у черзі",
    description="""
Переводить елемент черги між статусами:
- `waiting` → `in_progress`: лікар викликає пацієнта (фіксується `started_at`)
- `in_progress` → `served`: прийом завершено (фіксується `finished_at`)

Зворотній перехід (`served` → будь-який) заборонений.
    """,
)
async def update_queue_status(
    entry_id: int,
    payload: QueueEntryStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> QueueEntryRead:
    """PATCH /queue/{entry_id}/status — Зміна статусу у черзі."""
    entry = await get_queue_entry_or_404(entry_id, db)

    # Заборона зміни вже обслуженого пацієнта
    if entry.queue_status == QueueStatus.served:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Неможливо змінити статус: пацієнт вже обслужений",
        )

    new_status = payload.queue_status
    now = datetime.now(timezone.utc)

    # Фіксуємо timestamp при переходах статусів
    if new_status == QueueStatus.in_progress and entry.started_at is None:
        entry.started_at = now

    if new_status == QueueStatus.served:
        entry.finished_at = now
        # Оновлюємо статус пов'язаного Appointment → completed
        # Об'єкт appointment вже завантажений завдяки selectinload у get_queue_entry_or_404
        if entry.appointment:
            entry.appointment.status = AppointmentStatus.completed

    entry.queue_status = new_status
    await db.flush()
    
    # Оновлюємо об'єкт, щоб отримати timestamps з БД (created_at, started_at тощо)
    await db.refresh(entry)
    if entry.appointment:
        await db.refresh(entry.appointment)

    # Валідуємо модель поки сесія відкрита
    return QueueEntryRead.model_validate(entry)


# ===========================================================================
# ЕНДПОІНТ 4: Видалення елемента черги
# ===========================================================================

@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Видалити пацієнта з черги",
    description="Видаляє елемент черги (наприклад, пацієнт пішов, не дочекавшись).",
)
async def remove_from_queue(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
) -> None:
    """DELETE /queue/{entry_id} — Видалення з черги."""
    entry = await get_queue_entry_or_404(entry_id, db)
    await db.delete(entry)
    # Транзакція завершується у get_db() dependency

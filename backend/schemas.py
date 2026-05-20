"""
backend/schemas.py — Pydantic v2 схеми для валідації запитів та серіалізації відповідей

Структура:
  Кожна сутність має кілька схем із різним набором полів:
    XxxBase    — спільні поля (без id, timestamps)
    XxxCreate  — вхідні дані для POST (успадковує Base, додає обов'язкові поля)
    XxxRead    — вихідні дані (успадковує Base, додає id, timestamps)
    XxxUpdate  — часткове оновлення (всі поля Optional)

Pydantic v2:
  model_config = ConfigDict(from_attributes=True) — замінює orm_mode = True
  Це дозволяє серіалізувати SQLAlchemy-об'єкти безпосередньо.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from models import AppointmentStatus, QueueStatus


# ===========================================================================
# DOCTOR
# ===========================================================================

class DoctorBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255, examples=["Іваненко Петро Васильович"])
    specialty: str = Field(..., min_length=2, max_length=100, examples=["Кардіолог"])
    email: EmailStr = Field(..., examples=["doctor@med.com"])
    bio: Optional[str] = Field(None, max_length=2000)


class DoctorCreate(DoctorBase):
    password: str = Field(..., min_length=6, max_length=100)


class DoctorRead(DoctorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ===========================================================================
# PATIENT
# ===========================================================================

class PatientBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255, examples=["Петренко Оксана Михайлівна"])
    phone: Optional[str] = Field(
        None,
        pattern=r"^\+?[\d\s\-\(\)]{7,20}$",
        examples=["+380991234567"],
    )
    email: Optional[EmailStr] = Field(None, examples=["patient@example.com"])


class PatientCreate(PatientBase):
    pass


class PatientRead(PatientBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# ===========================================================================
# APPOINTMENT
# ===========================================================================

class AppointmentBase(BaseModel):
    patient_id: int = Field(..., gt=0)
    doctor_id: int = Field(..., gt=0)
    scheduled_start: datetime = Field(
        ...,
        examples=["2025-06-15T10:30:00+03:00"],
        description="Запланований час початку прийому (з урахуванням часового поясу)",
    )
    duration_minutes: Optional[int] = Field(
        30,
        ge=5,
        le=240,
        description="Тривалість прийому в хвилинах (5–240)",
    )
    notes: Optional[str] = Field(None, max_length=1000)


class AppointmentCreate(AppointmentBase):
    """Схема для POST /appointments/ — створення нового запису на прийом."""
    pass


class AppointmentStatusUpdate(BaseModel):
    """Схема для оновлення статусу та нотаток запису."""
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = Field(None, max_length=5000)


class AppointmentRead(AppointmentBase):
    """Схема відповіді — містить id, статус та timestamps."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: AppointmentStatus
    created_at: datetime
    updated_at: datetime

    # Вкладені об'єкти (якщо selectin-relationship завантажив їх)
    doctor: Optional[DoctorRead] = None
    patient: Optional[PatientRead] = None


class AppointmentScheduleItem(BaseModel):
    """
    Спрощена схема для відображення розкладу лікаря (GET /doctors/{id}/schedule).
    Не включає вкладених об'єктів для економії трафіку.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    scheduled_start: datetime
    duration_minutes: Optional[int]
    status: AppointmentStatus
    notes: Optional[str]

    # Ім'я пацієнта для відображення у розкладі
    patient: Optional[PatientRead] = None

    # Чи зареєстрований пацієнт вже у черзі
    is_checked_in: bool = False


# ===========================================================================
# QUEUE ENTRY
# ===========================================================================

class QueueEntryBase(BaseModel):
    appointment_id: int = Field(..., gt=0)
    priority: int = Field(
        10,
        ge=0,
        le=100,
        description="Пріоритет: менше = вищий (0=екстрений, 10=стандарт, 20=низький)",
    )


class QueueEntryCreate(QueueEntryBase):
    """
    Схема для POST /queue/check-in/{appointment_id}.
    Пріоритет можна вказати явно (адміністратор може підвищити пріоритет).
    """
    pass


class QueueEntryRead(QueueEntryBase):
    """Схема відповіді одного елемента черги."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    queue_status: QueueStatus
    arrival_time: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime

    # Вкладений запис на прийом (для відображення даних пацієнта у черзі)
    appointment: Optional[AppointmentRead] = None


class QueueEntryStatusUpdate(BaseModel):
    """Схема для зміни статусу пацієнта у черзі."""
    queue_status: QueueStatus


class LiveQueueResponse(BaseModel):
    """
    Відповідь для GET /queue/live/{doctor_id} — стан живої черги лікаря.
    Включає статистику та впорядкований список пацієнтів.
    """
    doctor_id: int
    doctor_name: str
    total_waiting: int = Field(description="Кількість пацієнтів у статусі 'очікує'")
    total_in_progress: int = Field(description="Кількість пацієнтів на прийомі (0 або 1)")
    queue: list[QueueEntryRead] = Field(description="Черга, відсортована за пріоритетом та часом прибуття")

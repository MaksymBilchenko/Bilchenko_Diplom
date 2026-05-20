"""
backend/models.py — SQLAlchemy ORM-моделі для системи медичної черги

Сутності:
  Doctor       — лікар (спеціаліст медичного закладу)
  Patient      — пацієнт (клієнт, що записується на прийом)
  Appointment  — запис на прийом (розклад)
  QueueEntry   — елемент живої черги в день прийому

Зв'язки:
  Doctor      1 ──< Appointment  (один лікар — багато записів)
  Patient     1 ──< Appointment  (один пацієнт — багато записів)
  Appointment 1 ──< QueueEntry   (один запис — один або більше елементів черги)
"""

import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Імпортуємо Base з database.py — звідси всі моделі успадковують метадані
from database import Base


# ===========================================================================
# ENUMS
# Визначаємо Python-enum'и, які SQLAlchemy відображає на тип ENUM в PostgreSQL
# ===========================================================================

class AppointmentStatus(str, enum.Enum):
    """
    Статус запису на прийом (Appointment).

    Значення зберігаються як рядки (str mixin), що дозволяє порівнювати:
      appointment.status == "scheduled"   ✓
      appointment.status == AppointmentStatus.scheduled  ✓
    """
    scheduled  = "scheduled"    # Заплановано — запис підтверджено
    cancelled  = "cancelled"    # Скасовано — пацієнт або клінік скасували
    no_show    = "no_show"      # Неявка — пацієнт не прийшов
    completed  = "completed"    # Завершено — прийом відбувся


class QueueStatus(str, enum.Enum):
    """
    Фактичний статус пацієнта у живій черзі (QueueEntry).
    """
    waiting     = "waiting"     # Очікує — пацієнт прийшов, сидить у черзі
    in_progress = "in_progress" # На прийомі — лікар веде прийом
    served      = "served"      # Обслужено — прийом завершено


# ===========================================================================
# МОДЕЛІ
# ===========================================================================

class Doctor(Base):
    """
    Лікар медичного закладу.

    Таблиця: doctors
    """
    __tablename__ = "doctors"

    # --- Первинний ключ ---
    # BigInteger замість Integer — запас для великих БД
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Email та пароль для авторизації
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
        comment="Email лікаря для входу в систему",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Хеш пароля",
    )

    # ПІБ лікаря: довжина 255 символів, NOT NULL
    # (може бути два лікарі з однаковим іменем)
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Повне ім'я лікаря (ПІБ)",
    )

    # Спеціальність: кардіолог, терапевт, стоматолог тощо
    specialty: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,  # Індекс для швидкого пошуку за спеціальністю
        comment="Медична спеціальність лікаря",
    )

    # Опис/біографія (необов'язкове поле)
    bio: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Коротка біографія або опис лікаря",
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Час створення запису",
    )

    # --- Зв'язки (Relationships) ---
    # Один лікар може мати багато записів на прийом
    # cascade="all, delete-orphan" — при видаленні лікаря видаляються і записи
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="doctor",
        cascade="all, delete-orphan",
        lazy="selectin",  # Завантаження через SELECT IN (безпечно для async)
    )

    def __repr__(self) -> str:
        return f"<Doctor id={self.id} name='{self.full_name}' specialty='{self.specialty}'>"


class Patient(Base):
    """
    Пацієнт — клієнт медичного закладу.

    Таблиця: patients
    """
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # --- Поля ---
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Повне ім'я пацієнта (ПІБ)",
    )

    # Телефон: зберігаємо як рядок (з кодом країни, пробілами тощо)
    phone: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        index=True,
        comment="Контактний телефон пацієнта",
    )

    # Email: використовується для входу та нагадувань
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,  # Один email — один акаунт пацієнта
        index=True,
        comment="Email для входу та нагадувань",
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Хеш пароля",
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # --- Зв'язки ---
    # Один пацієнт може мати багато записів (до різних лікарів)
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="patient",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Patient id={self.id} name='{self.full_name}' email='{self.email}'>"


class Appointment(Base):
    """
    Запис на прийом до лікаря.

    Це центральна сутність системи: пов'язує пацієнта та лікаря
    у конкретний часовий слот.

    Таблиця: appointments
    """
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # --- Зовнішні ключі ---
    patient_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID пацієнта",
    )

    doctor_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID лікаря",
    )

    # --- Часові поля ---
    # Запланований час початку прийому (з урахуванням часового поясу)
    scheduled_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # Індекс для вибірки за датою
        comment="Запланований час початку прийому",
    )

    # Запланована тривалість прийому у хвилинах (необов'язково)
    duration_minutes: Mapped[Optional[int]] = mapped_column(
        SmallInteger,
        nullable=True,
        default=30,
        comment="Тривалість прийому у хвилинах (за замовчуванням 30)",
    )

    # --- Статус запису ---
    # Enum зберігається як VARCHAR у PostgreSQL.
    # create_constraint=True — PostgreSQL перевіряє допустимість значень на рівні БД.
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(
            AppointmentStatus,
            name="appointment_status",  # Назва типу в PostgreSQL
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=AppointmentStatus.scheduled,
        server_default=AppointmentStatus.scheduled.value,
        index=True,
        comment="Статус запису: scheduled | cancelled | no_show | completed",
    )

    # Нотатки (причина скасування, коментар лікаря тощо)
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Додаткові нотатки до запису",
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),  # Автоматично оновлюється при кожній зміні
        nullable=False,
    )

    # --- Зв'язки ---
    # Many-to-one: багато записів → один лікар
    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="appointments",
        lazy="selectin",
    )

    # Many-to-one: багато записів → один пацієнт
    patient: Mapped["Patient"] = relationship(
        "Patient",
        back_populates="appointments",
        lazy="selectin",
    )

    # One-to-many: один запис → один або кілька елементів черги
    # (теоретично запис може перенестися і отримати новий QueueEntry)
    queue_entries: Mapped[List["QueueEntry"]] = relationship(
        "QueueEntry",
        back_populates="appointment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Appointment id={self.id} "
            f"patient_id={self.patient_id} "
            f"doctor_id={self.doctor_id} "
            f"scheduled='{self.scheduled_start}' "
            f"status='{self.status}'>"
        )


class QueueEntry(Base):
    """
    Елемент живої черги в день прийому.

    Створюється у момент, коли пацієнт фізично приходить до закладу
    і реєструється на стійці (або через self-check-in кіоск).

    Дозволяє оператору/лікарю відстежувати реальний стан черги в реальному часі.

    Таблиця: queue_entries
    """
    __tablename__ = "queue_entries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # --- Зовнішній ключ ---
    # Прив'язка до конкретного запису на прийом
    appointment_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="ID запису на прийом, до якого відноситься цей елемент черги",
    )

    # --- Часові поля ---
    # Час фізичного прибуття пацієнта (проставляє адміністратор або кіоск)
    arrival_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),  # За замовчуванням — момент реєстрації
        comment="Час реєстрації прибуття пацієнта",
    )

    # Час фактичного початку прийому (встановлюється при переводі в in_progress)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Фактичний час початку прийому лікарем",
    )

    # Час завершення прийому (встановлюється при переводі в served)
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Фактичний час завершення прийому",
    )

    # --- Статус у черзі ---
    queue_status: Mapped[QueueStatus] = mapped_column(
        Enum(
            QueueStatus,
            name="queue_status",
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=QueueStatus.waiting,
        server_default=QueueStatus.waiting.value,
        index=True,
        comment="Статус пацієнта у черзі: waiting | in_progress | served",
    )

    # --- Пріоритет ---
    # Ціле число: менше значення = вищий пріоритет.
    # 0  — екстрений (наприклад, дитина з температурою)
    # 10 — стандартний пріоритет
    # 20 — низький пріоритет (повторний прийом, планова перевірка)
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
        server_default="10",
        index=True,  # Індекс для сортування черги за пріоритетом
        comment="Пріоритет: менше значення = вищий пріоритет (0=екстрений, 10=стандарт)",
    )

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # --- Зв'язки ---
    # Many-to-one: багато записів черги → один Appointment
    appointment: Mapped["Appointment"] = relationship(
        "Appointment",
        back_populates="queue_entries",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<QueueEntry id={self.id} "
            f"appointment_id={self.appointment_id} "
            f"status='{self.queue_status}' "
            f"priority={self.priority}>"
        )

"""
backend/seed.py — Заповнення БД тестовими даними для розробки

Запуск усередині контейнера:
  docker compose exec backend python seed.py

Або напряму:
  python seed.py   (якщо DATABASE_URL встановлений)

Що створюється:
  - 3 лікарі (терапевт, кардіолог, педіатр)
  - 5 пацієнтів
  - Записи на прийом на СЬОГОДНІ до лікаря id=1
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta, timezone

# Переконуємося, що /app у PYTHONPATH (як у контейнері)
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionFactory, create_all_tables
from models import Appointment, AppointmentStatus, Doctor, Patient


# ── Seed data ────────────────────────────────────────────────────────────────

DOCTORS = [
    {
        "full_name": "Іваненко Петро Васильович", 
        "specialty": "Терапевт",   
        "email": "ivanenko@med.com", 
        "password_hash": "password123", # В реальному проекті тут був би хеш
        "bio": "Стаж 15 років. Лікування загальних захворювань, профілактика."
    },
    {
        "full_name": "Коваленко Марина Олексіївна", 
        "specialty": "Кардіолог", 
        "email": "kovalenko@med.com", 
        "password_hash": "password123",
        "bio": "Кандидат медичних наук. Спеціалізація: ішемічна хвороба серця."
    },
    {
        "full_name": "Мельник Сергій Іванович",    
        "specialty": "Педіатр",   
        "email": "melnyk@med.com", 
        "password_hash": "password123",
        "bio": "Дитячий лікар широкого профілю, стаж 10 років."
    },
]

PATIENTS = [
    {"full_name": "Бондаренко Олена Григорівна", "phone": "+380501234567", "email": "bondarenko@example.com", "password_hash": "password123"},
    {"full_name": "Савченко Микола Петрович",     "phone": "+380677654321", "email": "savchenko@example.com", "password_hash": "password123"},
    {"full_name": "Ткаченко Ірина Василівна",     "phone": "+380931112233", "email": "tkachenko@example.com", "password_hash": "password123"},
    {"full_name": "Гриценко Андрій Сергійович",   "phone": "+380664445566", "email": "grytsenko@example.com", "password_hash": "password123"},
    {"full_name": "Кравченко Наталія Миколаївна", "phone": "+380507778899", "email": "kravchenko@example.com", "password_hash": "password123"},
]


async def seed() -> None:
    # 1. Створюємо таблиці, якщо їх немає (не видаляємо існуючі)
    print("Перевірка таблиць...")
    await create_all_tables()

    async with AsyncSessionFactory() as session:
        from sqlalchemy import select
        
        # 2. Лікарі
        print("→ Перевірка та створення лікарів...")
        doctors = []
        for d_data in DOCTORS:
            # Перевіряємо за email
            stmt = select(Doctor).where(Doctor.email == d_data["email"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                doctor = Doctor(**d_data)
                session.add(doctor)
                doctors.append(doctor)
                print(f"   Створено лікаря: {d_data['full_name']}")
            else:
                doctors.append(existing)
                print(f"   Лікар вже існує: {existing.full_name}")

        await session.flush()

        # 3. Пацієнти
        print("→ Перевірка та створення пацієнтів...")
        patients = []
        for p_data in PATIENTS:
            stmt = select(Patient).where(Patient.email == p_data["email"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                patient = Patient(**p_data)
                session.add(patient)
                patients.append(patient)
                print(f"   Створено пацієнта: {p_data['full_name']}")
            else:
                patients.append(existing)
                print(f"   Пацієнт вже існує: {existing.full_name}")

        await session.flush()

        # 4. Записи на прийом на СЬОГОДНІ
        # Робимо їх актуальними: починаємо від поточної хвилини - 30 хвилин, щоб черга виглядала живою
        kyiv_offset = timezone(timedelta(hours=3))
        now = datetime.now(kyiv_offset)
        
        print(f"→ Створення актуальних записів відштовхуючись від поточного часу ({now.strftime('%H:%M')})...")
        doctor = doctors[0] # Перший лікар у списку

        # Очистимо старі записи цього лікаря на сьогодні, щоб не дублювати при кожному запуску
        from sqlalchemy import delete
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        del_stmt = delete(Appointment).where(
            Appointment.doctor_id == doctor.id,
            Appointment.scheduled_start >= today_start,
            Appointment.scheduled_start < today_end
        )
        await session.execute(del_stmt)
        print("   Попередні записи на сьогодні видалено для чистоти тесту.")

        schedule_slots = [
            (-30, patients[0], 25, "Первинний огляд"),      # Закінчився або затримується
            (0,   patients[1], 20, "Консультація"),         # Має початись зараз
            (20,  patients[2], 20, "Результати аналізів"),  # Буде через 20 хв
            (40,  patients[3], 30, "Профілактика"),         # Буде через 40 хв
            (70,  patients[4], 20, "Повторний візит"),      # Буде через 70 хв
        ]

        appointments = []
        base_time = now.replace(second=0, microsecond=0)

        for offset, patient, duration, notes in schedule_slots:
            scheduled_time = base_time + timedelta(minutes=offset)
            appt = Appointment(
                patient_id=patient.id,
                doctor_id=doctor.id,
                scheduled_start=scheduled_time,
                duration_minutes=duration,
                status=AppointmentStatus.scheduled,
                notes=notes,
            )
            session.add(appt)
            appointments.append(appt)

        await session.flush()
        for a in appointments:
            t = a.scheduled_start.strftime("%H:%M")
            print(f"   Запис id={a.id}: {t} — пацієнт id={a.patient_id}")

        # 5. Зберігаємо все
        await session.commit()
        print("\n Дані успішно оновлено!")
        print(f"   Лікарів:   {len(doctors)}")
        print(f"   Пацієнтів: {len(patients)}")
        print(f"   Записів:   {len(appointments)}")
        print("\n Дані для входу (пароль для всіх: password123):")
        print(f"   Адміністратор: admin@med.com (Оберіть роль 'Адмін')")
        print(f"   Лікар:         {doctors[0].email} (Оберіть роль 'Лікар')")
        print(f"   Пацієнт:       {patients[0].email} (Оберіть роль 'Пацієнт')")


if __name__ == "__main__":
    asyncio.run(seed())

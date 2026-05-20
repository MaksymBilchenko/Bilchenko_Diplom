"""
backend/database.py — Налаштування підключення до PostgreSQL

Використовує:
  - SQLAlchemy 2.x asyncio extension
  - asyncpg як async-драйвер PostgreSQL (замість psycopg2)
  - URL підключення зчитується з DATABASE_URL (environment variable Docker)

Схема DATABASE_URL:
  postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DB_NAME
  Приклад:
  postgresql+asyncpg://med_user:password@db:5432/med_queue_db
"""

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

# ---------------------------------------------------------------------------
# URL підключення до PostgreSQL
#
# У docker-compose.yml це значення встановлюється як:
#   DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
#
# ВАЖЛИВО: asyncpg використовує схему `postgresql+asyncpg://`, а НЕ `postgresql://`
# ---------------------------------------------------------------------------
DATABASE_URL: str = os.environ["DATABASE_URL"]

# ---------------------------------------------------------------------------
# Async Engine
#
# create_async_engine — асинхронний двійник звичайного create_engine.
#
# Параметри пулу з'єднань:
#   pool_size         — кількість постійних з'єднань у пулі (за замовчуванням 5)
#   max_overflow      — додаткові з'єднання понад pool_size (за замовчуванням 10)
#   pool_pre_ping     — перевірка живучості з'єднання перед кожним використанням
#   pool_recycle      — час (сек) після якого з'єднання примусово перестворюється
#                       (захист від "stale connections" при довгому простої)
#   echo              — True виводить усі SQL-запити в stdout (тільки для debug!)
# ---------------------------------------------------------------------------
engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=os.getenv("ENVIRONMENT", "development") == "development",
)

# ---------------------------------------------------------------------------
# Async Session Factory
#
# async_sessionmaker — фабрика, яка створює нові AsyncSession-об'єкти.
#
# expire_on_commit=False — після commit() об'єкти не стають "expired"
#   (тобто атрибути доступні без додаткового SELECT).
#   Це критично в async-коді, де ліниве завантаження (lazy load) заборонено.
# ---------------------------------------------------------------------------
AsyncSessionFactory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ---------------------------------------------------------------------------
# Базовий клас для всіх ORM-моделей
#
# DeclarativeBase замінює старий declarative_base() у SQLAlchemy 2.x.
# Усі моделі з models.py успадковуватимуть цей клас.
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Dependency для FastAPI (Dependency Injection)
#
# Використовується як:
#   async def endpoint(db: AsyncSession = Depends(get_db)):
#       ...
#
# Патерн try/finally гарантує закриття сесії навіть при виключенні.
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: повертає async-сесію БД для одного запиту."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Утиліти для lifecycle застосунку
# ---------------------------------------------------------------------------

async def create_all_tables() -> None:
    """
    Створює всі таблиці в БД (якщо не існують).
    Викликати при startup FastAPI. У продакшені — використовуйте Alembic.
    """
    async with engine.begin() as conn:
        # Імпорт тут гарантує, що моделі зареєстровані в Base.metadata
        import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)


async def drop_all_tables() -> None:
    """Видаляє всі таблиці. ОБЕРЕЖНО: видаляє всі дані!"""
    async with engine.begin() as conn:
        import models  # noqa: F401
        await conn.run_sync(Base.metadata.drop_all)


async def dispose_engine() -> None:
    """Закриває пул з'єднань при shutdown FastAPI."""
    await engine.dispose()

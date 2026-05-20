"""
backend/app/main.py — Точка входу FastAPI застосунку med-queue

Конфігурує:
  - Async lifecycle (startup: створення таблиць, shutdown: закриття пулу)
  - CORS middleware (дозволяє запити від Next.js фронтенду)
  - Підключення всіх роутерів
  - Health-check ендпоінти
"""

import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_redoc_html

# Гарантуємо, що Python знаходить модулі у кореневій теці /app (docker mount)
sys.path.insert(0, "/app")

from database import create_all_tables, dispose_engine
from routers.appointments import doctors_router, router as appointments_router
from routers.queue import router as queue_router


# ---------------------------------------------------------------------------
# Lifecycle: startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: автоматично створює таблиці у БД (dev-режим).
    У продакшені замініть на `alembic upgrade head`.
    Shutdown: закриває пул з'єднань asyncpg.
    """
    await create_all_tables()
    yield
    await dispose_engine()


# ---------------------------------------------------------------------------
# Ініціалізація FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Med Queue API",
    description=(
        "REST API для системи управління чергами та записами пацієнтів "
        "у приватних медичних закладах.\n\n"
        "**Основні можливості:**\n"
        "- Запис пацієнтів до лікарів\n"
        "- Розклад лікаря на день\n"
        "- Реєстрація прибуття (check-in)\n"
        "- Жива черга до кабінету в реальному часі"
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None, # Вимикаємо стандартний через бите посилання на CDN
    lifespan=lifespan,
    # Додаємо теги для Swagger UI (порядок відображення)
    openapi_tags=[
        {"name": "Health", "description": "Healthcheck ендпоінти"},
        {"name": "Appointments", "description": "Управління записами на прийом"},
        {"name": "Doctors", "description": "Розклад та інформація про лікарів"},
        {"name": "Queue", "description": "Управління живою чергою"},
    ],
)


# ---------------------------------------------------------------------------
# CORS Middleware
#
# Дозволяє Next.js (запущений на localhost:3000 або в Docker) робити
# крос-доменні запити до FastAPI бекенду.
#
# У продакшені замініть `allow_origins` на конкретні домени:
#   allow_origins=["https://your-production-domain.com"]
# ---------------------------------------------------------------------------
# Дозволяємо стандартні локальні адреси для розробки + ті, що передані в env
_default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://[::1]:3000",
]
_cors_origins_raw = os.getenv("CORS_ORIGINS", "")
if _cors_origins_raw:
    CORS_ORIGINS = [origin.strip() for origin in _cors_origins_raw.split(",")]
    for d in _default_origins:
        if d not in CORS_ORIGINS:
            CORS_ORIGINS.append(d)
else:
    CORS_ORIGINS = _default_origins

print(f"INFO: CORS_ORIGINS allowed: {CORS_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import traceback
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Глобальний обробник помилок.
    Логує traceback у консоль для відлагодження 500 помилок.
    """
    print("=== CRITICAL ERROR TRACEBACK ===")
    traceback.print_exc()
    print("================================")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )

# ---------------------------------------------------------------------------
# Підключення роутерів
# ---------------------------------------------------------------------------
API_PREFIX = "/api/v1"

app.include_router(appointments_router, prefix=API_PREFIX)
app.include_router(doctors_router, prefix=API_PREFIX)
app.include_router(queue_router, prefix=API_PREFIX)


# ---------------------------------------------------------------------------
# Health-check ендпоінти
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"], include_in_schema=False)
async def root():
    """Редірект-підказка для кореневого URL."""
    return JSONResponse({"message": "Med Queue API", "docs": "/docs", "version": "0.1.0"})


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    """Кастомний ReDoc з робочим посиланням на JS бандл."""
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=app.title + " - ReDoc",
        redoc_js_url="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js",
    )


@app.get("/health", tags=["Health"], summary="Healthcheck")
async def health_check():
    """
    Перевірка живучості сервісу.
    Використовується Docker healthcheck та load balancer.
    """
    return {"status": "ok", "service": "med-queue-backend"}

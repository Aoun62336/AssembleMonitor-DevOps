"""
AssembleMonitor FastAPI application entry point.

Startup checklist:
  1. Environment loaded via .env → app/core/config.py
  2. Database engine created    → app/db/session.py
  3. CORS middleware applied    → origins from settings.CORS_ORIGINS
  4. Routers registered         → /api/health + /api/v1/*
  5. Lifespan events hooked     → log start / dispose engine on shutdown
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.session import engine
from app.routers import auth, health, projects, tasks, users, phases, materials, attendance, expenses, site_photos, analytics, admin, notifications

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (replaces @app.on_event which is deprecated in FastAPI 0.111+)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("🚀 %s v%s starting up …", settings.APP_NAME, settings.APP_VERSION)
    logger.info("   Environment : %s", settings.APP_ENV)
    logger.info("   Debug mode  : %s", settings.DEBUG)
    yield
    logger.info("🛑 Shutting down — disposing database engine …")
    await engine.dispose()
    logger.info("✅ Engine disposed. Goodbye.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "AssembleMonitor construction management platform — REST API.\n\n"
            "All protected endpoints require a Bearer JWT token obtained from "
            "`POST /api/v1/auth/login`."
        ),
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ---- CORS ---------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Root / docs redirect -----------------------------------------------
    @app.get("/", include_in_schema=False)
    async def root() -> JSONResponse:
        return JSONResponse(
            {"message": f"Welcome to {settings.APP_NAME}", "docs": "/api/docs"}
        )

    # ---- Routers ------------------------------------------------------------
    # Public health check (no version prefix so monitoring tools can find it)
    app.include_router(health.router, prefix="/api")

    # Versioned API routes
    app.include_router(auth.router, prefix=settings.API_V1_STR)
    app.include_router(users.router, prefix=settings.API_V1_STR)
    app.include_router(projects.router, prefix=settings.API_V1_STR)
    app.include_router(phases.router, prefix=settings.API_V1_STR)
    app.include_router(tasks.router, prefix=settings.API_V1_STR)
    app.include_router(materials.router, prefix=settings.API_V1_STR)
    app.include_router(attendance.router, prefix=settings.API_V1_STR)
    app.include_router(expenses.router, prefix=settings.API_V1_STR)
    app.include_router(site_photos.router, prefix=settings.API_V1_STR)
    app.include_router(analytics.router, prefix=settings.API_V1_STR)
    app.include_router(admin.router, prefix=settings.API_V1_STR)
    app.include_router(notifications.router, prefix=settings.API_V1_STR)

    return app


app: FastAPI = create_app()
# Trigger reload to load SMTP settings from .env


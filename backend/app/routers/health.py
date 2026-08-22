"""
Health-check router.

Endpoints
---------
GET /api/health        Legacy diagnostic endpoint; preserved for backward compatibility
                       with Jenkins/K3s/k6/Terraform user-data references.
GET /api/health/live   Process-level liveness. No database dependency.
                       Kubernetes restarts the container only when this fails.
GET /api/health/ready  Dependency-aware readiness. Returns 503 when PostgreSQL is
                       unreachable. Kubernetes stops routing traffic to the pod.

The internal database probe timeout (3 s) is intentionally set below the
Kubernetes probe timeoutSeconds (5 s) to avoid cascading probe failures.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------


async def _database_available(db: AsyncSession) -> bool:
    """Return True if PostgreSQL responds to SELECT 1 within 3 seconds.

    Raw exceptions are intentionally not propagated to callers — the caller
    receives a simple boolean and decides the HTTP response shape.
    """
    try:
        await asyncio.wait_for(
            db.execute(text("SELECT 1")),
            timeout=3.0,
        )
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Database health probe failed: %s", type(exc).__name__)
        return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/health", summary="Service health check (legacy)")
async def health_check(db: AsyncSession = Depends(get_db)) -> dict:
    """General diagnostic endpoint preserved for backward compatibility.

    - **status**: always ``ok`` if the API process is reachable.
    - **database**: ``connected`` or ``unavailable`` (never raises on DB failure).
    - **version**: application version from settings.

    > Do not use this endpoint for Kubernetes liveness or readiness probes.
    > Use ``/api/health/live`` and ``/api/health/ready`` respectively.
    """
    database_available = await _database_available(db)
    return {
        "status": "ok",
        "database": "connected" if database_available else "unavailable",
        "version": settings.APP_VERSION,
    }


@router.get("/health/live", summary="Liveness check")
async def liveness_check() -> dict:
    """Process-level liveness probe. Has no database dependency.

    Kubernetes uses this endpoint to determine whether to restart the
    container. Returns HTTP 200 as long as the FastAPI process itself
    is running — regardless of downstream dependency state.

    - **status**: always ``alive``.
    - **version**: application version from settings.
    """
    return {
        "status": "alive",
        "version": settings.APP_VERSION,
    }


@router.get("/health/ready", summary="Readiness check")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Dependency-aware readiness probe.

    Kubernetes uses this endpoint to decide whether to route traffic to the
    pod. Returns HTTP 200 when PostgreSQL is reachable; HTTP 503 when it is
    not. The pod is temporarily removed from the load-balancer rotation on
    503 and restored automatically once the database becomes available again.

    - **status**: ``ready`` (200) or ``not_ready`` (503).
    - **database**: ``connected`` or ``unavailable``.
    - **version**: application version from settings.
    """
    if await _database_available(db):
        return {
            "status": "ready",
            "database": "connected",
            "version": settings.APP_VERSION,
        }

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "not_ready",
            "database": "unavailable",
            "version": settings.APP_VERSION,
        },
    )

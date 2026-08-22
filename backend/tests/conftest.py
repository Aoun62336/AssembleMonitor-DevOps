"""
pytest configuration and shared fixtures.

Design decisions
----------------
* Tests run WITHOUT a real PostgreSQL instance — all DB calls are mocked.
  This allows the test suite to run in GitHub Actions and locally without
  any external services.

* The DATABASE_URL environment variable must be set before any app module
  is imported, because session.py creates the SQLAlchemy engine at module
  level using settings.DATABASE_URL. We set a dummy valid DSN here.

* The SECRET_KEY has a safe default in config.py, but we set it explicitly
  to guarantee test isolation regardless of the local .env file.

* FastAPI's TestClient is used (synchronous). It internally manages an
  event loop for async endpoints, so pytest-asyncio is not required.

* Python 3.12 compatibility: opentelemetry-instrumentation==0.46b0 imports
  from `pkg_resources` (part of setuptools). On Python 3.12, pkg_resources
  may not be importable even when setuptools is installed. We inject a
  minimal mock into sys.modules before any opentelemetry import occurs.
  Production uses python:3.11-slim where pkg_resources is always present.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, MagicMock

# ---------------------------------------------------------------------------
# Step 1 — Python 3.12 pkg_resources compatibility shim
# Must be the very first thing in this file — before any opentelemetry import.
# ---------------------------------------------------------------------------
try:
    import pkg_resources  # noqa: F401
except (ImportError, ModuleNotFoundError):
    # Inject a minimal mock that satisfies opentelemetry-instrumentation's
    # `from pkg_resources import (DistributionNotFound, VersionConflict, require)`
    _pkg_mock = MagicMock()
    _pkg_mock.DistributionNotFound = Exception
    _pkg_mock.VersionConflict = Exception
    _pkg_mock.require = MagicMock(return_value=[])
    sys.modules["pkg_resources"] = _pkg_mock

# ---------------------------------------------------------------------------
# Step 2 — Set required environment variables BEFORE importing any app module.
# session.py creates the SQLAlchemy engine at module level, so DATABASE_URL
# must be present when Python first imports app.db.session.
# ---------------------------------------------------------------------------
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://ci_user:ci_pass@localhost:5432/ci_test",
)
os.environ.setdefault(
    "SECRET_KEY",
    "ci-test-secret-key-not-for-production-use-only",
)
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "false")
# Disable OTLP export — BatchSpanProcessor will try to connect to the OTel
# collector endpoint which doesn't exist in CI. OTEL_SDK_DISABLED suppresses it.
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

# ---------------------------------------------------------------------------
# Step 3 — App import (must come AFTER both steps above)
# ---------------------------------------------------------------------------
from app.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402


# ---------------------------------------------------------------------------
# Mock DB factories
# ---------------------------------------------------------------------------

def _make_db_ok() -> object:
    """Return a get_db override where DB queries succeed (but return no rows)."""

    async def _override():
        session = AsyncMock(spec=AsyncSession)
        result = MagicMock()
        # scalar_one_or_none() returns None → triggers "user not found" in auth
        result.scalar_one_or_none.return_value = None
        result.scalars.return_value.all.return_value = []
        session.execute.return_value = result
        yield session

    return _override


def _make_db_down() -> object:
    """Return a get_db override that simulates a DB connection failure."""

    async def _override():
        session = AsyncMock(spec=AsyncSession)
        session.execute.side_effect = OSError("Connection refused")
        yield session

    return _override


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(name="client")
def client_fixture():
    """HTTP TestClient backed by a healthy (but empty) mock database."""
    app.dependency_overrides[get_db] = _make_db_ok()
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="client_db_down")
def client_db_down_fixture():
    """HTTP TestClient that simulates a total database outage."""
    app.dependency_overrides[get_db] = _make_db_down()
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
    app.dependency_overrides.clear()

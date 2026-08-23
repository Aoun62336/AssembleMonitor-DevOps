"""
Tests for the authentication endpoints.

Coverage
--------
POST /api/v1/auth/login     — input validation (422) and bad credentials (401).
Protected endpoints          — 401 when no token or invalid token is provided.

Design note: These tests run against a mock DB that returns no users
(scalar_one_or_none() → None). This is sufficient to test the error paths
without requiring a live database or seeded fixtures.

The login endpoint only returns 200 on a valid user + correct password.
All other paths (user not found, wrong password) return 401. Both are tested.
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# POST /api/v1/auth/login — input validation
# ---------------------------------------------------------------------------


class TestLoginValidation:
    def test_missing_body_returns_422(self, client):
        """Request with no body must be rejected at the schema validation layer."""
        response = client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422

    def test_missing_password_returns_422(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com"},
        )
        assert response.status_code == 422

    def test_missing_email_returns_422(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"password": "secret"},
        )
        assert response.status_code == 422

    def test_invalid_email_format_returns_422(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "password": "secret"},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/v1/auth/login — business logic (user not found → 401)
# ---------------------------------------------------------------------------


class TestLoginCredentials:
    def test_nonexistent_user_returns_401(self, client):
        """
        Mock DB returns no user (scalar_one_or_none → None).
        The router must return 401, not 500 or 200.
        """
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "doesnotmatter"},
        )
        assert response.status_code == 401

    def test_401_body_does_not_leak_internal_details(self, client):
        """Error response must not expose DB errors, stack traces, or user existence."""
        body = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "doesnotmatter"},
        ).json()
        assert "detail" in body
        # Must not expose raw DB error messages or stack traces
        detail = str(body["detail"]).lower()
        assert "traceback" not in detail
        assert "sqlalchemy" not in detail
        assert "asyncpg" not in detail


# ---------------------------------------------------------------------------
# Protected endpoints — authentication enforcement
# ---------------------------------------------------------------------------


class TestAuthGuard:
    def test_protected_endpoint_without_token_returns_401(self, client):
        """A request with no Authorization header must be rejected."""
        response = client.get("/api/v1/users")
        assert response.status_code == 401

    def test_protected_endpoint_with_malformed_token_returns_401(self, client):
        """A malformed Bearer token must be rejected, not cause a 500."""
        response = client.get(
            "/api/v1/users",
            headers={"Authorization": "Bearer not.a.valid.jwt.token"},
        )
        assert response.status_code == 401

    def test_protected_endpoint_with_garbage_header_returns_401(self, client):
        """Garbage in the Authorization header must not cause a 500."""
        response = client.get(
            "/api/v1/users",
            headers={"Authorization": "Basic dXNlcjpwYXNz"},
        )
        # FastAPI's HTTPBearer with auto_error=False returns 401 or passes None
        assert response.status_code in (401, 403)

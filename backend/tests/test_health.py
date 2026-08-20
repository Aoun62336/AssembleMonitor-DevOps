"""
Tests for the three health endpoints.

Coverage
--------
GET /api/health        Legacy diagnostic — always 200, DB status informational only.
GET /api/health/live   Liveness — always 200, NO database dependency.
GET /api/health/ready  Readiness — 200 when DB up, 503 when DB down.

The critical contract being tested is the liveness/readiness separation:
a database outage must NOT make /live return a non-200 status, and
/ready MUST return 503 so Kubernetes removes the pod from rotation.
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# /api/health — legacy endpoint (backward compat)
# ---------------------------------------------------------------------------


class TestLegacyHealth:
    def test_returns_200_when_db_is_up(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_body_has_required_keys(self, client):
        body = client.get("/api/health").json()
        assert "status" in body
        assert "database" in body
        assert "version" in body

    def test_status_is_ok(self, client):
        body = client.get("/api/health").json()
        assert body["status"] == "ok"

    def test_database_connected_when_db_up(self, client):
        body = client.get("/api/health").json()
        assert body["database"] == "connected"

    def test_always_returns_200_even_when_db_is_down(self, client_db_down):
        """Legacy endpoint must preserve backward compat — never return 5xx."""
        response = client_db_down.get("/api/health")
        assert response.status_code == 200

    def test_database_unavailable_when_db_is_down(self, client_db_down):
        body = client_db_down.get("/api/health").json()
        assert body["status"] == "ok"          # HTTP 200 — backward compat
        assert body["database"] == "unavailable"


# ---------------------------------------------------------------------------
# /api/health/live — liveness probe
# ---------------------------------------------------------------------------


class TestLiveness:
    def test_returns_200_when_db_is_up(self, client):
        response = client.get("/api/health/live")
        assert response.status_code == 200

    def test_returns_200_even_when_db_is_down(self, client_db_down):
        """
        THE key liveness contract:
        A database outage MUST NOT restart the FastAPI container.
        Liveness has no database dependency — it only proves the process is alive.
        """
        response = client_db_down.get("/api/health/live")
        assert response.status_code == 200

    def test_status_is_alive(self, client):
        body = client.get("/api/health/live").json()
        assert body["status"] == "alive"

    def test_body_has_version(self, client):
        body = client.get("/api/health/live").json()
        assert "version" in body
        assert body["version"]  # non-empty string


# ---------------------------------------------------------------------------
# /api/health/ready — readiness probe
# ---------------------------------------------------------------------------


class TestReadiness:
    def test_returns_200_when_db_is_up(self, client):
        response = client.get("/api/health/ready")
        assert response.status_code == 200

    def test_status_is_ready_when_db_is_up(self, client):
        body = client.get("/api/health/ready").json()
        assert body["status"] == "ready"
        assert body["database"] == "connected"
        assert "version" in body

    def test_returns_503_when_db_is_down(self, client_db_down):
        """
        THE key readiness contract:
        Kubernetes must stop routing traffic to this pod when the database
        is unavailable. HTTP 503 triggers that pod eviction from load balancer.
        """
        response = client_db_down.get("/api/health/ready")
        assert response.status_code == 503

    def test_body_reflects_db_down_on_503(self, client_db_down):
        body = client_db_down.get("/api/health/ready").json()
        assert body["status"] == "not_ready"
        assert body["database"] == "unavailable"
        assert "version" in body

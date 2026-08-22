# Troubleshooting Diagnostics

> [!NOTE]
> Diagnostic procedures are organized by primary symptom.
> Commands designated `Local` target the Docker Compose environment. Commands designated `Kubernetes` target the EKS cluster environment.

---

## 1. Nginx `502 Bad Gateway`

**Symptom:** HTTP requests to the frontend entrypoint return HTTP 502 Bad Gateway.

**Diagnostic Analysis:** The Nginx reverse proxy is active but fails to establish a TCP connection with the upstream `api` container on port 8000. 

### Diagnostic Procedure

**1.1 Validate API Container State (Local)**

```bash
docker compose ps
```

- If `api` status is `Up`: Proceed to 1.3.
- If `api` is absent or `Exit`: Restart container and validate.
  ```bash
  docker compose start api
  sleep 10
  curl -i http://localhost:3000/api/health
  ```

**1.2 Analyze API Container Telemetry**

```bash
docker compose logs api --tail=30
```

Common failure modes:
- `uvicorn` initialization failure: Validate `DATABASE_URL` and environment variables (`backend/.env`).
- `ModuleNotFoundError`: Execute `docker compose build api` to resolve dependency mismatch.
- `Address already in use`: Execute `docker compose down && docker compose up -d` to resolve port binding conflict.

**1.3 Validate Direct API Reachability**

```bash
curl -i http://localhost:8000/api/health/live
```

- HTTP 200: API is functional. The failure is within Nginx upstream configuration.
- `Connection refused`: API process is bound incorrectly or terminated. Execute `docker compose restart api`.

**1.4 Analyze Nginx Upstream Telemetry**

```bash
docker compose logs frontend --tail=10
```

Review logs for `connect() failed` against the `api` container IP. Docker bridge network DNS desynchronization can be resolved via `docker compose restart`.

---

## 2. Readiness Probe `503 Service Unavailable`

**Symptom:** `/api/health/ready` returns HTTP 503 (`{"status":"not_ready","database":"unavailable"}`).

**Diagnostic Analysis:** The FastAPI application process is healthy (liveness probe passes), but the downstream database dependency check (`SELECT 1`) is failing.

### Diagnostic Procedure

**2.1 Validate Liveness State**

```bash
curl -i http://localhost:8000/api/health/live
```

- HTTP 200: API process is active. Proceed to 2.2.
- Non-200: API process failure. Refer to Section 1.

**2.2 Validate Database Container State (Local)**

```bash
docker compose ps db
```

- Status `Up (healthy)`: Database is active. The failure is network connectivity or DNS. Proceed to 2.3.
- Status `Exit`: Restart container and validate.
  ```bash
  docker compose start db
  sleep 15
  curl -i http://localhost:8000/api/health/ready
  ```

**2.3 Validate Connection String Configuration**

```bash
docker compose exec api env | grep DATABASE_URL
```

Expected output format: `postgresql+asyncpg://assembleuser:assemblepass@db:5432/assemblemonitor`

If the hostname component is modified (e.g., via fault injection override), execute a clean recreation:
```bash
docker compose up -d --force-recreate api
sleep 15
```

**2.4 Analyze Database Initialization Telemetry**

```bash
docker compose logs db --tail=20
```

Verify presence of `database system is ready to accept connections`. If absent, initialization is pending.

---

## 3. Kubernetes Pod `CrashLoopBackOff`

**Symptom:** Kubernetes workload resources enter `CrashLoopBackOff` status.

### Diagnostic Procedure

**3.1 Isolate Failing Workload**

```bash
kubectl get pods -n assemblemonitor
```

Identify the target pod name, `RESTARTS` count, and `STATUS`.

**3.2 Inspect Kubernetes Event Log**

```bash
kubectl describe pod <pod-name> -n assemblemonitor
```

Evaluate:
- `Last State`: Exit code `1` indicates application failure; exit code `137` indicates OOMKilled (Out of Memory).
- `Events`: Image pull failures, probe execution failures, or scheduling constraints.

**3.3 Analyze Current Container Telemetry**

```bash
kubectl logs <pod-name> -n assemblemonitor
```

**3.4 Analyze Previous Container Telemetry (Pre-Crash)**

```bash
kubectl logs <pod-name> -n assemblemonitor --previous
```

Captures stdout/stderr from the terminated container instance prior to the restart loop.

**3.5 Validate Secret and ConfigMap Mounts**

```bash
# Validate Secret structure
kubectl get secret assemblemonitor-secrets -n assemblemonitor -o jsonpath='{.data}' | jq 'keys'

# Validate ConfigMap structure
kubectl get configmap assemblemonitor-config -n assemblemonitor -o yaml
```

**3.6 Evaluate Resource Consumption**

```bash
kubectl top pods -n assemblemonitor
```

If memory consumption approaches the defined limit, adjust `resources.limits.memory` in `values/app.yaml`.

---

## 4. Command Reference

### Local Environment (Docker Compose)

| Diagnostic Objective | Command |
|---|---|
| Container state verification | `docker compose ps` |
| Continuous telemetry stream | `docker compose logs -f` |
| Component restart | `docker compose restart <service>` |
| Component rebuild | `docker compose up -d --build <service>` |
| Clean recreation | `docker compose up -d --force-recreate` |

### Production Environment (Kubernetes)

| Diagnostic Objective | Command |
|---|---|
| Pod status and restart count | `kubectl get pods -n assemblemonitor` |
| Pod event and state inspection | `kubectl describe pod <pod> -n assemblemonitor` |
| Continuous telemetry stream | `kubectl logs -f <pod> -n assemblemonitor` |
| Pre-crash telemetry retrieval | `kubectl logs <pod> -n assemblemonitor --previous` |
| Autoscaling state verification | `kubectl get hpa -n assemblemonitor` |
| Disruption budget verification | `kubectl get pdb -n assemblemonitor` |

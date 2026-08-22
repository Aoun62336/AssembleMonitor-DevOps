# Reliability & CI Hardening: Verification Procedures

> **Execution Context:** Run the following validation commands in a Bash shell from the repository root on the `hardening/reliability-ci` branch.

---

## 1. Health Endpoint Separation (M1)

**Objective:** Validate the implementation of distinct liveness and readiness probes.

```bash
grep -n "health/live\|health/ready" backend/app/routers/health.py
grep "health/live" backend/Dockerfile
grep -A3 "livenessProbe\|readinessProbe" k8s/helm-chart/values/app.yaml
```

**Success Criteria:** Commands return matches for `/api/health/live` and `/api/health/ready` configuration paths.

---

## 2. Test Suite Validation (M2)

**Objective:** Verify backend test coverage execution.

```bash
cd backend
python -m pytest tests/ -v
cd ..
```

**Success Criteria:** Standard output reports 23 successful tests.

---

## 3. CI Pipeline Validation (M3)

**Objective:** Verify GitHub Actions pipeline matrix execution.

```bash
grep "name:" .github/workflows/pr-validation.yml
grep "concurrency" .github/workflows/pr-validation.yml
```

**Success Criteria:** Output confirms 4 parallel job definitions (Backend, Frontend, Terraform, Helm). Remote pipeline execution status must report `[VERIFIED]` on all checks.

---

## 4. Helm Dependency Lock (M4)

**Objective:** Validate deterministic Helm builds via dependency locking.

```bash
cat k8s/helm-chart/Chart.lock
grep "helm-chart/charts" .gitignore
git ls-files k8s/helm-chart/charts/
```

**Success Criteria:**
- `Chart.lock` contains locked versions for `loki`, `tempo`, `kube-state-metrics`, and `opentelemetry-collector`.
- `git ls-files` returns empty (vendor directory is correctly ignored).

---

## 5. Kubernetes Hardening Render (M5)

**Objective:** Verify conditional rendering of PodDisruptionBudget and NetworkPolicy objects.

```bash
# Validate PDB rendering
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  | grep -A 10 "kind: PodDisruptionBudget"

# Validate NetworkPolicy is disabled by default (Expected exit code 1)
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  | grep "kind: NetworkPolicy" || true

# Validate NetworkPolicy renders when explicitly enabled
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  -f k8s/helm-chart/values/hardening-validation.yaml \
  | grep -A 3 "kind: NetworkPolicy"
```

**Success Criteria:**
- Two distinct `PodDisruptionBudget` manifests render.
- Zero `NetworkPolicy` manifests render in default configuration.
- Two `NetworkPolicy` manifests render with validation flags applied.

---

## 6. Infrastructure as Code Validation (M6)

**Objective:** Verify native Terraform module test execution.

```bash
terraform -chdir=terraform/modules/network init -backend=false
terraform -chdir=terraform/modules/network test
```

**Success Criteria:** Standard output reports `Success! 5 passed, 0 failed.`

---

## 7. Dashboard-as-Code Configuration (M7)

**Objective:** Validate Grafana dashboard JSON schema integrity.

```bash
python -c "
import json
with open('k8s/helm-chart/dashboards/application-overview.json') as f:
    d = json.load(f)
print('Title:', d['title'])
print('UID:', d['uid'])
print('Panels:', len(d['panels']))
"
```

**Success Criteria:** JSON payload successfully parses and confirms 10 active panel definitions.

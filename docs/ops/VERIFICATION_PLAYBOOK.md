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

**Success Criteria:** Output confirms 5 parallel job definitions (backend-test, frontend-build, terraform-validate, helm-validate, secret-scan). Remote pipeline execution status must report all 5 checks green.

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

---

## 8. Runtime PDB Validation (M9)

**Objective:** Prove that `kubectl drain` respects the Helm-rendered PodDisruptionBudget against the k3d/K3s test workloads. Run every command from the repository root.

### Step 1 — Create the cluster with labeled agent nodes

```bash
k3d cluster create assemblemonitor-hardening \
  --agents 2 \
  --k3s-node-label "workload=hardening@agent:0,1"
```

### Step 2 — Deploy the Helm-rendered policies and test workloads

```bash
# Render and apply NetworkPolicy + PDB into the hardening-test namespace
helm upgrade --install assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  -f k8s/helm-chart/values/hardening-validation.yaml

# Deploy the smoke workloads (nodeSelector ensures they land on labeled agents)
kubectl apply -f k8s/validation/hardening-smoke.yaml

# Wait for backend pods to be Running and Ready
kubectl rollout status deployment/hardening-backend \
  -n assemblemonitor-hardening-test --timeout=120s
```

### Step 3 — Identify the node hosting PDB-selected backend pods

```bash
# Find which agent node is running hardening-backend pods
PDB_NODE=$(kubectl get pods \
  -n assemblemonitor-hardening-test \
  -l app=assemblemonitor-backend \
  -o jsonpath='{.items[0].spec.nodeName}')

echo "Drain target: $PDB_NODE"
```

### Step 4 — Observe PDB state before drain

```bash
kubectl get pdb -n assemblemonitor-hardening-test
```

Expected: `ALLOWED DISRUPTIONS: 1` (maxUnavailable:1 with 2 replicas both Ready).

### Step 5 — Drain the target node

```bash
kubectl drain "$PDB_NODE" \
  --ignore-daemonsets \
  --delete-emptydir-data \
  --grace-period=5 \
  --timeout=120s
```

Expected: Drain output shows eviction retrying while PDB budget is exhausted, then completing once a replacement pod is ready on the second agent node.

### Step 6 — Verify pods rescheduled on surviving node

```bash
kubectl get pods -n assemblemonitor-hardening-test -o wide
kubectl get pdb -n assemblemonitor-hardening-test
```

Expected: All backend pods Running on the non-drained node; `ALLOWED DISRUPTIONS: 1` restored.

### Step 7 — Screenshot and clean up

Capture the terminal output showing the drain log and final pod/PDB state as `hardening-pdb-k3d.png`.

```bash
k3d cluster delete assemblemonitor-hardening
```

**Success Criteria:** `kubectl drain` logs show eviction retries while PDB budget was exhausted. All backend pods rescheduled on the surviving agent. `ALLOWED DISRUPTIONS` restored after replacement pod became Ready.

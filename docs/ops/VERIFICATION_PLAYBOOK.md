# AssembleMonitor — Hardening Verification Playbook

> Run these commands in **Git Bash from the repo root** unless specified.
> All commands assume you are on `hardening/reliability-ci` branch.

---

## Milestone 1 — Health Endpoint Separation

**What was done:** Split into `/api/health/live` (liveness) and `/api/health/ready` (readiness).

```bash
grep -n "health/live\|health/ready" backend/app/routers/health.py
grep "health/live" backend/Dockerfile
grep -A3 "livenessProbe\|readinessProbe" k8s/helm-chart/values/app.yaml
```

**Expected:** Lines showing `/api/health/live` and `/api/health/ready` in each file.

---

## Milestone 2 — pytest Test Suite (23 tests)

**What was done:** 23 tests covering health and auth, Python 3.12 mock shim.

```bash
cd backend
python -m pytest tests/ -v
cd ..
ls backend/tests/
cat backend/pytest.ini
```

**Expected:** `23 passed, 17 warnings in X.XXs`

---

## Milestone 3 — GitHub Actions CI (4 parallel jobs)

**What was done:** `.github/workflows/pr-validation.yml` with Backend, Frontend, Terraform, Helm jobs.

```bash
grep "name:" .github/workflows/pr-validation.yml
grep "concurrency" .github/workflows/pr-validation.yml
# Then open in browser to see green checks:
# https://github.com/Aoun62336/AssembleMonitor-DevOps/actions
```

**Expected:** All 4 jobs green in GitHub Actions.

---

## Milestone 4 — Helm Dependency Locking

**What was done:** `Chart.lock` pins exact dependency versions; `charts/` is gitignored.

```bash
cat k8s/helm-chart/Chart.lock
grep "version:" k8s/helm-chart/Chart.yaml
grep "helm-chart/charts" .gitignore
git ls-files k8s/helm-chart/charts/
ls k8s/helm-chart/charts/
```

**Expected:**
- Chart.lock with loki 6.29.0, tempo 1.8.0, kube-state-metrics 5.15.2, opentelemetry-collector 0.114.0
- `git ls-files ...` returns nothing (not tracked)
- `ls charts/` shows 4 `.tgz` files

---

## Milestone 5 — PDB + NetworkPolicy Templates

**What was done:** PDB active in production; NetworkPolicy disabled by default, enabled via values override.

```bash
# 2 PDB blocks must render
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  | grep -A 10 "kind: PodDisruptionBudget"

# No NetworkPolicy in production (exit code 1 from grep is CORRECT/EXPECTED)
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  | grep "kind: NetworkPolicy"

# 2 NetworkPolicy blocks in hardening render
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  -f k8s/helm-chart/values/hardening-validation.yaml \
  | grep -A 3 "kind: NetworkPolicy"

# Full lint — must pass
helm lint k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  -f k8s/helm-chart/values/hardening-validation.yaml
```

**Expected:**
- Two PDB blocks: `assemblemonitor-backend-pdb`, `assemblemonitor-frontend-pdb`
- NetworkPolicy: no output in production, two blocks in hardening render
- Lint: `1 chart(s) linted, 0 chart(s) failed`

> **Important:** `grep` returning exit code 1 (no output) = NetworkPolicy is correctly ABSENT in production. That is the correct behavior — it is NOT an error.

---

## Milestone 6 — Jenkinsfile Hardening

**What was done:** `options{}` block, `DOCKER_BUILDKIT=1`, pytest stage added, image cleanup.

```bash
grep -A 6 "options {" Jenkinsfile-gitops
grep "DOCKER_BUILDKIT" Jenkinsfile-gitops
grep -A 10 "Backend Unit Tests" Jenkinsfile-gitops
grep "assemblemonitor-backend-check" Jenkinsfile-gitops
grep "stage('" Jenkinsfile-gitops | wc -l
```

**Expected:**
- `options {}` block with 4 directives (buildDiscarder, timestamps, disableConcurrentBuilds, timeout)
- `DOCKER_BUILDKIT = '1'`
- `Backend Unit Tests` stage with `docker run --user root ... pytest`
- `docker image rm -f assemblemonitor-backend-check:${IMAGE_TAG}` cleanup
- 14 stages total

---

## Milestone 7 — Terraform Reusable Network Module + terraform test

**What was done:** `terraform/modules/network/` with 5 unit tests using `mock_provider`.

```bash
ls -la terraform/modules/network/
ls -la terraform/modules/network/tests/
grep "^run " terraform/modules/network/tests/network_unit.tftest.hcl
grep "for_each" terraform/modules/network/main.tf
grep -A 4 "validation" terraform/modules/network/variables.tf
grep "terraform test" .github/workflows/pr-validation.yml
```

**Expected:**
- 5 files in the module: `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `tests/`
- 5 `run "..."` blocks in the test file
- `for_each = var.private_subnet_cidr_map` (subnets created dynamically)
- `length(var.private_subnet_cidr_map) >= 1` validation rule
- `terraform test` step in CI workflow

---

## Milestone 8 — Grafana Dashboard-as-Code

**What was done:** 10-panel application overview dashboard JSON stored in Git, loaded via Helm.

```bash
# Verify JSON is valid and has 10 panels
python -c "
import json
with open('k8s/helm-chart/dashboards/application-overview.json') as f:
    d = json.load(f)
print('Title:', d['title'])
print('UID:', d['uid'])
print('Panels:', len(d['panels']))
print('Tags:', d['tags'])
"

# Verify it is referenced in the Grafana template
grep "application-overview" k8s/helm-chart/templates/grafana.yaml

# Verify it renders into the Helm ConfigMap
helm template assemblemonitor k8s/helm-chart \
  -f k8s/helm-chart/values/app.yaml \
  -f k8s/helm-chart/values/observability.yaml \
  | grep "application-overview.json"

# View dashboard LIVE in Grafana (Docker)
docker run -d --name grafana-local -p 3000:3000 grafana/grafana:10.4.2
# Wait 10 seconds, then open: http://localhost:3000 (admin / admin)
# Dashboards → New → Import → Upload JSON file:
#   k8s/helm-chart/dashboards/application-overview.json
# Cleanup when done:
docker stop grafana-local && docker rm grafana-local
```

**Expected:**
- Title: `AssembleMonitor — Application Overview`
- UID: `assemblemonitor-overview`
- Panels: `10`
- Tags: `['assemblemonitor', 'application', 'fastapi', 'opentelemetry']`

---

## Global Check — Git Log (all milestones in one view)

```bash
git log --oneline main..hardening/reliability-ci
```

**Expected commit list (newest → oldest):**
```
5b6eb25 feat(grafana): add application overview dashboard as code
97e3071 feat(terraform): add reusable network module with terraform test suite
7dc321a fix(ci): register helm repos before dependency build
08fb205 ci(jenkins): add options block, pytest stage, and image cleanup
6f6c44d feat(k8s): add PDB and NetworkPolicy Helm templates
5d2246f build(helm): lock chart dependencies reproducibly
de3856b ci: add GitHub Actions pull request validation
...      test(backend): add pytest health and auth test suite
...      feat(health): add separate liveness and readiness endpoints
```

---

## Interview Answer Template

Use this for every milestone in an interview:

> *"I implemented [X] because [problem]. The solution was [Y].
> I verified it by running [Z command] and seeing [expected output].
> In production, this prevents [specific failure scenario]."*

| Milestone | Problem solved | Verification command |
|---|---|---|
| M1: Health Probes | K8s restarts healthy pods that can't find DB | `grep health/live backend/Dockerfile` |
| M2: pytest | Broken auth ships to prod undetected | `python -m pytest tests/ -v` |
| M3: GitHub Actions | No gate on broken PRs | GitHub Actions tab showing all ✅ |
| M4: Helm Lock | Different chart version per environment | `cat k8s/helm-chart/Chart.lock` |
| M5: PDB | Rolling deploy kills all replicas at once | `helm template ... | grep PodDisruptionBudget` |
| M6: Jenkins | Builds hang, no tests before image push | `grep "Backend Unit Tests" Jenkinsfile-gitops` |
| M7: TF Module | VPC code duplicated, no tests | `grep "^run " .../network_unit.tftest.hcl` |
| M8: Grafana | Dashboard lost when Grafana restarts | `python -c "import json; ..."` |

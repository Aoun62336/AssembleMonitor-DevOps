# Hardening Evidence Asset Catalog

**Reference Document:** [`docs/hardening/SYSTEM_RELIABILITY_REPORT.md`](../../../hardening/SYSTEM_RELIABILITY_REPORT.md)

| Asset File | Format | Associated Milestone | Technical Demonstration |
|---|---|---|---|
| `hardening-github-actions-pr-green.png` | PNG | M3: CI Pipeline | Five GitHub Actions jobs passing on the hardening branch: backend-test, frontend-build, terraform-validate, helm-validate, secret-scan. |
| `hardening-terraform-test.png` | PNG | M6: Infrastructure as Code | Successful execution of 5 native Terraform unit tests. |
| `hardening-networkpolicy-k3d.png` | PNG | M9: k3d Validation | Backend ingress isolation runtime-verified in k3d: frontend → backend allowed; untrusted → backend blocked. |
| `hardening-pdb-k3d.1.jpg` | JPG | M9: k3d Validation | Pre-drain PDB state and PDB-selected workload placement across the disposable k3d agent nodes. |
| `hardening-pdb-k3d.2.jpg` | JPG | M9: k3d Validation | Voluntary node-drain execution against a node hosting PDB-selected workloads, with eviction/rescheduling and post-drain PDB state. |
| `hardening-otel-local.png` | PNG | M13: Observability | OpenTelemetry Collector ingesting OTLP traces from local FastAPI container via the OTLP receiver pipeline. |
| `hardening-health-readiness-recovery.jpg` | JPG | M12: Fault Injection | INC-001 recovery telemetry: Liveness probe maintains 200 OK while Readiness probe fails (503) during database outage. |
| `hardening-main-ruleset.png` | PNG | M16: Branch Ruleset | Active main-branch ruleset settings showing 5 required status checks configured. |

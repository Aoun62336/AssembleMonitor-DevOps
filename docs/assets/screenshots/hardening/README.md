# Hardening Evidence Asset Catalog

**Reference Document:** [`docs/hardening/SYSTEM_RELIABILITY_REPORT.md`](../../../hardening/SYSTEM_RELIABILITY_REPORT.md)

| Asset File | Format | Associated Milestone | Technical Demonstration |
|---|---|---|---|
| `hardening-github-actions-pr-green.png` | PNG | M3: CI Pipeline | Five GitHub Actions jobs passing on the hardening branch: backend-test, frontend-build, terraform-validate, helm-validate, secret-scan. |
| `hardening-terraform-test.png` | PNG | M6: Infrastructure as Code | Successful execution of 5 native Terraform unit tests. |
| `hardening-networkpolicy-k3d.png` | PNG | M9: k3d Validation | Ingress/egress isolation verified in k3d: frontend → backend traffic allowed; untrusted pod traffic timed out. |
| `hardening-pdb-k3d.png` | PNG | M9: k3d Validation | kubectl drain targeting a k3d agent node hosting PDB-selected pods; Eviction API respecting maxUnavailable: 1. |
| `hardening-otel-local.png` | PNG | M13: Observability | OpenTelemetry Collector ingesting OTLP traces from local FastAPI container via the OTLP receiver pipeline. |
| `hardening-health-readiness-recovery.jpg` | JPG | M12: Fault Injection | INC-001 recovery telemetry: Liveness probe maintains 200 OK while Readiness probe fails (503) during database outage. |
| `hardening-main-ruleset.png` | PNG | M16: Branch Ruleset | Active main-branch ruleset settings showing 5 required status checks configured. |

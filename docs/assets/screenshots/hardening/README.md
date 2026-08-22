# Hardening Evidence Asset Catalog

**Reference Document:** [`docs/hardening/SYSTEM_RELIABILITY_REPORT.md`](../../hardening/SYSTEM_RELIABILITY_REPORT.md)

| Asset File | Format | Associated Milestone | Technical Demonstration |
|---|---|---|---|
| `hardening-github-actions-pr-green.png` | PNG | M3: CI Pipeline | Execution of 4 required static analysis and build jobs on the hardening branch. |
| `hardening-terraform-test.png` | PNG | M6: Infrastructure as Code | Successful execution of 5 native Terraform unit tests. |
| `hardening-networkpolicy-k3d.png` | PNG | M9: k3d Validation | Enforcement of default-deny egress; verified allowed routing (`frontend` → `backend`). |
| `hardening-pdb-k3d.png` | PNG | M9: k3d Validation | Node drain interruption prevented by PodDisruptionBudget parameter `maxUnavailable: 1`. |
| `hardening-otel-local.png` | PNG | M13: Observability | OpenTelemetry collector ingress traces from local container environment. |
| `hardening-health-readiness-recovery.jpg` | JPG | M12: Fault Injection | INC-001 recovery telemetry: Liveness probe maintains 200 OK while Readiness probe fails (503) during database outage. |

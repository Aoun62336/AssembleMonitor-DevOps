# AssembleMonitor — Performance Tests

This directory contains [k6](https://k6.io/) load test scripts for validating HPA autoscaling behavior and baseline response times under load.

## Test Scripts

| Script | Endpoint | VUs | Duration |
|---|---|---|---|
| `health-test.js` | `GET /api/health` | 5 | 30s |
| `frontend-test.js` | `GET /` | 5 | 30s |
| `login-test.js` | `POST /api/auth/login` | 3 | 30s |

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed locally
- A running deployment with a reachable ALB DNS name or local URL

## Running Tests

```bash
# Health endpoint
k6 run -e BASE_URL=http://<ALB_DNS_NAME> performance-tests/health-test.js

# Frontend
k6 run -e BASE_URL=http://<ALB_DNS_NAME> performance-tests/frontend-test.js

# Login (Auth + DB read)
k6 run -e BASE_URL=http://<ALB_DNS_NAME> \
  -e LOGIN_EMAIL=admin@example.com \
  -e LOGIN_PASSWORD=your_password \
  performance-tests/login-test.js
```

## What to Watch During Tests

```bash
# Monitor HPA scaling decisions
kubectl get hpa -n assemblemonitor -w

# Monitor pod count changes
kubectl get pods -n assemblemonitor -w
```

## Key Metrics

- `http_req_duration` — total request round-trip time
- `http_req_failed` — percentage of failed requests
- `checks` — pass/fail rate on defined thresholds
- `p95` — 95th percentile response time

> Tests are run manually post-deployment. They are not currently integrated into the Jenkins CI/CD pipeline.

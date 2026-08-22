# Performance Testing Suite

This directory contains [k6](https://k6.io/) load testing scripts designed to validate Horizontal Pod Autoscaler (HPA) behavior and measure baseline API response times under load.

## Test Matrix

| Script | Target Endpoint | Virtual Users (VUs) | Duration |
|---|---|---|---|
| `health-test.js` | `GET /api/health` | 5 | 30s |
| `frontend-test.js` | `GET /` | 5 | 30s |
| `login-test.js` | `POST /api/auth/login` | 3 | 30s |

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) binary installed on the execution host.
- A functional deployment accessible via an ALB DNS endpoint or local host URL.

## Execution Procedure

```bash
# Health endpoint validation
k6 run -e BASE_URL=http://<ALB_DNS_NAME> performance-tests/health-test.js

# Frontend index validation
k6 run -e BASE_URL=http://<ALB_DNS_NAME> performance-tests/frontend-test.js

# Authentication flow validation (Auth + DB read)
k6 run -e BASE_URL=http://<ALB_DNS_NAME> \
  -e LOGIN_EMAIL=admin@example.com \
  -e LOGIN_PASSWORD=your_password \
  performance-tests/login-test.js
```

## Infrastructure Telemetry

To correlate load generation with auto-scaling events, execute the following monitoring commands concurrently:

```bash
# Monitor HPA scaling threshold evaluations
kubectl get hpa -n assemblemonitor -w

# Monitor pod provisioning and termination events
kubectl get pods -n assemblemonitor -w
```

## Key Metrics Interpretation

- `http_req_duration`: End-to-end request latency
- `http_req_failed`: Error rate percentage
- `checks`: Success rate against predefined thresholds
- `p95`: 95th percentile response latency

> [!NOTE]
> Tests are executed manually post-deployment. Automated execution within the Jenkins CI/CD pipeline is not currently implemented.

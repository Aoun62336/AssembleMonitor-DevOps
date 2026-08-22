# AssembleMonitor — Frontend

[![React](https://img.shields.io/badge/React-18-%2361DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-%23646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React Router](https://img.shields.io/badge/React_Router-v6-%23CA4245?style=flat-square&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Nginx](https://img.shields.io/badge/Nginx-alpine-%23009639?style=flat-square&logo=nginx&logoColor=white)](https://nginx.org/)

React single-page application for the AssembleMonitor platform. Compiled via Vite and served by Nginx within a Docker container. Production deployment operates within Amazon EKS behind an AWS Application Load Balancer via NodePort 30080.

---

## Technology Stack

| Component | Technology | Version |
|---|---|---|
| UI Framework | React | 18.3 |
| Build System | Vite | 5.4 |
| Routing | React Router DOM | 6.30 |
| Styling | Vanilla CSS | — |
| Web Server | Nginx | alpine |

---

## Directory Structure

```text
frontend/
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx                        # Public landing page
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx                   # Authentication entry
│   │   │   ├── ForgotPasswordPage.jsx          # Password reset initiation
│   │   │   └── ResetPasswordPage.jsx           # Password reset confirmation
│   │   └── dashboard/
│   │       └── DashboardRoutePage.jsx          # Role-based routing controller
│   ├── components/
│   │   ├── common/
│   │   │   └── ToastProvider.jsx               # Global notification context
│   │   ├── dashboard/
│   │   │   └── LegacyPageContent.jsx           # Core dashboard layout
│   │   └── layout/                             # Shared structural components
│   ├── data/                                   # Static constants
│   ├── styles/                                 # Global and component CSS
│   ├── App.jsx                                 # Root application router
│   └── main.jsx                                # React DOM initialization
├── public/                                     # Static assets
├── Dockerfile                                  # Multi-stage container definition
├── nginx.conf                                  # Reverse proxy configuration
├── vite.config.js                              # Build configuration
├── tsconfig.json                               # TypeScript compiler configuration
└── package.json                                # Dependency manifests
```

---

## Role-Based Access Control (RBAC) Routing

The application enforces access controls at the routing layer. Authenticated users are directed to role-specific dashboard views:

| Role | Route Pattern | Functional Scope |
|---|---|---|
| Admin | `/admin` and `/admin/:slug` | System administration, analytics, cross-project visibility |
| Project Manager | `/pm` and `/pm/:slug` | Project planning, phase management, task allocation, budgeting |
| Site Engineer | `/se` and `/se/:slug` | Labor attendance, task progression, material consumption, image ingestion |
| Client | `/client` and `/client/:slug` | Read-only project monitoring |

Unauthenticated or unauthorized route access redirects to the root path (`/`).

---

## Local Development Execution

### Prerequisites

- Node.js (≥ 20)
- Local backend API initialization (reference [`../backend/README.md`](../backend/README.md))

### Initialization

```bash
cd frontend
npm install
npm run dev
```

The Vite development server binds to **http://localhost:5173**.

### Production Compilation

```bash
npm run build        # Outputs artifacts to dist/
npm run preview      # Executes local preview of production build
```

---

## Containerization

### Standalone Container Execution

```bash
cd frontend
docker build -t assemblemonitor-frontend .
docker run -p 3000:80 assemblemonitor-frontend
```

Application binds to **http://localhost:3000**.

### Docker Compose Stack

Initialize the complete application stack from the repository root:

```bash
docker compose up --build -d
```

| Service | Local Endpoint |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/docs |
| Adminer (Database UI) | http://localhost:8080 |

---

## Multi-Stage Dockerfile Architecture

The frontend utilizes a multi-stage container build to minimize the runtime attack surface:

```text
Stage 1 (Compilation): node:20-alpine
    - Executes `npm install` and `npm run build`
    - Artifacts output to `/app/dist`

Stage 2 (Runtime): nginx:alpine
    - Ingests `dist/` into `/usr/share/nginx/html`
    - Applies `nginx.conf` to `/etc/nginx/conf.d/default.conf`
    - Exposes port 80
```

The runtime image contains exclusively the compiled static assets and the Nginx web server; Node.js runtimes and source code are excluded.

---

## Nginx Proxy Configuration

Nginx executes routing and reverse proxy functions for the application:

- Serves static artifacts from `/usr/share/nginx/html`.
- Implements `index.html` fallback for React Router client-side path resolution.
- Proxies `/api/` ingress to the backend service. (In production, this routes to the Kubernetes ClusterIP service).

---

## Kubernetes Deployment Topology (EKS)

Within the Amazon EKS environment, the frontend container is provisioned via Helm chart:

| Resource | Implementation Detail |
|---|---|
| **Deployment** | `k8s/helm-chart/templates/frontend-deployment.yaml` |
| **Service** | NodePort (`30080`) — target group binding for AWS ALB |
| **HPA** | Minimum 2 replicas, scales to 5 replicas at 70% CPU threshold |
| **Image Tag** | `fire2686/assemblemonitor-frontend:<BUILD_NUMBER>` (Updated via GitOps) |
| **Probes** | Readiness: `GET /` (10s delay). Liveness: `GET /` (30s delay) |
| **Resources** | Requests: 50m CPU / 128Mi. Limits: 300m CPU / 512Mi |

Ingress flow:
```text
Internet → AWS WAF → AWS ALB → EKS NodePort (30080) → Frontend Pod (Nginx:80)
```

---

## Interface Previews

Asset registry for UI components:

| Asset Reference | Scope |
|---|---|
| _app-landing-page.png_ | Public landing interface |
| _app-login-page.png_ | Authentication portal |
| _app-admin-dashboard.png_ | Administrator telemetry |
| _app-project-manager-dashboard.png_ | Project Manager planning interface |
| _app-site-engineer-dashboard.png_ | Site Engineer operational interface |
| _app-client-dashboard.png_ | Client read-only interface |
| _app-photo-gallery-s3.png_ | S3-backed image gallery |

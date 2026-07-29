# AssembleMonitor — Frontend

[![React](https://img.shields.io/badge/React-18-%2361DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-%23646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React Router](https://img.shields.io/badge/React_Router-v6-%23CA4245?style=flat-square&logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Nginx](https://img.shields.io/badge/Nginx-alpine-%23009639?style=flat-square&logo=nginx&logoColor=white)](https://nginx.org/)

React single-page application for the AssembleMonitor construction management platform. Built with Vite and served by Nginx inside a Docker container. In production, the container runs inside Amazon EKS behind an AWS ALB, exposed on NodePort 30080.

---

## Tech Stack

| Layer                   | Technology       | Version |
| ----------------------- | ---------------- | ------- |
| UI library              | React            | 18.3    |
| Build tool              | Vite             | 5.4     |
| Routing                 | React Router DOM | 6.30    |
| Styling                 | Vanilla CSS      | —       |
| Web server (production) | Nginx            | alpine  |

---

## Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── HomePage.jsx                        # Public landing page
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx                   # Login form
│   │   │   ├── ForgotPasswordPage.jsx          # Password reset request
│   │   │   └── ResetPasswordPage.jsx           # Password reset confirmation
│   │   └── dashboard/
│   │       └── DashboardRoutePage.jsx          # Role-based dashboard router
│   ├── components/
│   │   ├── common/
│   │   │   └── ToastProvider.jsx               # Global toast notification context
│   │   ├── dashboard/
│   │   │   └── LegacyPageContent.jsx           # Main dashboard content component
│   │   └── layout/                             # Shared layout components
│   ├── data/                                   # Static data / constants
│   ├── styles/                                 # Global and component CSS
│   ├── App.jsx                                 # Root router configuration
│   └── main.jsx                                # React DOM entry point
├── public/                                     # Static assets
├── Dockerfile                                  # Node 20 build → Nginx alpine runtime
├── nginx.conf                                  # Nginx server configuration
├── vite.config.js                              # Vite build configuration
├── tsconfig.json
└── package.json
```

---

## RBAC Routes

The application enforces role-based routing at the URL level. After login, users are directed to their role-specific dashboard:

| Role            | Route                         | Description                                                 |
| --------------- | ----------------------------- | ----------------------------------------------------------- |
| Admin           | `/admin` and `/admin/:slug`   | Full system — user management, analytics, all projects      |
| Project Manager | `/pm` and `/pm/:slug`         | Project planning, phases, tasks, budgets                    |
| Site Engineer   | `/se` and `/se/:slug`         | Attendance, task updates, material consumption, site photos |
| Client          | `/client` and `/client/:slug` | Read-only project visibility                                |

Unauthenticated or unmatched routes redirect to the landing page (`/`).

---

## Local Development

### Prerequisites

- Node.js 20+
- The backend API running locally (see [`../backend/README.md`](../backend/README.md))

### Install and run

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server (with hot-module replacement)
npm run dev
```

The development server starts at **http://localhost:5173** by default.

### Build for production

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

---

## Docker

### Build and run the container

```bash
cd frontend

# Build the image
docker build -t assemblemonitor-frontend .

# Run the container
docker run -p 3000:80 assemblemonitor-frontend
```

Access at **http://localhost:3000**.

### Docker Compose (full stack)

Run from the repository root to start the complete local stack:

```bash
# From repository root
docker compose up --build -d
```

| Service          | URL                            |
| ---------------- | ------------------------------ |
| Frontend         | http://localhost:3000          |
| Backend API      | http://localhost:8000/api/docs |
| Adminer (DB GUI) | http://localhost:8080          |

---

## Dockerfile

The frontend uses a **two-stage build**:

```
Stage 1 (build):  node:20-alpine
    - npm install
    - npm run build
    - Output: /app/dist (compiled static assets)

Stage 2 (runtime):  nginx:alpine
    - Copies dist/ to /usr/share/nginx/html
    - Copies nginx.conf to /etc/nginx/conf.d/default.conf
    - EXPOSE 80
    - CMD: nginx -g "daemon off;"
```

The final image contains only Nginx and the compiled static files — no Node.js, no source code, no development dependencies.

---

## Nginx Configuration

Nginx handles all routing for the React SPA. The `nginx.conf` is configured to:

- Serve static assets from `/usr/share/nginx/html`
- Fall back to `index.html` for all unmatched paths (required for React Router client-side routing)
- Forward `/api/` requests to the backend service (in production, this is handled by the Kubernetes ClusterIP service)

---

## Kubernetes Deployment (EKS GitOps Path)

In the EKS environment, the frontend container is managed by the Helm chart:

| Resource       | Detail                                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| **Deployment** | `k8s/helm-chart/templates/frontend-deployment.yaml`                                     |
| **Service**    | NodePort on port `30080` — bound to the AWS ALB target group                            |
| **HPA**        | 2 minimum replicas, scales to 5 at 70% CPU                                              |
| **Image**      | `fire2686/assemblemonitor-frontend:<BUILD_NUMBER>` — updated by Jenkins GitOps pipeline |
| **Probes**     | Readiness: `GET /` (10s delay, 10s period) — Liveness: `GET /` (30s delay, 20s period)  |
| **Resources**  | Requests: 50m CPU / 128Mi — Limits: 300m CPU / 512Mi                                    |

Traffic flow:

```
Internet → AWS WAF → Application Load Balancer → EKS NodePort 30080 → Frontend Pod (Nginx:80)
                                                                            ↓
                                                          Backend ClusterIP (FastAPI:8000)
```

---

## Kubernetes Deployment (K3s Path)

On the K3s cluster, the frontend is deployed using raw Kubernetes manifests:

```bash
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

The service type is `NodePort` on port `30080`.

Access: `http://<K3S_PUBLIC_IP>:30080`

---

## Screenshots

> Add frontend screenshots to `../docs/screenshots/` and update the links below.

| Screenshot                            | Description                               |
| ------------------------------------- | ----------------------------------------- |
| _(app-landing-page.png)_              | Public landing page                       |
| _(app-login-page.png)_                | Login screen                              |
| _(app-admin-dashboard.png)_           | Admin KPIs and project management         |
| _(app-project-manager-dashboard.png)_ | PM — project planning and task assignment |
| _(app-site-engineer-dashboard.png)_   | SE — attendance, updates, photo uploads   |
| _(app-client-dashboard.png)_          | Client read-only view                     |
| _(app-photo-gallery-s3.png)_          | Site photos stored and served from S3     |

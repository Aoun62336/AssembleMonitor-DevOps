# AssembleMonitor: Application Overview

This document describes the application domain model, role model, status lifecycles, calculated fields, and database-enforced business rules implemented in AssembleMonitor.

For infrastructure and DevOps details, see [DEVOPS_IMPLEMENTATION.md](DEVOPS_IMPLEMENTATION.md).

---

## Domain Model

The application is organized around a hierarchy of five primary entities: Project, Phase, Task, Material, and Expense. Supporting entities include User, Attendance, SitePhoto, and Notification.

### Entity Hierarchy

```
Project
├── Phase (ordered by order_index)
│   ├── Task (assigned to a site engineer)
│   └── MaterialUsage (consumption linked to this phase)
├── Material
│   ├── MaterialStock  (received inventory records)
│   └── MaterialUsage  (consumption records per phase or task)
├── Expense (project-level or phase-level)
├── Attendance (per user per project, with check-in/out times)
└── SitePhoto (uploaded to Amazon S3)
```

### Entity Reference

| Entity | Table | Purpose |
|--------|-------|---------|
| `User` | `users` | Platform user with one of four roles |
| `Project` | `projects` | Top-level construction project with budget and dates |
| `ProjectAssignment` | `project_assignments` | Links a user to a project with a role designation |
| `Phase` | `phases` | Ordered logical division of a project |
| `Task` | `tasks` | Unit of work within a phase, assigned to a site engineer |
| `Material` | `materials` | Catalogue entry for a material type used on a project |
| `MaterialStock` | `material_stock` | Inventory receipt: quantity received, date, and supplier |
| `MaterialUsage` | `material_usage` | Consumption record: quantity used, phase, and task reference |
| `Expense` | `expenses` | Financial expense with approval workflow |
| `Attendance` | `attendance` | Site check-in and check-out record with optional GPS coordinates |
| `SitePhoto` | `site_photos` | Photo uploaded from site, stored in Amazon S3 |
| `Notification` | `notifications` | In-app notification record per user |

All primary keys are UUIDs. All entities include `created_at` and `updated_at` timestamps via a shared `TimestampMixin`.

---

## Role Model

Four roles are enforced at both the database level (via `CheckConstraint` on `users.role`) and the API level (via `require_role` dependency guards on each router).

| Role | Description |
|------|-------------|
| `admin` | Full platform access: all projects, all users, and all analytics |
| `project_manager` | Assigned projects: phase and task management, expense approval, analytics |
| `site_engineer` | Assigned projects: task updates, attendance, material usage, site photos |
| `client` | Assigned projects: read-only status, progress, and budget views |

Users are linked to projects through the `ProjectAssignment` join table. A user can be assigned to a project only once (enforced by `UniqueConstraint`). Admins bypass assignment checks and have unrestricted access to all resources.

---

## Status Lifecycles

### Project status
Valid values: `planning`, `active`, `on_hold`, `completed`, `cancelled`

### Phase status
Valid values: `not_started`, `in_progress`, `on_hold`, `completed`

Phases are ordered within a project using `order_index` (non-negative integer, enforced by `CheckConstraint`).

### Task status
Valid values: `not_started`, `in_progress`, `completed`, `blocked`

### Task priority
Valid values: `low`, `medium`, `high`, `critical`

### Expense status
Valid values: `pending`, `approved`, `rejected`

Expenses default to `pending` on creation. Only Project Managers and Admins can approve or reject them.

### Expense categories
`Labour Payment`, `Equipment Rental`, `Transportation`, `Materials`, `Miscellaneous`, `Office Supplies`, `Site Utilities`

---

## Calculated Fields

These fields are derived from stored data at query time. None are persisted columns; all are recomputed on each request.

### `progress_pct` — Project level

Source: `routers/analytics.py`

```python
progress_pct = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
```

Counts all tasks across all phases of the project. A project with no tasks reports `0.0`. The value is rounded to two decimal places before being returned.

### `is_delayed` — Task level

Source: `models/task.py` (`@property`)

```python
# For tasks not yet completed:
is_delayed = date.today() > due_date

# For completed tasks:
is_delayed = completed_date > due_date
```

A task with no `due_date` set is never flagged as delayed. A completed task is delayed if it was finished after its due date, even if it is no longer overdue today.

### `budget_used_pct` — Project level

Source: `routers/analytics.py`

```python
total_spent = sum(non_rejected_expenses) + sum(material_unit_cost * quantity_used)
budget_used_pct = (total_spent / budget * 100) if budget > 0 else 0.0
```

Rejected expenses are excluded from the calculation. Material cost is computed per material as `unit_cost * total_used`. Projects with no budget set return `0.0`. The value is rounded to two decimal places.

### `is_low_stock` — Material level

Source: `models/material.py` (`@property`)

```python
remaining_stock = total_received - total_used
threshold = max(total_required_qty * 0.10, 5.0)
is_low_stock = remaining_stock < threshold
```

Materials without a `total_required_qty` are never flagged as low stock. The 5-unit minimum prevents false positives for projects with very small material quantities. Stock levels are derived from `MaterialStock` (received) and `MaterialUsage` (consumed) records.

---

## Database-Enforced Business Rules

The following constraints are enforced at the database level and cannot be bypassed by the application layer.

| Rule | Mechanism |
|------|-----------|
| User role restricted to four valid values | `CheckConstraint` on `users.role` |
| Project status restricted to five valid values | `CheckConstraint` on `projects.status` |
| Project `end_date` must be on or after `start_date` | `CheckConstraint` on `projects` |
| Phase status restricted to four valid values | `CheckConstraint` on `phases.status` |
| Phase `order_index` must be non-negative | `CheckConstraint` on `phases.order_index` |
| Phase `end_date` must be on or after `start_date` | `CheckConstraint` on `phases` |
| Task status restricted to four valid values | `CheckConstraint` on `tasks.status` |
| Task priority restricted to four valid values | `CheckConstraint` on `tasks.priority` |
| Task `due_date` must be on or after `start_date` | `CheckConstraint` on `tasks` |
| Material stock quantity must be non-negative | `CheckConstraint` on `material_stock.quantity` |
| Material usage quantity must be greater than zero | `CheckConstraint` on `material_usage.quantity_used` |
| Expense amount must be greater than zero | `CheckConstraint` on `expenses.amount` |
| Expense category restricted to seven valid values | `CheckConstraint` on `expenses.category` |
| Expense status restricted to three valid values | `CheckConstraint` on `expenses.status` |
| A user can be assigned to a project only once | `UniqueConstraint` on `project_assignments(project_id, user_id)` |
| Deleting a project cascades to phases, tasks, materials, and expenses | `ondelete="CASCADE"` on all child FK references |
| Deleting a user sets `manager_id` to NULL on the project | `ondelete="SET NULL"` on `projects.manager_id` |
| Deleting a user sets `assigned_to` to NULL on tasks | `ondelete="SET NULL"` on `tasks.assigned_to` |

---

## Analytics Endpoints

All analytics endpoints are implemented in `routers/analytics.py`. Access is scoped by role and project assignment; non-admin users only receive data for projects they are assigned to.

| Endpoint | Roles | Returns |
|----------|-------|---------|
| `GET /analytics/overview` | All | Per-project summary: `progress_pct`, task counts by status, delayed count, `budget_used_pct` |
| `GET /analytics/gantt` | All | All phases and tasks with dates, status, and `is_delayed` flag |
| `GET /analytics/budget` | PM, Admin, Client | Budget breakdown: expenses, material costs, total spent, remaining, `budget_used_pct` |
| `GET /analytics/materials` | All | Material counts, `low_stock_items` count, total material cost |
| `GET /analytics/attendance-summary` | All | Total check-ins and total hours logged for the project |
| `GET /analytics/admin-overview` | Admin only | Platform-wide totals: users, projects, active projects, total budget, total spend |
| `GET /analytics/recent-activity` | All | Time-sorted activity feed: task updates, material changes, project events, user registrations (Admin only) |

---

## Role Dashboards

Each role has a dedicated dashboard in the frontend. The routing logic in `DashboardRoutePage.jsx` directs users to the appropriate view on login based on their role.

### Admin Dashboard

Displays platform-wide totals (users, projects, active projects, total spend), a recent activity feed, and access to user management.

![Admin Dashboard](assets/screenshots/app-admin-dashboard.png)

### Project Manager Dashboard

Displays assigned projects with progress bars, budget consumption percentage, delayed task count, and access to Gantt charts, expense management, and material tracking.

![Project Manager Dashboard](assets/screenshots/app-project-manager-dashboard.png)

### Site Engineer Dashboard

Displays assigned tasks with priority and status indicators, attendance check-in and check-out controls, and material usage recording.

![Site Engineer Dashboard](assets/screenshots/app-site-engineer-dashboard.png)

### Client Dashboard

Displays read-only project status cards with progress percentage and budget summary.

![Client Dashboard](assets/screenshots/app-client-dashboard.png)

### Application Landing Page

![Landing Page](assets/screenshots/app-landing-page.png)

---

## API Reference

The backend exposes a full OpenAPI specification at `/api/docs` when running locally. All routes are served under the `/api` prefix.

Authentication uses JWT bearer tokens. Tokens are issued at `POST /api/auth/token` with `username` (email) and `password` form fields. The token must be passed as a `Bearer` header on all protected routes.

![FastAPI Swagger UI](assets/screenshots/app-fastapi-swagger.png)

Evidence: `backend/app/routers/` · `backend/app/models/` · `backend/app/schemas/`

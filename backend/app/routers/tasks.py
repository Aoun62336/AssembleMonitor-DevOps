from typing import List, Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_role
from app.models.task import Task
from app.models.phase import Phase
from app.models.project import ProjectAssignment
from app.models.user import User
from app.schemas.tasks import TaskCreate, TaskUpdate, TaskResponse
from app.utils.logic import recalculate_phase_status
from app.utils.notifications import create_notification

router = APIRouter(prefix="/tasks", tags=["Tasks"])
 
@router.get("", response_model=List[TaskResponse])
async def list_all_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all tasks accessible to the user."""
    from sqlalchemy import or_
    
    if current_user.role == "admin":
        result = await db.execute(select(Task).options(selectinload(Task.phase), selectinload(Task.assignee)))
    elif current_user.role == "project_manager":
        query = (
            select(Task)
            .options(selectinload(Task.phase), selectinload(Task.assignee))
            .join(Phase, Task.phase_id == Phase.id)
            .join(ProjectAssignment, Phase.project_id == ProjectAssignment.project_id)
            .where(ProjectAssignment.user_id == current_user.id)
        )
        result = await db.execute(query)
    else:
        # Site engineers only see their assigned tasks
        query = (
            select(Task)
            .options(selectinload(Task.phase), selectinload(Task.assignee))
            .where(Task.assigned_to == current_user.id)
        )
        result = await db.execute(query)
    
    return list(result.scalars().all())


@router.get("/assigned", response_model=List[TaskResponse])
async def list_assigned_tasks(
    project_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return all tasks assigned to the current user (SE/PM/Admin). Optional project filter."""
    query = select(Task).options(selectinload(Task.phase), selectinload(Task.assignee))
    
    if current_user.role != "admin":
        query = query.where(Task.assigned_to == current_user.id)
    
    if project_id:
        query = query.join(Task.phase).where(Phase.project_id == project_id)
        
    result = await db.execute(query)
    return list(result.scalars().all())


async def _verify_task_access(db: AsyncSession, phase_id: UUID, user: User):
    if user.role == "admin":
        return
        
    phase_res = await db.execute(select(Phase).where(Phase.id == phase_id))
    phase = phase_res.scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

    result = await db.execute(
        select(ProjectAssignment)
        .where(ProjectAssignment.project_id == phase.project_id, ProjectAssignment.user_id == user.id)
    )
    if not result.scalars().first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this project.")

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("project_manager", "admin"))
):
    """Create a new task (PM/Admin only)."""
    try:
        # TEMP DEBUG: Log the received payload
        print(f"[DEBUG-CREATE] Received payload: name={task_in.name!r}, description={task_in.description!r}, priority={task_in.priority!r}")
        # Fetch phase to check dates
        phase_res = await db.execute(select(Phase).where(Phase.id == task_in.phase_id))
        phase = phase_res.scalar_one_or_none()
        if not phase:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Phase not found")

        # Date Validation: Task must be within Phase dates
        if task_in.start_date and phase.start_date and task_in.start_date < phase.start_date:
            raise HTTPException(status_code=400, detail="Task dates must be within phase duration")
        if task_in.due_date and phase.end_date and task_in.due_date > phase.end_date:
            raise HTTPException(status_code=400, detail="Task dates must be within phase duration")

        if task_in.start_date and task_in.due_date and task_in.start_date > task_in.due_date:
            raise HTTPException(status_code=400, detail="Task start date cannot be after due date")

        await _verify_task_access(db, task_in.phase_id, current_user)

        # Check for overlaps
        if task_in.assigned_to and task_in.start_date:
            existing_task = await db.execute(
                select(Task).where(
                    Task.assigned_to == task_in.assigned_to,
                    Task.start_date == task_in.start_date
                )
            )
            if existing_task.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Engineer already assigned to another task on selected date"
                )

        # Create Task - Explicitly set fields to ensure nothing is missed
        task = Task(
            name=task_in.name,
            description=task_in.description,
            priority=task_in.priority.lower() if task_in.priority else "medium",
            phase_id=task_in.phase_id,
            assigned_to=task_in.assigned_to,
            start_date=task_in.start_date,
            due_date=task_in.due_date,
            status="not_started"
        )
        
        db.add(task)
        await db.commit()
        await db.refresh(task)
        
        task_id = task.id
        phase_id = task.phase_id

        # Recalculate phase/project status
        await recalculate_phase_status(db, phase_id)
        
        # Refetch with relations for response
        result = await db.execute(
            select(Task).options(
                selectinload(Task.phase), 
                selectinload(Task.assignee)
            ).where(Task.id == task_id)
        )
        task = result.scalars().first()
        
        if not task:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Task not found after creation")
        
        task_response = TaskResponse.model_validate(task)

        # Notify SE
        if task.assigned_to:
            await create_notification(
                db,
                user_id=task.assigned_to,
                title="New Task Assigned",
                message=f"Task '{task.name}' has been assigned to you in Phase '{task.phase.name}'",
                notification_type="info",
                link="/se/index.html"
            )

        return task_response

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        err_msg = f"Error in create_task: {str(e)}\n{traceback.format_exc()}"
        with open("error_log.txt", "a") as f:
            f.write(f"\n--- {date.today()} ---\n{err_msg}\n")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/phase/{phase_id}", response_model=List[TaskResponse])
async def list_tasks(
    phase_id: UUID,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List tasks for a phase with optional filters."""
    await _verify_task_access(db, phase_id, current_user)

    query = select(Task).options(selectinload(Task.phase), selectinload(Task.assignee)).where(Task.phase_id == phase_id)
    
    if current_user.role == "site_engineer":
        query = query.where(Task.assigned_to == current_user.id)
        
    if status:
        query = query.where(Task.status == status)
    if priority:
        query = query.where(Task.priority == priority)
    if assigned_to:
        query = query.where(Task.assigned_to == assigned_to)
    query = query.order_by(Task.created_at)

    result = await db.execute(query)
    return list(result.scalars().all())

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get details for a specific task."""
    result = await db.execute(
        select(Task).options(selectinload(Task.phase), selectinload(Task.assignee)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    await _verify_task_access(db, task.phase_id, current_user)
    return task

@router.patch("/{task_id}", response_model=TaskResponse)
@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("site_engineer", "project_manager", "admin"))
):
    """Update a task (SE/PM/Admin only). Handles auto-dates."""
    result = await db.execute(
        select(Task).options(selectinload(Task.phase), selectinload(Task.assignee)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await _verify_task_access(db, task.phase_id, current_user)

    update_data = task_in.model_dump(exclude_unset=True)
    
    # Store old values for notification logic
    old_status = task.status
    old_assigned_to = task.assigned_to
    
    for field, value in update_data.items():
        setattr(task, field, value)
        
    # Auto-date logic based on status changes
    if "status" in update_data and old_status != task.status:
        if task.status == "in_progress" and not task.start_date:
            task.start_date = date.today()
        elif task.status == "completed":
            task.completed_date = date.today()

    await db.commit()
    await db.refresh(task)

    # 1. Trigger Notifications for Status Changes
    if "status" in update_data and old_status != task.status:
        # Notify Assigned User (if update was by someone else)
        if task.assigned_to and task.assigned_to != current_user.id:
            await create_notification(
                db,
                user_id=task.assigned_to,
                title="Task Status Updated",
                message=f"Status for '{task.name}' has been changed to {task.status.replace('_', ' ')}",
                notification_type="info",
                link="/se/my-tasks.html"
            )
        
        # If completed, notify PM/Admins
        if task.status == "completed":
            # Fetch phase to get project_id
            phase_res = await db.execute(select(Phase).where(Phase.id == task.phase_id))
            phase = phase_res.scalar_one_or_none()
            if phase:
                # Notify PM of project
                proj_res = await db.execute(
                    select(User.id).join(ProjectAssignment, User.id == ProjectAssignment.user_id)
                    .where(ProjectAssignment.project_id == phase.project_id, User.role == "project_manager")
                )
                pms = proj_res.scalars().all()
                for pm_id in pms:
                    if pm_id != current_user.id:
                        await create_notification(
                            db,
                            user_id=pm_id,
                            title="Task Completed",
                            message=f"Task '{task.name}' in Phase '{phase.name}' has been marked COMPLETED",
                            notification_type="success",
                            link="/pm/task-management.html"
                        )
                
                # Notify Admins
                admin_res = await db.execute(select(User.id).where(User.role == "admin"))
                for admin_id in admin_res.scalars().all():
                    if admin_id != current_user.id:
                        await create_notification(
                            db,
                            user_id=admin_id,
                            title="Task Completed",
                            message=f"Task '{task.name}' in Phase '{phase.name}' completed.",
                            notification_type="info",
                            link="/admin/gantt.html"
                        )

    # 2. Trigger Notifications for Reassignment
    if "assigned_to" in update_data and old_assigned_to != task.assigned_to:
        if task.assigned_to:
            await create_notification(
                db,
                user_id=task.assigned_to,
                title="Task Reassigned",
                message=f"Task '{task.name}' has been assigned to you.",
                notification_type="info",
                link="/se/my-tasks.html"
            )

    task_id_cache = task.id
    phase_id_cache = task.phase_id

    if "status" in update_data and old_status != task.status:
        await recalculate_phase_status(db, phase_id_cache)
        # Refetch with phase for response
    result = await db.execute(
        select(Task).options(selectinload(Task.phase), selectinload(Task.assignee)).where(Task.id == task_id_cache)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found after update")
    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("project_manager", "admin"))
):
    """Delete a task (PM/Admin only)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await _verify_task_access(db, task.phase_id, current_user)

    phase_id = task.phase_id
    await db.delete(task)
    await db.commit()
    
    # Recalculate phase status after deletion
    await recalculate_phase_status(db, phase_id)
    return None

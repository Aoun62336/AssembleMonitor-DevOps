from typing import List, Optional, Sequence, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.dependencies import get_db, get_current_user, require_role
from app.models.site_photo import SitePhoto
from app.models.project import Project, ProjectAssignment
from app.models.user import User
from app.schemas.site_photos import SitePhotoResponse
from app.utils.s3 import upload_file_to_s3, delete_file_from_s3, generate_presigned_url
from app.core.config import settings

router = APIRouter(prefix="/site-photos", tags=["Site Photos"])


async def _verify_project_access(db: AsyncSession, project_id: Union[UUID, str], user: User):
    if user.role == "admin":
        return
    if isinstance(project_id, str):
        try:
            project_id = UUID(project_id)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project ID format")
    if user.role == "site_engineer":
        from app.models.task import Task
        from app.models.phase import Phase
        # For site engineers, access is granted only if they have an assigned task in this project
        task_check = await db.execute(
            select(Task.id)
            .join(Phase, Task.phase_id == Phase.id)
            .where(Phase.project_id == project_id, Task.assigned_to == user.id)
            .limit(1)
        )
        if not task_check.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No assigned tasks in this project.")
    else:
        result = await db.execute(
            select(ProjectAssignment)
            .where(ProjectAssignment.project_id == project_id, ProjectAssignment.user_id == user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not assigned to this project.")


def _attach_presigned_urls(photos: Sequence[SitePhoto]) -> List[SitePhotoResponse]:
    """Replace stored S3 URLs with fresh presigned URLs so the browser can load images.
    
    S3 buckets block public access by default. Presigned URLs include a temporary
    signature that grants access for 1 hour without making the bucket public.
    """
    result = []
    for photo in photos:
        response = SitePhotoResponse.model_validate(photo)
        if response.file_url:
            response.file_url = generate_presigned_url(response.file_url, expiry_seconds=3600)
        result.append(response)
    return result


@router.post("/upload", response_model=SitePhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_site_photo(
    project_id: UUID = Form(...),
    phase_id: Optional[UUID] = Form(None),
    task_id: Optional[UUID] = Form(None),
    category: str = Form("general"),
    caption: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a site photo to AWS S3 and save metadata in DB."""
    await _verify_project_access(db, project_id, current_user)

    # Fetch project to get its name for S3 folder
    project_result = await db.execute(select(Project).where(Project.id == project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    import re
    safe_project_name = re.sub(r'[^a-zA-Z0-9_-]', '_', project.name).lower()
    folder_prefix = f"{safe_project_name}"

    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG and PNG are allowed."
        )

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    await file.seek(0)

    try:
        file_url = await upload_file_to_s3(file, folder_prefix=folder_prefix)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    site_photo = SitePhoto(
        project_id=project_id,
        phase_id=phase_id,
        task_id=task_id,
        uploaded_by=current_user.id,
        file_url=file_url,
        caption=caption,
        category=category,
        file_size_bytes=len(file_bytes),
        mime_type=file.content_type
    )

    db.add(site_photo)
    await db.commit()

    # Re-fetch with user relationship to populate uploaded_by_name property
    result = await db.execute(
        select(SitePhoto)
        .options(joinedload(SitePhoto.uploaded_by_user))
        .where(SitePhoto.id == site_photo.id)
    )
    photo = result.scalar_one()

    # Return with presigned URL so the frontend can display the image immediately
    response = SitePhotoResponse.model_validate(photo)
    response.file_url = generate_presigned_url(photo.file_url, expiry_seconds=3600)
    return response


@router.get("/project/{project_id}", response_model=List[SitePhotoResponse])
async def list_site_photos(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List site photos for a project, with presigned S3 URLs."""
    await _verify_project_access(db, project_id, current_user)

    result = await db.execute(
        select(SitePhoto)
        .options(joinedload(SitePhoto.uploaded_by_user))
        .where(SitePhoto.project_id == project_id)
        .order_by(SitePhoto.created_at.desc())
    )
    photos = result.scalars().all()
    return _attach_presigned_urls(photos)


@router.get("", response_model=List[SitePhotoResponse])
async def list_all_site_photos(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List site photos. Admin sees all; PM/SE see only their assigned projects."""
    query = (
        select(SitePhoto)
        .options(joinedload(SitePhoto.uploaded_by_user))
        .order_by(SitePhoto.created_at.desc())
    )

    if current_user.role == "site_engineer":
        from app.models.task import Task
        from app.models.phase import Phase
        subq = (
            select(Phase.project_id)
            .join(Task, Task.phase_id == Phase.id)
            .where(Task.assigned_to == current_user.id)
        )
        query = query.where(SitePhoto.project_id.in_(subq))
    elif current_user.role != "admin":
        query = (
            query
            .join(ProjectAssignment, SitePhoto.project_id == ProjectAssignment.project_id)
            .where(ProjectAssignment.user_id == current_user.id)
        )

    query = query.limit(limit)
    result = await db.execute(query)
    photos = result.scalars().all()
    return _attach_presigned_urls(photos)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_site_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("project_manager", "admin"))
):
    """Delete a site photo (PM/Admin only). Removes from S3 and DB."""
    result = await db.execute(select(SitePhoto).where(SitePhoto.id == photo_id))
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    await _verify_project_access(db, photo.project_id, current_user)

    try:
        delete_file_from_s3(photo.file_url)
    except Exception as e:
        print(f"S3 Deletion failed (non-critical): {e}")

    await db.delete(photo)
    await db.commit()
    return None

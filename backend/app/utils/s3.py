import boto3
import uuid
import logging
from botocore.exceptions import ClientError
from fastapi import UploadFile
from app.core.config import settings

logger = logging.getLogger(__name__)

from typing import Any

def get_s3_client() -> Any:
    if not settings.AWS_ACCESS_KEY_ID:
        logger.warning("AWS credentials not configured properly.")
    
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION
    )
    
    """return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )"""

async def upload_file_to_s3(file: UploadFile, folder_prefix: str = "site-photos") -> str:
    """Upload file to S3 and return the full S3 URL.
    
    We store just the key so we can generate fresh presigned URLs on each request.
    This avoids issues with public access blocks on S3 buckets.
    """
    s3_client = get_s3_client()
    
    # Generate unique filename/key
    filename = file.filename if file.filename else "upload.jpg"
    file_extension = filename.split('.')[-1].lower()
    unique_key = f"{folder_prefix}/{uuid.uuid4()}.{file_extension}"
    
    try:
        s3_client.upload_fileobj(
            file.file,
            settings.S3_BUCKET_NAME,
            unique_key,
            ExtraArgs={'ContentType': file.content_type}
        )
        # Return the full S3 URL — presigned URL generation happens at read time
        return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{unique_key}"
    except ClientError as e:
        logger.error(f"S3 Upload Error: {e}")
        raise Exception(f"Failed to upload file to S3: {e}")


def generate_presigned_url(file_url: str, expiry_seconds: int = 3600) -> str:
    """Generate a presigned URL from an S3 object URL.
    
    This allows private S3 buckets to serve images in the browser without 
    making the bucket public. The URL expires after `expiry_seconds` (default 1 hour).
    """
    if not file_url:
        return file_url
    
    # If it's already a presigned URL or not an S3 URL, return as-is
    if 'X-Amz-Signature' in file_url or not 'amazonaws.com' in file_url:
        return file_url
    
    try:
        s3_client = get_s3_client()
        # Extract the S3 key from the URL
        # URL format: https://bucket.s3.region.amazonaws.com/key
        # or: https://s3.region.amazonaws.com/bucket/key
        if f"{settings.S3_BUCKET_NAME}.s3." in file_url:
            # Virtual-hosted style: bucket.s3.region.amazonaws.com/key
            key = file_url.split(f"{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/")[-1]
        elif f"s3.{settings.AWS_REGION}.amazonaws.com/{settings.S3_BUCKET_NAME}/" in file_url:
            # Path-style: s3.region.amazonaws.com/bucket/key
            key = file_url.split(f"s3.{settings.AWS_REGION}.amazonaws.com/{settings.S3_BUCKET_NAME}/")[-1]
        else:
            # Fallback: take the last path component (legacy uploads without folder prefix)
            key = file_url.split('amazonaws.com/')[-1]
        
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.S3_BUCKET_NAME, 'Key': key},
            ExpiresIn=expiry_seconds
        )
        return presigned_url
    except Exception as e:
        logger.error(f"Failed to generate presigned URL for {file_url}: {e}")
        return file_url  # Fall back to original URL


def delete_file_from_s3(file_url: str):
    if not file_url:
        return
    s3_client = get_s3_client()
    try:
        # Extract key from URL (handle both with and without folder prefix)
        if f"{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/" in file_url:
            key = file_url.split(f"{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/")[-1]
        else:
            key = file_url.split('/')[-1]
        s3_client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    except ClientError as e:
        logger.error(f"S3 Delete Error: {e}")
        raise Exception("Failed to delete file from S3")

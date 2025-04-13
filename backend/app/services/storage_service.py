import os
import shutil
from datetime import datetime
from typing import BinaryIO, Optional, Dict, Any
from fastapi import UploadFile
from uuid import uuid4
import mimetypes
from abc import ABC, abstractmethod
import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

class StorageService(ABC):
    """Abstract base class for file storage services"""
    
    @abstractmethod
    async def upload_file(self, file: UploadFile, folder: str = None) -> Dict[str, Any]:
        """Upload a file to storage and return metadata"""
        pass
    
    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        """Delete a file from storage"""
        pass
    
    @abstractmethod
    async def get_file(self, file_path: str) -> Optional[BinaryIO]:
        """Get a file from storage"""
        pass

class LocalStorageService(StorageService):
    """Implementation of StorageService using local filesystem"""
    
    def __init__(self, root_path: str):
        self.root_path = root_path
        os.makedirs(root_path, exist_ok=True)
    
    async def upload_file(self, file: UploadFile, folder: str = None) -> Dict[str, Any]:
        """Upload a file to local storage"""
        # Generate a unique filename to avoid collisions
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid4())[:8]
        filename = f"{timestamp}_{unique_id}_{file.filename}"
        
        # Determine the storage directory
        upload_dir = self.root_path
        if folder:
            upload_dir = os.path.join(upload_dir, folder)
            os.makedirs(upload_dir, exist_ok=True)
        
        # Get the file path
        file_path = os.path.join(upload_dir, filename)
        relative_path = os.path.relpath(file_path, self.root_path)
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size and type
        file_size = os.path.getsize(file_path)
        file_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        
        # Return metadata
        return {
            "filename": filename,
            "original_filename": file.filename,
            "file_path": relative_path,
            "file_size": file_size,
            "file_type": file_type,
            "upload_date": datetime.now().isoformat()
        }
    
    async def delete_file(self, file_path: str) -> bool:
        """Delete a file from local storage"""
        full_path = os.path.join(self.root_path, file_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False
    
    async def get_file(self, file_path: str) -> Optional[BinaryIO]:  ## Not Needed
        """Get a file from local storage"""
        full_path = os.path.join(self.root_path, file_path)
        if os.path.exists(full_path):
            return open(full_path, "rb")
        return None

class S3StorageService(StorageService):
    """Implementation of StorageService using AWS S3"""
    
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.s3_client = boto3.client(
            's3',
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
    
    async def upload_file(self, file: UploadFile, folder: str = None) -> Dict[str, Any]:
        """Upload a file to S3 storage"""
        # Generate a unique filename to avoid collisions
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid4())[:8]
        filename = f"{timestamp}_{unique_id}_{file.filename}"
        
        # Determine the storage key (path in S3)
        s3_key = filename
        if folder:
            s3_key = f"{folder}/{s3_key}"
        
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Get content type
        file_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        
        # Upload to S3
        try:
            self.s3_client.put_object(
                Body=file_content,
                Bucket=self.bucket_name,
                Key=s3_key,
                ContentType=file_type
            )
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            raise
        
        # Return metadata
        return {
            "filename": filename,
            "original_filename": file.filename,
            "file_path": s3_key,
            "file_size": file_size,
            "file_type": file_type,
            "upload_date": datetime.now().isoformat()
        }
    
    async def delete_file(self, file_path: str) -> bool:
        """Delete a file from S3 storage"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_path
            )
            return True
        except ClientError as e:
            print(f"Error deleting from S3: {e}")
            return False
    
    async def get_file(self, file_path: str) -> Optional[BinaryIO]: ## Not Needed
        """Get a file from S3 storage"""
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=file_path
            )
            return response['Body']
        except ClientError as e:
            print(f"Error getting file from S3: {e}")
            return None

# Factory function to get the appropriate storage service
def get_storage_service() -> StorageService:
    """Factory function to return the configured storage service"""
    if settings.STORAGE_TYPE.lower() == "s3":
        return S3StorageService()
    else:
        return LocalStorageService(settings.LOCAL_STORAGE_PATH)
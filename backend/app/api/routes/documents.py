import os
import mimetypes
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query, Body
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from app.db.session import get_db
from app.services.storage_service import get_storage_service
from app.crud.document import create_document, get_document, get_documents, delete_document, get_user_documents, get_user_favorites, update_favorite_status
from app.schemas.document import Document, DocumentCreate
from app.core.config import settings
from app.api.deps import get_current_user, get_current_active_user, get_current_active_superuser
from app.models.user import User

from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError

class FavoriteRequest(BaseModel):
    favorite: bool

router = APIRouter()

# Set up logging
logger = logging.getLogger(__name__)

# Document Upload Endpoint
@router.post("/upload", response_model=Document, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Require authenticated user
):
    """
    Upload a new file to the server.
    
    Requires authentication. The uploaded document will be associated with the current user.
    """
    logger.info(f"User {current_user.id} ({current_user.username}) is uploading file: {file.filename}")
    
    # Check file size
    content = await file.read(settings.MAX_UPLOAD_SIZE * 1024 * 1024 + 1)
    file_size = len(content)
    
    if file_size > settings.MAX_UPLOAD_SIZE * 1024 * 1024:
        logger.warning(f"Upload attempt with oversized file ({file_size} bytes) by user {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size allowed is {settings.MAX_UPLOAD_SIZE}MB"
        )
    
    # Reset file position for storage service to read it again
    await file.seek(0)
    
    # Upload the file using the appropriate storage service
    storage_service = get_storage_service()
    try:
        file_metadata = await storage_service.upload_file(file)
        
        # Add user ID to metadata to associate document with user
        file_metadata["user_id"] = current_user.id
        
        # Save file metadata to database
        try:
            document = create_document(db, file_metadata)
            logger.info(f"Document {document.id} successfully uploaded by user {current_user.id}")
            return document
        except IntegrityError as e:
            # Check if it's a unique constraint violation
            if isinstance(e.orig, UniqueViolation):
                # Delete the file as we couldn't create the DB record
                await storage_service.delete_file(file_metadata["file_path"])
                logger.error(f"Unique constraint violation during upload by user {current_user.id}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A file with this path already exists."
                )
            logger.error(f"Database error during upload by user {current_user.id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
    except Exception as e:
        logger.error(f"Error uploading file by user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not upload file: {str(e)}"
        )


#Get user's favorite documents
@router.get("/documents/favorites",response_model=List[Document])
async def get_favorite_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Require authenticated user
):
    """
    Retrieve user's favorite documents.
    
    Each user has their own favorites collection.
    """
    logger.info(f"User {current_user.id} retrieving favorite documents")
    
    try:
        # Get user's favorite document IDs from the database
        documents=get_user_favorites(db,user_id=current_user.id)
        return documents
    except Exception as e:
        logger.error(f"Error retrieving favorite documents for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not retrieve favorite documents: {str(e)}"
        )
        
# Toggle favorite status for a document
@router.post("/documents/{document_id}/favorite", response_model=Dict[str, Any])
async def toggle_favorite_document(
    document_id: int,
    favorite_request: FavoriteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Toggle favorite status for a document.
    
    Users can only favorite their own documents or documents they have access to.
    """
    # Check if document exists and user has access to it
    document=get_document(db,document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    # Check if user has permission to access this document
    if document.user_id != current_user.id and not current_user.is_superuser:
        logger.warning(f"User {current_user.id} attempted to favorite document {document_id} owned by user {document.user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to favorite this document"
        )
    
    try:
        # Update favorite status in the database
        success = update_favorite_status(
            db, 
            user_id=current_user.id, 
            document_id=document_id, 
            is_favorite=favorite_request.favorite
        )
        
        action = "added to" if favorite_request.favorite else "removed from"
        logger.info(f"Document {document_id} {action} favorites by user {current_user.id}")
        
        return {"success": success}
    except Exception as e:
        logger.error(f"Error updating favorite status for document {document_id} by user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not update favorite status: {str(e)}"
        )
            
# Retrieve All Documents Endpoint
@router.get('/documents', response_model=List[Document])
def get_all_documents(
    skip: int = 0,
    limit: int = 100,
    owned_only: bool = Query(True, description="If true, return only user's documents. If false (and user is admin), return all documents."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Require authenticated user
):
    """
    Retrieve documents with pagination.
    
    Regular users can only see their own documents.
    Superusers (admins) can see all documents if owned_only=False.
    """
    if owned_only or not current_user.is_superuser:
        # Regular users or admin requesting only owned documents
        logger.info(f"User {current_user.id} retrieving their own documents")
        documents = get_user_documents(db, user_id=current_user.id, skip=skip, limit=limit)
    else:
        # Admin requesting all documents
        logger.info(f"Admin user {current_user.id} retrieving all documents")
        documents = get_documents(db, skip=skip, limit=limit)
    
    return documents

# Retrieve a Specific Document by ID Endpoint
@router.get('/documents/{document_id}', response_model=Document)
def get_document_by_id(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Require authenticated user
):
    """
    Retrieve a specific document by ID.
    
    Users can only access their own documents.
    Superusers (admins) can access any document.
    """
    document = get_document(db, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user has permission to access this document
    if document.user_id != current_user.id and not current_user.is_superuser:
        logger.warning(f"User {current_user.id} attempted to access document {document_id} owned by user {document.user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this document"
        )
    
    logger.info(f"User {current_user.id} accessed document {document_id}")
    return document
    
# Delete a Document by ID Endpoint
@router.delete('/documents/{document_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_by_id(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Require authenticated user
):
    """
    Delete a document by ID.
    
    Users can only delete their own documents.
    Superusers (admins) can delete any document.
    """
    document = get_document(db, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user has permission to delete this document
    if document.user_id != current_user.id and not current_user.is_superuser:
        logger.warning(f"User {current_user.id} attempted to delete document {document_id} owned by user {document.user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this document"
        )
    
    # Delete file from storage
    storage_service = get_storage_service()
    await storage_service.delete_file(document.file_path)
    
    # Delete document record from database
    delete_document(db, document_id)
    logger.info(f"Document {document_id} deleted by user {current_user.id}")
    
# Download a Document by ID
@router.get('/documents/{document_id}/download')
async def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Require authenticated user
):
    """
    Download a document by ID.
    
    Users can only download their own documents.
    Superusers (admins) can download any document.
    """
    document = get_document(db, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user has permission to download this document
    if document.user_id != current_user.id and not current_user.is_superuser:
        logger.warning(f"User {current_user.id} attempted to download document {document_id} owned by user {document.user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to download this document"
        )
    
    # Get file from storage
    storage_service = get_storage_service()
    file_content = await storage_service.get_file(document.file_path)
    
    if file_content is None:
        logger.error(f"File not found in storage for document {document_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in storage"
        )
        
    # Ensure the file pointer is at the beginning
    if settings.STORAGE_TYPE == 'local' and hasattr(file_content, "seek"):
        file_content.seek(0)
    
    filename = os.path.basename(document.file_path)
    content_type, _ = mimetypes.guess_type(filename)
    if content_type is None:
        content_type = "application/octet-stream"
    
    logger.info(f"User {current_user.id} downloaded document {document_id}")
    return StreamingResponse(
        file_content,
        media_type=content_type,
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )
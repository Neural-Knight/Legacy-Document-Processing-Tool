from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from typing import List
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.storage_service import get_storage_service
from app.crud.document import create_document, get_document, get_documents, delete_document
from app.schemas.document import Document
from app.core.config import settings

from psycopg2.errors import UniqueViolation
from sqlalchemy.exc import IntegrityError

router = APIRouter()

# Document Upload Endpoint
@router.post("/upload", response_model=Document, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a new file to the server
    """
    # Check file size
    content = await file.read(settings.MAX_UPLOAD_SIZE * 1024 * 1024 + 1)
    file_size = len(content)
    
    if file_size > settings.MAX_UPLOAD_SIZE * 1024 * 1024:
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
        
        # Save file metadata to database
        try:
            document = create_document(db, file_metadata)
            return document
        except IntegrityError as e:
            # Check if it's a unique constraint violation
            if isinstance(e.orig, UniqueViolation):
                # Delete the file as we couldn't create the DB record
                await storage_service.delete_file(file_metadata["file_path"])
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A file with this path already exists."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(e)}"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not upload file: {str(e)}"
        )
        
# Retrieve All Documents Endpoint
@router.get('/documents',response_model=List[Document])
def get_all_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Retrieve all documents
    """
    documents = get_documents(db, skip=skip, limit=limit)
    return documents

# Retrieve a Specific Document by ID Endpoint
@router.get('/documents/{document_id}', response_model=Document)
def get_document_by_id(
    document_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific document by ID
    """
    document=get_document(db,document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    return document
    
    
# Delete a Document by ID Endpoint
@router.delete('/documents/{document_id}',status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_by_id(
    document_id: int,
    db: Session=Depends(get_db)
):
    """
    Delete a document by ID
    """
    document=get_document(db,document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
        
    # Delete file from storage
    storage_service = get_storage_service()
    await storage_service.delete_file(document.file_path)
    
    # Delete document record from database
    delete_document(db, document_id)
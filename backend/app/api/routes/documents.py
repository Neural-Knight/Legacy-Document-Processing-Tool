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
from app.models.extraction import Extraction
from app.services.document_processor import document_processor
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
    """Upload a document and start content extraction"""
    return await document_processor.process_document(file, current_user.id, db)

# Get Extraction Status
@router.get("/documents/{document_id}/extraction", response_model=Dict[str, Any])
async def get_extraction_status(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the extraction status and results for a document"""
    # Verify user has access to this document
    document = get_document(db, document_id)
    if document.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get extraction info
    extraction = db.query(Extraction).filter(Extraction.document_id == document_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    return {
        "status": extraction.status,
        "extraction_date": extraction.extraction_date,
        "error": extraction.error,
        "content_available": extraction.status == "completed"
    }

# Get Extraction Content
@router.get("/documents/{document_id}/content", response_model=Dict[str, Any])
async def get_extraction_content(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the extracted content for a document"""
    # Verify user has access to this document
    document = get_document(db, document_id)
    if document.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get extraction content
    extraction = db.query(Extraction).filter(Extraction.document_id == document_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    if extraction.status != "completed":
        return {
            "status": extraction.status,
            "message": f"Content extraction is {extraction.status}"
        }
    
    return extraction.content

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

# Get table markdown files
@router.get("/documents/{document_id}/table-markdown", response_model=Dict[str, Any])
async def get_table_markdown(
    document_id: int,
    page_number: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the table markdown file for a specific page or all table markdown files"""
    # Verify user has access to this document
    document = get_document(db, document_id)
    if document.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get extraction to check status
    extraction = db.query(Extraction).filter(Extraction.document_id == document_id).first()
    if not extraction:
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    if extraction.status != "completed":
        return {
            "status": extraction.status,
            "message": f"Content extraction is {extraction.status}"
        }
        
    # Build the path to the tables directory
    doc_id_str = str(document_id)
    doc_folder = None
    uploads_dir = os.path.abspath(os.path.join("uploads", "extractions"))
    
    # Find the document folder
    for folder in os.listdir(uploads_dir):
        if folder.startswith(f"doc_{doc_id_str}"):
            doc_folder = folder
            break
    
    if not doc_folder:
        raise HTTPException(status_code=404, detail="Document extraction folder not found")
    
    tables_folder = os.path.join(uploads_dir, doc_folder)
    for subfolder in os.listdir(tables_folder):
        potential_tables_folder = os.path.join(tables_folder, subfolder, "tables")
        if os.path.exists(potential_tables_folder):
            tables_folder = potential_tables_folder
            break
    else:
        # If no tables subfolder found
        raise HTTPException(status_code=404, detail="Tables folder not found")
            
    # If page_number is specified, return just that markdown file
    if page_number is not None:
        markdown_file = os.path.join(tables_folder, f"p{page_number}.md")
        if not os.path.exists(markdown_file):
            raise HTTPException(status_code=404, detail=f"Markdown file for page {page_number} not found")
            
        try:
            with open(markdown_file, 'r', encoding='utf-8') as f:
                content = f.read()
                return {"page": page_number, "content": content}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading markdown file: {str(e)}")
    
    # Otherwise return all markdown files
    result = {}
    try:
        for filename in os.listdir(tables_folder):
            if filename.endswith('.md') and filename.startswith('p'):
                try:
                    # Extract page number from filename (p1.md -> 1)
                    page_num = int(filename[1:-3])
                    file_path = os.path.join(tables_folder, filename)
                    
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        result[page_num] = content
                except (ValueError, IndexError):
                    # Skip files that don't match our naming convention
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading markdown files: {str(e)}")
    
    if not result:
        raise HTTPException(status_code=404, detail="No table markdown files found")
        
    return {"pages": result}
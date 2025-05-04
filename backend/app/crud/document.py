from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.document import Document
from app.schemas.document import DocumentCreate
from app.models.user_favorite import UserFavorite

def create_document(db: Session, document_data: dict) -> Document:
    # Initialize document with basic attributes
    db_obj = Document(
        filename=document_data["filename"],
        original_filename=document_data["original_filename"],
        file_path=document_data["file_path"],
        file_type=document_data["file_type"],
        file_size=document_data["file_size"]
    )
    
    # Add user_id if provided in document_data
    if "user_id" in document_data:
        db_obj.user_id = document_data["user_id"]
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_document(db: Session, document_id: int) -> Optional[Document]:
    return db.query(Document).filter(Document.id == document_id).first()

def get_documents(db: Session, skip: int = 0, limit: int = 100) -> List[Document]:
    return db.query(Document).offset(skip).limit(limit).all()

def get_user_documents(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Document]:
    """
    Get documents owned by a specific user
    """
    return db.query(Document).filter(Document.user_id == user_id).offset(skip).limit(limit).all()

def delete_document(db: Session, document_id: int) -> bool:
    db_obj = db.query(Document).filter(Document.id == document_id).first()
    if db_obj:
        db.delete(db_obj)
        db.commit()
        return True
    return False

def update_document_owner(db: Session, document_id: int, user_id: int) -> Optional[Document]:
    """
    Update the owner of a document
    """
    db_obj = db.query(Document).filter(Document.id == document_id).first()
    if db_obj:
        db_obj.user_id = user_id
        db.commit()
        db.refresh(db_obj)
        return db_obj
    return None

def get_documents_by_filetype(db: Session, file_type: str, user_id: Optional[int] = None, 
                            skip: int = 0, limit: int = 100) -> List[Document]:
    """
    Get documents by file type, optionally filtered by user
    """
    query = db.query(Document).filter(Document.file_type == file_type)
    
    if user_id is not None:
        query = query.filter(Document.user_id == user_id)
        
    return query.offset(skip).limit(limit).all()


def get_user_favorites(db: Session, user_id: int):
    """Get all favorite documents for a user"""
    favorite_documents = db.query(Document)\
        .join(UserFavorite, UserFavorite.document_id == Document.id)\
        .filter(UserFavorite.user_id == user_id)\
        .all()
    return favorite_documents

def update_favorite_status(db: Session, user_id: int, document_id: int, is_favorite: bool):
    """Add or remove a document from user's favorites"""
    # Check if favorite relationship already exists
    existing_favorite = db.query(UserFavorite)\
        .filter(UserFavorite.user_id == user_id, 
                UserFavorite.document_id == document_id)\
        .first()
    
    if is_favorite and not existing_favorite:
        # Add to favorites
        new_favorite = UserFavorite(
            user_id=user_id,
            document_id=document_id
        )
        db.add(new_favorite)
        db.commit()
        return True
    elif not is_favorite and existing_favorite:
        # Remove from favorites
        db.delete(existing_favorite)
        db.commit()
        return True
    
    # No change needed
    return True
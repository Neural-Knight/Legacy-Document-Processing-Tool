from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.document import Document
from app.schemas.document import DocumentCreate

def create_document(db: Session, document_data: dict) -> Document:
    db_obj = Document(
        filename=document_data["filename"],
        original_filename=document_data["original_filename"],
        file_path=document_data["file_path"],
        file_type=document_data["file_type"],
        file_size=document_data["file_size"]
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def get_document(db: Session, document_id: int) -> Optional[Document]:
    return db.query(Document).filter(Document.id == document_id).first()

def get_documents(db: Session, skip: int = 0, limit: int = 100) -> List[Document]:
    return db.query(Document).offset(skip).limit(limit).all()

def delete_document(db: Session, document_id: int) -> bool:
    db_obj = db.query(Document).filter(Document.id == document_id).first()
    if db_obj:
        db.delete(db_obj)
        db.commit()
        return True
    return False
# In app/models/document.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base  # Make sure this is the same Base everywhere


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    original_filename = Column(String(255))
    file_path = Column(String(512), index=True, unique=True)
    file_type = Column(String(100))
    file_size = Column(Integer)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Boolean, default=False)
    processing_error = Column(Text)
    
    # Add this new field to link to users
    user_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="documents")
    
    # Add a composite index for efficient querying on multiple columns
    __table_args__ = (
        Index('idx_document_filename_processed', 'filename', 'processed'),
    )

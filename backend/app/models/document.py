from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base


Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), index=True)
    original_filename = Column(String(255))
    file_path = Column(String(512), unique=True, index=True)
    file_type = Column(String(100))
    file_size = Column(Integer)
    upload_date = Column(DateTime(timezone=True), server_default=func.now())
    processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)
    
    # Add a composite index for efficient querying on multiple columns
    __table_args__ = (
        Index('idx_document_filename_processed', 'filename', 'processed'),
    )

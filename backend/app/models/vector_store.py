from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base

class VectorEntry(Base):
    __tablename__ = "vector_entries"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    chunk_text = Column(Text, nullable=False)
    message_metadata = Column(JSON, nullable=True)
    page_number = Column(Integer, nullable=True)
    vector = Column(Text, nullable=True)  # Store vector embedding as base64 string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to document
    document = relationship("Document", back_populates="vector_entries")
from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base

class UserFavorite(Base):
    """Model for storing user's favorite documents"""
    __tablename__ = "user_favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    
    # User who favorited the document
    user = relationship("User", back_populates="favorites")
    
    # The favorited document
    document = relationship("Document", back_populates="favorited_by")  

    # Ensure a user can't favorite the same document twice
    __table_args__ = (
        UniqueConstraint('user_id', 'document_id', name='unique_user_document_favorite'),
    )
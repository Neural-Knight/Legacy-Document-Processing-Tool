from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_type: str
    file_size: str  # Changed to string to match what's generated in document_processor
    user_id: Optional[int] = None
    status: Optional[str] = "uploaded"

class DocumentCreate(DocumentBase):
    pass

class DocumentInDBBase(DocumentBase):
    id: int
    upload_date: datetime
    processed: bool
    processing_error: Optional[str] = None
    user_id: int  # Ensure user_id is present and required in DB model
    
    model_config = {
        "from_attributes": True
    }

class Document(DocumentInDBBase):
    pass
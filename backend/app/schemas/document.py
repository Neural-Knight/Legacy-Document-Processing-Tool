from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_type: str
    file_size: int

class DocumentCreate(DocumentBase):
    pass

class DocumentInDBBase(DocumentBase):
    id: int
    upload_date: datetime
    processed: bool
    processing_error: Optional[str] = None
    
    model_config = {
        "from_attributes": True
    }

class Document(DocumentInDBBase):
    pass
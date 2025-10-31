import logging
import os
import asyncio
from typing import Dict, Any, List, Optional
import time
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.document import Document as DBDocument
from app.models.extraction import Extraction
from app.extractors.pdf_extractor import PdfContentExtractor
from app.schemas.document import DocumentCreate, Document
from app.core.config import settings
from app.utils.id_utils import generate_document_id
from app.services.storage_service import get_storage_service

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Service for processing uploaded documents and extracting content"""
    
    SUPPORTED_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "json", "xml"]
    STATISTICAL_EXTENSIONS = ["pdf", "xlsx", "xls", "csv", "json", "xml"]
    
    def __init__(self):
        # Change UPLOADS_DIR to LOCAL_STORAGE_PATH
        self.uploads_dir = settings.LOCAL_STORAGE_PATH
        self.extraction_dir = os.path.join(self.uploads_dir, 'extractions')
        self.storage_service = get_storage_service()
        
        # Create upload and extraction directories if they don't exist
        os.makedirs(self.uploads_dir, exist_ok=True)
        os.makedirs(self.extraction_dir, exist_ok=True)
        
        # Set up logger
        self.logger = logging.getLogger(__name__)
        
    async def process_document(self, file: UploadFile, user_id: int, db: Session) -> Document:
        """
        Process an uploaded document:
        1. Save the file using storage service
        2. Create document record
        3. Extract content asynchronously
        4. Return document info
        """
        # Validate file type
        if not self._is_valid_file_type(file.filename):
            raise HTTPException(400, "Unsupported file type")
            
        # Validate file is a statistical document
        if not await self._is_statistical_document(file):
            raise HTTPException(400, "File does not contain statistical data")
            
        # Use storage service instead of direct file writing
        upload_result = await self.storage_service.upload_file(file)
        
        # Reset file position for potential reuse
        await file.seek(0)
        
        # Create document record
        doc_create = DocumentCreate(
            filename=upload_result["filename"],
            original_filename=upload_result["original_filename"],
            file_path=upload_result["file_path"],
            file_type=upload_result["file_type"],
            file_size=str(upload_result["file_size"]),
            user_id=user_id,
            status="uploaded"
        )
        
        # Add to database
        db_doc = DBDocument(**doc_create.dict())
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)
        
        # Get full path for extraction
        full_path = os.path.join(self.storage_service.root_path, upload_result["file_path"])
        
        # Start extraction in background
        asyncio.create_task(self._extract_content(db_doc.id, full_path, db))
        
        # Return document info
        return Document.from_orm(db_doc)
    
    async def _extract_content(self, document_id: int, file_path: str, db: Session) -> None:
        """Extract content from the document in background"""
        try:
            # Update document status
            db_doc = db.query(DBDocument).filter(DBDocument.id == document_id).first()
            if not db_doc:
                logger.error(f"Document {document_id} not found for extraction")
                return
                
            db_doc.status = "processing"
            db.commit()
            
            # Extract based on file type
            file_ext = os.path.splitext(file_path)[1].lower().replace('.', '')
            
            if file_ext == "pdf":
                extraction_results = await self._extract_pdf_content(file_path, document_id)
            elif file_ext in ["xlsx", "xls"]:
                extraction_results = await self._extract_excel_content(file_path)
            elif file_ext == "csv":
                extraction_results = await self._extract_csv_content(file_path)
            else:
                extraction_results = await self._extract_generic_content(file_path)
            
            # Save extraction results to database
            extraction = Extraction(
                document_id=document_id,
                content=extraction_results,
                status="completed"
            )
            db.add(extraction)
            
            # Update document status
            db_doc.status = "processed"
            db_doc.processed = True
            db.commit()
            
        except Exception as e:
            logger.error(f"Error processing document {document_id}: {str(e)}")
            
            # Update document with error
            db_doc = db.query(DBDocument).filter(DBDocument.id == document_id).first()
            if db_doc:
                db_doc.status = "error"
                db_doc.processing_error = str(e)
                db.commit()
    
    async def _extract_pdf_content(self, file_path: str, document_id: int) -> Dict[str, Any]:
        """Extract content from PDF using PdfContentExtractor"""
        try:
            # Create output folder based on document ID
            output_folder = os.path.join(self.extraction_dir, f"doc_{document_id}")
            os.makedirs(output_folder, exist_ok=True)
            
            # Use PdfContentExtractor for main extraction
            extractor = PdfContentExtractor(
                pdf_path=file_path,
                output_folder=output_folder
            )
            
            # Extract all content
            results = extractor.extract_all()
            
            # Save extraction results to disk and database
            try:
                output_file = extractor.save_extraction_results(
                    format="json", 
                    load_tables_to_db=True,
                    document_id=document_id
                )
                
                # Get structured content for further processing
                structured_content = extractor.get_structured_content()
            except Exception as e:
                logger.error(f"Error saving extraction results: {str(e)}")
                # Provide fallback content structure
                structured_content = {
                    "metadata": {"filename": os.path.basename(file_path)},
                    "content": results,
                    "extraction_status": "partial",
                    "error": str(e)
                }
            
            return structured_content
            
        except Exception as e:
            logger.error(f"PDF extraction error for document {document_id}: {str(e)}")
            # Return minimal content to avoid complete failure
            return {
                "metadata": {"filename": os.path.basename(file_path)},
                "content": "Extraction failed - see error details",
                "extraction_status": "failed",
                "error": str(e)
            }
    
    async def _extract_excel_content(self, file_path: str) -> Dict[str, Any]:
        """Extract content from Excel files"""
        try:
            # For now, return a simple placeholder structure
            # In a full implementation, you would use pandas or a similar library
            return {
                "metadata": {
                    "filename": os.path.basename(file_path),
                    "file_type": "excel"
                },
                "content": {
                    "message": "Excel content extraction is implemented as a placeholder",
                    "file_path": file_path
                },
                "extraction_status": "placeholder"
            }
        except Exception as e:
            logger.error(f"Excel extraction error for {file_path}: {str(e)}")
            return {
                "metadata": {"filename": os.path.basename(file_path)},
                "content": "Excel extraction failed",
                "extraction_status": "failed",
                "error": str(e)
            }
    
    async def _extract_csv_content(self, file_path: str) -> Dict[str, Any]:
        """Extract content from CSV files"""
        try:
            # For now, return a simple placeholder structure
            # In a full implementation, you would use pandas or a similar library
            return {
                "metadata": {
                    "filename": os.path.basename(file_path),
                    "file_type": "csv"
                },
                "content": {
                    "message": "CSV content extraction is implemented as a placeholder",
                    "file_path": file_path
                },
                "extraction_status": "placeholder"
            }
        except Exception as e:
            logger.error(f"CSV extraction error for {file_path}: {str(e)}")
            return {
                "metadata": {"filename": os.path.basename(file_path)},
                "content": "CSV extraction failed",
                "extraction_status": "failed",
                "error": str(e)
            }
    
    async def _extract_generic_content(self, file_path: str) -> Dict[str, Any]:
        """Extract content from other file types"""
        try:
            file_ext = os.path.splitext(file_path)[1].lower().replace('.', '')
            
            return {
                "metadata": {
                    "filename": os.path.basename(file_path),
                    "file_type": file_ext
                },
                "content": {
                    "message": f"{file_ext.upper()} content extraction is implemented as a placeholder",
                    "file_path": file_path
                },
                "extraction_status": "placeholder"
            }
        except Exception as e:
            logger.error(f"Generic extraction error for {file_path}: {str(e)}")
            return {
                "metadata": {"filename": os.path.basename(file_path)},
                "content": "Content extraction failed",
                "extraction_status": "failed",
                "error": str(e)
            }
    
    def _is_valid_file_type(self, filename: str) -> bool:
        """Check if file type is supported"""
        ext = os.path.splitext(filename)[1].lower().replace('.', '')
        return ext in self.SUPPORTED_EXTENSIONS
    
    async def _is_statistical_document(self, file: UploadFile) -> bool:
        """Check if document contains statistical data"""
        # Get file extension
        ext = os.path.splitext(file.filename)[1].lower().replace('.', '')
        
        # For now, we'll assume all supported extensions are valid
        # In a production environment, you would:
        # 1. Read part of the file
        # 2. Use ML or rules to detect if it contains statistical data
        # 3. Return True/False based on analysis
        
        return ext in self.STATISTICAL_EXTENSIONS

# Create singleton instance
document_processor = DocumentProcessor()

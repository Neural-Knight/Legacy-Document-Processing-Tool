import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.extraction import Extraction
from app.models.vector_store import VectorEntry

logger = logging.getLogger(__name__)

class ContentIndexer:
    """Service to index document content for RAG and chatbot applications"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
    def index_document(self, document_id: int, db: Session) -> bool:
        """Index a document's content for RAG and chatbot use"""
        try:
            # Get the document and its extraction
            extraction = db.query(Extraction).filter(
                Extraction.document_id == document_id,
                Extraction.status == "completed"
            ).first()
            
            if not extraction or not extraction.content:
                logger.warning(f"No extraction content available for document {document_id}")
                return False
            
            # Get the document to access metadata
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                logger.warning(f"Document {document_id} not found")
                return False
            
            # Create chunks from the content
            chunks = self._create_semantic_chunks(extraction.content, document)
            
            # Create vector embeddings for each chunk
            for chunk in chunks:
                vector_entry = VectorEntry(
                    document_id=document_id,
                    chunk_text=chunk["text"],
                    metadata=chunk["metadata"],
                    page_number=chunk["metadata"].get("page_number")
                )
                db.add(vector_entry)
            
            db.commit()
            logger.info(f"Indexed {len(chunks)} chunks for document {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error indexing document {document_id}: {str(e)}")
            db.rollback()
            return False
    
    def _create_semantic_chunks(self, content: Dict[str, Any], document: Document) -> List[Dict[str, Any]]:
        """Create semantically meaningful chunks from document content"""
        chunks = []
        
        # Process each page
        if "pages" in content:
            for page in content["pages"]:
                page_number = page.get("page_number")
                page_content = page.get("page_content", "")
                
                # Skip empty pages
                if not page_content or not page_content.strip():
                    continue
                
                # Create chunks for this page
                page_chunks = self._chunk_text(page_content)
                
                for i, chunk_text in enumerate(page_chunks):
                    chunk = {
                        "text": chunk_text,
                        "metadata": {
                            "document_id": document.id,
                            "document_name": document.filename,
                            "page_number": page_number,
                            "chunk_index": i,
                            "is_scanned": page.get("isScanned", False)
                        }
                    }
                    chunks.append(chunk)
                    
        # Include metadata chunks
        if "title" in content and content["title"]:
            chunks.append({
                "text": f"Document Title: {content['title']}",
                "metadata": {
                    "document_id": document.id,
                    "document_name": document.filename,
                    "content_type": "metadata",
                    "metadata_field": "title"
                }
            })
            
        # Include table metadata
        tables_count = 0
        for page in content.get("pages", []):
            if "tables" in page and page["tables"]:
                tables_count += len(page["tables"])
                for i, table in enumerate(page["tables"]):
                    # Create a text representation of the table
                    table_text = self._table_to_text(table, page.get("page_number"), i)
                    chunks.append({
                        "text": table_text,
                        "metadata": {
                            "document_id": document.id,
                            "document_name": document.filename,
                            "page_number": page.get("page_number"),
                            "content_type": "table",
                            "table_index": i
                        }
                    })
        
        return chunks
    
    def _chunk_text(self, text: str) -> List[str]:
        """Split text into chunks with overlap"""
        chunks = []
        
        if len(text) <= self.chunk_size:
            chunks.append(text)
        else:
            start = 0
            while start < len(text):
                end = start + self.chunk_size
                if end >= len(text):
                    chunks.append(text[start:])
                    break
                
                # Try to break at paragraph or sentence boundary
                boundary = self._find_boundary(text, end)
                chunks.append(text[start:boundary])
                start = boundary - self.chunk_overlap
                
                # Ensure we're making progress
                if start < 0 or start >= len(text) - 10:
                    break
                    
        return chunks
    
    def _find_boundary(self, text: str, position: int) -> int:
        """Find the nearest paragraph or sentence boundary after position"""
        # Look for paragraph breaks first
        for i in range(min(position + 100, len(text) - 1), position - 1, -1):
            if text[i] == '\n' and (i + 1 < len(text) and text[i + 1] == '\n'):
                return i + 2
        
        # Then look for sentence breaks
        for i in range(min(position + 100, len(text) - 1), position - 1, -1):
            if text[i] in ['.', '!', '?'] and (i + 1 < len(text) and text[i + 1] == ' '):
                return i + 2
        
        # If no good boundary found, break at a space
        for i in range(min(position + 50, len(text) - 1), position - 1, -1):
            if text[i] == ' ':
                return i + 1
        
        # Fallback to exact position
        return position
    
    def _table_to_text(self, table: Dict[str, Any], page_number: int, table_index: int) -> str:
        """Convert a table to text representation"""
        text_parts = [f"Table {table_index + 1} on page {page_number}:"]
        
        # Add headers
        if "headers" in table and table["headers"]:
            headers = " | ".join(str(h) for h in table["headers"])
            text_parts.append(headers)
        
        # Add data rows
        if "data" in table and table["data"]:
            for row in table["data"]:
                if isinstance(row, dict):
                    # Handle dict format
                    row_text = " | ".join(str(v) for v in row.values())
                else:
                    # Handle list format
                    row_text = " | ".join(str(cell) for cell in row)
                text_parts.append(row_text)
        
        return "\n".join(text_parts)

# Create singleton instance
content_indexer = ContentIndexer()
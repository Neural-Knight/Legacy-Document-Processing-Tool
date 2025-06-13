import logging
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.vector_store import VectorEntry
from app.models.chat_session import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

class RAGService:
    """Service for RAG-based document querying"""
    
    def __init__(self):
        # Initialize embeddings model
        self._init_embeddings()
        
    def _init_embeddings(self):
        """Initialize the embeddings model"""
        try:
            # For this example, we'll assume a simple embedding method
            # In a real implementation, you would use a proper embedding model
            self.embedding_model = None
            logger.info("Embedding model initialized")
        except Exception as e:
            logger.error(f"Error initializing embedding model: {str(e)}")
    
    async def process_query(
        self,
        query: str,
        document_ids: Optional[List[int]],
        conversation_id: Optional[str],
        user_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """Process a query using RAG"""
        try:
            # Create or get conversation
            if conversation_id:
                chat_session = db.query(ChatSession).filter(
                    ChatSession.id == conversation_id,
                    ChatSession.user_id == user_id
                ).first()
                
                if not chat_session:
                    logger.warning(f"Chat session {conversation_id} not found, creating new")
                    chat_session = self._create_chat_session(user_id, query, document_ids, db)
            else:
                chat_session = self._create_chat_session(user_id, query, document_ids, db)
            
            # Save user message
            user_message = ChatMessage(
                session_id=chat_session.id,
                content=query,
                role="user",
                metadata={"document_ids": document_ids} if document_ids else {}
            )
            db.add(user_message)
            db.commit()
            
            # Find relevant document chunks
            relevant_chunks = self._retrieve_relevant_chunks(query, document_ids, db)
            
            # Generate response using the relevant chunks
            response_text = self._generate_response(query, relevant_chunks, chat_session.id, db)
            
            # Save assistant message
            assistant_message = ChatMessage(
                session_id=chat_session.id,
                content=response_text,
                role="assistant",
                metadata={"sources": [self._chunk_to_source(chunk) for chunk in relevant_chunks]}
            )
            db.add(assistant_message)
            
            # Update chat session
            chat_session.last_message = response_text[:100] + "..." if len(response_text) > 100 else response_text
            db.commit()
            
            # Prepare the response
            response = {
                "response": response_text,
                "sources": [self._chunk_to_source(chunk) for chunk in relevant_chunks],
                "conversation_id": chat_session.id
            }
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            raise
    
    def _create_chat_session(
        self,
        user_id: int,
        query: str,
        document_ids: Optional[List[int]],
        db: Session
    ) -> ChatSession:
        """Create a new chat session"""
        title = query[:50] + "..." if len(query) > 50 else query
        
        chat_session = ChatSession(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=title,
            document_ids=document_ids
        )
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)
        
        return chat_session
    
    def _retrieve_relevant_chunks(
        self,
        query: str,
        document_ids: Optional[List[int]],
        db: Session
    ) -> List[VectorEntry]:
        """Retrieve relevant chunks for the query"""
        # In a real implementation, you would:
        # 1. Generate an embedding for the query
        # 2. Find the most similar chunks using vector similarity
        
        # For now, we'll use a simple keyword-based approach
        query_terms = query.lower().split()
        
        # Base query for VectorEntry
        chunks_query = db.query(VectorEntry)
        
        # Filter by documents if specified
        if document_ids:
            chunks_query = chunks_query.filter(VectorEntry.document_id.in_(document_ids))
        
        # Get all chunks (in a real implementation, you'd use vector search)
        all_chunks = chunks_query.all()
        
        # Score chunks based on term matches (very basic approach)
        scored_chunks = []
        for chunk in all_chunks:
            score = 0
            text = chunk.chunk_text.lower()
            for term in query_terms:
                if term in text:
                    score += 1
            
            if score > 0:
                scored_chunks.append((chunk, score))
        
        # Sort by score and return top chunks
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return [chunk for chunk, score in scored_chunks[:5]]
    
    def _generate_response(
        self,
        query: str,
        chunks: List[VectorEntry],
        conversation_id: str,
        db: Session
    ) -> str:
        """Generate a response using the retrieved chunks"""
        # In a real implementation, you would:
        # 1. Format the chunks into a prompt
        # 2. Call an LLM to generate a response
        
        # For now, we'll create a simple template-based response
        if not chunks:
            return "I couldn't find any relevant information in the selected documents to answer your query."
        
        # Create a simple response
        response = f"Here's what I found in the documents:\n\n"
        
        for i, chunk in enumerate(chunks):
            doc = db.query(Document).filter(Document.id == chunk.document_id).first()
            doc_name = doc.filename if doc else "Unknown document"
            
            response += f"From document '{doc_name}'"
            
            if chunk.page_number:
                response += f", page {chunk.page_number}"
            
            response += ":\n"
            
            # Add an excerpt from the chunk
            text = chunk.chunk_text
            if len(text) > 200:
                text = text[:200] + "..."
            
            response += f"{text}\n\n"
        
        return response
    
    def _chunk_to_source(self, chunk: VectorEntry) -> Dict[str, Any]:
        """Convert a chunk to a source reference"""
        return {
            "document_id": chunk.document_id,
            "page_number": chunk.page_number,
            "metadata": chunk.metadata
        }

# Create singleton instance
rag_service = RAGService()
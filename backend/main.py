from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from app.api.routes import api_router
from app.api.middleware import setup_middleware
from app.core.config import settings
from app.db.session import engine
# Import Base directly from session, not from document model
from app.db.session import Base
# Import all models to ensure they're registered with Base
from app.models.document import Document
from app.models.user import User, RefreshToken
import os
# Create logs directory if it doesn't exist
log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(log_dir, exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(log_dir, "app.log"), mode='a', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# In development you can uncomment this to create tables automatically
# In production, you should use Alembic migrations instead
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Legacy Document Manager APIs",
    description="API for uploading and managing legacy documents",
    version="1.0.0",
)

# Setup middleware with security enhancements
setup_middleware(app)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# Error handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with proper JSON response"""
    logger.error(f"HTTP error: {exc.detail}", exc_info=True)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with proper JSON response"""
    logger.error(f"Validation error: {exc.errors()}", exc_info=True)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions with proper JSON response"""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

@app.get("/")
def root():
    """Root endpoint with welcome message"""
    return {"message": "Welcome to the Legacy Document Manager APIs. See /docs for documentation."}

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring systems"""
    return {"status": "healthy"}

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting application")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on shutdown"""
    logger.info("Shutting down application")
    
if __name__=="__main__":
    import uvicorn
    uvicorn.run(app,host="0.0.0.0",port=8000)
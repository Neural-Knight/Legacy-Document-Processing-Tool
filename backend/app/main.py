from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import settings
from app.db.session import engine
from app.models.document import Base

# Create all tables in the database
Base.metadata.create_all(bind=engine)

# Create all tables in the database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Legacy Document Manager APIs",
    description="API for uploading and managing legacy documents",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to the Legacy Document Manager APIs. See /docs for documentation."}

@app.get("/health")
def health_check():
    """Health check endpoint for monitoring systems"""
    return {"status": "healthy"}
from fastapi import APIRouter
from app.api.routes import documents, auth, chat

api_router = APIRouter()
api_router.include_router(documents.router, tags=["Documents"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(chat.router, prefix="/api", tags=["chat"])
# api_router.include_router(query.router, prefix="/query", tags=["Query"])
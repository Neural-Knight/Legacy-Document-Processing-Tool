from fastapi import APIRouter
from app.api.routes import uploads

api_router = APIRouter()
api_router.include_router(uploads.router, tags=["documents"])
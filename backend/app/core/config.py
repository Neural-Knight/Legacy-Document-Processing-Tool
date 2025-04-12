from pydantic_settings import BaseSettings
from typing import Optional
import os
from pathlib import Path

class Settings(BaseSettings):
    # API settings
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "File Upload API"
    
    # PostgreSQL Database settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "file_upload_db"
    POSTGRES_PORT: str = "5432"  # Added this field
    
    # File storage settings
    STORAGE_TYPE: str = "local"
    LOCAL_STORAGE_PATH: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 50  # MB
    
    # S3 Settings
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"  # This allows extra fields to be passed without errors
    }
    
    # Construct Database URL as a computed property
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    def __init__(self, **data):
        super().__init__(**data)
        # Ensure storage directory exists
        if self.STORAGE_TYPE == "local":
            path = Path(self.LOCAL_STORAGE_PATH)
            path.mkdir(parents=True, exist_ok=True)

# Global settings instance
settings = Settings()
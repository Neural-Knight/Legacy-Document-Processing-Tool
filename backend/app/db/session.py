from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# PostgreSQL connection settings
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Helps detect disconnections
    pool_size=10,  # Connection pool size
    max_overflow=20,  # Allow 20 connections beyond pool_size when needed
    pool_recycle=3600,  # Recycle connections after 1 hour
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
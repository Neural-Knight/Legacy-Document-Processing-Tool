from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union
import uuid

from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, RefreshToken

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate a password hash"""
    return pwd_context.hash(password)

def create_access_token(
    subject: Union[str, int], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create an access JWT
    :param subject: Token subject (usually user ID)
    :param expires_delta: Token expiration time
    :return: Encoded JWT
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "jti": str(uuid.uuid4()),
        "type": "access"
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    db: Session, user_id: int, user_agent: Optional[str] = None, 
    ip_address: Optional[str] = None, expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a refresh token and store it in the database
    :param db: Database session
    :param user_id: User ID
    :param user_agent: User agent string
    :param ip_address: Client IP address
    :param expires_delta: Token expiration time
    :return: Refresh token
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    token_string = str(uuid.uuid4())
    
    # Store the refresh token in the database
    refresh_token = RefreshToken(
        token=token_string,
        expires_at=expire,
        user_id=user_id,
        user_agent=user_agent,
        ip_address=ip_address
    )
    
    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)
    
    return token_string


def revoke_refresh_token(db: Session, token: str) -> bool:
    """
    Invalidate a refresh token
    :param db: Database session
    :param token: Refresh token to revoke
    :return: Success flag
    """
    db_token = db.query(RefreshToken).filter(RefreshToken.token == token).first()
    if not db_token:
        return False
    
    db_token.revoked = True
    db.commit()
    return True


def revoke_all_user_refresh_tokens(db: Session, user_id: int) -> int:
    """
    Revoke all refresh tokens for a user
    :param db: Database session
    :param user_id: User ID
    :return: Number of tokens revoked
    """
    result = db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False
    ).update({"revoked": True})
    
    db.commit()
    return result

def validate_refresh_token(db: Session, token: str) -> Optional[int]:
    """
    Validate a refresh token and return the associated user ID
    :param db: Database session
    :param token: Refresh token to validate
    :return: User ID if valid, None otherwise
    """
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == token,
        RefreshToken.revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    ).first()
    
    if not db_token:
        return None
    
    return db_token.user_id
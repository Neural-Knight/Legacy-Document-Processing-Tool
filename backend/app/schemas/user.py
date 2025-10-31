from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, validator
import re
from datetime import datetime

# Base User Schema
class UserBase(BaseModel):
    email: EmailStr
    username: str
    is_active: Optional[bool] = True
    
    @validator('username')
    def username_alphanumeric(cls, v):
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username must be alphanumeric and may include underscores or hyphens')
        return v
    
# Schema for creating a new user
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    
    @validator('password')
    def password_strength(cls, v):
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v

# Schema for updating user information
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    password: Optional[str] = None
    
    @validator('password')
    def password_strength(cls, v):
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain at least one number')
        return v


# Schema for returning user data
class User(UserBase):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        
# Schema for JWT token content
class TokenPayload(BaseModel):
    sub: str  # User ID
    exp: int  # Expiration timestamp
    iat: int  # Issued at timestamp
    jti: str  # Unique token ID
    type: str  # Token type (access or refresh)
    
# Schema for token response
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds until token expires

# Schema for login
class Login(BaseModel):
    username: str  # Can be email or username
    password: str
    remember_me: bool = False

# Schema for token refresh
class TokenRefresh(BaseModel):
    refresh_token: str

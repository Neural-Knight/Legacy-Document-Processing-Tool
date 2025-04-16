from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_client_info
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
    revoke_all_user_refresh_tokens
)
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate, Token, Login, TokenRefresh

router = APIRouter()

@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
def register(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user
    """
    # Check if email already exists
    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )
    
    # Check if username already exists
    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username already exists",
        )
    
    # Create new user
    user = User(
        email=user_in.email,
        username=user_in.username,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        is_active=True,
    )
    user.set_password(user_in.password)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@router.post("/login", response_model=Token)
def login(
    request: Request,
    db: Session = Depends(get_db),
    login_data: Login = Body(...),
) -> Any:
    """
    Login and get access and refresh tokens
    """
    # Try to authenticate by username first
    user = db.query(User).filter(User.username == login_data.username).first()
    
    # If no user found, try with email
    if not user:
        user = db.query(User).filter(User.email == login_data.username).first()
    
    # If still no user or password verification fails, raise error
    if not user or not user.verify_password(login_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get client info for security purposes
    client_info = get_client_info(request)
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    # Create refresh token with longer expiry for "remember me"
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    if not login_data.remember_me:
        # Shorter expiry if "remember me" is not checked
        refresh_token_expires = timedelta(hours=24)
    
    refresh_token = create_refresh_token(
        db=db,
        user_id=user.id,
        user_agent=client_info["user_agent"],
        ip_address=client_info["ip_address"],
        expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/login/access-token", response_model=Token)
def login_access_token(
    request: Request,
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2-compatible token login for backward compatibility with Swagger UI
    """
    # Try to authenticate by username first
    user = db.query(User).filter(User.username == form_data.username).first()
    
    # If no user found, try with email
    if not user:
        user = db.query(User).filter(User.email == form_data.username).first()
    
    # If still no user or password verification fails, raise error
    if not user or not user.verify_password(form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get client info for security purposes
    client_info = get_client_info(request)
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    # Create refresh token
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        db=db,
        user_id=user.id,
        user_agent=client_info["user_agent"],
        ip_address=client_info["ip_address"],
        expires_delta=refresh_token_expires
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }
    
@router.post("/refresh-token", response_model=Token)
def refresh_token(
    request: Request,
    token_data: TokenRefresh = Body(...),
    db: Session = Depends(get_db),
) -> Any:
    """
    Refresh access token using a valid refresh token
    """
    # Validate refresh token
    user_id = validate_refresh_token(db, token_data.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user still exists and is active
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        # Revoke the token if user is invalid
        revoke_refresh_token(db, token_data.refresh_token)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get client info for security logging
    client_info = get_client_info(request)
    
    # Create new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    # Revoke the old refresh token and create a new one (token rotation for security)
    revoke_refresh_token(db, token_data.refresh_token)
    refresh_token = create_refresh_token(
        db=db,
        user_id=user.id,
        user_agent=client_info["user_agent"],
        ip_address=client_info["ip_address"]
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.post("/logout")
def logout(
    token_data: TokenRefresh = Body(...),
    db: Session = Depends(get_db),
) -> Any:
    """
    Logout by revoking the refresh token
    """
    success = revoke_refresh_token(db, token_data.refresh_token)
    return {"success": success}

@router.post("/logout-all-devices")
def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Logout from all devices by revoking all refresh tokens
    """
    revoked_count = revoke_all_user_refresh_tokens(db, current_user.id)
    return {"success": True, "revoked_count": revoked_count}


@router.get("/me", response_model=UserSchema)
def read_users_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user information
    """
    return current_user


@router.put("/me", response_model=UserSchema)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Update own user information
    """
    if user_in.email and user_in.email != current_user.email:
        # Check if email is already used
        user = db.query(User).filter(User.email == user_in.email).first()
        if user and user.id != current_user.id:
            raise HTTPException(
                status_code=400,
                detail="This email is already in use"
            )
        current_user.email = user_in.email
    
    if user_in.first_name is not None:
        current_user.first_name = user_in.first_name
    
    if user_in.last_name is not None:
        current_user.last_name = user_in.last_name
    
    if user_in.password:
        current_user.set_password(user_in.password)
    
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return current_user
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import (
    Token, User, UserCreate, UserUpdate, UserPasswordUpdate, LoginRequest
)
from app.services.user_service import UserService
from app.dependencies.auth import (
    get_current_active_user, 
    require_admin, 
    get_user_service
)
from app.config import settings
import logging

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=User, status_code=status.HTTP_201_CREATED)
def register(
    user: UserCreate,
    user_service: UserService = Depends(get_user_service)
):
    """
    Register a new user account.
    
    - **username**: Username (3-50 characters, alphanumeric with hyphens/underscores)
    - **email**: Valid email address
    - **password**: Password (min 8 chars, must contain uppercase, lowercase, and digit)
    - **role**: User role (admin or user)
    """
    # Check if username already exists
    if not user_service.is_username_available(user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email already exists
    if not user_service.is_email_available(user.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    return user_service.create_user(user_data=user)


@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    user_service: UserService = Depends(get_user_service)
):
    """
    Login with username/email and password to get access token.
    
    - **username**: Username or email address
    - **password**: User password
    """
    user = user_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = user_service.create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login_with_json(
    login_data: LoginRequest,
    user_service: UserService = Depends(get_user_service)
):
    """
    Alternative login endpoint that accepts JSON instead of form data.
    
    - **username**: Username or email address
    - **password**: User password
    """
    user = user_service.authenticate_user(login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = user_service.create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=User)
def read_users_me(current_user: User = Depends(get_current_active_user)) -> User:
    """
    Get current user information.
    
    Returns the profile information of the currently authenticated user.
    """
    return current_user


@router.put("/me", response_model=User)
def update_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
) -> User:
    """
    Update current user's profile information.
    
    - **username**: New username (optional)
    - **email**: New email address (optional)
    - **role**: New role (optional, admin only)
    - **is_active**: Account status (optional, admin only)
    """
    # Only admins can change role and is_active
    if current_user.role.value != "admin":
        if user_update.role is not None or user_update.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to modify role or active status"
            )
    
    # Check username availability if changing
    if user_update.username and not user_service.is_username_available(
        user_update.username, exclude_user_id=current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Check email availability if changing
    if user_update.email and not user_service.is_email_available(
        user_update.email, exclude_user_id=current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already taken"
        )
    
    updated_user = user_service.update_user(current_user.id, user_update)
    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return updated_user


@router.put("/me/password")
def change_password(
    password_update: UserPasswordUpdate,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
):
    """
    Change current user's password.
    
    - **current_password**: Current password for verification
    - **new_password**: New password (min 8 chars, must contain uppercase, lowercase, and digit)
    """
    success = user_service.update_user_password(current_user.id, password_update)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    return {"message": "Password updated successfully"}


@router.put("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    user_service: UserService = Depends(get_user_service)
):
    """
    Deactivate a user account (admin only).
    
    - **user_id**: ID of the user to deactivate
    """
    try:
        if current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to deactivate user"
            )
        
        success = user_service.deactivate_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {"message": "User deactivated successfully"}
    except Exception as e:
        logging.error(f"Error deactivating user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/users/{user_id}/activate")
def activate_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    user_service: UserService = Depends(get_user_service)
):
    """
    Activate a user account (admin only).
    
    - **user_id**: ID of the user to activate
    """
    try:
        if current_user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to activate user"
            )
        
        success = user_service.activate_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return {"message": "User activated successfully"}
    except Exception as e:
        logging.error(f"Error activating user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

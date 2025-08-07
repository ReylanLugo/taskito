from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
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
from app.middleware import limiter
import logging

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def register(
    request: Request,
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
    
    user = user_service.create_user(user_data=user)
    logging.info(f"User registered ({user})")
    return JSONResponse(status_code=status.HTTP_201_CREATED, content="User registered successfully")


@router.post("/token", response_model=Token)
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    user_service: UserService = Depends(get_user_service)
):
    """
    Login with username and password to get access token.
    
    - **username**: Username
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
    
    refresh_token_expires = timedelta(minutes=settings.refresh_token_expire_minutes)
    refresh_token = user_service.create_refresh_token(
        data={"sub": user.username},
        expires_delta=refresh_token_expires
    )
    
    response = JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Login successful"})
    response.set_cookie(
        key="taskito_access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(access_token_expires.total_seconds()),
        path="/"
    )
    response.set_cookie(
        key="taskito_refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(refresh_token_expires.total_seconds()),
        path="/api/auth/refresh"
    )
    return response


@router.post("/login", response_model=Token)
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def login_with_json(
    request: Request,
    login_data: LoginRequest,
    user_service: UserService = Depends(get_user_service)
):
    """
    Alternative login endpoint that accepts JSON instead of form data.
    
    - **username**: Username
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
    
    refresh_token_expires = timedelta(minutes=settings.refresh_token_expire_minutes)
    refresh_token = user_service.create_refresh_token(
        data={"sub": user.username},
        expires_delta=refresh_token_expires
    )
    
    response = JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Login successful"})
    response.set_cookie(
        key="taskito_access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(access_token_expires.total_seconds()),
        path="/"
    )
    response.set_cookie(
        key="taskito_refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(refresh_token_expires.total_seconds()),
        path="/"
    )
    return response


@router.post("/refresh", response_model=Token)
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def refresh_token(
    request: Request,
    user_service: UserService = Depends(get_user_service)
):
    """
    Refresh access token using a valid refresh token.
    
    - **refresh_token**: Valid refresh token in cookie
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    refresh_token = request.cookies.get("taskito_refresh_token")
    if not refresh_token:
        raise credentials_exception
    
    token_data = user_service.verify_refresh_token(refresh_token)
    if token_data is None:
        raise credentials_exception
    
    user = user_service.get_user_by_username(token_data.username)
    if user is None or not user.is_active:
        raise credentials_exception
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = user_service.create_access_token(
        data={"sub": user.username}, 
        expires_delta=access_token_expires
    )
    
    response = JSONResponse(
        status_code=status.HTTP_200_OK, 
        content={"access_token": access_token, "token_type": "bearer"}
    )
    return response


@router.get("/me", response_model=User)
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def read_users_me(request: Request, current_user: User = Depends(get_current_active_user)):
    """
    Get current user information.
    
    Returns the profile information of the currently authenticated user.
    """
    user_data = User.model_validate(current_user).model_dump(mode='json')
    return JSONResponse(status_code=status.HTTP_200_OK, content={"user": user_data})


@router.put("/me", response_model=User)
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def update_user_profile(
    request: Request,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
):
    """
    Update current user's profile information.
    
    - **username**: New username (optional)
    - **email**: New email address (optional)
    - **role**: New role (optional, admin only)
    - **is_active**: Account status (optional, admin only)
    """
    # Only admins can modify role or active status
    if (user_update.role is not None or user_update.is_active is not None):
        if current_user.role.value != "admin":
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
    
    user_data = User.model_validate(updated_user).model_dump(mode='json')
    return JSONResponse(status_code=status.HTTP_200_OK, content={"user": user_data})

@router.get("/users")
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def read_users(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get all users.
    """
    users = user_service.get_all_users()
    user_data = [User.model_validate(user).model_dump(mode='json') for user in users]
    return JSONResponse(status_code=status.HTTP_200_OK, content={"users": user_data})


@router.put("/me/password")
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def change_password(
    request: Request,
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
    
    return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Password updated successfully"})


@router.put("/users/{user_id}/deactivate")
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def deactivate_user(
    request: Request,
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
        
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "User deactivated successfully"})
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deactivating user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.put("/users/{user_id}/activate")
@limiter.limit(f"{settings.rate_limit_auth_requests}/{settings.rate_limit_auth_window}")
async def activate_user(
    request: Request,
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
        
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "User activated successfully"})
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error activating user {user_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/logout")
async def logout_user(
    response: Response
):
    """
    Logout user by clearing access and refresh token cookies.
    """
    # Clear access token cookie
    response.delete_cookie("taskito_access_token", path="/")
    
    # Clear refresh token cookie
    response.delete_cookie("taskito_refresh_token", path="/api/auth/refresh")
    
    return {"message": "Logout successful"}

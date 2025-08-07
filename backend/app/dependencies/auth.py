from fastapi import Depends, HTTPException, status, Cookie
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.user_service import UserService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    """
    Dependency to get UserService instance.
    
    Args:
        db: Database session
        
    Returns:
        UserService instance
    """
    return UserService(db)


async def get_token_from_cookie(taskito_access_token: str | None = Cookie(default=None, alias="taskito_access_token")):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if taskito_access_token is None:
        raise credentials_exception
    return taskito_access_token


async def get_current_user(
    token: str = Depends(get_token_from_cookie),
    user_service: UserService = Depends(get_user_service)
) -> User:
    """
    Get the current authenticated user from JWT token.
    
    Args:
        token: JWT token from cookie
        user_service: UserService instance
        
    Returns:
        Current authenticated user
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = user_service.verify_token(token)
    if token_data is None or token_data.username is None:
        raise credentials_exception
    
    user = user_service.get_user_by_username(token_data.username)
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Get the current active user.
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        Current active user
        
    Raises:
        HTTPException: If user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """
    Require admin role for the current user.
    
    Args:
        current_user: Current active user
        
    Returns:
        Current user if admin
        
    Raises:
        HTTPException: If user is not admin
    """
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

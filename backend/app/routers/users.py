from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import logging

from app.database import get_db
from app.schemas.user import User, UserUpdate
from app.schemas.task import Task as TaskSchema
from app.services.user_service import UserService
from app.dependencies.auth import require_admin, get_user_service
from app.middleware import limiter
from app.config import settings

router = APIRouter(prefix="/users", tags=["users"])


def get_service(db: Session = Depends(get_db)) -> UserService:
    """
    Dependency to get UserService instance.
    """
    return UserService(db)


@router.get("/", response_model=List[User])
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}")
async def list_users(
    request: Request,
    current_user: User = Depends(require_admin),
    user_service: UserService = Depends(get_user_service)
):
    """
    List all users (admin only).
    """
    users = user_service.get_all_users()
    data = [User.model_validate(u).model_dump(mode="json", exclude_none=True) for u in users]
    logging.info(f"GET /users/ Listed {len(users)} users")
    return JSONResponse(status_code=status.HTTP_200_OK, content=data)


@router.put("/{user_id}", response_model=User)
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}")
async def update_user(
    request: Request,
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(require_admin),
    user_service: UserService = Depends(get_user_service)
):
    """
    Update a user (admin only).
    """
    logging.info(f"PUT /users/{user_id} Updating user {request}")
    updated = user_service.update_user(user_id=user_id, user_update=user_update)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return JSONResponse(status_code=status.HTTP_200_OK, content=User.model_validate(updated).model_dump(mode="json", exclude_none=True))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}")
async def delete_user(
    request: Request,
    user_id: int,
    current_user: User = Depends(require_admin),
    user_service: UserService = Depends(get_user_service)
):
    """
    Delete a user (admin only).
    """
    success = user_service.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    logging.info(f"DELETE /users/{user_id} User deleted successfully")
    # 204 No Content must not include a body
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{user_id}/tasks", response_model=List[TaskSchema])
@limiter.limit(f"{settings.rate_limit_requests}/{settings.rate_limit_window}")
async def get_user_tasks(
    request: Request,
    user_id: int,
    current_user: User = Depends(require_admin),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get tasks related to a user (created by or assigned to) (admin only).
    """
    tasks = user_service.get_user_tasks(user_id=user_id, include_assigned=True)
    data = [TaskSchema.model_validate(t).model_dump(mode="json", exclude_none=True) for t in tasks]
    logging.info(f"GET /users/{user_id}/tasks Getting user tasks")
    return JSONResponse(status_code=status.HTTP_200_OK, content=data)

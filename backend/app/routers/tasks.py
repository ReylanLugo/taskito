import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import math

from ..database import get_db
from ..schemas.task import (
    Task, TaskCreate, TaskUpdate, TaskResponse, TaskStatistics, 
    TaskFilter, Comment, CommentCreate
)
from ..models.task import TaskPriority
from ..schemas.user import User
from ..services.task_service import TaskService
from ..dependencies.auth import get_current_active_user


router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_task_service(db: Session = Depends(get_db)) -> TaskService:
    """
    Dependency to get TaskService instance.
    
    Args:
        db: Database session
        
    Returns:
        TaskService instance
    """
    return TaskService(db)


@router.get("/", response_model=TaskResponse)
def read_tasks(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Number of tasks per page"),
    completed: Optional[bool] = Query(None, description="Filter by completion status"),
    priority: Optional[TaskPriority] = Query(None, description="Filter by priority level"),
    assigned_to: Optional[int] = Query(None, description="Filter by assigned user ID"),
    created_by: Optional[int] = Query(None, description="Filter by creator user ID"),
    due_before: Optional[str] = Query(None, description="Filter tasks due before this date (ISO format)"),
    due_after: Optional[str] = Query(None, description="Filter tasks due after this date (ISO format)"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    order_by: str = Query(
        "created_at", 
        regex="^(created_at|updated_at|due_date|priority|title)$",
        description="Field to order by"
    ),
    order_desc: bool = Query(True, description="Order in descending order"),
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieve a paginated list of tasks with filtering and sorting options.
    
    - **page**: Page number (starts from 1)
    - **size**: Number of tasks per page (1-100)
    - **completed**: Filter by completion status
    - **priority**: Filter by priority level (alta, media, baja)
    - **assigned_to**: Filter by assigned user ID
    - **created_by**: Filter by creator user ID
    - **due_before**: Filter tasks due before this date
    - **due_after**: Filter tasks due after this date
    - **search**: Search in task title and description
    - **order_by**: Field to order by
    - **order_desc**: Order in descending order
    """

    # Parse date filters if provided
    try:
        if due_before:
            due_before_formated = datetime.fromisoformat(due_before.replace('Z', '+00:00'))
        else:
            due_before_formated = None
    except ValueError:
        logging.error(f"/tasks GET Invalid due_before date format: {due_before}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid due_before date format. Use ISO format."
    )

    try:
        if due_after:
            due_after_formated = datetime.fromisoformat(due_after.replace('Z', '+00:00'))
        else:
            due_after_formated = None
    except ValueError:
        logging.error(f"/tasks GET Invalid due_after date format: {due_after}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid due_after date format. Use ISO format."
    )
    
    # Create filter object
    filters = TaskFilter(
        completed=completed,
        priority=priority,
        assigned_to=assigned_to,
        created_by=created_by,
        due_before=due_before_formated,
        due_after=due_after_formated,
        search=search
    )
    
    skip = (page - 1) * size
    tasks, total = task_service.get_tasks(
        skip=skip, 
        limit=size, 
        filters=filters, 
        order_by=order_by, 
        order_desc=order_desc
    )
    
    pages = math.ceil(total / size) if total > 0 else 1
    logging.info(f"/tasks GET: {total} tasks, {pages} pages, {size} tasks per page")
    return TaskResponse(
        tasks=tasks,
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.get("/statistics", response_model=TaskStatistics)
def read_task_statistics(
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get comprehensive task statistics.
    
    Returns statistics including:
    - Total number of tasks
    - Number of completed tasks
    - Number of pending tasks
    - Number of overdue tasks
    - Tasks by priority level
    """
    logging.info("/tasks/statistics GET")
    return task_service.get_task_statistics()


@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
def create_new_task(
    task: TaskCreate,
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new task.
    
    - **title**: Task title (required, 1-200 characters)
    - **description**: Task description (optional, max 1000 characters)
    - **due_date**: Task due date (optional, ISO format)
    - **priority**: Task priority level (alta, media, baja)
    - **assigned_to**: ID of the user assigned to this task (optional)
    """
    try:
        task = task_service.create_task(task_data=task, user_id=current_user.id)
        logging.info(f"/tasks POST Task created successfully (id={task.id})")
        return task
    except ValueError as e:
        logging.error(f"/tasks POST Error creating task: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{task_id}", response_model=Task)
def read_task(
    task_id: int,
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Retrieve a specific task by its ID.
    
    - **task_id**: The ID of the task to retrieve
    """
    db_task: Task | None = task_service.get_task_by_id(task_id)
    if db_task is None:
        logging.info(f"/tasks/{task_id} GET Task not found (id={task_id})")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    logging.info(f"/tasks/{task_id} GET Found")
    return db_task


@router.put("/{task_id}", response_model=Task)
def update_existing_task(
    task_id: int,
    task_update: TaskUpdate,
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update an existing task.
    
    Only the task creator or an admin can update a task.
    
    - **task_id**: The ID of the task to update
    - **title**: New task title (optional, 1-200 characters)
    - **description**: New task description (optional, max 1000 characters)
    - **completed**: Task completion status (optional)
    - **due_date**: New task due date (optional, ISO format)
    - **priority**: New task priority level (optional)
    - **assigned_to**: ID of the user to assign this task to (optional)
    """
    db_task: Task | None = task_service.get_task_by_id(task_id)
    if db_task is None:
        logging.info(f"/tasks/{task_id} PUT Task not found for update (id={task_id})")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    # Permission check: only owner or admin
    if db_task.created_by != current_user.id and current_user.role.value != "admin":
        logging.warning(f"/tasks/{task_id} PUT Permission denied for user {current_user.id} to update task {task_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this task"
        )
    updated_task: Task | None = task_service.update_task(task_id=task_id, task_update=task_update, user_id=current_user.id)
    if updated_task is None:
        logging.error(f"/tasks/{task_id} PUT Update failed for task {task_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    logging.info(f"/tasks/{task_id} PUT Task updated successfully")
    return updated_task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_task(
    task_id: int,
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete an existing task.
    
    Only the task creator or an admin can delete a task.
    
    - **task_id**: The ID of the task to delete
    """
    db_task: Task | None = task_service.get_task_by_id(task_id)
    if db_task is None:
        logging.info(f"/tasks/{task_id} DELETE Task not found for deletion (id={task_id})")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Permission check: only owner or admin
    if db_task.created_by != current_user.id and current_user.role.value != "admin":
        logging.warning(f"/tasks/{task_id} DELETE Permission denied for user {current_user.id} to delete task {task_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete this task"
        )

    success: bool = task_service.delete_task(task_id=task_id, user_id=current_user.id)
    if not success:
        logging.error(f"/tasks/{task_id} DELETE Delete failed for task {task_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    logging.info(f"/tasks/{task_id} DELETE Task deleted successfully")


@router.post("/{task_id}/comments", response_model=Comment, status_code=status.HTTP_201_CREATED)
def add_comment_to_task(
    task_id: int,
    comment: CommentCreate,
    task_service: TaskService = Depends(get_task_service),
    current_user: User = Depends(get_current_active_user)
):
    """
    Add a comment to a specific task.
    
    - **task_id**: The ID of the task to comment on
    - **content**: Comment content (required, 1-500 characters)
    """
    # Check if task exists
    db_task: Task | None = task_service.get_task_by_id(task_id)
    if db_task is None:
        logging.info(f"/tasks/{task_id}/comments POST Task not found for comment (id={task_id})")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    try:
        comment = task_service.create_comment(
            comment_data=comment, 
            task_id=task_id, 
            user_id=current_user.id
        )
        logging.info(f"/tasks/{task_id}/comments POST Comment added successfully")
        return comment
    except Exception as e:
        logging.error(f"/tasks/{task_id}/comments POST Error adding comment to task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add comment"
        )

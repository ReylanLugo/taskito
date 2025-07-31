from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from ..models.task import TaskPriority


class TaskBase(BaseModel):
    """Base schema for task data"""
    title: str = Field(..., min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=1000, description="Task description")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    priority: TaskPriority = Field(TaskPriority.MEDIUM, description="Task priority level")
    assigned_to: Optional[int] = Field(None, description="ID of the user assigned to this task")

    @validator('title')
    def validate_title(cls, v):
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()


class TaskCreate(TaskBase):
    """Schema for creating a new task"""
    pass


class TaskUpdate(BaseModel):
    """Schema for updating an existing task"""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="Task title")
    description: Optional[str] = Field(None, max_length=1000, description="Task description")
    completed: Optional[bool] = Field(None, description="Task completion status")
    due_date: Optional[datetime] = Field(None, description="Task due date")
    priority: Optional[TaskPriority] = Field(None, description="Task priority level")
    assigned_to: Optional[int] = Field(None, description="ID of the user assigned to this task")

    @validator('title')
    def validate_title(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Title cannot be empty')
        return v.strip() if v else v


class CommentBase(BaseModel):
    """Base schema for comment data"""
    content: str = Field(..., min_length=1, max_length=500, description="Comment content")

    @validator('content')
    def validate_content(cls, v):
        if not v or not v.strip():
            raise ValueError('Comment content cannot be empty')
        return v.strip()


class CommentCreate(CommentBase):
    """Schema for creating a new comment"""
    pass


class Comment(CommentBase):
    """Schema for comment response"""
    id: int
    task_id: int
    author_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Task(TaskBase):
    """Schema for task response"""
    id: int
    completed: bool
    created_by: int
    created_at: datetime
    updated_at: datetime
    comments: List[Comment] = []

    class Config:
        from_attributes = True


class TaskStatistics(BaseModel):
    """Schema for task statistics"""
    total_tasks: int = Field(..., ge=0, description="Total number of tasks")
    completed_tasks: int = Field(..., ge=0, description="Number of completed tasks")
    pending_tasks: int = Field(..., ge=0, description="Number of pending tasks")
    overdue_tasks: int = Field(..., ge=0, description="Number of overdue tasks")
    high_priority_tasks: int = Field(..., ge=0, description="Number of high priority tasks")
    medium_priority_tasks: int = Field(..., ge=0, description="Number of medium priority tasks")
    low_priority_tasks: int = Field(..., ge=0, description="Number of low priority tasks")


class TaskFilter(BaseModel):
    """Schema for task filtering options"""
    completed: Optional[bool] = Field(None, description="Filter by completion status")
    priority: Optional[TaskPriority] = Field(None, description="Filter by priority level")
    assigned_to: Optional[int] = Field(None, description="Filter by assigned user ID")
    created_by: Optional[int] = Field(None, description="Filter by creator user ID")
    due_before: Optional[datetime] = Field(None, description="Filter tasks due before this date")
    due_after: Optional[datetime] = Field(None, description="Filter tasks due after this date")
    search: Optional[str] = Field(None, max_length=100, description="Search in title and description")


class TaskResponse(BaseModel):
    """Schema for paginated task response"""
    tasks: List[Task] = Field(..., description="List of tasks")
    total: int = Field(..., ge=0, description="Total number of tasks matching filters")
    page: int = Field(..., ge=1, description="Current page number")
    size: int = Field(..., ge=1, le=100, description="Number of tasks per page")
    pages: int = Field(..., ge=1, description="Total number of pages")

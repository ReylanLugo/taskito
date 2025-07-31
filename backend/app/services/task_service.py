import logging
from typing import List, Optional, Tuple
from datetime import datetime
from fastapi import status
from fastapi.exceptions import HTTPException
from sqlalchemy.orm import Query, Session
from sqlalchemy import and_, or_, desc, asc, func

from ..models.task import Task, Comment, TaskPriority
from ..models.user import User
from ..schemas.task import (
    TaskCreate, TaskUpdate, TaskFilter, TaskStatistics, CommentCreate
)


class TaskService:
    """
    Service class for handling task-related business logic.
    
    Attributes:
        db: SQLAlchemy database session
    """

    def __init__(self, db: Session):
        """
        Initialize the TaskService with a database session.
        
        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    def get_task_by_id(self, task_id: int) -> Optional[Task]:
        """
        Retrieve a task by its ID.
        
        Args:
            task_id: The ID of the task to retrieve
            
        Returns:
            Task object if found, None otherwise
        """
        try:
            task: Task | None = self.db.query(Task).filter(Task.id == task_id).first()
            if not task:
                logging.info(f"Task not found (id={task_id})")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
            return task
        except Exception as e:
            logging.error(f"Error retrieving task {task_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def get_tasks(
        self,
        skip: int = 0,
        limit: int = 10,
        filters: Optional[TaskFilter] = None,
        order_by: str = "created_at",
        order_desc: bool = True
    ) -> Tuple[List[Task], int]:
        """
        Retrieve a list of tasks with filtering, pagination, and sorting.
        
        Args:
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return
            filters: TaskFilter object with filtering criteria
            order_by: Field to order by
            order_desc: Whether to order in descending order
            
        Returns:
            Tuple of (list of tasks, total count)
        """
        try:
            query: Query[Task] = self.db.query(Task)
        
            # Apply filters
            if filters:
                query = self._apply_filters(query, filters)
        
            # Get total count before pagination
            total: int = query.count()
        
            # Apply ordering
            query = self._apply_ordering(query, order_by, order_desc)
        
            # Apply pagination
            tasks: List[Task] = query.offset(skip).limit(limit).all()
            
            logging.info(f"Retrieved {len(tasks)} tasks {'with filters' if filters else 'without filters'} {'ordered by' if order_by else ''} {'descending' if order_desc else 'ascending'}")

            return tasks, total
        except Exception as e:
            logging.error(f"Error retrieving tasks: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def create_task(self, task_data: TaskCreate, user_id: int) -> Task:
        """
        Create a new task.
        
        Args:
            task_data: TaskCreate schema with task information
            user_id: ID of the user creating the task
            
        Returns:
            Created Task object
        
        Raises:
            ValueError: If assigned_to user doesn't exist
        """
        try:
            # Validate assigned_to user exists if provided
            if task_data.assigned_to is not None:
                assigned_user: User | None = self.db.query(User).filter(User.id == task_data.assigned_to).first()
                if not assigned_user:
                    logging.error(f"Assigned user not found (id={task_data.assigned_to})")
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

            db_task = Task(
                title=task_data.title,
                description=task_data.description,
                due_date=task_data.due_date,
                priority=task_data.priority,
                assigned_to=task_data.assigned_to,
                created_by=user_id
            )

            self.db.add(db_task)
            self.db.commit()
            self.db.refresh(db_task)

            logging.info(f"Task created (id={db_task.id}, by user={user_id})")
            return db_task
        except Exception as e:
            logging.error(f"Error creating task: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def update_task(self, task_id: int, task_update: TaskUpdate, user_id: int) -> Optional[Task]:
        """
        Update an existing task.
        
        Args:
            task_id: ID of the task to update
            task_update: TaskUpdate schema with updated fields
            user_id: ID of the user making the update
            
        Returns:
            Updated Task object if found, None otherwise
        """
        try:
            db_task = self.get_task_by_id(task_id)
            if not db_task:
                return None

            # Update only provided fields
            update_data = task_update.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(db_task, field, value)
                
            self.db.commit()
            self.db.refresh(db_task)
            
            logging.info(f"Task updated (id={task_id}, by user={user_id})")
            return db_task
        except Exception as e:
            logging.error(f"Error updating task {task_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def delete_task(self, task_id: int, user_id: int) -> bool:
        """
        Delete a task by its ID.
        
        Args:
            task_id: ID of the task to delete
            user_id: ID of the user making the deletion
            
        Returns:
            True if task was deleted, False if not found
        """
        try:
            db_task = self.get_task_by_id(task_id)
            if not db_task:
                return False
            
            self.db.delete(db_task)
            self.db.commit()
            
            logging.info(f"Task deleted (id={task_id}) by user {user_id}")
            return True
        except Exception as e:
            logging.error(f"Error deleting task {task_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def get_task_statistics(self) -> TaskStatistics:
        """
        Get comprehensive task statistics.
        
        Returns:
            TaskStatistics object with various metrics
        """
        try:
            total_tasks: int = self.db.query(Task).count()
            completed_tasks: int = self.db.query(Task).filter(Task.completed == True).count()
            pending_tasks: int = total_tasks - completed_tasks
            
            # Get overdue tasks (past due date and not completed)
            now = datetime.utcnow()
            overdue_tasks: int = self.db.query(Task).filter(
                and_(
                    Task.due_date < now,
                    Task.completed == False
                )
            ).count()
        
            # Get tasks by priority
            high_priority_tasks: int = self.db.query(Task).filter(
                Task.priority == TaskPriority.HIGH
            ).count()
            medium_priority_tasks: int = self.db.query(Task).filter(
                Task.priority == TaskPriority.MEDIUM
            ).count()
            low_priority_tasks: int = self.db.query(Task).filter(
                Task.priority == TaskPriority.LOW
            ).count()
            
            logging.info(f"Task statistics retrieved: {total_tasks} tasks, {completed_tasks} completed, {pending_tasks} pending, {overdue_tasks} overdue, {high_priority_tasks} high priority, {medium_priority_tasks} medium priority, {low_priority_tasks} low priority")
            
            return TaskStatistics(
                total_tasks=total_tasks,
                completed_tasks=completed_tasks,
                pending_tasks=pending_tasks,
                overdue_tasks=overdue_tasks,
                high_priority_tasks=high_priority_tasks,
                medium_priority_tasks=medium_priority_tasks,
                low_priority_tasks=low_priority_tasks
            )
        except Exception as e:
            logging.error(f"Error getting task statistics: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def create_comment(self, comment_data: CommentCreate, task_id: int, user_id: int) -> Comment:
        """
        Create a new comment for a task.
        
        Args:
            comment_data: CommentCreate schema with comment information
            task_id: ID of the task to comment on
            user_id: ID of the user creating the comment
            
        Returns:
            Created Comment object
        """
        try:
            db_comment = Comment(
                content=comment_data.content,
                task_id=task_id,
                author_id=user_id
            )
            self.db.add(db_comment)
            self.db.commit()
            self.db.refresh(db_comment)
            
            logging.info(f"Comment added to task {task_id} by user {user_id}")
            return db_comment
        except Exception as e:
            logging.error(f"Error adding comment to task {task_id}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    def _apply_filters(self, query, filters: TaskFilter) -> Query:
        """
        Apply filters to the task query.
        
        Args:
            query: SQLAlchemy query object
            filters: TaskFilter object with filtering criteria
            
        Returns:
            Filtered query object
        """
        if filters.completed is not None:
            query = query.filter(Task.completed == filters.completed)
        
        if filters.priority is not None:
            query = query.filter(Task.priority == filters.priority)
        
        if filters.assigned_to is not None:
            query = query.filter(Task.assigned_to == filters.assigned_to)
        
        if filters.created_by is not None:
            query = query.filter(Task.created_by == filters.created_by)
        
        if filters.due_before is not None:
            query = query.filter(Task.due_date <= filters.due_before)
        
        if filters.due_after is not None:
            query = query.filter(Task.due_date >= filters.due_after)
        
        if filters.search:
            search_term = f"%{filters.search}%"
            query = query.filter(
                or_(
                    Task.title.ilike(search_term),
                    Task.description.ilike(search_term)
                )
            )
        
        return query

    def _apply_ordering(self, query, order_by: str, order_desc: bool) -> Query:
        """
        Apply ordering to the task query.
        
        Args:
            query: SQLAlchemy query object
            order_by: Field to order by
            order_desc: Whether to order in descending order
            
        Returns:
            Ordered query object
        """
        # Map string field names to Task attributes
        order_fields: dict[str, Task] = {
            "created_at": Task.created_at,
            "updated_at": Task.updated_at,
            "due_date": Task.due_date,
            "priority": Task.priority,
            "title": Task.title
        }
        
        field: Task = order_fields.get(order_by, Task.created_at)
        
        if order_desc:
            query = query.order_by(desc(field))
        else:
            query = query.order_by(asc(field))
        
        return query

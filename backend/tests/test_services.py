"""
Tests for service layer components.
"""
import pytest
from unittest.mock import patch
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.services.user_service import UserService
from app.services.task_service import TaskService
from app.schemas.user import UserCreate, UserUpdate, UserPasswordUpdate
from app.schemas.task import TaskCreate, TaskUpdate, TaskFilter, CommentCreate
from app.models.user import User as UserModel, UserRole
from app.models.task import TaskPriority


class TestUserService:
    """Test class for UserService."""

    @pytest.mark.unit
    def test_user_service_init(self, db_session: Session):
        """Test UserService initialization."""
        service = UserService(db_session)
        assert service.db == db_session

    @pytest.mark.unit
    def test_create_user(self, user_service: UserService, test_user_data):
        """Test user creation through service."""
        user_create = UserCreate(**test_user_data)
        user = user_service.create_user(user_create)
        
        assert user.username == test_user_data["username"]
        assert user.email == test_user_data["email"]
        assert user.role == UserRole.USER
        assert user.is_active is True

    @pytest.mark.unit
    def test_get_user_by_username(self, user_service: UserService, created_user: UserModel):
        """Test getting user by username."""
        user = user_service.get_user_by_username(str(created_user.username))
        if user is None:
            return pytest.fail("User not found")
        assert user.id == created_user.id

    @pytest.mark.unit
    def test_get_user_by_email(self, user_service: UserService, created_user: UserModel):
        """Test getting user by email."""
        user = user_service.get_user_by_email(str(created_user.email))
        if user is None:
            return pytest.fail("User not found")
        assert user.id == created_user.id

    @pytest.mark.unit
    def test_authenticate_user_success(self, user_service: UserService, created_user: UserModel, test_user_data):
        """Test successful user authentication."""
        user = user_service.authenticate_user(
            str(test_user_data["username"]), 
            str(test_user_data["password"])
        )
        if user is None:
            return pytest.fail("User not found")
        assert user.id == created_user.id

    @pytest.mark.unit
    def test_authenticate_user_wrong_password(self, user_service: UserService, created_user: UserModel):
        """Test authentication with wrong password."""
        user = user_service.authenticate_user(str(created_user.username), "wrongpassword")
        assert user is None

    @pytest.mark.unit
    def test_authenticate_user_nonexistent(self, user_service: UserService):
        """Test authentication with nonexistent user."""
        user = user_service.authenticate_user("nonexistent", "password")
        assert user is None

    @pytest.mark.unit
    def test_is_username_available(self, user_service: UserService, created_user: UserModel):
        """Test username availability check."""
        assert not user_service.is_username_available(str(created_user.username))
        assert user_service.is_username_available("newusername")

    @pytest.mark.unit
    def test_is_email_available(self, user_service: UserService, created_user: UserModel):
        """Test email availability check."""
        assert not user_service.is_email_available(str(created_user.email))
        assert user_service.is_email_available("new@example.com")

    @pytest.mark.unit
    def test_update_user(self, user_service: UserService, created_user: UserModel):
        """Test user update."""
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        update_data = UserUpdate(username="newusername", email="newemail@example.com", role=UserRole.USER, is_active=True)
        updated_user = user_service.update_user(user_id, update_data)
        if updated_user is None:
            return pytest.fail("User not found")
        assert updated_user.username == "newusername"

    @pytest.mark.unit
    def test_update_user_password(self, user_service: UserService, created_user: UserModel, test_user_data):
        """Test password update."""
        password_update = UserPasswordUpdate(
            current_password=test_user_data["password"],
            new_password="NewPassword123"
        )
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        success = user_service.update_user_password(user_id, password_update)
        assert success is True

    @pytest.mark.unit
    def test_create_access_token(self, user_service: UserService):
        """Test access token creation."""
        token = user_service.create_access_token({"sub": "testuser"})
        assert isinstance(token, str)
        assert len(token) > 0

    @pytest.mark.unit
    def test_verify_token(self, user_service: UserService):
        """Test token verification."""
        token = user_service.create_access_token({"sub": "testuser"})
        payload = user_service.verify_token(token)
        assert payload is not None
        assert payload.username == "testuser"

    @pytest.mark.unit
    def test_verify_invalid_token(self, user_service: UserService):
        """Test verification of invalid token."""
        payload = user_service.verify_token("invalid_token")
        assert payload is None


class TestTaskService:
    """Test class for TaskService."""

    @pytest.fixture
    def task_service(self, db_session: Session) -> TaskService:
        """Create TaskService instance."""
        return TaskService(db_session)

    @pytest.mark.unit
    def test_task_service_init(self, db_session: Session):
        """Test TaskService initialization."""
        service = TaskService(db_session)
        assert service.db == db_session

    @pytest.mark.unit
    def test_create_task(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test task creation through service."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        task = task_service.create_task(task_create, user_id)
        
        assert task.title == test_task_data["title"]
        assert task.description == test_task_data["description"]
        assert task.created_by == user_id

    @pytest.mark.unit
    def test_get_task_by_id(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test getting task by ID."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        created_task = task_service.create_task(task_create, user_id)
        task_id = getattr(created_task, 'id', None)
        if not isinstance(task_id, int) or task_id <= 0:
            return pytest.fail(f"Invalid task ID: {task_id}")
        retrieved_task = task_service.get_task_by_id(task_id)
        if retrieved_task is None:
            return pytest.fail("Task not found")
        assert retrieved_task.id == task_id

    @pytest.mark.unit
    def test_get_tasks_with_filters(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test getting tasks with filters."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        task_service.create_task(task_create, user_id)
        
        # TODO: Add more filters variants
        filters = TaskFilter(completed=False, priority=None, assigned_to=None, created_by=None, due_before=None, due_after=None, search=None)
        tasks, total = task_service.get_tasks(filters=filters)
        
        assert total >= 1
        assert all(not task.completed for task in tasks)

    @pytest.mark.unit
    def test_update_task(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test task update."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        created_task = task_service.create_task(task_create, user_id)
        task_id = getattr(created_task, 'id', None)
        if not isinstance(task_id, int) or task_id <= 0:
            return pytest.fail(f"Invalid task ID: {task_id}")
        update_data = TaskUpdate(title="Updated Title", description="Updated Description", completed=True, due_date=datetime.now() + timedelta(days=7), priority=TaskPriority.MEDIUM, assigned_to=user_id)
        updated_task = task_service.update_task(task_id, update_data, user_id)
        if updated_task is None:
            return pytest.fail("Task not found")
        assert updated_task.title == "Updated Title"

    @pytest.mark.unit
    def test_delete_task(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test task deletion."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        created_task = task_service.create_task(task_create, user_id)
        task_id = getattr(created_task, 'id', None)
        if not isinstance(task_id, int) or task_id <= 0:
            return pytest.fail(f"Invalid task ID: {task_id}")
        
        # Delete the task
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        success = task_service.delete_task(task_id, user_id)
        assert success is True

    @pytest.mark.unit
    def test_get_task_statistics(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test getting task statistics."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        task_service.create_task(task_create, user_id)
        
        stats = task_service.get_task_statistics()
        
        assert stats.total_tasks >= 0
        assert stats.completed_tasks >= 0
        assert stats.pending_tasks >= 0
        assert stats.overdue_tasks >= 0

    @pytest.mark.unit
    def test_create_comment(self, task_service: TaskService, created_user: UserModel, test_task_data):
        """Test comment creation."""
        task_create = TaskCreate(**test_task_data)
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        created_task = task_service.create_task(task_create, user_id)
        task_id = getattr(created_task, 'id', None)
        if not isinstance(task_id, int) or task_id <= 0:
            return pytest.fail(f"Invalid task ID: {task_id}")
        
        comment_create = CommentCreate(content="Test comment")
        comment = task_service.create_comment(comment_create, task_id, user_id)
        
        assert comment.content == "Test comment"
        assert comment.task_id == created_task.id
        assert comment.author_id == created_user.id


class TestServiceErrorHandling:
    """Test class for service error handling."""

    @pytest.mark.unit
    def test_user_service_database_error(self, db_session: Session):
        """Test UserService handles database errors gracefully."""
        with patch.object(db_session, 'add', side_effect=Exception("Database error")):
            service = UserService(db_session)
            user_create = UserCreate(
                username="testuser",
                email="test@example.com",
                password="TestPass123",
                role=UserRole.USER
            )
            
            with pytest.raises(Exception):
                service.create_user(user_create)

    @pytest.mark.unit
    def test_task_service_database_error(self, db_session: Session, created_user: UserModel):
        """Test TaskService handles database errors gracefully."""
        with patch.object(db_session, 'add', side_effect=Exception("Database error")):
            service = TaskService(db_session)
            user_id = getattr(created_user, 'id', None)
            if not isinstance(user_id, int) or user_id <= 0:
                return pytest.fail(f"Invalid user ID: {user_id}")
            task_create = TaskCreate(
                title="Test Task",
                description="Test description",
                due_date=datetime.now() + timedelta(days=7),
                priority=TaskPriority.LOW,
                assigned_to=user_id
            )
            
            with pytest.raises(Exception):
                service.create_task(task_create, user_id)

    @pytest.mark.unit
    def test_password_hashing_verification(self, user_service: UserService):
        """Test password hashing and verification."""
        password = "TestPassword123"
        hashed = user_service._hash_password(password)
        
        assert hashed != password  # Should be hashed
        assert user_service._verify_password(password, hashed)
        assert not user_service._verify_password("wrongpassword", hashed)

    @pytest.mark.unit
    def test_token_expiration(self, user_service: UserService):
        """Test token with custom expiration."""
        expires_delta = timedelta(minutes=1)
        token = user_service.create_access_token(
            {"sub": "testuser"}, 
            expires_delta=expires_delta
        )
        
        # Token should be valid immediately
        payload = user_service.verify_token(token)
        assert payload is not None
        assert payload.username == "testuser"

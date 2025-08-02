"""
Tests for service layer components.
"""
from fastapi.exceptions import HTTPException
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.services.user_service import UserService
from app.services.task_service import TaskService
from app.schemas.user import User, UserCreate, UserUpdate, UserPasswordUpdate
from app.schemas.task import TaskCreate, TaskUpdate, TaskFilter, CommentCreate
from app.models.user import User as UserModel, UserRole
from app.models.task import TaskPriority
from jose import jwt


class TestUserService:
    """Test class for UserService."""

    @pytest.mark.user
    def test_user_service_init(self, db_session: Session):
        """Test UserService initialization."""
        service = UserService(db_session)
        assert service.db == db_session

    @pytest.mark.user
    def test_create_user(self, user_service: UserService, test_user_data):
        """Test user creation through service."""
        user_create = UserCreate(**test_user_data)
        user = user_service.create_user(user_create)
        
        assert user.username == test_user_data["username"]
        assert user.email == test_user_data["email"]
        assert user.role == UserRole.USER
        assert user.is_active is True

    @pytest.mark.user
    def test_create_user_re_raises_http_exception(
        self, user_service: UserService, monkeypatch, test_user_data
    ):
        """Test that create_user re-raises HTTPException when one occurs."""
        def mock_hash_password(password: str) -> str:
            raise HTTPException(status_code=400, detail="Invalid password format")
    
        monkeypatch.setattr(user_service, "_hash_password", mock_hash_password)

        user_create = UserCreate(**test_user_data)
    
        with pytest.raises(HTTPException) as exc_info:
            user_service.create_user(user_create)
        
        assert exc_info.value.status_code == 400
        assert "Invalid password format" in exc_info.value.detail
   
    @pytest.mark.user
    def test_get_user_by_id_raises_500_on_db_error(
        self, user_service: UserService, monkeypatch
    ):
        """Test that get_user_by_id raises 500 on a generic database error."""
        mock_query = MagicMock(side_effect=Exception("Database connection error"))
        monkeypatch.setattr(user_service.db, "query", mock_query)

        with pytest.raises(HTTPException) as exc_info:
            user_service.get_user_by_id(user_id=1)

        assert exc_info.value.status_code == 500
        assert "Database connection error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_get_user_by_username(self, user_service: UserService, created_user: UserModel):
        """Test getting user by username."""
        user = user_service.get_user_by_username(str(created_user.username))
        if user is None:
            return pytest.fail("User not found")
        assert user.id == created_user.id

    @pytest.mark.user
    def test_get_user_by_username_raises_500_on_db_error(
        self, user_service: UserService, monkeypatch
    ):
        """Test that get_user_by_username raises 500 on a generic database error."""
        mock_query = MagicMock(side_effect=Exception("Database connection error"))
        monkeypatch.setattr(user_service.db, "query", mock_query)

        with pytest.raises(HTTPException) as exc_info:
            user_service.get_user_by_username("testuser")

        assert exc_info.value.status_code == 500
        assert "Database connection error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_get_user_by_email(self, user_service: UserService, created_user: UserModel):
        """Test getting user by email."""
        user = user_service.get_user_by_email(str(created_user.email))
        if user is None:
            return pytest.fail("User not found")
        assert user.id == created_user.id

    @pytest.mark.user
    def test_get_user_by_email_returns_none_when_user_not_found(
        self, user_service: UserService
    ):
        """Test that get_user_by_email returns None when user is not found."""
        user = user_service.get_user_by_email("nonexistent@example.com")
        assert user is None

    @pytest.mark.user
    def test_get_user_by_email_raises_500_on_db_error(
        self, user_service: UserService, monkeypatch
    ):
        """Test that get_user_by_email raises 500 on a generic database error."""
        mock_query = MagicMock(side_effect=Exception("Database connection error"))
        monkeypatch.setattr(user_service.db, "query", mock_query)

        with pytest.raises(HTTPException) as exc_info:
            user_service.get_user_by_email("test@example.com")

        assert exc_info.value.status_code == 500
        assert "Database connection error" in str(exc_info.value.detail)
    
    @pytest.mark.user
    def test_authenticate_user_success(self, user_service: UserService, created_user: UserModel, test_user_data):
        """Test successful user authentication."""
        user = user_service.authenticate_user(
            str(test_user_data["username"]), 
            str(test_user_data["password"])
        )
        if user is None:
            return pytest.fail("User not found")
        assert user.id == created_user.id

    @pytest.mark.user
    def test_authenticate_user_wrong_password(self, user_service: UserService, created_user: UserModel):
        """Test authentication with wrong password."""
        user = user_service.authenticate_user(str(created_user.username), "wrongpassword")
        assert user is None

    @pytest.mark.user
    def test_authenticate_user_nonexistent(self, user_service: UserService):
        """Test authentication with nonexistent user."""
        user = user_service.authenticate_user("nonexistent", "password")
        assert user is None

    @pytest.mark.user
    def test_authenticate_user_raises_500_on_db_error(
        self, user_service: UserService, created_user: UserModel, monkeypatch
    ):
        """Test that authenticate_user raises 500 on a generic database error."""
        # Mock the get_user_by_username method to raise an exception
        mock_get_user = MagicMock(side_effect=Exception("Database error"))
        monkeypatch.setattr(user_service, "get_user_by_username", mock_get_user)

        with pytest.raises(HTTPException) as exc_info:
            user_service.authenticate_user(str(created_user.username), "password")

        assert exc_info.value.status_code == 500
        assert "Database error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_is_username_available(self, user_service: UserService, created_user: UserModel):
        """Test username availability check."""
        assert not user_service.is_username_available(str(created_user.username))
        assert user_service.is_username_available("newusername")

    @pytest.mark.user
    def test_is_username_available_raises_500_on_error(self, user_service: UserService, monkeypatch, caplog):
        """Test that is_username_available raises 500 on a generic error."""
        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("DB error")
        monkeypatch.setattr(user_service, "db", mock_db)

        username = "testuser"

        with pytest.raises(HTTPException) as exc_info:
            user_service.is_username_available(username)

        assert exc_info.value.status_code == 500
        assert "DB error" in str(exc_info.value.detail)
        assert f"Error checking username availability (username={username}): DB error" in caplog.text

    @pytest.mark.user
    def test_is_email_available(self, user_service: UserService, created_user: UserModel):
        """Test email availability check."""
        assert not user_service.is_email_available(str(created_user.email))
        assert user_service.is_email_available("new@example.com")

    @pytest.mark.user
    def test_is_email_available_raises_500_on_error(self, user_service: UserService, monkeypatch, caplog):
        """Test that is_email_available raises 500 on a generic error."""
        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("DB error")
        monkeypatch.setattr(user_service, "db", mock_db)

        email = "test@example.com"

        with pytest.raises(HTTPException) as exc_info:
            user_service.is_email_available(email)

        assert exc_info.value.status_code == 500
        assert "DB error" in str(exc_info.value.detail)
        assert f"Error checking email availability (email={email}): DB error" in caplog.text

    @pytest.mark.user
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
    
    @pytest.mark.user
    def test_update_user_returns_none_when_user_not_found(
        self, user_service: UserService
    ):
        """Test that update_user returns None when the user is not found."""
        user_update = UserUpdate(username="new_username", email="newemail@example.com", role=UserRole.USER, is_active=True)
    
        updated_user = user_service.update_user(999, user_update)
    
        assert updated_user is None

    @pytest.mark.user
    def test_update_user_raises_500_on_retrieval_db_error(
        self, user_service: UserService, monkeypatch
    ):
        """Test that update_user raises 500 on a generic database error during retrieval."""
        mock_query = MagicMock(side_effect=Exception("Database connection error"))
        monkeypatch.setattr(user_service.db, "query", mock_query)

        user_update = UserUpdate(username="new_username", email="newemail@example.com", role=UserRole.USER, is_active=True)

        with pytest.raises(HTTPException) as exc_info:
            user_service.update_user(1, user_update)

        assert exc_info.value.status_code == 500
        assert "Database connection error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_update_user_raises_500_on_update_db_error(
        self, user_service: UserService, created_user: UserModel, monkeypatch
    ):
        """Test that update_user raises 500 on a generic database error during update."""
        # First, let's get a valid user
        db_user = created_user

        # Now, mock the commit to raise an error
        mock_commit = MagicMock(side_effect=Exception("Database commit error"))
        monkeypatch.setattr(user_service.db, "commit", mock_commit)

        user_update = UserUpdate(username="new_username", email="newemail@example.com", role=UserRole.USER, is_active=True)
        
        user_id = getattr(db_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        
        with pytest.raises(HTTPException) as exc_info:
            user_service.update_user(user_id, user_update)

        assert exc_info.value.status_code == 500
        assert "Database commit error" in str(exc_info.value.detail)

    @pytest.mark.user
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

    @pytest.mark.user
    def test_update_user_password_raises_500_on_db_error(
        self, user_service: UserService, created_user: UserModel, monkeypatch
    ):
        """Test that update_user_password raises 500 on a generic database error."""
        mock_commit = MagicMock(side_effect=Exception("Database commit error"))
        monkeypatch.setattr(user_service.db, "commit", mock_commit)
        
        # Bypass password verification to ensure we reach the commit
        monkeypatch.setattr(user_service, "_verify_password", lambda *args, **kwargs: True)

        password_update = UserPasswordUpdate(
            current_password="password123",
            new_password="Newpassword123"
        )

        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")

        with pytest.raises(HTTPException) as exc_info:
            user_service.update_user_password(user_id, password_update)

        assert exc_info.value.status_code == 500
        assert "Database commit error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_create_access_token(self, user_service: UserService):
        """Test access token creation."""
        token = user_service.create_access_token({"sub": "testuser"})
        assert isinstance(token, str)
        assert len(token) > 0

    @pytest.mark.user
    def test_create_access_token_raises_500_on_error(
        self, user_service: UserService, created_user: UserModel, monkeypatch
    ):
        """Test that create_access_token raises 500 on a generic error."""
        # Mock jwt.encode to raise an exception
        mock_jwt_encode = MagicMock(side_effect=Exception("Token creation error"))
        monkeypatch.setattr(jwt, "encode", mock_jwt_encode)

        data = {"sub": created_user.username}
        with pytest.raises(HTTPException) as exc_info:
            user_service.create_access_token(data)

        assert exc_info.value.status_code == 500
        assert "Token creation error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_verify_token(self, user_service: UserService):
        """Test token verification."""
        token = user_service.create_access_token({"sub": "testuser"})
        payload = user_service.verify_token(token)
        assert payload is not None
        assert payload.username == "testuser"

    @pytest.mark.user
    def test_verify_invalid_token(self, user_service: UserService):
        """Test verification of invalid token."""
        payload = user_service.verify_token("invalid_token")
        assert payload is None

    @pytest.mark.user
    def test_verify_token_payload_sub_not_string(self, user_service: UserService, caplog, monkeypatch):
        """Test that verify_token returns None when 'sub' is not a string."""

        mock_jwt_decode = MagicMock(return_value={"sub": 123})
        monkeypatch.setattr(jwt, "decode", mock_jwt_decode)

        token = "some.token"
        result = user_service.verify_token(token)

        assert result is None
        assert "Invalid token payload: 'sub' is not a string or is missing" in caplog.text

    @pytest.mark.user
    def test_verify_token_raises_500_on_error(self, user_service: UserService, monkeypatch):
        """Test that verify_token raises 500 on a generic error during token verification."""

        mock_jwt_decode = MagicMock(side_effect=Exception("Decode error"))
        monkeypatch.setattr(jwt, "decode", mock_jwt_decode)

        token = "some.token"

        with pytest.raises(HTTPException) as exc_info:
            user_service.verify_token(token)

        assert exc_info.value.status_code == 500
        assert "Decode error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_deactivate_user_raises_500_on_db_error(
        self, user_service: UserService, created_user: UserModel, monkeypatch
    ):
        """Test that deactivate_user raises 500 on a generic database error."""
        # Mock the commit method to raise an exception
        mock_commit = MagicMock(side_effect=Exception("Database commit error"))
        monkeypatch.setattr(user_service.db, "commit", mock_commit)

        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")

        with pytest.raises(HTTPException) as exc_info:
            user_service.deactivate_user(user_id)

        assert exc_info.value.status_code == 500
        assert "Database commit error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_activate_user_raises_500_on_db_error(
        self, user_service: UserService, created_user: UserModel, monkeypatch
    ):
        """Test that activate_user raises 500 on a generic database error."""
        # First deactivate the user so we can activate it
        user_id = getattr(created_user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        user_service.deactivate_user(user_id)

        # Mock the commit method to raise an exception
        mock_commit = MagicMock(side_effect=Exception("Database commit error"))
        monkeypatch.setattr(user_service.db, "commit", mock_commit)

        with pytest.raises(HTTPException) as exc_info:
            user_service.activate_user(user_id)

        assert exc_info.value.status_code == 500
        assert "Database commit error" in str(exc_info.value.detail)

    @pytest.mark.user
    def test_hash_password_raises_500_on_error(self, user_service: UserService, monkeypatch, caplog):
        """Test that _hash_password raises 500 on a generic error."""
        mock_hash = MagicMock(side_effect=Exception("Hashing error"))
        monkeypatch.setattr(user_service.pwd_context, "hash", mock_hash)

        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="Password123123",
            role=UserRole.USER
        )

        with pytest.raises(HTTPException) as exc_info:
            user_service.create_user(user_data)

        assert exc_info.value.status_code == 500
        assert "Hashing error" in str(exc_info.value.detail)
        assert "Error hashing password" in caplog.text

    @pytest.mark.user
    def test_verify_password_raises_500_on_error(self, user_service: UserService, monkeypatch, caplog):
        """Test that _verify_password raises 500 on a generic error."""
        mock_verify = MagicMock(side_effect=Exception("Verification error"))
        monkeypatch.setattr(user_service.pwd_context, "verify", mock_verify)

        with pytest.raises(HTTPException) as exc_info:
            user_service._verify_password("password", "hashedpassword")

        assert exc_info.value.status_code == 500
        assert "Verification error" in str(exc_info.value.detail)
        assert "Error verifying password" in caplog.text


class TestTaskService:
    """Test class for TaskService."""

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

"""
Pytest configuration and shared fixtures for testing.
"""
import os

# Set testing environment variable to disable rate limiting in normal tests
# This must be done BEFORE importing the main app object
os.environ["TESTING"] = "true"

import pytest
from typing import Generator, Dict, Any
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.services.task_service import TaskService
from main import app
from app.database import get_db, Base, SessionLocal
from app.models.user import User as UserModel
from app.schemas.user import UserCreate
from app.services.user_service import UserService

# Test database URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

# Create test engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session")
def db_engine():
    """Create test database engine."""
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator[Session, None, None]:
    """Create a fresh database session for each test."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create test client with database override."""
    app.dependency_overrides[get_db] = lambda: db_session
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def user_service(db_session: Session) -> UserService:
    """Create UserService instance for testing."""
    return UserService(db_session)


@pytest.fixture
def task_service(db_session: Session) -> TaskService:
    """Create TaskService instance for testing."""
    return TaskService(db_session)

@pytest.fixture
def test_user_data() -> Dict[str, Any]:
    """Test user data for registration."""
    return {
        "username": "testuser",
        "email": "test@example.com",
        "password": "TestPass123",
        "role": "user"
    }


@pytest.fixture
def test_admin_data() -> Dict[str, Any]:
    """Test admin user data for registration."""
    return {
        "username": "adminuser",
        "email": "admin@example.com",
        "password": "AdminPass123",
        "role": "admin"
    }


@pytest.fixture
def created_user(user_service: UserService, test_user_data: Dict[str, Any]) -> UserModel:
    """Create a test user in the database."""
    user_create = UserCreate(**test_user_data)
    return user_service.create_user(user_create)


@pytest.fixture
def created_admin(user_service: UserService, test_admin_data: Dict[str, Any]) -> UserModel:
    """Create a test admin user in the database."""
    admin_create = UserCreate(**test_admin_data)
    return user_service.create_user(admin_create)


@pytest.fixture
def user_cookies(client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]) -> Dict[str, str]:
    """Login test user and return auth cookies."""
    response = client.post(
        "/auth/token",
        data={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
    )
    access_cookie = response.cookies.get("taskito_access_token")
    refresh_cookie = response.cookies.get("taskito_refresh_token")
    assert access_cookie is not None, "Missing taskito_access_token cookie after login"
    assert refresh_cookie is not None, "Missing taskito_refresh_token cookie after login"
    # Return only the auth cookies we set in the app
    return {
        "taskito_access_token": access_cookie,
        "taskito_refresh_token": refresh_cookie,
    }


@pytest.fixture
def admin_cookies(client: TestClient, created_admin: UserModel, test_admin_data: Dict[str, Any]) -> Dict[str, str]:
    """Login admin user and return auth cookies."""
    response = client.post(
        "/auth/token",
        data={
            "username": test_admin_data["username"],
            "password": test_admin_data["password"]
        }
    )
    access_cookie = response.cookies.get("taskito_access_token")
    refresh_cookie = response.cookies.get("taskito_refresh_token")
    assert access_cookie is not None, "Missing taskito_access_token cookie after login"
    assert refresh_cookie is not None, "Missing taskito_refresh_token cookie after login"
    return {
        "taskito_access_token": access_cookie,
        "taskito_refresh_token": refresh_cookie,
    }


@pytest.fixture(scope="function")
def auth_headers_csrf(client: TestClient, user_cookies: Dict[str, str]) -> Dict[str, Any]:
    """Get CSRF token for authenticated user using cookie-based auth."""
    csrf_response = client.get("/csrf/token", cookies=user_cookies)
    csrf_token = csrf_response.json()["csrf_token"]
    csrf_cookie = csrf_response.cookies.get("csrf_token")
    
    # Merge auth cookies with csrf cookie
    cookies: Dict[str, str] = {**user_cookies}
    if csrf_cookie is not None:
        cookies["csrf_token"] = csrf_cookie
    
    return {
        "headers": {
            "x-csrf-token": csrf_token
        },
        "cookies": cookies
    }

@pytest.fixture(scope="function")
def admin_headers_csrf(client: TestClient, admin_cookies: Dict[str, str]) -> Dict[str, Any]:
    """Get CSRF token for admin user using cookie-based auth."""
    csrf_response = client.get("/csrf/token", cookies=admin_cookies)
    csrf_token = csrf_response.json()["csrf_token"]
    csrf_cookie = csrf_response.cookies.get("csrf_token")
    
    cookies: Dict[str, str] = {**admin_cookies}
    if csrf_cookie is not None:
        cookies["csrf_token"] = csrf_cookie
    
    return {
        "headers": {
            "x-csrf-token": csrf_token
        },
        "cookies": cookies
    }

@pytest.fixture
def created_task(client: TestClient, auth_headers_csrf: Dict[str, Any], test_task_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a test task in the database with CSRF protection"""
    response = client.post(
        "/tasks/", 
        json=test_task_data, 
        headers=auth_headers_csrf["headers"],
        cookies=auth_headers_csrf["cookies"]
    )
    return response.json()


@pytest.fixture
def test_task_data() -> Dict[str, Any]:
    """Test task data for creation."""
    return {
        "title": "Test Task",
        "description": "This is a test task",
        "priority": "media",
        "due_date": "2024-12-31T23:59:59"
    }


# Cleanup and mocking fixtures
@pytest.fixture(autouse=True)
def cleanup_test_db():
    """Clean up test database after each test."""
    yield
    # Remove test database file if it exists
    if os.path.exists("./test.db"):
        try:
            os.remove("./test.db")
        except OSError:
            pass


@pytest.fixture(autouse=True)
def mock_loki_handler():
    """Mock Loki handler to prevent connection errors during tests."""
    with patch('app.loki_handler.setup_logging') as mock_setup:
        mock_setup.return_value = None
        yield


@pytest.fixture(autouse=True)
def mock_loki_requests():
    """Mock requests to Loki to prevent network errors."""
    with patch('requests.post') as mock_post:
        mock_post.return_value.status_code = 200
        mock_post.return_value.json.return_value = {"status": "success"}
        yield


@pytest.fixture
def mock_db_session(monkeypatch) -> Generator[MagicMock, None, None]:
    """Mock database session for testing database operations.

    This fixture patches `SessionLocal` to return a mock session, allowing
    tests to run without a real database connection. It yields the mock session
    object for assertions in database-related tests.
    
    Used primarily in test_database.py for testing database connection handling.
    """
    mock_session_local = MagicMock(spec=SessionLocal)
    mock_session = MagicMock(spec=Session)
    mock_session_local.return_value = mock_session

    monkeypatch.setattr('app.database.SessionLocal', mock_session_local)

    yield mock_session
"""
Pytest configuration and shared fixtures for testing.
"""
import pytest
import os
from typing import Generator, Dict, Any
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from main import app
from app.database import get_db, Base
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
def user_token(client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]) -> str:
    """Get authentication token for test user."""
    response = client.post(
        "/auth/token",
        data={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
    )
    return response.json()["access_token"]


@pytest.fixture
def admin_token(client: TestClient, created_admin: UserModel, test_admin_data: Dict[str, Any]) -> str:
    """Get authentication token for test admin."""
    response = client.post(
        "/auth/token",
        data={
            "username": test_admin_data["username"],
            "password": test_admin_data["password"]
        }
    )
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(user_token: str) -> Dict[str, str]:
    """Get authorization headers for test user."""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
def admin_headers(admin_token: str) -> Dict[str, str]:
    """Get authorization headers for test admin."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def test_task_data() -> Dict[str, Any]:
    """Test task data for creation."""
    return {
        "title": "Test Task",
        "description": "This is a test task",
        "priority": "media",
        "due_date": "2024-12-31T23:59:59"
    }


@pytest.fixture
def created_task(client: TestClient, auth_headers: Dict[str, str], test_task_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a test task in the database."""
    response = client.post("/tasks/", json=test_task_data, headers=auth_headers)
    return response.json()


# Cleanup after tests
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

import pytest
import os
import time
from fastapi.testclient import TestClient
from fastapi import status
from unittest.mock import patch
from app.config import settings
from app.middleware.rate_limit import is_testing
from main import app
from app.database import get_db
from tests.conftest import override_get_db
from fastapi import status


@pytest.fixture
def rate_limited_client():
    """Create a test client with rate limiting enabled."""
    # Store original TESTING value
    original_testing = os.environ.get("TESTING", "true")
    
    # Enable rate limiting by setting TESTING to false
    os.environ["TESTING"] = "false"
    
    # Override database dependency
    app.dependency_overrides[get_db] = override_get_db
    
    # Create client with rate limiting enabled
    with TestClient(app) as test_client:
        yield test_client
    
    # Restore original TESTING value
    os.environ["TESTING"] = original_testing
    
    # Clear dependency overrides
    app.dependency_overrides.clear()


class TestRateLimiting:
    """Test class for rate limiting security features.
    
    These tests verify that rate limiting is properly applied to endpoints
    when enabled, and that different rate limits are applied to auth vs
    general endpoints.
    
    Note: These tests temporarily enable rate limiting by setting TESTING=false.
    """
    @pytest.mark.security
    def test_rate_limit_headers_exits(self, rate_limited_client):
        """Test that rate limit headers are present in responses."""
        # Ensure rate limiting is enabled
        assert not is_testing(), "Rate limiting should be enabled for this test"
        assert settings.rate_limit_enabled, "Rate limit setting should be enabled"

        # Make a request to a general endpoint
        responses = []
        for _ in range(settings.rate_limit_requests + 1):
            response = rate_limited_client.get("/")
            responses.append(response)
        
        # Verify that rate limit headers are present
        assert "x-ratelimit-limit" in responses[-1].headers
        assert "x-ratelimit-remaining" in responses[-1].headers
        assert "x-ratelimit-reset" in responses[-1].headers

    @pytest.mark.security
    def test_auth_rate_limit_exceeded(self, rate_limited_client):
        """Test that authentication endpoints have rate limiting applied."""
        # Ensure rate limiting is enabled
        assert not is_testing(), "Rate limiting should be enabled for this test"
        assert settings.rate_limit_enabled, "Rate limit setting should be enabled"
        
        # Make multiple requests to auth endpoint to trigger rate limit
        login_data = {"username": "testuser", "password": "WrongPass123ADSA"}
        
        # Send requests up to the limit
        responses = []
        for _ in range(settings.rate_limit_auth_requests + 1):
            response = rate_limited_client.post("/auth/token", data=login_data)
            responses.append(response)
            
            # Small delay to ensure rate limiter registers each request
            time.sleep(0.1)
        
        # Verify that the last request was rate limited
        assert responses[-1].status_code == status.HTTP_429_TOO_MANY_REQUESTS
    
    @pytest.mark.security
    def test_general_rate_limit_exceeded(self, rate_limited_client):
        """Test that general endpoints have rate limiting applied."""
        # Ensure rate limiting is enabled
        assert not is_testing(), "Rate limiting should be enabled for this test"
        assert settings.rate_limit_enabled, "Rate limit setting should be enabled"
        
        # Make multiple requests to a general endpoint to trigger rate limit
        responses = []
        for _ in range(settings.rate_limit_requests + 1):
            response = rate_limited_client.get("/")
            responses.append(response)
            
            # Small delay to ensure rate limiter registers each request
            time.sleep(0.1)
        
        # Verify that the last request was rate limited
        assert responses[-1].status_code == status.HTTP_429_TOO_MANY_REQUESTS
    
    @pytest.mark.security
    def test_rate_limit_disabled_with_testing_true(self):
        """Test that rate limiting is disabled when TESTING=true."""
        # Store original TESTING value
        original_testing = os.environ.get("TESTING", "false")
        
        try:
            # Explicitly set TESTING to true
            os.environ["TESTING"] = "true"
            
            # Create a client with TESTING=true
            app.dependency_overrides[get_db] = override_get_db
            with TestClient(app) as test_client:
                # Verify that testing mode is detected
                assert is_testing(), "Testing mode should be detected"
                
                # Make many requests to auth endpoint - should not be rate limited
                login_data = {"username": "testuser", "password": "wrongpassword"}
                
                for _ in range(settings.rate_limit_auth_requests + 5):
                    response = test_client.post("/auth/token", data=login_data)
                    # Should never get rate limited
                    assert response.status_code != status.HTTP_429_TOO_MANY_REQUESTS
        finally:
            # Restore original TESTING value
            os.environ["TESTING"] = original_testing
            app.dependency_overrides.clear()
    
    @pytest.mark.security
    @patch("app.config.settings.rate_limit_enabled", False)
    def test_rate_limit_disabled_with_setting(self, rate_limited_client):
        """Test that rate limiting is disabled when setting is False."""
        # Even with TESTING=false, if the setting is disabled, no rate limiting
        login_data = {"username": "testuser", "password": "wrongpassword"}
        
        # Make many requests - should not be rate limited
        for _ in range(settings.rate_limit_auth_requests + 5):
            response = rate_limited_client.post("/auth/token", data=login_data)
            # Should never get rate limited
            assert response.status_code != status.HTTP_429_TOO_MANY_REQUESTS

class TestCSRFProtection:
    """Test CSRF protection functionality."""
    
    @pytest.mark.security
    def test_csrf_token_generation(self, client: TestClient, user_cookies):
        """Test that we can generate a CSRF token."""
        response = client.get("/csrf/token", cookies=user_cookies)
        
        assert response.status_code == status.HTTP_200_OK
        assert "csrf_token" in response.json()
        assert "csrf_token" in response.cookies
    
    @pytest.mark.security
    def test_protected_endpoint_without_csrf_fails(self, client: TestClient, user_cookies):
        """Test that POST requests fail without CSRF token."""
        # Try to create a task without CSRF token
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "medium"
        }
        response = client.post("/tasks", json=task_data, cookies=user_cookies)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "CSRF token missing" in response.json()["detail"]
    
    @pytest.mark.security
    def test_protected_endpoint_with_invalid_csrf_fails(self, client: TestClient, user_cookies):
        """Test that POST requests fail with invalid CSRF token."""
        headers = {"x-csrf-token": "invalid-token"}
        
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "medium"
        }
        response = client.post("/tasks/", json=task_data, headers=headers, cookies={**user_cookies, "csrf_token": "invalid-token"})
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Invalid CSRF token" in response.json()["detail"]
    
    @pytest.mark.security
    def test_protected_endpoint_with_valid_csrf_succeeds(self, client: TestClient, user_cookies):
        """Test that POST requests succeed with valid CSRF token."""
        # First get a CSRF token
        csrf_response = client.get("/csrf/token", cookies=user_cookies)
        csrf_token = csrf_response.json()["csrf_token"]
        csrf_cookie = csrf_response.cookies.get("csrf_token")
    
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "media",
        }
    
        headers = {"x-csrf-token": csrf_token}

        # Ensure csrf_cookie is not None before using it
        assert csrf_cookie is not None, "CSRF cookie should not be None"
        
        response = client.post(
            "/tasks/", 
            json=task_data, 
            headers=headers, 
            cookies={**user_cookies, "csrf_token": csrf_cookie}
        )

        assert response.status_code == status.HTTP_201_CREATED
    
    @pytest.mark.security
    def test_get_requests_skip_csrf(self, client: TestClient, user_cookies):
        """Test that GET requests don't require CSRF tokens."""
        response = client.get("/tasks/", cookies=user_cookies)
        # Should not require CSRF and should not set csrf token for simple GET
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.security
    def test_csrf_token_validation_endpoint(self, client: TestClient, user_cookies):
        """Test the CSRF token validation endpoint."""
        csrf_response = client.get("/csrf/token", cookies=user_cookies)
        csrf_token = csrf_response.json()["csrf_token"]
        csrf_cookie = csrf_response.cookies.get("csrf_token")
        
        headers = {"x-csrf-token": csrf_token}
        assert csrf_cookie is not None, "CSRF cookie should not be None"
        response = client.get("/csrf/validate", headers=headers, cookies={**user_cookies, "csrf_token": csrf_cookie})
        
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["valid"] is True
    
    @pytest.mark.security
    def test_csrf_token_endpoint(self, client: TestClient, user_cookies):
        """Test the CSRF token endpoint returns and renews tokens."""
        r1 = client.get("/csrf/token", cookies=user_cookies)
        t1 = r1.json()["csrf_token"]
        c1 = r1.cookies.get("csrf_token")
        assert c1 is not None

        r2 = client.get("/csrf/token", cookies=user_cookies)
        t2 = r2.json()["csrf_token"]
        c2 = r2.cookies.get("csrf_token")
        assert c2 is not None

        assert t1 != t2, "CSRF token should be renewed"
        assert c1 != c2, "CSRF cookie should be renewed"

    @pytest.mark.security
    def test_csrf_protection_for_put_delete(self, client: TestClient, user_cookies):
        """Test CSRF protection for PUT and DELETE methods."""
        # Test PUT without CSRF
        update_data = {"title": "Updated Task"}
        response = client.put("/tasks/1", json=update_data, cookies=user_cookies)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Test DELETE without CSRF
        response = client.delete("/tasks/1", cookies=user_cookies)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # With CSRF
        csrf_resp = client.get("/csrf/token", cookies=user_cookies)
        csrf_token = csrf_resp.json()["csrf_token"]
        csrf_cookie = csrf_resp.cookies.get("csrf_token")
        assert csrf_cookie is not None
        headers = {"x-csrf-token": csrf_token}

        put_valid = client.put(
            "/tasks/1",
            json={"title": "Updated Task"},
            headers=headers,
            cookies={**user_cookies, "csrf_token": csrf_cookie},
        )
        assert put_valid.status_code in {status.HTTP_200_OK, status.HTTP_404_NOT_FOUND}

        delete_valid = client.delete(
            "/tasks/1",
            headers=headers,
            cookies={**user_cookies, "csrf_token": csrf_cookie},
        )
        assert delete_valid.status_code in {status.HTTP_200_OK, status.HTTP_404_NOT_FOUND}

class TestSQLInjectionProtection():
    def test_sql_injection_protection(self, client: TestClient):
        """Test SQL injection protection with SQLAlchemy."""
        response = client.post(
            "/auth/login",
            data={"username": "admin_valid' OR 1=1--", "password": "hack"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
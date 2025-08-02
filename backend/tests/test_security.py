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
    def test_csrf_token_generation(self, client: TestClient, user_token):
        """Test that we can generate a CSRF token."""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = client.get("/csrf/token", headers=headers)
        
        assert response.status_code == status.HTTP_200_OK
        assert "csrf_token" in response.json()
        assert "csrf_token" in response.cookies
    
    @pytest.mark.security
    def test_protected_endpoint_without_csrf_fails(self, client: TestClient, user_token):
        """Test that POST requests fail without CSRF token."""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Try to create a task without CSRF token
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "medium"
        }
        response = client.post("/tasks", json=task_data, headers=headers)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "CSRF token missing" in response.json()["detail"]
    
    @pytest.mark.security
    def test_protected_endpoint_with_invalid_csrf_fails(self, client: TestClient, user_token):
        """Test that POST requests fail with invalid CSRF token."""
        headers = {
            "Authorization": f"Bearer {user_token}",
            "x-csrf-token": "invalid-token"
        }
        
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "medium"
        }
        response = client.post("/tasks", json=task_data, headers=headers, cookies={"csrf_token": "invalid-token"})
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Invalid CSRF token" in response.json()["detail"]
    
    @pytest.mark.security
    def test_protected_endpoint_with_valid_csrf_succeeds(self, client: TestClient, user_token):
        """Test that POST requests succeed with valid CSRF token."""
        # First get a CSRF token
        headers = {"Authorization": f"Bearer {user_token}"}
        csrf_response = client.get("/csrf/token", headers=headers)
        csrf_token = csrf_response.json()["csrf_token"]
        csrf_cookie = csrf_response.cookies.get("csrf_token")
    
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "media",
        }
    
        headers["x-csrf-token"] = csrf_token

        # Ensure csrf_cookie is not None before using it
        assert csrf_cookie is not None, "CSRF cookie should not be None"
        
        response = client.post(
            "/tasks/", 
            json=task_data, 
            headers=headers, 
            cookies={"csrf_token": csrf_cookie}
        )
    
        assert response.status_code == status.HTTP_201_CREATED
    
    @pytest.mark.security
    def test_get_requests_skip_csrf(self, client: TestClient, user_token):
        """Test that GET requests don't require CSRF tokens."""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = client.get("/tasks", headers=headers)
        
        assert response.status_code == status.HTTP_200_OK
    
    @pytest.mark.security
    def test_auth_endpoints_skip_csrf(self, client: TestClient):
        """Test that authentication endpoints skip CSRF validation."""
        # Register endpoint should work without CSRF
        user_data = {
            "username": "testcsrfuser",
            "email": "testcsrf@example.com",
            "password": "TestPass123!",
            "full_name": "Test CSRF User"
        }
        response = client.post("/auth/register", json=user_data)
        
        # This should succeed or fail due to validation, not CSRF
        assert response.status_code != status.HTTP_403_FORBIDDEN
    
    @pytest.mark.security
    def test_csrf_token_validation_endpoint(self, client: TestClient, user_token):
        """Test the CSRF token validation endpoint."""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Test without tokens
        response = client.get("/csrf/validate", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["valid"] is False
        
        # Test with tokens
        csrf_response = client.get("/csrf/token", headers=headers)
        csrf_token = csrf_response.json()["csrf_token"]
        csrf_cookie = csrf_response.cookies.get("csrf_token")
        
        headers.update({"x-csrf-token": csrf_token})
        
        response = client.get("/csrf/validate", headers=headers, cookies={"csrf_token": str(csrf_cookie)})
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["valid"] is True
    
    @pytest.mark.security
    def test_csrf_token_endpoint(self, client: TestClient, user_token: str):
        response = client.get("/csrf/token", headers={"Authorization": f"Bearer {user_token}"})
        assert "csrf_token" in response.json()

    @pytest.mark.security
    def test_csrf_token_renewal_on_get(self, client: TestClient, auth_headers_csrf):
        """
        Test that authenticated GET requests to protected endpoints:
        - Include a new CSRF token in headers and cookies each time
        - Renew the token on every request
        - Verify token rotation mechanism
        """
        headers = auth_headers_csrf["headers"]
        cookies = auth_headers_csrf["cookies"]
    
        response1 = client.get("/tasks/statistics", headers=headers, cookies=cookies)
        assert response1.status_code == status.HTTP_200_OK
    
        assert "X-CSRF-Token" in response1.headers, "Missing CSRF token in headers"
        assert "csrf_token" in response1.cookies, "Missing CSRF token in cookies"
    
        token1_header = response1.headers["X-CSRF-Token"]
        token1_cookie = response1.cookies["csrf_token"]
    
        headers_with_token1 = {**headers, "X-CSRF-Token": token1_header}
        cookies_with_token1 = {**cookies, "csrf_token": token1_cookie}
    
        response2 = client.get(
            "/tasks/statistics",
            headers=headers_with_token1,
            cookies=cookies_with_token1
        )
        assert response2.status_code == status.HTTP_200_OK
    
        token2_header = response2.headers["X-CSRF-Token"]
        token2_cookie = response2.cookies["csrf_token"]
    
        assert token1_header != token2_header, "CSRF token not renewed in headers"
        assert token1_cookie != token2_cookie, "CSRF token not renewed in cookies"
    
        headers_with_token2 = {**headers, "X-CSRF-Token": token2_header}
        cookies_with_token2 = {**cookies, "csrf_token": token2_cookie}
    
        response3 = client.get(
            "/tasks/statistics",
            headers=headers_with_token2,
            cookies=cookies_with_token2
        )
        assert response3.status_code == status.HTTP_200_OK
    
        token3_header = response3.headers["X-CSRF-Token"]
        token3_cookie = response3.cookies["csrf_token"]
    
        assert token2_header != token3_header, "CSRF token not rotated in subsequent request"
        assert token2_cookie != token3_cookie, "CSRF cookie not rotated in subsequent request"
    
        assert token3_header in token3_cookie, "Header token not matching cookie content"

    @pytest.mark.security
    def test_csrf_protection_for_put_delete(self, client: TestClient, user_token):
        """Test CSRF protection for PUT and DELETE methods."""
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Test PUT without CSRF
        update_data = {"title": "Updated Task"}
        response = client.put("/tasks/1", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        
        # Test DELETE without CSRF
        response = client.delete("/tasks/1", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

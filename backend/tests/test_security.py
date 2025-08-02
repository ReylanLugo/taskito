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
from fastapi.routing import APIRoute
from app.schemas.main import HealthCheckResponse
from main import app
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
import re


class TestMainEndpoints:
    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"message": "Hello World"}

    def test_health_check_success(self, client: TestClient, monkeypatch):
        """Test health check with healthy database."""
        mock_conn = MagicMock()
        mock_conn.execute.return_value = None
        
        mock_engine = MagicMock()
        mock_engine.connect.return_value.__enter__.return_value = mock_conn
    
        monkeypatch.setattr("main.engine", mock_engine)

        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "database": True
        }

    def test_health_check_database_failure(self, client: TestClient, monkeypatch):
        """Test health check with failed database connection."""
        mock_engine = MagicMock()
        mock_engine.connect.side_effect = OperationalError("Error with database connection", None, Exception("Error"))
    
        monkeypatch.setattr("main.engine", mock_engine)

        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "degraded",
            "database": False
        }

    def test_unauthorized_access_protected_endpoints(self, client: TestClient):
        """Test unauthorized access to protected endpoints."""
        # Get only API routes
        api_routes = [
            route for route in app.routes 
            if isinstance(route, APIRoute)
        ]
    
        # Filter public endpoints
        public_paths = {
            "/",
            "/health",
            "/auth/token",
            "/openapi.json",
            "/docs",
            "/redoc",
            "/docs/oauth2-redirect",
            "/docs/static/{path:path}"
        }
    
        # Test protected routes
        for route in api_routes:
            path = route.path
            
            # Skip public paths
            if path in public_paths:
                continue
            
            # Create testable path by replacing all parameters
            test_path = re.sub(r'\{[^}]+\}', 'test_value', path)
        
            # Skip paths that couldn't be sanitized
            if "{" in test_path or "}" in test_path:
                continue
            
            # Determine which methods to test
            methods_to_test = []
            if "GET" in route.methods:
                methods_to_test.append("GET")
            if "POST" in route.methods and "{" not in path:
                methods_to_test.append("POST")
        
            for method in methods_to_test:
                if method in ["POST", "PUT", "PATCH"]:
                    response = client.request(
                        method=method,
                        url=test_path,
                        json={}
                    )
                else:
                    response = client.request(
                        method=method,
                        url=test_path
                    )
            
                # Allow additional status codes:
                # - 405: Method not allowed (shouldn't happen but safe to include)
                # - 404: Not found (invalid test path)
                # - 422: Validation error (invalid parameters)
                assert response.status_code in [401, 403, 404, 405, 422], \
                    (f"{method} {path} returned {response.status_code} "
                 "instead of 401/403")


    def test_routers_registered(self, client: TestClient):
        """Verify that the main routers are registered."""
        # Verify task router
        task_routes = [
            route for route in app.routes 
            if isinstance(route, APIRoute) and route.path.startswith("/tasks")
        ]
        assert len(task_routes) > 0, "Router of tasks not registered"
    
        # Verify auth router
        auth_routes = [
            route for route in app.routes 
            if isinstance(route, APIRoute) and route.path.startswith("/auth")
        ]
        assert len(auth_routes) > 0, "Router of auth not registered"
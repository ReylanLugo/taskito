"""
Tests for main application endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from sqlalchemy.exc import SQLAlchemyError


class TestMainEndpoints:
    """Test class for main application endpoints."""

    @pytest.mark.unit
    def test_root_endpoint(self, client: TestClient):
        """Test the root endpoint returns correct response."""
        response = client.get("/")
        
        assert response.status_code == 200
        assert response.json() == {"message": "Hello World"}

    @pytest.mark.unit
    @patch('app.database.engine.connect')
    def test_health_check_healthy_database(self, mock_connect, client: TestClient):
        """Test health check endpoint with healthy database."""
        # Mock successful database connection
        mock_conn = MagicMock()
        mock_conn.execute.return_value = None
        mock_connect.return_value.__enter__.return_value = mock_conn
        
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] is True

    @pytest.mark.unit
    @patch('app.database.engine.connect')
    def test_health_check_unhealthy_database(self, mock_connect, client: TestClient):
        """Test health check endpoint with unhealthy database."""
        # Mock database connection failure
        mock_connect.side_effect = SQLAlchemyError("Database connection failed")
        
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] is False

    @pytest.mark.unit
    @patch('app.database.engine.connect')
    def test_health_check_database_connection_exception(self, mock_connect, client: TestClient):
        """Test health check endpoint handles database exceptions gracefully."""
        # Mock connection that raises exception during execute
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = Exception("Connection lost")
        mock_connect.return_value.__enter__.return_value = mock_conn
        
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] is False

    @pytest.mark.integration
    def test_health_check_response_structure(self, client: TestClient):
        """Test health check response has correct structure."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert "status" in data
        assert "database" in data
        
        # Check field types
        assert isinstance(data["status"], str)
        assert isinstance(data["database"], bool)
        
        # Check status is valid
        assert data["status"] in ["ok", "degraded"]

    @pytest.mark.unit
    def test_nonexistent_endpoint(self, client: TestClient):
        """Test that nonexistent endpoints return 404."""
        response = client.get("/nonexistent")
        
        assert response.status_code == 404

    @pytest.mark.unit
    def test_health_endpoint_logging(self, client: TestClient, caplog):
        """Test that health endpoint logs appropriately."""
        with caplog.at_level("INFO"):
            response = client.get("/health")
        
        assert response.status_code == 200
        assert "Health check endpoint was called" in caplog.text
        
        # Check for database health logging
        if response.json()["database"]:
            assert "Database connection is healthy" in caplog.text
        else:
            assert "Database connection is not healthy" in caplog.text

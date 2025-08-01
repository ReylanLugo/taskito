"""
Tests for task management endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from typing import Dict, Any
from datetime import datetime, timedelta

from app.models.user import User as UserModel


class TestTaskCreation:
    """Test class for task creation endpoint."""

    @pytest.mark.tasks
    def test_create_task_success(self, client: TestClient, auth_headers: Dict[str, str], test_task_data: Dict[str, Any]):
        """Test successful task creation."""
        response = client.post("/tasks/", json=test_task_data, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == test_task_data["title"]
        assert data["description"] == test_task_data["description"]
        assert data["priority"] == test_task_data["priority"]
        assert data["completed"] is False
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.tasks
    def test_create_task_minimal_data(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test creating task with minimal required data."""
        minimal_data = {"title": "Minimal Task"}
        
        response = client.post("/tasks/", json=minimal_data, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Minimal Task"
        assert data["description"] is None
        assert data["priority"] == "media"  # Default priority
        assert data["due_date"] is None

    @pytest.mark.tasks
    def test_create_task_with_assignment(self, client: TestClient, auth_headers: Dict[str, str], created_admin: UserModel):
        """Test creating task with user assignment."""
        task_data = {
            "title": "Assigned Task",
            "assigned_to": created_admin.id
        }
        
        response = client.post("/tasks/", json=task_data, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["assigned_to"] == created_admin.id

    @pytest.mark.tasks
    def test_create_task_unauthorized(self, client: TestClient, test_task_data: Dict[str, Any]):
        """Test creating task without authentication fails."""
        response = client.post("/tasks/", json=test_task_data)
        
        assert response.status_code == 401

    @pytest.mark.tasks
    def test_create_task_invalid_data(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test creating task with invalid data fails."""
        invalid_data = {"title": ""}  # Empty title
        
        response = client.post("/tasks/", json=invalid_data, headers=auth_headers)
        
        assert response.status_code == 422

    @pytest.mark.tasks
    def test_create_task_invalid_priority(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test creating task with invalid priority fails."""
        invalid_data = {
            "title": "Test Task",
            "priority": "invalid_priority"
        }
        
        response = client.post("/tasks/", json=invalid_data, headers=auth_headers)
        
        assert response.status_code == 422


class TestTaskRetrieval:
    """Test class for task retrieval endpoints."""

    @pytest.mark.tasks
    def test_get_tasks_default(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test getting tasks with default parameters."""
        response = client.get("/tasks/", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert "pages" in data
        assert len(data["tasks"]) >= 1

    @pytest.mark.tasks
    def test_get_tasks_pagination(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test task pagination."""
        response = client.get("/tasks/?page=1&size=5", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["size"] == 5

    @pytest.mark.tasks
    def test_get_tasks_filter_completed(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test filtering tasks by completion status."""
        response = client.get("/tasks/?completed=false", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        for task in data["tasks"]:
            assert task["completed"] is False

    @pytest.mark.tasks
    def test_get_tasks_filter_priority(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test filtering tasks by priority."""
        response = client.get("/tasks/?priority=media", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        for task in data["tasks"]:
            assert task["priority"] == "media"

    @pytest.mark.tasks
    def test_get_tasks_search(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test searching tasks by title/description."""
        response = client.get("/tasks/?search=Test", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        # Should find our test task
        assert len(data["tasks"]) >= 1

    @pytest.mark.tasks
    def test_get_tasks_order_by(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test ordering tasks by different fields."""
        response = client.get("/tasks/?order_by=title&order_desc=false", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["tasks"]) >= 1

    @pytest.mark.tasks
    def test_get_tasks_date_filters(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test filtering tasks by date ranges."""
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        response = client.get(f"/tasks/?due_before={future_date}", headers=auth_headers)
        
        assert response.status_code == 200

    @pytest.mark.tasks
    def test_get_tasks_invalid_date_format(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test invalid date format returns error."""
        response = client.get("/tasks/?due_before=invalid-date", headers=auth_headers)
        
        assert response.status_code == 400
        assert "Invalid due_before date format" in response.json()["detail"]

    @pytest.mark.tasks
    def test_get_tasks_unauthorized(self, client: TestClient):
        """Test getting tasks without authentication fails."""
        response = client.get("/tasks/")
        
        assert response.status_code == 401

    @pytest.mark.tasks
    def test_get_single_task(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test getting a single task by ID."""
        task_id = created_task["id"]
        response = client.get(f"/tasks/{task_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == task_id
        assert data["title"] == created_task["title"]

    @pytest.mark.tasks
    def test_get_nonexistent_task(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test getting nonexistent task returns 404."""
        response = client.get("/tasks/99999", headers=auth_headers)
        
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]


class TestTaskStatistics:
    """Test class for task statistics endpoint."""

    @pytest.mark.tasks
    def test_get_task_statistics(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test getting task statistics."""
        response = client.get("/tasks/statistics", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        # Check all required fields exist
        expected_fields = [
            "total_tasks", 
            "completed_tasks", 
            "pending_tasks", 
            "overdue_tasks",
            "high_priority_tasks",
            "medium_priority_tasks",
            "low_priority_tasks"
        ]
        
        for field in expected_fields:
            assert field in data, f"Missing expected field: {field}"
        
        # Check data types
        for field in expected_fields:
            assert isinstance(data[field], int), f"{field} should be an integer"

    @pytest.mark.tasks
    def test_get_task_statistics_unauthorized(self, client: TestClient):
        """Test getting task statistics without authentication fails."""
        response = client.get("/tasks/statistics")
        
        assert response.status_code == 401


class TestTaskUpdate:
    """Test class for task update endpoint."""

    @pytest.mark.tasks
    def test_update_task_success(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test successful task update."""
        task_id = created_task["id"]
        update_data = {
            "title": "Updated Task Title",
            "completed": True
        }
        
        response = client.put(f"/tasks/{task_id}", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Task Title"
        assert data["completed"] is True

    @pytest.mark.tasks
    def test_update_task_partial(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test partial task update."""
        task_id = created_task["id"]
        update_data = {"description": "Updated description only"}
        
        response = client.put(f"/tasks/{task_id}", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["description"] == "Updated description only"
        assert data["title"] == created_task["title"]  # Should remain unchanged

    @pytest.mark.tasks
    def test_update_task_priority(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test updating task priority."""
        task_id = created_task["id"]
        update_data = {"priority": "alta"}
        
        response = client.put(f"/tasks/{task_id}", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["priority"] == "alta"

    @pytest.mark.tasks
    def test_update_nonexistent_task(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test updating nonexistent task returns 404."""
        update_data = {"title": "Updated Title"}
        
        response = client.put("/tasks/99999", json=update_data, headers=auth_headers)
        
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]

    @pytest.mark.tasks
    def test_update_task_unauthorized(self, client: TestClient, created_task: Dict[str, Any]):
        """Test updating task without authentication fails."""
        task_id = created_task["id"]
        update_data = {"title": "Updated Title"}
        
        response = client.put(f"/tasks/{task_id}", json=update_data)
        
        assert response.status_code == 401

    @pytest.mark.tasks
    def test_update_task_permission_denied(self, client: TestClient, created_task: Dict[str, Any], test_admin_data: Dict[str, Any]):
        """Test updating task by non-owner non-admin fails."""
        # Create another user
        client.post("/auth/register", json={
            "username": "otheruser",
            "email": "other@example.com",
            "password": "OtherPass123",
            "role": "user"
        })
        
        # Login as other user
        login_response = client.post(
            "/auth/token",
            data={
                "username": "otheruser",
                "password": "OtherPass123"
            }
        )
        other_token = login_response.json()["access_token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}
        
        task_id = created_task["id"]
        update_data = {"title": "Updated Title"}
        
        response = client.put(f"/tasks/{task_id}", json=update_data, headers=other_headers)
        
        assert response.status_code == 403
        assert "Not enough permissions" in response.json()["detail"]

    @pytest.mark.tasks
    def test_update_task_admin_permission(self, client: TestClient, admin_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test admin can update any task."""
        task_id = created_task["id"]
        update_data = {"title": "Admin Updated Title"}
        
        response = client.put(f"/tasks/{task_id}", json=update_data, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Admin Updated Title"


class TestTaskDeletion:
    """Test class for task deletion endpoint."""

    @pytest.mark.tasks
    def test_delete_task_success(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test successful task deletion."""
        task_id = created_task["id"]
        
        response = client.delete(f"/tasks/{task_id}", headers=auth_headers)
        
        assert response.status_code == 204

    @pytest.mark.tasks
    def test_delete_nonexistent_task(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test deleting nonexistent task returns 404."""
        response = client.delete("/tasks/99999", headers=auth_headers)
        
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]

    @pytest.mark.tasks
    def test_delete_task_unauthorized(self, client: TestClient, created_task: Dict[str, Any]):
        """Test deleting task without authentication fails."""
        task_id = created_task["id"]
        
        response = client.delete(f"/tasks/{task_id}")
        
        assert response.status_code == 401

    @pytest.mark.tasks
    def test_delete_task_permission_denied(self, client: TestClient, created_task: Dict[str, Any]):
        """Test deleting task by non-owner non-admin fails."""
        # Create another user
        client.post("/auth/register", json={
            "username": "deleteuser",
            "email": "delete@example.com",
            "password": "DeletePass123",
            "role": "user"
        })
        
        # Login as other user
        login_response = client.post(
            "/auth/token",
            data={
                "username": "deleteuser",
                "password": "DeletePass123"
            }
        )
        other_token = login_response.json()["access_token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}
        
        task_id = created_task["id"]
        
        response = client.delete(f"/tasks/{task_id}", headers=other_headers)
        
        assert response.status_code == 403
        assert "Not enough permissions" in response.json()["detail"]

    @pytest.mark.tasks
    def test_delete_task_admin_permission(self, client: TestClient, admin_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test admin can delete any task."""
        task_id = created_task["id"]
        
        response = client.delete(f"/tasks/{task_id}", headers=admin_headers)
        
        assert response.status_code == 204


class TestTaskComments:
    """Test class for task comments endpoint."""

    @pytest.mark.tasks
    def test_add_comment_success(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test successfully adding comment to task."""
        task_id = created_task["id"]
        comment_data = {"content": "This is a test comment"}
        
        response = client.post(f"/tasks/{task_id}/comments", json=comment_data, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "This is a test comment"
        assert data["task_id"] == task_id
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.tasks
    def test_add_comment_to_nonexistent_task(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test adding comment to nonexistent task fails."""
        comment_data = {"content": "This is a test comment"}
        
        response = client.post("/tasks/99999/comments", json=comment_data, headers=auth_headers)
        
        assert response.status_code == 404
        assert "Task not found" in response.json()["detail"]

    @pytest.mark.tasks
    def test_add_comment_unauthorized(self, client: TestClient, created_task: Dict[str, Any]):
        """Test adding comment without authentication fails."""
        task_id = created_task["id"]
        comment_data = {"content": "This is a test comment"}
        
        response = client.post(f"/tasks/{task_id}/comments", json=comment_data)
        
        assert response.status_code == 401

    @pytest.mark.tasks
    def test_add_comment_invalid_data(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test adding comment with invalid data fails."""
        task_id = created_task["id"]
        comment_data = {"content": ""}  # Empty content
        
        response = client.post(f"/tasks/{task_id}/comments", json=comment_data, headers=auth_headers)
        
        assert response.status_code == 422

    @pytest.mark.tasks
    def test_add_comment_long_content(self, client: TestClient, auth_headers: Dict[str, str], created_task: Dict[str, Any]):
        """Test adding comment with very long content."""
        task_id = created_task["id"]
        long_content = "A" * 600  # Exceeds 500 character limit
        comment_data = {"content": long_content}
        
        response = client.post(f"/tasks/{task_id}/comments", json=comment_data, headers=auth_headers)
        
        assert response.status_code == 422


class TestTaskValidation:
    """Test class for task validation edge cases."""

    @pytest.mark.tasks
    def test_task_title_length_validation(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test task title length validation."""
        # Too long title
        long_title = "A" * 201  # Exceeds 200 character limit
        task_data = {"title": long_title}
        
        response = client.post("/tasks/", json=task_data, headers=auth_headers)
        
        assert response.status_code == 422

    @pytest.mark.tasks
    def test_task_description_length_validation(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test task description length validation."""
        # Too long description
        long_description = "A" * 1001  # Exceeds 1000 character limit
        task_data = {
            "title": "Test Task",
            "description": long_description
        }
        
        response = client.post("/tasks/", json=task_data, headers=auth_headers)
        
        assert response.status_code == 422

    @pytest.mark.tasks
    def test_task_invalid_due_date_format(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test task creation with invalid due date format."""
        task_data = {
            "title": "Test Task",
            "due_date": "invalid-date-format"
        }
        
        response = client.post("/tasks/", json=task_data, headers=auth_headers)
        
        assert response.status_code == 422

    @pytest.mark.tasks
    def test_task_pagination_limits(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test task pagination limits."""
        # Test maximum page size
        response = client.get("/tasks/?size=101", headers=auth_headers)
        assert response.status_code == 422
        
        # Test minimum page number
        response = client.get("/tasks/?page=0", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.tasks
    def test_task_order_by_validation(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test task ordering field validation."""
        response = client.get("/tasks/?order_by=invalid_field", headers=auth_headers)
        
        assert response.status_code == 422

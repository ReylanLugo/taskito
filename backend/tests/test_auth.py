"""
Tests for authentication endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from typing import Dict, Any
from unittest.mock import patch

from app.models.user import User as UserModel
from app.services.user_service import UserService


class TestAuthRegistration:
    """Test class for user registration endpoint."""

    @pytest.mark.auth
    def test_register_user_success(self, client: TestClient, test_user_data: Dict[str, Any]):
        """Test successful user registration."""
        response = client.post("/auth/register", json=test_user_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == test_user_data["username"]
        assert data["email"] == test_user_data["email"]
        assert data["role"] == test_user_data["role"]
        assert data["is_active"] is True
        assert "id" in data
        assert "password" not in data  # Password should not be returned

    @pytest.mark.auth
    def test_register_duplicate_username(self, client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]):
        """Test registration with duplicate username fails."""
        # Try to register with same username
        duplicate_data = test_user_data.copy()
        duplicate_data["email"] = "different@example.com"
        
        response = client.post("/auth/register", json=duplicate_data)
        
        assert response.status_code == 400
        assert "Username already registered" in response.json()["detail"]

    @pytest.mark.auth
    def test_register_duplicate_email(self, client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]):
        """Test registration with duplicate email fails."""
        # Try to register with same email
        duplicate_data = test_user_data.copy()
        duplicate_data["username"] = "differentuser"
        
        response = client.post("/auth/register", json=duplicate_data)
        
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    @pytest.mark.auth
    def test_register_invalid_password(self, client: TestClient):
        """Test registration with invalid password fails."""
        invalid_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "weak",  # Too weak
            "role": "user"
        }
        
        response = client.post("/auth/register", json=invalid_data)
        
        assert response.status_code == 422

    @pytest.mark.auth
    def test_register_invalid_email(self, client: TestClient):
        """Test registration with invalid email fails."""
        invalid_data = {
            "username": "testuser",
            "email": "invalid-email",  # Invalid email format
            "password": "TestPass123",
            "role": "user"
        }
        
        response = client.post("/auth/register", json=invalid_data)
        
        assert response.status_code == 422

    @pytest.mark.auth
    def test_register_admin_user(self, client: TestClient):
        """Test registration of admin user."""
        admin_data = {
            "username": "adminuser",
            "email": "admin@example.com",
            "password": "AdminPass123",
            "role": "admin"
        }
        
        response = client.post("/auth/register", json=admin_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "admin"


class TestAuthLogin:
    """Test class for login endpoints."""

    @pytest.mark.auth
    def test_login_token_success(self, client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]):
        """Test successful login with form data."""
        response = client.post(
            "/auth/token",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0

    @pytest.mark.auth
    def test_login_json_success(self, client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]):
        """Test successful login with JSON data."""
        response = client.post(
            "/auth/login",
            json={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.auth
    def test_login_wrong_password(self, client: TestClient, created_user: UserModel, test_user_data: Dict[str, Any]):
        """Test login with wrong password fails."""
        response = client.post(
            "/auth/token",
            data={
                "username": test_user_data["username"],
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    @pytest.mark.auth
    def test_login_nonexistent_user(self, client: TestClient):
        """Test login with nonexistent user fails."""
        response = client.post(
            "/auth/token",
            data={
                "username": "nonexistent",
                "password": "TestPass123"
            }
        )
        
        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    @pytest.mark.auth
    def test_login_inactive_user(self, client: TestClient, user_service: UserService, test_user_data: Dict[str, Any]):
        """Test login with inactive user fails."""
        # Create and deactivate user
        from app.schemas.user import UserCreate
        user_create = UserCreate(**test_user_data)
        user = user_service.create_user(user_create)
        user_id = getattr(user, 'id', None)
        if not isinstance(user_id, int) or user_id <= 0:
            return pytest.fail(f"Invalid user ID: {user_id}")
        # Deactivate the user
        is_deactivated = user_service.deactivate_user(user_id)
        if not is_deactivated:
            return pytest.fail("Failed to deactivate user")
        
        response = client.post(
            "/auth/token",
            data={
                "username": test_user_data["username"],
                "password": test_user_data["password"]
            }
        )
        
        assert response.status_code == 400
        assert "Inactive user account" in response.json()["detail"]


class TestAuthProfile:
    """Test class for profile management endpoints."""

    @pytest.mark.auth
    def test_get_current_user(self, client: TestClient, auth_headers: Dict[str, str], created_user: UserModel):
        """Test getting current user profile."""
        response = client.get("/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == created_user.id
        assert data["username"] == created_user.username
        assert data["email"] == created_user.email
        assert "password" not in data

    @pytest.mark.auth
    def test_get_current_user_unauthorized(self, client: TestClient):
        """Test getting current user without authentication fails."""
        response = client.get("/auth/me")
        
        assert response.status_code == 401

    @pytest.mark.auth
    def test_get_current_user_invalid_token(self, client: TestClient):
        """Test getting current user with invalid token fails."""
        response = client.get("/auth/me", headers={"Authorization": "Bearer invalid_token"})
        
        assert response.status_code == 401

    @pytest.mark.auth
    def test_update_user_profile_username(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test updating user profile username."""
        update_data = {"username": "newusername"}
        
        response = client.put("/auth/me", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newusername"

    @pytest.mark.auth
    def test_update_user_profile_email(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test updating user profile email."""
        update_data = {"email": "newemail@example.com"}
        
        response = client.put("/auth/me", json=update_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "newemail@example.com"

    @pytest.mark.auth
    def test_update_user_profile_duplicate_username(self, client: TestClient, auth_headers: Dict[str, str], created_admin: UserModel):
        """Test updating username to existing one fails."""
        update_data = {"username": created_admin.username}
        
        response = client.put("/auth/me", json=update_data, headers=auth_headers)
        
        assert response.status_code == 400
        assert "Username already taken" in response.json()["detail"]

    @pytest.mark.auth
    def test_update_user_role_non_admin(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test non-admin user cannot update role."""
        update_data = {"role": "admin"}
        
        response = client.put("/auth/me", json=update_data, headers=auth_headers)
        
        assert response.status_code == 403
        assert "Not enough permissions" in response.json()["detail"]

    @pytest.mark.auth
    def test_update_user_role_admin(self, client: TestClient, admin_headers: Dict[str, str]):
        """Test admin user can update role."""
        update_data = {"role": "user"}
        
        response = client.put("/auth/me", json=update_data, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "user"


class TestAuthPasswordChange:
    """Test class for password change endpoint."""

    @pytest.mark.auth
    def test_change_password_success(self, client: TestClient, auth_headers: Dict[str, str], test_user_data: Dict[str, Any]):
        """Test successful password change."""
        password_data = {
            "current_password": test_user_data["password"],
            "new_password": "NewTestPass123"
        }
        
        response = client.put("/auth/me/password", json=password_data, headers=auth_headers)
        
        assert response.status_code == 200
        assert "Password updated successfully" in response.json()["message"]

    @pytest.mark.auth
    def test_change_password_wrong_current(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test password change with wrong current password fails."""
        password_data = {
            "current_password": "wrongpassword",
            "new_password": "NewTestPass123"
        }
        
        response = client.put("/auth/me/password", json=password_data, headers=auth_headers)
        
        assert response.status_code == 400
        assert "Current password is incorrect" in response.json()["detail"]

    @pytest.mark.auth
    def test_change_password_weak_new(self, client: TestClient, auth_headers: Dict[str, str], test_user_data: Dict[str, Any]):
        """Test password change with weak new password fails."""
        password_data = {
            "current_password": test_user_data["password"],
            "new_password": "weak"
        }
        
        response = client.put("/auth/me/password", json=password_data, headers=auth_headers)
        
        assert response.status_code == 422

    @pytest.mark.auth
    def test_change_password_unauthorized(self, client: TestClient):
        """Test password change without authentication fails."""
        password_data = {
            "current_password": "TestPass123",
            "new_password": "NewTestPass123"
        }
        
        response = client.put("/auth/me/password", json=password_data)
        
        assert response.status_code == 401


class TestAuthAdminActions:
    """Test class for admin-only endpoints."""

    @pytest.mark.auth
    def test_deactivate_user_admin(self, client: TestClient, admin_headers: Dict[str, str], created_user: UserModel):
        """Test admin can deactivate user."""
        response = client.put(f"/auth/users/{created_user.id}/deactivate", headers=admin_headers)
        
        assert response.status_code == 200
        assert "User deactivated successfully" in response.json()["message"]

    @pytest.mark.auth
    def test_activate_user_admin(self, client: TestClient, admin_headers: Dict[str, str], created_user: UserModel):
        """Test admin can activate user."""
        # First deactivate
        client.put(f"/auth/users/{created_user.id}/deactivate", headers=admin_headers)
        
        # Then activate
        response = client.put(f"/auth/users/{created_user.id}/activate", headers=admin_headers)
        
        assert response.status_code == 200
        assert "User activated successfully" in response.json()["message"]

    @pytest.mark.auth
    def test_deactivate_user_non_admin(self, client: TestClient, auth_headers: Dict[str, str], created_admin: UserModel):
        """Test non-admin cannot deactivate user."""
        response = client.put(f"/auth/users/{created_admin.id}/deactivate", headers=auth_headers)
        
        assert response.status_code == 403

    @pytest.mark.auth
    def test_activate_user_non_admin(self, client: TestClient, auth_headers: Dict[str, str], created_admin: UserModel):
        """Test non-admin cannot activate user."""
        response = client.put(f"/auth/users/{created_admin.id}/activate", headers=auth_headers)
        
        assert response.status_code == 403

    @pytest.mark.auth
    def test_deactivate_nonexistent_user(self, client: TestClient, admin_headers: Dict[str, str]):
        """Test deactivating nonexistent user fails."""
        response = client.put("/auth/users/99999/deactivate", headers=admin_headers)
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    @pytest.mark.auth
    def test_activate_nonexistent_user(self, client: TestClient, admin_headers: Dict[str, str]):
        """Test activating nonexistent user fails."""
        response = client.put("/auth/users/99999/activate", headers=admin_headers)
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

"""
Tests for the users router (admin-only endpoints).
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from typing import Dict, Any


class TestUsersRouterPermissions:
    @pytest.mark.users
    def test_list_users_requires_auth(self, client: TestClient):
        """Unauthenticated GET /users/ should be rejected."""
        resp = client.get("/users/")
        assert resp.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

    @pytest.mark.users
    def test_list_users_requires_admin(self, client: TestClient, auth_headers_csrf: Dict[str, Any]):
        """Authenticated non-admin should receive 403 for GET /users/."""
        resp = client.get(
            "/users/",
            headers=auth_headers_csrf["headers"],
            cookies=auth_headers_csrf["cookies"],
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.users
    def test_update_user_requires_admin(self, client: TestClient, auth_headers_csrf: Dict[str, Any]):
        """PUT /users/{user_id} should be forbidden for non-admin users."""
        resp = client.put(
            "/users/1",
            json={"username": "newname"},
            headers=auth_headers_csrf["headers"],
            cookies=auth_headers_csrf["cookies"],
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.users
    def test_delete_user_requires_admin(self, client: TestClient, auth_headers_csrf: Dict[str, Any]):
        """DELETE /users/{user_id} should be forbidden for non-admin users."""
        resp = client.delete(
            "/users/1",
            headers=auth_headers_csrf["headers"],
            cookies=auth_headers_csrf["cookies"],
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.users
    def test_get_user_tasks_requires_admin(self, client: TestClient, auth_headers_csrf: Dict[str, Any]):
        """GET /users/{user_id}/tasks should be forbidden for non-admin users."""
        resp = client.get(
            "/users/1/tasks",
            headers=auth_headers_csrf["headers"],
            cookies=auth_headers_csrf["cookies"],
        )
        assert resp.status_code == status.HTTP_403_FORBIDDEN


class TestUsersRouterAdminHappyPath:
    @pytest.mark.users
    def test_list_users_as_admin_success(self, client: TestClient, created_admin, user_service):
        """Admin can list users successfully (covers response assembly lines)."""
        # Create access token for admin and set it as cookie
        token = user_service.create_access_token({"sub": created_admin.username})
        resp = client.get(
            "/users/",
            cookies={"taskito_access_token": token},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert isinstance(data, list)
        # Each element should be a dict-like user object when present
        if data:
            assert isinstance(data[0], dict)

    def _get_admin_csrf(self, client: TestClient, user_service, created_admin):
        token = user_service.create_access_token({"sub": created_admin.username})
        resp = client.get("/csrf/token", cookies={"taskito_access_token": token})
        assert resp.status_code == status.HTTP_200_OK
        csrf_token = resp.json().get("csrf_token")
        csrf_cookie = resp.cookies.get("csrf_token")
        assert csrf_token and csrf_cookie
        headers = {"x-csrf-token": csrf_token}
        cookies = {"taskito_access_token": token, "csrf_token": csrf_cookie}
        return headers, cookies

    @pytest.mark.users
    def test_update_user_not_found_admin(self, client: TestClient, created_admin, user_service):
        """Admin updating a nonexistent user returns 404 (covers not-found branch)."""
        headers, cookies = self._get_admin_csrf(client, user_service, created_admin)
        resp = client.put(
            "/users/99999",
            json={"username": "nonexistent"},
            headers=headers,
            cookies=cookies,
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        assert "User not found" in resp.json()["detail"]

    @pytest.mark.users
    def test_delete_user_not_found_admin(self, client: TestClient, created_admin, user_service):
        """Admin deleting a nonexistent user returns 404 (covers not-found branch)."""
        headers, cookies = self._get_admin_csrf(client, user_service, created_admin)
        resp = client.delete(
            "/users/99999",
            headers=headers,
            cookies=cookies,
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND
        assert "User not found" in resp.json()["detail"]

    @pytest.mark.users
    def test_delete_user_success_admin(self, client: TestClient, created_admin, created_user, user_service):
        """Admin can delete an existing user (covers success path and 204 response)."""
        headers, cookies = self._get_admin_csrf(client, user_service, created_admin)
        # created_user fixture provides a valid user to delete
        resp = client.delete(
            f"/users/{created_user.id}",
            headers=headers,
            cookies=cookies,
        )
        assert resp.status_code == status.HTTP_204_NO_CONTENT

    @pytest.mark.users
    def test_get_user_tasks_as_admin(self, client: TestClient, created_admin, created_user, user_service):
        """Admin can fetch user's tasks (covers response assembly for tasks)."""
        token = user_service.create_access_token({"sub": created_admin.username})
        resp = client.get(
            f"/users/{created_user.id}/tasks",
            cookies={"taskito_access_token": token},
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert isinstance(data, list)

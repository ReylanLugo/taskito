from fastapi.testclient import TestClient

from main import app
from app.services.websocket_service import manager


def test_websocket_ping_pong_and_echo() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/tasks") as ws:
        # ping/pong
        ws.send_text("ping")
        msg = ws.receive_text()
        assert msg == "pong"

        # echo back arbitrary message
        ws.send_text("hello")
        assert ws.receive_text() == "hello"

    # After context exit, router should have disconnected the websocket
    assert "tasks" not in manager.active_connections or len(manager.active_connections.get("tasks", set())) == 0


def test_websocket_connect_and_close_immediately() -> None:
    client = TestClient(app)

    with client.websocket_connect("/ws/tasks"):
        # Immediately exit context; server should handle disconnect and cleanup
        pass

    assert "tasks" not in manager.active_connections or len(manager.active_connections.get("tasks", set())) == 0

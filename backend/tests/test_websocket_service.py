import json
import pytest

from app.services.websocket_service import ConnectionManager


class DummyWebSocket:
    """A minimal fake WebSocket that records sent text messages."""

    def __init__(self) -> None:
        self.sent: list[str] = []

    # Starlette's WebSocket send_text is async, so we mirror that
    async def send_text(self, message: str) -> None:  # type: ignore[override]
        self.sent.append(message)

    # Ensure hashable so it can be stored in a set
    def __hash__(self) -> int:
        return id(self)


class TestWebSocketService:
    @pytest.mark.asyncio
    async def test_broadcast_json_sends_to_all_connections(self) -> None:
        manager = ConnectionManager()

        # Prepare two dummy websockets subscribed to the 'tasks' channel
        ws1, ws2 = DummyWebSocket(), DummyWebSocket()
        manager.active_connections["tasks"] = {ws1, ws2}  # type: ignore[arg-type]

        payload = {"type": "test", "value": 123}
        await manager.broadcast_json("tasks", payload)

        # Verify both received exactly one message and it matches the payload
        assert len(ws1.sent) == 1
        assert len(ws2.sent) == 1

        sent1 = json.loads(ws1.sent[0])
        sent2 = json.loads(ws2.sent[0])
        assert sent1 == payload
        assert sent2 == payload

    @pytest.mark.asyncio
    async def test_notify_task_event_wraps_payload(self) -> None:
        manager = ConnectionManager()

        ws = DummyWebSocket()
        manager.active_connections["tasks"] = {ws}  # type: ignore[arg-type]

        task = {"id": 42, "title": "Hello"}
        meta = {"actor_id": 7}

        await manager.notify_task_updated(task, meta=meta)

        assert len(ws.sent) == 1
        data = json.loads(ws.sent[0])

        # Structure asserted according to notify_task_event implementation
        assert data["type"] == "task"
        assert data["event"] == "updated"
        assert data["data"] == task
        assert data["meta"] == meta

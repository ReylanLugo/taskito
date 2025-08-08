from __future__ import annotations

import json
import logging
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Dict, Set, Optional, Any
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """
    Manages active WebSocket connections grouped by channels.

    Example channels: "tasks", "notifications", etc.
    """

    def __init__(self) -> None:
        # channel -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    @staticmethod
    def _safe_default(o: Any):
        """Default serializer for json.dumps to handle non-serializable types."""
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        if isinstance(o, (UUID,)):
            return str(o)
        if isinstance(o, (Decimal,)):
            return float(o)
        if isinstance(o, Enum):
            return o.value
        # Fallback: try Pydantic-like .model_dump() / .dict()
        if hasattr(o, "model_dump"):
            return o.model_dump()
        if hasattr(o, "dict"):
            return o.dict()
        return str(o)

    async def connect(self, websocket: WebSocket, channel: str) -> None:
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        logging.info(f"WebSocket connected (channel={channel}). Total: {len(self.active_connections[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str) -> None:
        try:
            if channel in self.active_connections and websocket in self.active_connections[channel]:
                self.active_connections[channel].remove(websocket)
                logging.info(
                    f"WebSocket disconnected (channel={channel}). Remaining: {len(self.active_connections[channel])}"
                )
                if not self.active_connections[channel]:
                    # cleanup empty channel
                    del self.active_connections[channel]
        except Exception as e:
            logging.error(f"Error during WebSocket disconnect (channel={channel}): {e}")

    async def send_personal_message(self, message: str | dict, websocket: WebSocket) -> None:
        try:
            if isinstance(message, dict):
                await websocket.send_text(json.dumps(message, default=self._safe_default))
            else:
                await websocket.send_text(message)
        except RuntimeError:
            # Socket likely closed
            logging.warning("Attempted to send message to a closed WebSocket")

    async def broadcast(self, channel: str, message: str) -> None:
        if channel not in self.active_connections:
            return
        dead: Set[WebSocket] = set()
        for connection in self.active_connections[channel]:
            try:
                await connection.send_text(message)
            except RuntimeError:
                dead.add(connection)
        for ws in dead:
            self.disconnect(ws, channel)

    async def broadcast_json(self, channel: str, payload: dict) -> None:
        await self.broadcast(channel, json.dumps(payload, default=self._safe_default))

    # Convenience helpers for task events
    async def notify_task_event(self, event: str, data: dict, meta: Optional[dict] = None) -> None:
        """
        Broadcast a task-related event to the "tasks" channel.
        event can be: created | updated | deleted
        """
        payload = {"type": "task", "event": event, "data": data}
        if meta:
            payload["meta"] = meta
        await self.broadcast_json(channel="tasks", payload=payload)

    async def notify_task_created(self, task: dict, meta: Optional[dict] = None) -> None:
        await self.notify_task_event("created", task, meta)

    async def notify_task_updated(self, task: dict, meta: Optional[dict] = None) -> None:
        await self.notify_task_event("updated", task, meta)

    async def notify_task_deleted(self, task_id: int, meta: Optional[dict] = None) -> None:
        await self.notify_task_event("deleted", {"id": task_id}, meta)


# Singleton-ish manager instance to be imported by routers or services
manager = ConnectionManager()

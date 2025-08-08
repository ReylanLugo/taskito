from __future__ import annotations

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_service import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/{channel}")
async def websocket_endpoint(websocket: WebSocket, channel: str):
    """
    Generic WebSocket endpoint. Clients can connect to a specific channel
    (e.g., "tasks") and receive real-time events broadcast to that channel.

    Frontend example:
      const ws = new WebSocket(`wss://<host>/api/ws/tasks`);
      ws.onmessage = (evt) => console.log(JSON.parse(evt.data));
    """
    await manager.connect(websocket, channel)
    try:
        # Keep the connection open; optionally react to client pings/messages
        while True:
            try:
                message = await websocket.receive_text()
                # Simple ping/pong handling and echo for debugging
                if message == "ping":
                    await websocket.send_text("pong")
                else:
                    # No-op or echo back for visibility
                    await websocket.send_text(message)
            except WebSocketDisconnect:
                break
    finally:
        manager.disconnect(websocket, channel)
        logging.info(f"WebSocket closed (channel={channel})")

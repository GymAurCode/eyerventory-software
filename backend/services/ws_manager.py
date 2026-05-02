"""
WebSocket connection manager.
Maintains per-user connection sets so notifications are pushed only to the right user.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("ws-manager")


class ConnectionManager:
    def __init__(self):
        # user_id -> set of active WebSocket connections
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self._connections[user_id].add(websocket)
        logger.info("WS connected user_id=%s total=%s", user_id, len(self._connections[user_id]))

    def disconnect(self, websocket: WebSocket, user_id: int):
        self._connections[user_id].discard(websocket)
        logger.info("WS disconnected user_id=%s remaining=%s", user_id, len(self._connections[user_id]))

    async def send_to_user(self, user_id: int, payload: dict[str, Any]):
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(payload, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[user_id].discard(ws)

    async def broadcast(self, payload: dict[str, Any]):
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, payload)

    def active_user_ids(self) -> list[int]:
        return [uid for uid, conns in self._connections.items() if conns]


# Singleton shared across the app
manager = ConnectionManager()

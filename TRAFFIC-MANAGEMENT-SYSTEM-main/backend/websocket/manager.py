"""
WebSocket Connection Manager — handles multiple client connections
"""
import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)
        logger.info(f"🔌 WS connected. Total: {len(self.active_connections)}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)
        logger.info(f"🔌 WS disconnected. Total: {len(self.active_connections)}")

    async def send_personal(self, websocket: WebSocket, data: dict):
        try:
            await websocket.send_text(json.dumps(data, default=str))
        except Exception as e:
            logger.warning(f"Send error: {e}")
            await self.disconnect(websocket)

    async def broadcast(self, data: dict):
        """Broadcast to all connected clients"""
        if not self.active_connections:
            return
        message = json.dumps(data, default=str)
        dead = set()
        async with self._lock:
            connections = self.active_connections.copy()
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            await self.disconnect(ws)

    @property
    def client_count(self) -> int:
        return len(self.active_connections)

# Singleton manager
ws_manager = ConnectionManager()

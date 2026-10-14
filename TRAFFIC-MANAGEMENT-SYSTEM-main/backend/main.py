"""
AI-Based Smart Traffic Management System — FastAPI Backend
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db.database import connect_db, close_db, get_db, get_settings
from api.auth import router as auth_router, hash_password
from api.cameras import router as cameras_router
from api.analytics import router as analytics_router
from api.alerts import router as alerts_router
from api.reports import router as reports_router
from websocket.manager import ws_manager
from websocket.streamer import simulate_traffic_update, start_all_cameras, stop_all_cameras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 TrafficAI Backend starting...")
    await connect_db()

    db = get_db()

    # Seed default admin user
    if db and not await db.users.find_one({"username": "admin"}):
        await db.users.insert_one({
            "username": "admin",
            "hashed_password": hash_password("password123"),
            "role": "admin",
            "created_at": datetime.utcnow(),
        })
        await db.users.insert_one({
            "username": "operator",
            "hashed_password": hash_password("password123"),
            "role": "operator",
            "created_at": datetime.utcnow(),
        })
        logger.info("✅ Default users seeded: admin / operator (password: password123)")

    # Start AI processing (simulation mode)
    sim_task = asyncio.create_task(simulate_traffic_update())
    app.state.sim_task = sim_task
    logger.info("✅ Traffic simulation started")

    yield

    # Shutdown
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass
    await stop_all_cameras()
    await close_db()
    logger.info("📴 TrafficAI Backend stopped")

# ── App ───────────────────────────────────────────────
app = FastAPI(
    title="TrafficAI — Smart Traffic Management System",
    description="AI-powered real-time traffic monitoring with YOLOv8 and WebSocket",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all domains (including Vercel previews & production)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ───────────────────────────────────────────
app.include_router(auth_router)
app.include_router(cameras_router)
app.include_router(analytics_router)
app.include_router(alerts_router)
app.include_router(reports_router)

# ── Dynamic Settings API ──────────────────────────────
_current_runtime_settings = {
    "yolo_model": "yolov8x",
    "ai_confidence": 0.40,
    "frame_skip": 2,
    "density_low": 5,
    "density_medium": 15,
    "density_high": 30,
    "density_critical": 50,
}

@app.get("/api/settings")
async def get_runtime_settings():
    from api.cameras import detector_instance
    if detector_instance and hasattr(detector_instance, 'model_name'):
        _current_runtime_settings["yolo_model"] = detector_instance.model_name
        _current_runtime_settings["ai_confidence"] = detector_instance.confidence
    return _current_runtime_settings

@app.post("/api/settings")
async def update_runtime_settings(data: dict):
    from api.cameras import set_detector_model
    model_name = data.get("yolo_model", _current_runtime_settings["yolo_model"])
    confidence = float(data.get("ai_confidence", _current_runtime_settings["ai_confidence"]))
    
    # Update active detector
    set_detector_model(model_name=model_name, confidence=confidence)
    _current_runtime_settings.update(data)
    _current_runtime_settings["yolo_model"] = model_name
    _current_runtime_settings["ai_confidence"] = confidence
    
    logger.info(f"✅ Runtime settings updated: YOLO model = {model_name}, confidence = {confidence}")
    return {"message": "Settings updated successfully", "settings": _current_runtime_settings}

# ── WebSocket endpoint ────────────────────────────────
@app.websocket("/ws/traffic")
async def traffic_websocket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial state
        from websocket.streamer import camera_states, compute_stats
        await ws_manager.send_personal(websocket, {
            "type": "connected",
            "message": "Connected to TrafficAI real-time stream",
            "cameras": camera_states,
            "stats": compute_stats(),
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Keep alive
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
            except asyncio.TimeoutError:
                await ws_manager.send_personal(websocket, {"type": "heartbeat", "ts": datetime.utcnow().isoformat()})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await ws_manager.disconnect(websocket)

# ── Health endpoints ───────────────────────────────────
@app.get("/")
async def root():
    return {
        "app": "TrafficAI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "ws": "ws://localhost:8000/ws/traffic",
    }

@app.get("/api/health")
async def health():
    from websocket.streamer import camera_states
    db = get_db()
    db_ok = False
    if db:
        try:
            await db.command("ping")
            db_ok = True
        except Exception:
            pass
    return {
        "status": "healthy",
        "database": "connected" if db_ok else "disconnected",
        "active_cameras": len(camera_states),
        "ws_clients": ws_manager.client_count,
        "timestamp": datetime.utcnow().isoformat(),
    }

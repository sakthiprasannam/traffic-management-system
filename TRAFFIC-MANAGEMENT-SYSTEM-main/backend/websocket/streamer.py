"""
Real-time Traffic Data Streamer
Runs AI processing loops and broadcasts data via WebSocket
"""
import asyncio
import logging
import random
from datetime import datetime
from typing import Dict
from websocket.manager import ws_manager
try:
    from ai.detector import VehicleDetector
    from ai.tracker import VehicleTracker
    from ai.analyzer import TrafficAnalyzer
    from ai.demo_processor import DemoProcessor
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    VehicleDetector = VehicleTracker = TrafficAnalyzer = DemoProcessor = None
from db.database import get_settings

logger = logging.getLogger(__name__)

# Global camera state
camera_states: Dict[str, dict] = {}
camera_tasks: Dict[str, asyncio.Task] = {}

DEMO_CAMERAS = [
    {"camera_id": "CAM01", "camera_name": "CAM 01 — North Junction", "demo_video": "uploads/cam01_junction.mp4"},
    {"camera_id": "CAM02", "camera_name": "CAM 02 — East Corridor", "demo_video": "uploads/cam02_corridor.mp4"},
    {"camera_id": "CAM03", "camera_name": "CAM 03 — South Highway", "demo_video": "uploads/cam03_highway.mp4"},
    {"camera_id": "CAM04", "camera_name": "CAM 04 — West Bridge", "demo_video": "uploads/cam04_bridge.mp4"},
]

async def on_camera_result(result: dict):
    """Callback when a camera produces new analysis results"""
    cam_id = result["camera_id"]
    camera_states[cam_id] = {**result, "active": True, "last_update": datetime.utcnow().isoformat()}

    # Build broadcast payload
    payload = {
        "type": "traffic_update",
        "cameras": {cam_id: camera_states[cam_id]},
        "stats": compute_stats(),
        "alerts": [a for state in camera_states.values() for a in state.get("alerts", [])][:10],
        "timestamp": datetime.utcnow().isoformat(),
    }
    await ws_manager.broadcast(payload)

def compute_stats() -> dict:
    if not camera_states:
        return {"total_vehicles": 0, "active_cameras": 0, "alerts_today": 0, "avg_density": "Low"}
    total = sum(s.get("vehicle_count", 0) for s in camera_states.values())
    active = sum(1 for s in camera_states.values() if s.get("active"))
    alerts = sum(len(s.get("alerts", [])) for s in camera_states.values())
    densities = [s.get("density", "Low") for s in camera_states.values()]
    priority = ["Critical", "High", "Medium", "Low"]
    peak = "Low"
    for d in priority:
        if d in densities:
            peak = d
            break
    return {
        "total_vehicles": total,
        "active_cameras": active,
        "alerts_today": alerts,
        "avg_density": peak,
    }

async def start_camera_processing(camera: dict, db=None):
    """Start AI processing loop for a single camera"""
    settings = get_settings()
    cam_id = camera["camera_id"]

    detector = VehicleDetector(
        model_name=settings.YOLO_MODEL,
        confidence=settings.AI_CONFIDENCE,
        iou_threshold=settings.IOU_THRESHOLD,
        imgsz=settings.IMAGE_SIZE,
        min_box_width=settings.MIN_BOX_WIDTH,
        min_box_height=settings.MIN_BOX_HEIGHT,
    )
    # Each camera gets its own tracker with camera_id for per-camera counting line
    tracker = VehicleTracker(camera_id=cam_id)
    analyzer = TrafficAnalyzer(thresholds={
        "Low":      (0, settings.DENSITY_LOW),
        "Medium":   (settings.DENSITY_LOW, settings.DENSITY_MEDIUM),
        "High":     (settings.DENSITY_MEDIUM, settings.DENSITY_HIGH),
        "Critical": (settings.DENSITY_HIGH, float("inf")),
    })
    processor = DemoProcessor(
        video_path=camera.get("demo_video"),
        frame_skip=settings.FRAME_SKIP,
    )

    try:
        await processor.process_loop(
            camera_id=cam_id,
            camera_name=camera["camera_name"],
            detector=detector,
            tracker=tracker,
            analyzer=analyzer,
            on_result=on_camera_result,
            db=db,
        )
    except asyncio.CancelledError:
        processor.stop()

async def start_all_cameras(db=None):
    """Initialize all demo cameras"""
    logger.info("🚦 Starting all camera processing tasks...")

    # Load cameras from DB if available
    cameras = DEMO_CAMERAS.copy()
    if db:
        try:
            async for cam in db.cameras.find({"status": "online"}):
                cameras.append({
                    "camera_id": cam["camera_id"],
                    "camera_name": cam["name"],
                    "demo_video": cam.get("demo_video"),
                })
        except Exception as e:
            logger.warning(f"Could not load cameras from DB: {e}")

    for camera in cameras:
        cam_id = camera["camera_id"]
        if cam_id not in camera_tasks:
            task = asyncio.create_task(start_camera_processing(camera, db))
            camera_tasks[cam_id] = task
            logger.info(f"✅ Camera task started: {camera['camera_name']}")

async def stop_all_cameras():
    """Stop all camera processing"""
    for cam_id, task in camera_tasks.items():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    camera_tasks.clear()
    logger.info("⏹ All camera tasks stopped")

async def simulate_traffic_update():
    """
    Lightweight simulation fallback — generates realistic fake data
    Used when running in pure demo mode without OpenCV
    """
    DENSITIES = ["Low", "Medium", "High", "Critical"]
    WEIGHTS = [0.4, 0.3, 0.2, 0.1]
    cam_names = [
        ("CAM01", "CAM 01 — North Junction"),
        ("CAM02", "CAM 02 — East Corridor"),
        ("CAM03", "CAM 03 — South Highway"),
        ("CAM04", "CAM 04 — West Bridge"),
    ]
    while True:
        cameras = {}
        all_alerts = []
        for cam_id, cam_name in cam_names:
            density = random.choices(DENSITIES, weights=WEIGHTS)[0]
            count = {"Low": random.randint(5, 14), "Medium": random.randint(15, 29), "High": random.randint(30, 49), "Critical": random.randint(50, 80)}[density]
            cars = int(count * 0.55)
            bikes = int(count * 0.20)
            buses = int(count * 0.12)
            trucks = count - cars - bikes - buses
            incident = random.random() < 0.03
            emergency = random.random() < 0.02

            state = {
                "camera_id": cam_id, "camera_name": cam_name,
                "active": True, "density": density,
                "vehicle_count": count,
                "vehicle_counts": {"cars": cars, "bikes": bikes, "buses": buses, "trucks": trucks, "total": count},
                "incident_detected": incident,
                "emergency_vehicle": emergency,
                "congestion": density == "Critical",
                "fps": round(random.uniform(22, 26), 1),
                "alerts": [],
                "last_update": datetime.utcnow().isoformat(),
            }
            if incident:
                state["alerts"].append({"severity": "high", "message": "Stopped vehicle detected", "camera_name": cam_name})
                all_alerts.append(state["alerts"][-1])
            if emergency:
                state["alerts"].append({"severity": "warning", "message": "Emergency vehicle", "camera_name": cam_name})
                all_alerts.append(state["alerts"][-1])
            cameras[cam_id] = state

        payload = {
            "type": "traffic_update",
            "cameras": cameras,
            "stats": {
                "total_vehicles": sum(c["vehicle_count"] for c in cameras.values()),
                "active_cameras": 4,
                "alerts_today": len(all_alerts),
                "avg_density": max(cameras.values(), key=lambda x: DENSITIES.index(x["density"]) if x["density"] in DENSITIES else 0)["density"],
            },
            "alerts": all_alerts,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await ws_manager.broadcast(payload)
        await asyncio.sleep(2)

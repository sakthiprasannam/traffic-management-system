from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Optional
from pydantic import BaseModel
import uuid, os, aiofiles, base64
from db.database import get_db, get_settings
from db.models import CameraCreate, CameraModel
from api.auth import get_current_user
from datetime import datetime
try:
    import numpy as np
    import cv2
    from ai.detector import VehicleDetector
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    VehicleDetector = None
    np = None
    cv2 = None

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

UPLOAD_DIR = "uploads"

# Load detector once at startup (only if AI packages are available)
_settings = get_settings()
if AI_AVAILABLE and VehicleDetector:
    detector_instance = VehicleDetector(
        model_name=_settings.YOLO_MODEL,
        confidence=_settings.AI_CONFIDENCE,
        iou_threshold=_settings.IOU_THRESHOLD,
        imgsz=_settings.IMAGE_SIZE,
        min_box_width=_settings.MIN_BOX_WIDTH,
        min_box_height=_settings.MIN_BOX_HEIGHT,
    )
else:
    detector_instance = None

def set_detector_model(model_name: str, confidence: float = 0.40):
    global detector_instance
    if not AI_AVAILABLE or not VehicleDetector:
        return None
    detector_instance = VehicleDetector(
        model_name=model_name,
        confidence=confidence,
        iou_threshold=_settings.IOU_THRESHOLD,
        imgsz=_settings.IMAGE_SIZE,
        min_box_width=_settings.MIN_BOX_WIDTH,
        min_box_height=_settings.MIN_BOX_HEIGHT,
    )
    return detector_instance


class FrameDetectRequest(BaseModel):
    image: str
    camera_id: str = "DEFAULT"   # used for per-camera ROI filtering


@router.get("/", response_model=List[dict])
async def list_cameras(db=Depends(get_db), _=Depends(get_current_user)):
    cameras = []
    async for cam in db.cameras.find({}, {"_id": 0}):
        cameras.append(cam)
    return cameras


@router.post("/")
async def create_camera(data: CameraCreate, db=Depends(get_db), _=Depends(get_current_user)):
    camera_id = str(uuid.uuid4())[:8].upper()
    camera = {
        "camera_id": camera_id,
        "name": data.name,
        "location": data.location,
        "ip": data.ip,
        "mode": data.mode,
        "fps": data.fps,
        "status": "offline",
        "created_at": datetime.utcnow(),
    }
    await db.cameras.insert_one(camera)
    camera.pop("_id", None)
    return camera


@router.put("/{camera_id}")
async def update_camera(camera_id: str, data: dict, db=Depends(get_db), _=Depends(get_current_user)):
    data.pop("camera_id", None)
    data.pop("_id", None)
    result = await db.cameras.update_one({"camera_id": camera_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"message": "Camera updated"}


@router.delete("/{camera_id}")
async def delete_camera(camera_id: str, db=Depends(get_db), _=Depends(get_current_user)):
    result = await db.cameras.delete_one({"camera_id": camera_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"message": "Camera deleted"}


@router.post("/{camera_id}/upload-demo")
async def upload_demo_video(
    camera_id: str,
    file: UploadFile = File(...),
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{camera_id}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(filepath, "wb") as out:
        content = await file.read()
        await out.write(content)
    await db.cameras.update_one(
        {"camera_id": camera_id},
        {"$set": {"demo_video": filepath, "mode": "demo"}}
    )
    return {"message": "Demo video uploaded", "path": filepath}


@router.get("/{camera_id}/status")
async def camera_status(camera_id: str, db=Depends(get_db), _=Depends(get_current_user)):
    cam = await db.cameras.find_one({"camera_id": camera_id}, {"_id": 0})
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return cam


@router.post("/detect-frame")
async def detect_frame_endpoint(data: FrameDetectRequest):
    """
    Per-frame detection endpoint used by React frontend camera feeds.
    Accepts a base64 JPEG, runs YOLOv8s inference with ROI filtering,
    returns detections, counts, and density.
    """
    try:
        img_data = data.image
        if "," in img_data:
            img_data = img_data.split(",", 1)[1]
        raw_bytes = base64.b64decode(img_data)
        np_arr = np.frombuffer(raw_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            return {
                "count": 0, "density": "Low",
                "counts": {"cars": 0, "bikes": 0, "autos": 0, "buses": 0, "trucks": 0},
                "detections": []
            }

        # Detect with per-camera ROI (no tracking for single-frame endpoint)
        detections, _ = detector_instance.detect(frame, camera_id=data.camera_id, use_tracking=False)

        # Count by class
        autos  = sum(1 for d in detections if d["class_name"] in ("auto", "auto_rickshaw"))
        bikes  = sum(1 for d in detections if d["class_name"] == "motorcycle")
        cars   = sum(1 for d in detections if d["class_name"] == "car")
        buses  = sum(1 for d in detections if d["class_name"] == "bus")
        trucks = sum(1 for d in detections if d["class_name"] == "truck")
        total  = len(detections)

        # Density from settings thresholds
        s = _settings
        density = (
            "Critical" if total > s.DENSITY_HIGH else
            "High"     if total > s.DENSITY_MEDIUM else
            "Medium"   if total > s.DENSITY_LOW else
            "Low"
        )

        return {
            "count": total,
            "density": density,
            "counts": {"cars": cars, "bikes": bikes, "autos": autos, "buses": buses, "trucks": trucks},
            "detections": detections,
        }

    except Exception as e:
        return {
            "count": 0, "density": "Low",
            "counts": {"cars": 0, "bikes": 0, "autos": 0, "buses": 0, "trucks": 0},
            "detections": [],
            "error": str(e)
        }

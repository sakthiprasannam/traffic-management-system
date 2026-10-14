from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

# ── User ──────────────────────────────────────────────
class UserInDB(BaseModel):
    id: Optional[str] = None
    username: str
    hashed_password: str
    role: str = "operator"  # admin | operator
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserOut(BaseModel):
    username: str
    role: str

# ── Camera ────────────────────────────────────────────
class CameraModel(BaseModel):
    camera_id: str
    name: str
    location: str
    ip: Optional[str] = None
    mode: str = "demo"  # live | demo
    demo_video: Optional[str] = None
    fps: int = 24
    status: str = "offline"  # online | offline
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CameraCreate(BaseModel):
    name: str
    location: str
    ip: Optional[str] = None
    mode: str = "demo"
    fps: int = 24

# ── Traffic Record ────────────────────────────────────
class VehicleCounts(BaseModel):
    cars: int = 0
    bikes: int = 0
    buses: int = 0
    trucks: int = 0
    total: int = 0

class LaneData(BaseModel):
    lane_id: int
    vehicle_count: int
    density: str = "Low"
    avg_speed: Optional[float] = None

class TrafficRecord(BaseModel):
    camera_id: str
    camera_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    vehicle_counts: VehicleCounts
    density: str = "Low"  # Low | Medium | High | Critical
    lanes: List[LaneData] = []
    incident_detected: bool = False
    emergency_vehicle: bool = False
    congestion: bool = False
    fps: float = 0.0
    unique_vehicle_ids: List[int] = []

# ── Alert ─────────────────────────────────────────────
class AlertModel(BaseModel):
    id: Optional[str] = None
    camera_id: str
    camera_name: str
    severity: str  # critical | high | warning | info
    message: str
    description: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False
    resolved: bool = False

class AlertCreate(BaseModel):
    camera_id: str
    camera_name: str
    severity: str
    message: str
    description: Optional[str] = None

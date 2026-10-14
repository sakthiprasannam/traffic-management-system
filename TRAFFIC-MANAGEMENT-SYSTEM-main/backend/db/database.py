"""
Database Manager for TrafficAI
Supports both Real MongoDB (via motor) and a fully persistent Local JSON Document Database
Zero external dependencies required — saves all data directly to backend/db/traffic_db.json
"""

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from functools import lru_cache
import os
import json
import copy
import asyncio
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "traffic_management"
    SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ── YOLO Model ──────────────────────────────────────────
    YOLO_MODEL: str = "yolov8x"

    # ── Detection Parameters ────────────────────────────────
    AI_CONFIDENCE: float = 0.40
    IOU_THRESHOLD: float = 0.50
    IMAGE_SIZE: int = 960
    MIN_BOX_WIDTH: int = 25
    MIN_BOX_HEIGHT: int = 25

    # ── Traffic Density Thresholds ──────────────────────────
    DENSITY_LOW: int = 5
    DENSITY_MEDIUM: int = 15
    DENSITY_HIGH: int = 30

    # ── Processing ──────────────────────────────────────────
    FRAME_SKIP: int = 2

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

DB_FILE_PATH = os.path.join(os.path.dirname(__file__), "traffic_db.json")

# ── Persistent Local Document Store ────────────────────────────────────────

def _serialize_val(val):
    if isinstance(val, datetime):
        return {"__type__": "datetime", "value": val.isoformat()}
    return val

def _deserialize_val(val):
    if isinstance(val, dict) and val.get("__type__") == "datetime":
        try:
            return datetime.fromisoformat(val["value"])
        except Exception:
            return datetime.utcnow()
    return val

def _serialize_doc(doc):
    out = {}
    for k, v in doc.items():
        if isinstance(v, dict):
            out[k] = _serialize_doc(v)
        elif isinstance(v, list):
            out[k] = [_serialize_doc(item) if isinstance(item, dict) else _serialize_val(item) for item in v]
        else:
            out[k] = _serialize_val(v)
    return out

def _deserialize_doc(doc):
    out = {}
    for k, v in doc.items():
        if isinstance(v, dict):
            if v.get("__type__") == "datetime":
                out[k] = _deserialize_val(v)
            else:
                out[k] = _deserialize_doc(v)
        elif isinstance(v, list):
            out[k] = [_deserialize_doc(item) if isinstance(item, dict) else _deserialize_val(item) for item in v]
        else:
            out[k] = _deserialize_val(v)
    return out


class PersistentCursor:
    def __init__(self, data):
        self.data = data
        self.index = 0

    def sort(self, *args, **kwargs):
        if args and isinstance(args[0], list) and args[0]:
            key, direction = args[0][0]
            self.data = sorted(
                self.data,
                key=lambda x: x.get(key) if x.get(key) is not None else datetime.min,
                reverse=(direction == -1)
            )
        elif args and isinstance(args[0], str):
            key = args[0]
            direction = args[1] if len(args) > 1 else 1
            self.data = sorted(
                self.data,
                key=lambda x: x.get(key) if x.get(key) is not None else datetime.min,
                reverse=(direction == -1)
            )
        return self

    def limit(self, n):
        self.data = self.data[:n]
        return self

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.index >= len(self.data):
            raise StopAsyncIteration
        val = self.data[self.index]
        self.index += 1
        return val

    async def to_list(self, length=None):
        if length is not None:
            return self.data[:length]
        return self.data


class PersistentCollection:
    def __init__(self, name, parent_db):
        self.name = name
        self.parent_db = parent_db
        self.data = []

    async def create_index(self, *args, **kwargs):
        pass

    async def find_one(self, filter=None, projection=None):
        filter = filter or {}
        for doc in self.data:
            match = True
            for k, v in filter.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                res = copy.deepcopy(doc)
                if projection and "_id" not in projection:
                    res.pop("_id", None)
                return res
        return None

    async def insert_one(self, doc):
        import uuid
        doc_copy = copy.deepcopy(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = str(uuid.uuid4())
        self.data.append(doc_copy)
        self.parent_db.save_to_disk()
        return doc_copy

    def find(self, filter=None, projection=None):
        filter = filter or {}
        matches = []
        for doc in self.data:
            match = True
            for k, v in filter.items():
                val = doc.get(k)
                if isinstance(v, dict):
                    if "$regex" in v:
                        import re
                        if not re.search(v["$regex"], str(val or ""), re.IGNORECASE if "i" in v.get("$options", "") else 0):
                            match = False
                            break
                    elif "$gte" in v:
                        if val is None or val < v["$gte"]:
                            match = False
                            break
                    elif "$lt" in v:
                        if val is None or val >= v["$lt"]:
                            match = False
                            break
                elif val != v:
                    match = False
                    break
            if match:
                res = copy.deepcopy(doc)
                if projection and "_id" not in projection:
                    res.pop("_id", None)
                matches.append(res)
        return PersistentCursor(matches)

    async def update_one(self, filter, update):
        for d in self.data:
            match = True
            for k, v in filter.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        d[sk] = sv
                self.parent_db.save_to_disk()
                class Result:
                    matched_count = 1
                return Result()
        class Result:
            matched_count = 0
        return Result()

    async def update_many(self, filter, update):
        count = 0
        for d in self.data:
            match = True
            for k, v in filter.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        d[sk] = sv
                count += 1
        if count > 0:
            self.parent_db.save_to_disk()
        class Result:
            modified_count = count
        return Result()

    async def delete_one(self, filter):
        for i, d in enumerate(self.data):
            match = True
            for k, v in filter.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                self.data.pop(i)
                self.parent_db.save_to_disk()
                class Result:
                    deleted_count = 1
                return Result()
        class Result:
            deleted_count = 0
        return Result()

    async def count_documents(self, filter=None):
        filter = filter or {}
        count = 0
        for d in self.data:
            match = True
            for k, v in filter.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count

    def aggregate(self, pipeline):
        # 1. Match Stage
        matched = list(self.data)
        for stage in pipeline:
            if "$match" in stage:
                cond = stage["$match"]
                res = []
                for d in matched:
                    m = True
                    for k, v in cond.items():
                        val = d.get(k)
                        if isinstance(v, dict) and "$gte" in v:
                            if val is None or val < v["$gte"]:
                                m = False
                                break
                        elif val != v:
                            m = False
                            break
                    if m:
                        res.append(d)
                matched = res

        # 2. Group Stage
        for stage in pipeline:
            if "$group" in stage:
                group_spec = stage["$group"]
                group_id = group_spec.get("_id")

                if group_id == {"$hour": "$timestamp"}:
                    by_hour = {}
                    for d in matched:
                        ts = d.get("timestamp")
                        hour = ts.hour if isinstance(ts, datetime) else 12
                        if hour not in by_hour:
                            by_hour[hour] = {"_id": hour, "count": 0, "cars": 0, "bikes": 0, "buses": 0, "trucks": 0}
                        by_hour[hour]["count"] += d.get("vehicle_counts", {}).get("total", 1)
                        by_hour[hour]["cars"] += d.get("vehicle_counts", {}).get("cars", 0)
                        by_hour[hour]["bikes"] += d.get("vehicle_counts", {}).get("bikes", 0)
                        by_hour[hour]["buses"] += d.get("vehicle_counts", {}).get("buses", 0)
                        by_hour[hour]["trucks"] += d.get("vehicle_counts", {}).get("trucks", 0)
                    return PersistentCursor(list(by_hour.values()))

                elif group_id == "$camera_id":
                    by_cam = {}
                    for d in matched:
                        cid = d.get("camera_id", "CAM01")
                        cname = d.get("camera_name", "Camera")
                        if cid not in by_cam:
                            by_cam[cid] = {"_id": cid, "camera_name": cname, "vehicles": 0, "incidents": 0}
                        by_cam[cid]["vehicles"] += d.get("vehicle_counts", {}).get("total", 0)
                        if d.get("incident_detected"):
                            by_cam[cid]["incidents"] += 1
                    return PersistentCursor(list(by_cam.values()))

                elif group_id is None:
                    total_v = sum(d.get("vehicle_counts", {}).get("total", 0) for d in matched)
                    total_c = sum(d.get("vehicle_counts", {}).get("cars", 0) for d in matched)
                    total_b = sum(d.get("vehicle_counts", {}).get("bikes", 0) for d in matched)
                    total_bus = sum(d.get("vehicle_counts", {}).get("buses", 0) for d in matched)
                    total_trk = sum(d.get("vehicle_counts", {}).get("trucks", 0) for d in matched)
                    incidents = sum(1 for d in matched if d.get("incident_detected"))
                    emergencies = sum(1 for d in matched if d.get("emergency_vehicle"))

                    return PersistentCursor([{
                        "total_vehicles": total_v,
                        "total_cars": total_c,
                        "total_bikes": total_b,
                        "total_buses": total_bus,
                        "total_trucks": total_trk,
                        "incidents": incidents,
                        "emergency_events": emergencies,
                        "records": len(matched),
                    }])

        return PersistentCursor(matched)


class PersistentDatabase:
    def __init__(self, file_path=DB_FILE_PATH):
        self.file_path = file_path
        self.collections = {}
        self.load_from_disk()

    def __getattr__(self, name):
        if name not in self.collections:
            self.collections[name] = PersistentCollection(name, self)
        return self.collections[name]

    async def command(self, cmd):
        return {"ok": 1.0}

    def load_from_disk(self):
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    for col_name, docs in raw_data.items():
                        col = PersistentCollection(col_name, self)
                        col.data = [_deserialize_doc(d) for d in docs]
                        self.collections[col_name] = col
                logger.info(f"Persistent database loaded from {self.file_path}")
            except Exception as e:
                logger.warning(f"Could not load database file: {e}")

    def save_to_disk(self):
        try:
            raw_data = {}
            for col_name, col in self.collections.items():
                raw_data[col_name] = [_serialize_doc(d) for d in col.data]
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(raw_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save database to disk: {e}")


# ── Global Database Instance ───────────────────────────────────────────────

class Database:
    client = None
    db = None

db_instance = Database()

DEFAULT_CAMERAS = [
    {"camera_id": "CAM01", "name": "CAM 01 — North Junction", "location": "North Intersection", "ip": "192.168.1.101", "mode": "demo", "fps": 25, "status": "online"},
    {"camera_id": "CAM02", "name": "CAM 02 — East Corridor", "location": "East Expressway", "ip": "192.168.1.102", "mode": "demo", "fps": 25, "status": "online"},
    {"camera_id": "CAM03", "name": "CAM 03 — South Highway", "location": "South Overpass", "ip": "192.168.1.103", "mode": "demo", "fps": 25, "status": "online"},
    {"camera_id": "CAM04", "name": "CAM 04 — West Bridge", "location": "West River Crossing", "ip": "192.168.1.104", "mode": "demo", "fps": 25, "status": "online"},
]

async def seed_defaults(db):
    """Ensure default cameras and admin user always exist"""
    try:
        from api.auth import hash_password
        # Seed Admin User
        if not await db.users.find_one({"username": "admin"}):
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
            logger.info("Seeded default users: admin / operator")

        # Seed Default Cameras
        for cam in DEFAULT_CAMERAS:
            existing = await db.cameras.find_one({"camera_id": cam["camera_id"]})
            if not existing:
                await db.cameras.insert_one({**cam, "created_at": datetime.utcnow()})
                logger.info(f"Seeded camera: {cam['name']}")

    except Exception as e:
        logger.warning(f"Seed defaults warning: {e}")

async def connect_db():
    settings = get_settings()
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=1500)
        await db_instance.client.admin.command("ping")
        db_instance.db = db_instance.client[settings.MONGODB_DB]
        print("[OK] Connected to MongoDB:", settings.MONGODB_DB)
    except Exception as e:
        print("[OK] Using Persistent Local Database (Disk:", DB_FILE_PATH, ")")
        db_instance.client = None
        db_instance.db = PersistentDatabase()

    await seed_defaults(db_instance.db)

async def close_db():
    if db_instance.client:
        db_instance.client.close()
        print("[OK] MongoDB disconnected")
    elif isinstance(db_instance.db, PersistentDatabase):
        db_instance.db.save_to_disk()
        print("[OK] Persistent Local Database saved to disk")

def get_db():
    return db_instance.db

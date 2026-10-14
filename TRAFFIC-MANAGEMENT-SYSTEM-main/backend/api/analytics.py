# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timedelta
from db.database import get_db
from api.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/summary")
async def get_summary(
    camera_id: Optional[str] = None,
    hours: int = Query(default=24, le=168),
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    since = datetime.utcnow() - timedelta(hours=hours)
    match = {"timestamp": {"$gte": since}}
    if camera_id:
        match["camera_id"] = camera_id

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": None,
            "total_vehicles": {"$sum": "$vehicle_counts.total"},
            "total_cars": {"$sum": "$vehicle_counts.cars"},
            "total_bikes": {"$sum": "$vehicle_counts.bikes"},
            "total_buses": {"$sum": "$vehicle_counts.buses"},
            "total_trucks": {"$sum": "$vehicle_counts.trucks"},
            "incidents": {"$sum": {"$cond": ["$incident_detected", 1, 0]}},
            "emergency_events": {"$sum": {"$cond": ["$emergency_vehicle", 1, 0]}},
            "records": {"$sum": 1},
        }}
    ]
    results = await db.traffic_records.aggregate(pipeline).to_list(1)
    summary = results[0] if results else {
        "total_vehicles": 0, "total_cars": 0, "total_bikes": 0,
        "total_buses": 0, "total_trucks": 0, "incidents": 0,
        "emergency_events": 0, "records": 0,
    }
    summary.pop("_id", None)
    return summary

@router.get("/hourly")
async def get_hourly(
    camera_id: Optional[str] = None,
    date: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    if date:
        start = datetime.strptime(date, "%Y-%m-%d")
        end = start + timedelta(days=1)
    else:
        end = datetime.utcnow()
        start = end - timedelta(hours=24)

    match = {"timestamp": {"$gte": start, "$lt": end}}
    if camera_id:
        match["camera_id"] = camera_id

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$hour": "$timestamp"},
            "count": {"$sum": "$vehicle_counts.total"},
            "cars": {"$sum": "$vehicle_counts.cars"},
            "bikes": {"$sum": "$vehicle_counts.bikes"},
            "buses": {"$sum": "$vehicle_counts.buses"},
            "trucks": {"$sum": "$vehicle_counts.trucks"},
        }},
        {"$sort": {"_id": 1}}
    ]
    results = await db.traffic_records.aggregate(pipeline).to_list(24)
    return [
        {
            "hour": f"{r['_id']:02d}:00",
            "count": r["count"],
            "cars": r["cars"], "bikes": r["bikes"],
            "buses": r["buses"], "trucks": r["trucks"],
        }
        for r in results
    ]

@router.get("/density-history")
async def get_density_history(
    camera_id: Optional[str] = None,
    limit: int = Query(default=50, le=500),
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    match = {}
    if camera_id:
        match["camera_id"] = camera_id
    records = []
    cursor = db.traffic_records.find(match, {"_id": 0}).sort("timestamp", -1).limit(limit)
    async for r in cursor:
        r["timestamp"] = r["timestamp"].isoformat()
        records.append(r)
    return records

@router.get("/by-camera")
async def stats_by_camera(db=Depends(get_db), _=Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(hours=24)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": "$camera_id",
            "camera_name": {"$last": "$camera_name"},
            "vehicles": {"$sum": "$vehicle_counts.total"},
            "incidents": {"$sum": {"$cond": ["$incident_detected", 1, 0]}},
        }},
        {"$sort": {"vehicles": -1}}
    ]
    results = await db.traffic_records.aggregate(pipeline).to_list(10)
    return [{"camera": r["_id"], "name": r.get("camera_name",""), "vehicles": r["vehicles"], "incidents": r["incidents"]} for r in results]

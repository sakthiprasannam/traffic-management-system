from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime
from db.database import get_db
from db.models import AlertCreate
from api.auth import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("/")
async def list_alerts(
    limit: int = Query(default=50, le=200),
    severity: Optional[str] = None,
    resolved: Optional[bool] = False,
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    match = {"resolved": resolved}
    if severity:
        match["severity"] = severity
    alerts = []
    cursor = db.alerts.find(match, {"_id": 0}).sort("timestamp", -1).limit(limit)
    async for a in cursor:
        a["timestamp"] = a["timestamp"].isoformat()
        alerts.append(a)
    return alerts

@router.post("/")
async def create_alert(data: AlertCreate, db=Depends(get_db), _=Depends(get_current_user)):
    import uuid
    alert = {
        "id": str(uuid.uuid4()),
        "camera_id": data.camera_id,
        "camera_name": data.camera_name,
        "severity": data.severity,
        "message": data.message,
        "description": data.description,
        "timestamp": datetime.utcnow(),
        "read": False,
        "resolved": False,
    }
    await db.alerts.insert_one(alert)
    alert.pop("_id", None)
    alert["timestamp"] = alert["timestamp"].isoformat()
    return alert

@router.patch("/{alert_id}/read")
async def mark_read(alert_id: str, db=Depends(get_db), _=Depends(get_current_user)):
    await db.alerts.update_one({"id": alert_id}, {"$set": {"read": True}})
    return {"message": "Marked as read"}

@router.patch("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, db=Depends(get_db), _=Depends(get_current_user)):
    await db.alerts.update_one({"id": alert_id}, {"$set": {"resolved": True, "read": True}})
    return {"message": "Alert resolved"}

@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, db=Depends(get_db), _=Depends(get_current_user)):
    await db.alerts.delete_one({"id": alert_id})
    return {"message": "Alert deleted"}

@router.post("/mark-all-read")
async def mark_all_read(db=Depends(get_db), _=Depends(get_current_user)):
    await db.alerts.update_many({"read": False}, {"$set": {"read": True}})
    return {"message": "All alerts marked as read"}

@router.get("/count")
async def alert_count(db=Depends(get_db), _=Depends(get_current_user)):
    total = await db.alerts.count_documents({"resolved": False})
    unread = await db.alerts.count_documents({"read": False, "resolved": False})
    return {"total": total, "unread": unread}

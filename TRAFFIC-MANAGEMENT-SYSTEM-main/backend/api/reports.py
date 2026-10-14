from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timedelta
import io, csv, pandas as pd
from db.database import get_db
from api.auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

async def fetch_records(db, start: str, end: str, camera: Optional[str]):
    start_dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d") + timedelta(days=1)
    match = {"timestamp": {"$gte": start_dt, "$lt": end_dt}}
    if camera and camera != "ALL":
        match["camera_name"] = {"$regex": camera, "$options": "i"}

    records = []
    async for r in db.traffic_records.find(match, {"_id": 0}).sort("timestamp", -1):
        records.append({
            "Date": r["timestamp"].strftime("%Y-%m-%d"),
            "Time": r["timestamp"].strftime("%H:%M:%S"),
            "Camera": r.get("camera_name", ""),
            "Total Vehicles": r.get("vehicle_counts", {}).get("total", 0),
            "Cars": r.get("vehicle_counts", {}).get("cars", 0),
            "Bikes": r.get("vehicle_counts", {}).get("bikes", 0),
            "Buses": r.get("vehicle_counts", {}).get("buses", 0),
            "Trucks": r.get("vehicle_counts", {}).get("trucks", 0),
            "Density": r.get("density", ""),
            "Incident": r.get("incident_detected", False),
            "Emergency": r.get("emergency_vehicle", False),
            "FPS": round(r.get("fps", 0), 1),
        })
    return records

@router.get("/csv")
async def export_csv(
    start: str = Query(default="2026-08-21"),
    end: str = Query(default="2026-08-21"),
    camera: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    records = await fetch_records(db, start, end, camera)

    output = io.StringIO()
    if records:
        writer = csv.DictWriter(output, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    else:
        output.write("No data found for the selected period\n")

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=traffic_{start}_{end}.csv"}
    )

@router.get("/pdf")
async def export_pdf(
    start: str = Query(default="2026-08-21"),
    end: str = Query(default="2026-08-21"),
    camera: Optional[str] = None,
    db=Depends(get_db),
    _=Depends(get_current_user)
):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import cm

    records = await fetch_records(db, start, end, camera)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle('title', fontSize=16, fontName='Helvetica-Bold', spaceAfter=6)
    story.append(Paragraph("AI Traffic Management System — Report", title_style))
    story.append(Paragraph(f"Period: {start} to {end} | Camera: {camera or 'All'}", styles['Normal']))
    story.append(Spacer(1, 0.5*cm))

    if records:
        headers = list(records[0].keys())
        data = [headers] + [[str(r[h]) for h in headers] for r in records[:100]]
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a5f')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f4f8')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
    else:
        story.append(Paragraph("No data found for the selected period.", styles['Normal']))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=traffic_{start}_{end}.pdf"}
    )

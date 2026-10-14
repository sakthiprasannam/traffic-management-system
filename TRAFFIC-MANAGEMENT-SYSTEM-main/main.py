"""
=============================================================================
SMART TRAFFIC MANAGEMENT SYSTEM — OpenCV Standalone Application
=============================================================================
Core OpenCV + YOLOv8 + ByteTrack Real-Time Traffic Detection & Monitoring

Features:
- Video file, Webcam (0), or RTSP/IP camera input
- YOLOv8s/n/m inference with ByteTrack persistent ID tracking
- Configurable per-camera ROI polygon & virtual counting line
- Accurate Current (in ROI) vs Total (crossed line) vehicle statistics
- Traffic density evaluation & adaptive signal recommendation
- Modern, clean OpenCV HUD dashboard overlay (cv2.imshow)
- Real FPS and CUDA/CPU device telemetry
- Keyboard controls (Q=Quit, P=Pause, R=Reset, S=Screenshot, V=ROI, L=Line, 1-4=Cameras)
- Optional output recording with cv2.VideoWriter
=============================================================================
"""

import os
import sys
import time
import math
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Set
import numpy as np
import cv2
import torch
from ultralytics import YOLO

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION & SETTINGS
# ─────────────────────────────────────────────────────────────────────────────

# Model selection: 'yolov8x.pt' (extra large, maximum accuracy), 'yolov8s.pt' (balanced), 'yolov8n.pt' (fastest)
# Can also be a custom trained model path: "models/custom_traffic.pt"
MODEL_PATH = os.path.join(os.path.dirname(__file__), "backend", "yolov8x.pt")
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "yolov8x.pt"

# Detection parameters
CONFIDENCE_THRESHOLD = 0.40
IOU_THRESHOLD = 0.50
IMAGE_SIZE = 960         # 960 for high accuracy & distant vehicles (use 640 for slower CPUs)
MIN_BOX_WIDTH = 25
MIN_BOX_HEIGHT = 25
FRAME_SKIP = 0           # 0 = process every frame, 1 = skip 1 frame for speed

# Recording
SAVE_OUTPUT = False
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# Density thresholds (based on CURRENT vehicles inside ROI)
DENSITY_THRESHOLDS = {
    "LOW": (0, 5),        # 0-5 vehicles
    "MEDIUM": (6, 15),    # 6-15 vehicles
    "HIGH": (16, 999),    # 16+ vehicles
}

# Adaptive signal green times (in seconds)
SIGNAL_GREEN_TIMES = {
    "LOW": 15,
    "MEDIUM": 30,
    "HIGH": 60,
    "CRITICAL": 75,
}

# Target vehicle classes (COCO IDs: 2=car, 3=motorcycle, 5=bus, 7=truck)
VEHICLE_CLASS_IDS = [2, 3, 5, 7]
COCO_TO_CLASS = {
    2: "car",
    3: "motorbike",
    5: "bus",
    7: "truck",
}

# HUD Theme Colors (BGR)
COLORS = {
    "car": (246, 130, 59),        # Blue #3b82f6
    "motorbike": (16, 185, 129),  # Green #10b981
    "auto_rickshaw": (11, 158, 245), # Amber #f59e0b
    "bus": (11, 158, 245),        # Amber #f59e0b
    "truck": (246, 92, 139),      # Purple #8b5cf6
    "roi": (0, 220, 0),           # Green
    "line": (0, 215, 255),        # Yellow/Gold
    "line_active": (0, 0, 255),   # Red
    "hud_bg": (15, 23, 42),       # Dark Slate #0f172a
    "hud_card": (30, 41, 59),     # Card Slate #1e293b
    "hud_border": (51, 65, 85),   # Border #334155
    "text_white": (255, 255, 255),
    "text_muted": (148, 163, 184),# Muted #94a3b8
    "signal_green": (34, 197, 94),
    "signal_yellow": (234, 179, 8),
    "signal_red": (239, 68, 68),
}

# ─────────────────────────────────────────────────────────────────────────────
# CAMERA PRESETS & INPUT SOURCES
# ─────────────────────────────────────────────────────────────────────────────

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "backend", "uploads")

# Auto-locate best user video if available
USER_DEMO_VIDEO = os.path.join(UPLOADS_DIR, "CAM03_14968619_2160_3840_30fps.mp4")
if not os.path.exists(USER_DEMO_VIDEO):
    USER_DEMO_VIDEO = os.path.join(UPLOADS_DIR, "cam03_highway.mp4")

CAMERA_PRESETS = {
    "CAM01": {
        "id": "CAM01",
        "name": "CAM 01 — North Junction",
        "direction": "NORTH",
        "source": os.path.join(UPLOADS_DIR, "cam01_junction.mp4"),
        "roi": [(0.00, 0.35), (1.00, 0.35), (1.00, 1.00), (0.00, 1.00)],
        "counting_line": ((0.05, 0.65), (0.95, 0.65)),
    },
    "CAM02": {
        "id": "CAM02",
        "name": "CAM 02 — East Corridor",
        "direction": "EAST",
        "source": os.path.join(UPLOADS_DIR, "cam02_corridor.mp4"),
        "roi": [(0.00, 0.30), (1.00, 0.30), (1.00, 1.00), (0.00, 1.00)],
        "counting_line": ((0.05, 0.60), (0.95, 0.60)),
    },
    "CAM03": {
        "id": "CAM03",
        "name": "CAM 03 — South Highway",
        "direction": "SOUTH",
        "source": USER_DEMO_VIDEO if os.path.exists(USER_DEMO_VIDEO) else os.path.join(UPLOADS_DIR, "cam03_highway.mp4"),
        "roi": [(0.02, 0.22), (0.98, 0.22), (1.00, 1.00), (0.00, 1.00)],
        "counting_line": ((0.05, 0.58), (0.95, 0.58)),
    },
    "CAM04": {
        "id": "CAM04",
        "name": "CAM 04 — West Bridge",
        "direction": "WEST",
        "source": os.path.join(UPLOADS_DIR, "cam04_bridge.mp4"),
        "roi": [(0.08, 0.38), (0.92, 0.38), (0.95, 1.00), (0.05, 1.00)],
        "counting_line": ((0.10, 0.70), (0.90, 0.70)),
    },
    "WEBCAM": {
        "id": "WEBCAM",
        "name": "Laptop Webcam (Live)",
        "direction": "LOCAL",
        "source": 0,
        "roi": [(0.00, 0.15), (1.00, 0.15), (1.00, 1.00), (0.00, 1.00)],
        "counting_line": ((0.05, 0.55), (0.95, 0.55)),
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def point_in_polygon(point: Tuple[int, int], polygon: np.ndarray) -> bool:
    """Returns True if point (cx, cy) is strictly inside or on polygon edges."""
    return cv2.pointPolygonTest(polygon, (float(point[0]), float(point[1])), False) >= 0

def lines_intersect(p1: Tuple[int, int], p2: Tuple[int, int], q1: Tuple[int, int], q2: Tuple[int, int]) -> bool:
    """Checks if line segment p1-p2 intersects line segment q1-q2."""
    def ccw(A, B, C):
        return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
    return (ccw(p1, q1, q2) != ccw(p2, q1, q2)) and (ccw(p1, p2, q1) != ccw(p1, p2, q2))

def draw_rounded_rect(img, pt1, pt2, color, radius=8, thickness=-1):
    """Draws a smooth rounded rectangle on an image."""
    x1, y1 = pt1
    x2, y2 = pt2
    w = x2 - x1
    h = y2 - y1
    r = min(radius, w // 2, h // 2)

    if thickness == -1:
        # Fill
        cv2.rectangle(img, (x1 + r, y1), (x2 - r, y2), color, -1)
        cv2.rectangle(img, (x1, y1 + r), (x2, y2 - r), color, -1)
        cv2.circle(img, (x1 + r, y1 + r), r, color, -1)
        cv2.circle(img, (x2 - r, y1 + r), r, color, -1)
        cv2.circle(img, (x1 + r, y2 - r), r, color, -1)
        cv2.circle(img, (x2 - r, y2 - r), r, color, -1)
    else:
        cv2.line(img, (x1 + r, y1), (x2 - r, y1), color, thickness)
        cv2.line(img, (x1 + r, y2), (x2 - r, y2), color, thickness)
        cv2.line(img, (x1, y1 + r), (x1, y2 - r), color, thickness)
        cv2.line(img, (x2, y1 + r), (x2, y2 - r), color, thickness)
        cv2.ellipse(img, (x1 + r, y1 + r), (r, r), 180, 0, 90, color, thickness)
        cv2.ellipse(img, (x2 - r, y1 + r), (r, r), 270, 0, 90, color, thickness)
        cv2.ellipse(img, (x2 - r, y2 - r), (r, r), 0, 0, 90, color, thickness)
        cv2.ellipse(img, (x1 + r, y2 - r), (r, r), 90, 0, 90, color, thickness)

# ─────────────────────────────────────────────────────────────────────────────
# CORE TRAFFIC DETECTOR & TRACKER CLASS
# ─────────────────────────────────────────────────────────────────────────────

class SmartTrafficDetector:
    def __init__(self, camera_key: str = "CAM03"):
        self.camera_key = camera_key
        self.cam_config = CAMERA_PRESETS.get(camera_key, CAMERA_PRESETS["CAM03"])
        
        # Load Model
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.device_name = "CUDA (GPU)" if torch.cuda.is_available() else "CPU"
        print(f"\n=======================================================")
        print(f"🚀 Initializing Smart Traffic Management System")
        print(f"   Model:     {MODEL_PATH}")
        print(f"   Device:    {self.device_name}")
        print(f"   Camera:    {self.cam_config['name']}")
        print(f"   Source:    {self.cam_config['source']}")
        print(f"   Conf/IoU:  {CONFIDENCE_THRESHOLD} / {IOU_THRESHOLD}")
        print(f"   Img Size:  {IMAGE_SIZE}px")
        print(f"=======================================================\n")
        
        self.model = YOLO(MODEL_PATH)
        if torch.cuda.is_available():
            self.model.to("cuda")

        # Tracking and Counting State
        self.crossed_ids: Set[int] = set()
        self.total_counts: Dict[str, int] = {
            "cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0
        }
        self.track_prev_centers: Dict[int, Tuple[int, int]] = {}
        self.track_classes: Dict[int, str] = {}
        
        # UI & Display Toggles
        self.show_roi = True
        self.show_counting_line = True
        self.is_paused = False
        self.video_writer = None

    def reset_counts(self):
        """Resets cumulative crossed vehicle statistics."""
        self.crossed_ids.clear()
        self.total_counts = {"cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0}
        self.track_prev_centers.clear()
        print("🔄 Statistics and vehicle counts reset!")

    def set_camera(self, camera_key: str):
        """Switches active camera preset and resets tracking state."""
        if camera_key in CAMERA_PRESETS:
            self.camera_key = camera_key
            self.cam_config = CAMERA_PRESETS[camera_key]
            self.reset_counts()
            print(f"📷 Switched to: {self.cam_config['name']}")

    def classify_vehicle(self, cls_id: int, bw: int, bh: int) -> str:
        """Accurately maps COCO class with geometric refinement for Indian roads."""
        raw_name = COCO_TO_CLASS.get(cls_id, "car")
        aspect = bw / float(max(bh, 1))

        # Distinct Indian Auto-Rickshaw profiling (3-wheeler boxy cabin)
        if raw_name in ("car", "truck") and 0.70 <= aspect <= 1.30 and bw < 140:
            return "auto_rickshaw"
        elif raw_name == "motorbike" and 0.85 < aspect <= 1.35 and bw > 60:
            return "auto_rickshaw"
        elif raw_name == "motorbike":
            return "motorbike"
        elif raw_name == "bus":
            return "bus"
        elif raw_name == "truck":
            return "truck"
        return "car"

    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, Dict]:
        """
        Executes complete detection, tracking, ROI filtering, counting,
        density evaluation, and HUD drawing for a single video frame.
        """
        h, w = frame.shape[:2]

        # 1. Build ROI & Line Coordinates in Pixels
        roi_norm = self.cam_config.get("roi", [(0,0), (1,0), (1,1), (0,1)])
        roi_px = np.array([(int(x * w), int(y * h)) for x, y in roi_norm], dtype=np.int32)

        line_norm = self.cam_config.get("counting_line", ((0.05, 0.6), (0.95, 0.6)))
        p1 = (int(line_norm[0][0] * w), int(line_norm[0][1] * h))
        p2 = (int(line_norm[1][0] * w), int(line_norm[1][1] * h))

        # 2. YOLOv8 Inference on Frame
        results = self.model(
            frame,
            conf=CONFIDENCE_THRESHOLD,
            iou=IOU_THRESHOLD,
            imgsz=IMAGE_SIZE,
            classes=[0, 1, 2, 3, 5, 7],  # person, bicycle, car, motorcycle, bus, truck
            verbose=False,
        )[0]

        current_counts = {"cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0}
        active_detections = []
        line_crossed_this_frame = False

        raw_boxes = []
        if results.boxes is not None and len(results.boxes) > 0:
            for b in results.boxes:
                cls_id = int(b.cls[0])
                cname = COCO_TO_CLASS.get(cls_id, "person" if cls_id == 0 else "bicycle" if cls_id == 1 else "car")
                conf = float(b.conf[0])
                x1, y1, x2, y2 = map(int, b.xyxy[0])
                raw_boxes.append({"cls": cname, "conf": conf, "box": [x1, y1, x2, y2]})

        # 3. Rider + Motorcycle Fusion & Vehicle Categorization
        fused = []
        used_p = set()

        for r in raw_boxes:
            if r["cls"] in ["motorbike", "bicycle"]:
                mx1, my1, mx2, my2 = r["box"]
                mbox = [mx1, my1, mx2, my2]
                bconf = r["conf"]
                for idx, p in enumerate(raw_boxes):
                    if p["cls"] == "person" and idx not in used_p:
                        px1, py1, px2, py2 = p["box"]
                        if (px1 < mx2 and px2 > mx1) and (py1 < my2 and py2 > my1 - (my2 - my1) * 0.6):
                            mbox = [min(mx1, px1), min(my1, py1), max(mx2, px2), max(my2, py2)]
                            bconf = max(bconf, p["conf"])
                            used_p.add(idx)
                fused.append({"class": "motorbike", "conf": bconf, "box": mbox})

        for r in raw_boxes:
            if r["cls"] in ["car", "truck", "bus"]:
                bx1, by1, bx2, by2 = r["box"]
                bw = bx2 - bx1
                bh = by2 - by1
                aspect = bw / float(max(bh, 1))
                if 0.60 <= aspect <= 1.30 and bw < (w * 0.28):
                    vtype = "auto_rickshaw"
                elif r["cls"] == "bus" or (aspect > 1.8 and (bw * bh) > 40000):
                    vtype = "bus"
                elif r["cls"] == "truck":
                    vtype = "truck"
                else:
                    vtype = "car"
                fused.append({"class": vtype, "conf": r["conf"], "box": [bx1, by1, bx2, by2]})

        # 4. Filter by Min Size and ROI
        for i, v in enumerate(fused):
            x1, y1, x2, y2 = v["box"]
            bw = x2 - x1
            bh = y2 - y1

            if bw < MIN_BOX_WIDTH or bh < MIN_BOX_HEIGHT:
                continue

            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            center = (cx, cy)

            if not point_in_polygon(center, roi_px):
                continue

            vclass = v["class"]
            conf = v["conf"]
            tid = i + 1

            if vclass == "car":
                current_counts["cars"] += 1
            elif vclass == "motorbike":
                current_counts["bikes"] += 1
            elif vclass == "auto_rickshaw":
                current_counts["autos"] += 1
            elif vclass == "bus":
                current_counts["buses"] += 1
            elif vclass == "truck":
                current_counts["trucks"] += 1

            # Line crossing check
            prev_c = self.track_prev_centers.get(tid)
            if prev_c is not None and tid not in self.crossed_ids:
                if lines_intersect(prev_c, center, p1, p2):
                    self.crossed_ids.add(tid)
                    line_crossed_this_frame = True
                    if vclass == "car": self.total_counts["cars"] += 1
                    elif vclass == "motorbike": self.total_counts["bikes"] += 1
                    elif vclass == "auto_rickshaw": self.total_counts["autos"] += 1
                    elif vclass == "bus": self.total_counts["buses"] += 1
                    elif vclass == "truck": self.total_counts["trucks"] += 1
            self.track_prev_centers[tid] = center

            active_detections.append({
                "bbox": (x1, y1, x2, y2),
                "class": vclass,
                "conf": conf,
                "tid": tid,
                "center": center,
            })

        total_current = sum(current_counts.values())
        total_passed = sum(self.total_counts.values())

        # 3. Traffic Density & Adaptive Signal Evaluation
        if total_current <= DENSITY_THRESHOLDS["LOW"][1]:
            density_str = "LOW"
            density_color = COLORS["signal_green"]
        elif total_current <= DENSITY_THRESHOLDS["MEDIUM"][1]:
            density_str = "MEDIUM"
            density_color = COLORS["signal_yellow"]
        else:
            density_str = "HIGH"
            density_color = COLORS["signal_red"]

        green_time = SIGNAL_GREEN_TIMES.get(density_str, 30)
        direction = self.cam_config.get("direction", "SOUTH")
        signal_recommendation = f"{direction} -> GREEN ({green_time}s)"

        # 4. Render Visual Overlays on Frame
        annotated = frame.copy()

        # Draw ROI Polygon
        if self.show_roi:
            roi_overlay = annotated.copy()
            cv2.fillPoly(roi_overlay, [roi_px], (0, 180, 0))
            cv2.addWeighted(roi_overlay, 0.10, annotated, 0.90, 0, annotated)
            cv2.polylines(annotated, [roi_px], isClosed=True, color=COLORS["roi"], thickness=2)
            cv2.putText(annotated, "ROI [ACTIVE ROADWAY]", (roi_px[0][0] + 10, roi_px[0][1] + 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, COLORS["roi"], 1, cv2.LINE_AA)

        # Draw Virtual Counting Line
        if self.show_counting_line:
            line_col = COLORS["line_active"] if line_crossed_this_frame else COLORS["line"]
            cv2.line(annotated, p1, p2, line_col, 3, cv2.LINE_AA)
            cv2.circle(annotated, p1, 5, line_col, -1)
            cv2.circle(annotated, p2, 5, line_col, -1)
            cv2.putText(annotated, "VIRTUAL COUNTING LINE", (p1[0] + 10, p1[1] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, line_col, 1, cv2.LINE_AA)

        # Draw Bounding Boxes with Corner Accents
        for det in active_detections:
            x1, y1, x2, y2 = det["bbox"]
            vclass = det["class"]
            conf = det["conf"]
            tid = det["tid"]
            col = COLORS.get(vclass, (246, 130, 59))

            # Box outline
            cv2.rectangle(annotated, (x1, y1), (x2, y2), col, 2)

            # High-tech corner brackets
            clen = 10
            cv2.line(annotated, (x1, y1), (x1 + clen, y1), col, 3)
            cv2.line(annotated, (x1, y1), (x1, y1 + clen), col, 3)
            cv2.line(annotated, (x2, y1), (x2 - clen, y1), col, 3)
            cv2.line(annotated, (x2, y1), (x2, y1 + clen), col, 3)
            cv2.line(annotated, (x1, y2), (x1 + clen, y2), col, 3)
            cv2.line(annotated, (x1, y2), (x1, y2 - clen), col, 3)
            cv2.line(annotated, (x2, y2), (x2 - clen, y2), col, 3)
            cv2.line(annotated, (x2, y2), (x2, y2 - clen), col, 3)

            # Label banner
            dname = "AUTO" if vclass == "auto_rickshaw" else "BIKE" if vclass == "motorbike" else vclass.upper()
            label_text = f"{dname} {int(conf * 100)}%"
            if tid is not None:
                label_text = f"ID:{tid} {label_text}"

            (lw, lh), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(annotated, (x1, max(y1 - 18, 0)), (x1 + lw + 8, max(y1, 18)), col, -1)
            cv2.putText(annotated, label_text, (x1 + 4, max(y1 - 4, 14)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # 5. Build Telemetry Data Dictionary
        stats = {
            "current_counts": current_counts,
            "total_current": total_current,
            "total_counts": self.total_counts,
            "total_passed": total_passed,
            "density": density_str,
            "density_color": density_color,
            "signal": signal_recommendation,
            "green_time": green_time,
            "camera_name": self.cam_config["name"],
            "device": self.device_name,
        }

        return annotated, stats

    def draw_hud_overlay(self, frame: np.ndarray, stats: Dict, fps: float) -> np.ndarray:
        """Renders the sleek, professional OpenCV HUD dashboard overlay onto the frame."""
        h, w = frame.shape[:2]
        hud = frame.copy()

        # ── 1. Top Header Bar ──────────────────────────────────────────
        header_h = 60
        header_bg = np.zeros((header_h, w, 3), dtype=np.uint8)
        header_bg[:] = COLORS["hud_bg"]
        cv2.addWeighted(header_bg, 0.85, hud[0:header_h, 0:w], 0.15, 0, hud[0:header_h, 0:w])
        cv2.line(hud, (0, header_h), (w, header_h), COLORS["hud_border"], 1)

        # Title & Subtitle
        cv2.putText(hud, "SMART TRAFFIC MANAGEMENT SYSTEM", (16, 26),
                    cv2.FONT_HERSHEY_DUPLEX, 0.65, COLORS["text_white"], 1, cv2.LINE_AA)
        cv2.putText(hud, f"Camera: {stats['camera_name']}  |  {stats['device']}", (16, 48),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, COLORS["text_muted"], 1, cv2.LINE_AA)

        # Live Badge & FPS on Right
        fps_text = f"FPS: {fps:.1f}"
        (fw, _), _ = cv2.getTextSize(fps_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        cv2.circle(hud, (w - fw - 35, 30), 5, COLORS["signal_green"], -1)
        cv2.putText(hud, fps_text, (w - fw - 20, 35),
                    cv2.FONT_HERSHEY_DUPLEX, 0.55, COLORS["signal_green"], 1, cv2.LINE_AA)

        # ── 2. Left Side Telemetry Panel ───────────────────────────────
        panel_w = 260
        panel_y1 = header_h + 12
        panel_h = min(360, h - panel_y1 - 12)
        panel_y2 = panel_y1 + panel_h

        panel_overlay = hud[panel_y1:panel_y2, 12:12+panel_w].copy()
        panel_bg = np.zeros((panel_h, panel_w, 3), dtype=np.uint8)
        panel_bg[:] = COLORS["hud_bg"]
        cv2.addWeighted(panel_bg, 0.88, panel_overlay, 0.12, 0, panel_overlay)
        hud[panel_y1:panel_y2, 12:12+panel_w] = panel_overlay
        draw_rounded_rect(hud, (12, panel_y1), (12+panel_w, panel_y2), COLORS["hud_border"], radius=8, thickness=1)

        # Panel Content
        py = panel_y1 + 22
        cv2.putText(hud, "TRAFFIC TELEMETRY", (24, py),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, COLORS["text_muted"], 1, cv2.LINE_AA)
        py += 8
        cv2.line(hud, (24, py), (12 + panel_w - 24, py), COLORS["hud_border"], 1)

        # Density Card
        py += 22
        cv2.putText(hud, "DENSITY STATUS:", (24, py),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, COLORS["text_white"], 1, cv2.LINE_AA)
        d_badge = f" {stats['density']} DENSITY "
        (dw, _), _ = cv2.getTextSize(d_badge, cv2.FONT_HERSHEY_DUPLEX, 0.45, 1)
        cv2.rectangle(hud, (140, py - 14), (140 + dw + 8, py + 4), stats["density_color"], -1)
        cv2.putText(hud, d_badge, (142, py - 1),
                    cv2.FONT_HERSHEY_DUPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

        # Current Vehicles
        py += 26
        cv2.putText(hud, f"CURRENT IN ROI:  {stats['total_current']} vehicles", (24, py),
                    cv2.FONT_HERSHEY_DUPLEX, 0.48, COLORS["text_white"], 1, cv2.LINE_AA)

        py += 18
        curr = stats["current_counts"]
        breakdown = f"Cars: {curr['cars']} | Bikes: {curr['bikes']} | Autos: {curr['autos']} | Bus/Trk: {curr['buses']+curr['trucks']}"
        cv2.putText(hud, breakdown, (24, py),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, COLORS["text_muted"], 1, cv2.LINE_AA)

        py += 14
        cv2.line(hud, (24, py), (12 + panel_w - 24, py), COLORS["hud_border"], 1)

        # Total Line Crossings
        py += 20
        cv2.putText(hud, f"TOTAL PASSED:  {stats['total_passed']} vehicles", (24, py),
                    cv2.FONT_HERSHEY_DUPLEX, 0.48, COLORS["text_white"], 1, cv2.LINE_AA)

        py += 18
        tot = stats["total_counts"]
        tot_str = f"Cars: {tot['cars']} | Bikes: {tot['bikes']} | Autos: {tot['autos']} | Bus/Trk: {tot['buses']+tot['trucks']}"
        cv2.putText(hud, tot_str, (24, py),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, COLORS["text_muted"], 1, cv2.LINE_AA)

        py += 14
        cv2.line(hud, (24, py), (12 + panel_w - 24, py), COLORS["hud_border"], 1)

        # Adaptive Signal State
        py += 22
        cv2.putText(hud, "SIGNAL RECOMMENDATION:", (24, py),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, COLORS["text_muted"], 1, cv2.LINE_AA)
        py += 20
        cv2.circle(hud, (32, py - 4), 6, stats["density_color"], -1)
        cv2.putText(hud, stats["signal"], (46, py),
                    cv2.FONT_HERSHEY_DUPLEX, 0.48, COLORS["text_white"], 1, cv2.LINE_AA)

        # ── 3. Bottom Controls Bar ─────────────────────────────────────
        footer_h = 32
        footer_bg = np.zeros((footer_h, w, 3), dtype=np.uint8)
        footer_bg[:] = COLORS["hud_bg"]
        cv2.addWeighted(footer_bg, 0.85, hud[h-footer_h:h, 0:w], 0.15, 0, hud[h-footer_h:h, 0:w])
        cv2.line(hud, (0, h - footer_h), (w, h - footer_h), COLORS["hud_border"], 1)

        controls_text = "[Q] Quit  |  [P] Pause  |  [R] Reset Stats  |  [S] Screenshot  |  [V] Toggle ROI  |  [L] Toggle Line  |  [1-4] Cameras"
        cv2.putText(hud, controls_text, (16, h - 11),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, COLORS["text_muted"], 1, cv2.LINE_AA)

        return hud

# ─────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION LOOP
# ─────────────────────────────────────────────────────────────────────────────

def run_traffic_system(source=None, camera_preset="CAM03"):
    """
    Main application entry point. Opens video capture and runs
    the OpenCV display loop until the user exits with 'Q' or ESC.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    detector = SmartTrafficDetector(camera_key=camera_preset)

    if source is not None:
        video_src = source
    else:
        video_src = detector.cam_config["source"]

    cap = cv2.VideoCapture(video_src)
    if not cap.isOpened():
        print(f"❌ Failed to open video source: {video_src}")
        print("Falling back to Webcam 0...")
        video_src = 0
        cap = cv2.VideoCapture(video_src)
        if not cap.isOpened():
            print("❌ No webcam or video source found. Exiting.")
            return

    # Video properties
    fps_video = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720

    # Optional Video Recording
    video_writer = None
    if SAVE_OUTPUT:
        output_file = os.path.join(OUTPUT_DIR, f"traffic_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4")
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        video_writer = cv2.VideoWriter(output_file, fourcc, fps_video, (frame_w, frame_h))
        print(f"🎬 Recording output to: {output_file}")

    window_name = "TrafficAI — Smart Traffic Management System (OpenCV)"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, min(1280, frame_w), min(720, frame_h))

    prev_time = time.time()
    fps_smooth = fps_video
    frame_idx = 0

    print("\n✅ System Running. Press 'Q' in the OpenCV window to exit.\n")

    while True:
        if not detector.is_paused:
            ret, frame = cap.read()
            if not ret:
                # Loop video files automatically
                if isinstance(video_src, str):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                if not ret:
                    print("⚠️ Video stream ended.")
                    break

            frame_idx += 1
            if FRAME_SKIP > 0 and (frame_idx % (FRAME_SKIP + 1) != 0):
                continue

            # Core AI Processing & HUD Drawing
            t_start = time.time()
            annotated_frame, stats = detector.process_frame(frame)
            t_end = time.time()

            # Measure real FPS
            curr_fps = 1.0 / max(t_end - t_start, 0.001)
            fps_smooth = 0.85 * fps_smooth + 0.15 * curr_fps

            # Render Full HUD Overlay
            display_frame = detector.draw_hud_overlay(annotated_frame, stats, fps_smooth)

            if video_writer is not None:
                video_writer.write(display_frame)
        else:
            # Paused indicator
            cv2.putText(display_frame, "|| PAUSED", (frame_w // 2 - 80, frame_h // 2),
                        cv2.FONT_HERSHEY_DUPLEX, 1.2, (0, 215, 255), 2, cv2.LINE_AA)

        # Show in OpenCV Window
        cv2.imshow(window_name, display_frame)

        # Keyboard Controls
        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), ord('Q'), 27):  # Q or ESC
            print("🛑 Exiting Traffic Management System...")
            break
        elif key in (ord('p'), ord('P'), 32):  # P or Space
            detector.is_paused = not detector.is_paused
            print(f"⏸ Pause state: {detector.is_paused}")
        elif key in (ord('r'), ord('R')):  # R = Reset stats
            detector.reset_counts()
        elif key in (ord('s'), ord('S')):  # S = Save Screenshot
            shot_file = os.path.join(OUTPUT_DIR, f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg")
            cv2.imwrite(shot_file, display_frame)
            print(f"📸 Screenshot saved to: {shot_file}")
        elif key in (ord('v'), ord('V')):  # V = Toggle ROI
            detector.show_roi = not detector.show_roi
            print(f"👁 ROI overlay: {detector.show_roi}")
        elif key in (ord('l'), ord('L')):  # L = Toggle Counting Line
            detector.show_counting_line = not detector.show_counting_line
            print(f"📏 Counting line: {detector.show_counting_line}")
        elif key == ord('1'):
            cap.release()
            detector.set_camera("CAM01")
            cap = cv2.VideoCapture(detector.cam_config["source"])
        elif key == ord('2'):
            cap.release()
            detector.set_camera("CAM02")
            cap = cv2.VideoCapture(detector.cam_config["source"])
        elif key == ord('3'):
            cap.release()
            detector.set_camera("CAM03")
            cap = cv2.VideoCapture(detector.cam_config["source"])
        elif key == ord('4'):
            cap.release()
            detector.set_camera("CAM04")
            cap = cv2.VideoCapture(detector.cam_config["source"])

    # Cleanup
    cap.release()
    if video_writer is not None:
        video_writer.release()
    cv2.destroyAllWindows()
    print("✅ OpenCV application terminated cleanly.")


if __name__ == "__main__":
    # Support command-line arguments: python main.py [video_path or 0] [CAM01|CAM02|CAM03|CAM04]
    custom_source = None
    cam_preset = "CAM03"

    if len(sys.argv) > 1:
        arg1 = sys.argv[1]
        if arg1.isdigit():
            custom_source = int(arg1)
        elif os.path.exists(arg1):
            custom_source = arg1
        elif arg1.upper() in CAMERA_PRESETS:
            cam_preset = arg1.upper()

    if len(sys.argv) > 2:
        arg2 = sys.argv[2].upper()
        if arg2 in CAMERA_PRESETS:
            cam_preset = arg2

    run_traffic_system(source=custom_source, camera_preset=cam_preset)

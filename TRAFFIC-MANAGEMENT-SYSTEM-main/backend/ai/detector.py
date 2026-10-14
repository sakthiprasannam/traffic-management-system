"""
Upgraded Vehicle Detector
─────────────────────────
Uses YOLOv8x/s/m with:
- Rider + Two-Wheeler intelligent fusion (unifies rider & scooter into a single clean box)
- Indian Auto-Rickshaw (3-wheeler) vs Car geometry classification
- Per-camera Region of Interest (ROI) polygon filtering
- Configurable confidence, IoU, and image size
- Min bounding-box size filter to remove poles/shadows/noise
- ByteTrack persistent tracking support
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
import logging

from ai.config import (
    CLASS_COLORS,
    get_roi,
    roi_to_pixels,
    point_in_roi,
)

logger = logging.getLogger(__name__)

# COCO classes used in vehicle detection
DETECT_CLASSES = [0, 1, 2, 3, 5, 7]  # person, bicycle, car, motorcycle, bus, truck
COCO_NAMES = {0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


class VehicleDetector:
    def __init__(
        self,
        model_name: str = "yolov8x",
        confidence: float = 0.25,
        iou_threshold: float = 0.50,
        imgsz: int = 960,
        min_box_width: int = 25,
        min_box_height: int = 25,
    ):
        self.model_name = model_name
        self.confidence = confidence
        self.iou_threshold = iou_threshold
        self.imgsz = imgsz
        self.min_box_width = min_box_width
        self.min_box_height = min_box_height
        self.model = None
        self._load_model()

    def _load_model(self):
        """Load YOLOv8 model. Downloads automatically if not present."""
        try:
            from ultralytics import YOLO
            import torch
            self.model = YOLO(f"{self.model_name}.pt")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"✅ YOLO model loaded: {self.model_name} | device={device} | conf={self.confidence}")
        except Exception as e:
            logger.warning(f"⚠️ YOLO not available: {e}")
            self.model = None

    def detect(
        self,
        frame: np.ndarray,
        camera_id: str = "DEFAULT",
        use_tracking: bool = False,
    ) -> Tuple[List[Dict], np.ndarray]:
        """
        Detect vehicles in a single frame.
        Fuses riders + two-wheelers and classifies auto-rickshaws, cars, buses, and trucks.
        """
        if self.model is None:
            return [], frame.copy()

        h, w = frame.shape[:2]
        detections = []
        annotated = frame.copy()

        # Build ROI polygon in pixels for this camera
        roi_poly_norm = get_roi(camera_id)
        roi_poly_px = roi_to_pixels(roi_poly_norm, w, h)

        # Draw ROI polygon on annotated frame
        roi_overlay = annotated.copy()
        cv2.fillPoly(roi_overlay, [roi_poly_px], (0, 255, 0))
        cv2.addWeighted(roi_overlay, 0.08, annotated, 0.92, 0, annotated)
        cv2.polylines(annotated, [roi_poly_px], True, (0, 220, 0), 1)

        try:
            results = self.model(
                frame,
                conf=self.confidence,
                iou=self.iou_threshold,
                imgsz=self.imgsz,
                classes=DETECT_CLASSES,
                verbose=False,
            )[0]

            raw_boxes = []
            if results.boxes is not None and len(results.boxes) > 0:
                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    if cls_id not in COCO_NAMES:
                        continue
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    raw_boxes.append({
                        "cls": COCO_NAMES[cls_id],
                        "conf": conf,
                        "box": [x1, y1, x2, y2],
                    })

            # ── 1. Match two-wheelers with riders (Rider + Bike Fusion) ──
            fused_vehicles = []
            used_persons = set()

            for r in raw_boxes:
                if r["cls"] in ["motorcycle", "bicycle"]:
                    mx1, my1, mx2, my2 = r["box"]
                    merged_box = [mx1, my1, mx2, my2]
                    best_conf = r["conf"]

                    # Check for rider person box overlapping
                    for idx, p in enumerate(raw_boxes):
                        if p["cls"] == "person" and idx not in used_persons:
                            px1, py1, px2, py2 = p["box"]
                            if (px1 < mx2 and px2 > mx1) and (py1 < my2 and py2 > my1 - (my2 - my1) * 0.6):
                                merged_box = [min(mx1, px1), min(my1, py1), max(mx2, px2), max(my2, py2)]
                                best_conf = max(best_conf, p["conf"])
                                used_persons.add(idx)

                    fused_vehicles.append({
                        "class": "motorcycle",
                        "conf": best_conf,
                        "box": merged_box,
                    })

            # ── 2. Add Cars, Buses, Trucks, and Auto-Rickshaws ───────────
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

                    fused_vehicles.append({
                        "class": vtype,
                        "conf": r["conf"],
                        "box": [bx1, by1, bx2, by2],
                    })

            # ── 3. Filter by Min Size and ROI ────────────────────────────
            for i, v in enumerate(fused_vehicles):
                x1, y1, x2, y2 = v["box"]
                bw = x2 - x1
                bh = y2 - y1

                if bw < self.min_box_width or bh < self.min_box_height:
                    continue

                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                if not point_in_roi(cx, cy, roi_poly_px):
                    continue

                vclass = v["class"]
                conf = v["conf"]

                det = {
                    "id": i + 1,
                    "class_name": vclass,
                    "confidence": round(conf, 3),
                    "bbox": [x1, y1, x2, y2],
                    "center": (cx, cy),
                }
                detections.append(det)

                # Annotate Frame
                color = CLASS_COLORS.get(vclass, (246, 130, 59))
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                # Corner brackets
                clen = 8
                cv2.line(annotated, (x1, y1 + clen), (x1, y1), color, 3)
                cv2.line(annotated, (x1, y1), (x1 + clen, y1), color, 3)
                cv2.line(annotated, (x2 - clen, y1), (x2, y1), color, 3)
                cv2.line(annotated, (x2, y1), (x2, y1 + clen), color, 3)
                cv2.line(annotated, (x1, y2 - clen), (x1, y2), color, 3)
                cv2.line(annotated, (x1, y2), (x1 + clen, y2), color, 3)
                cv2.line(annotated, (x2 - clen, y2), (x2, y2), color, 3)
                cv2.line(annotated, (x2, y2 - clen), (x2, y2), color, 3)

                display_name = "AUTO" if vclass == "auto_rickshaw" else "BIKE" if vclass == "motorcycle" else vclass.upper()
                label = f"{display_name} {int(conf * 100)}%"

                (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                cv2.rectangle(annotated, (x1, max(y1 - 18, 0)), (x1 + lw + 6, max(y1 - 2, 16)), color, -1)
                cv2.putText(annotated, label, (x1 + 3, max(y1 - 5, 13)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        except Exception as e:
            logger.error(f"[{camera_id}] Detection error: {e}")

        return detections, annotated

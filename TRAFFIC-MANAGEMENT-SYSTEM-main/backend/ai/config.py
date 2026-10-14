"""
Centralized per-camera configuration for:
- Region of Interest (ROI) polygons
- Virtual counting line positions
- Camera-specific detection tuning

ROI polygons are defined as normalized (0.0–1.0) (x, y) coordinates
so they scale to any frame resolution.

Counting line Y is a fraction of frame height (0.0 = top, 1.0 = bottom).
"""

from typing import Dict, List, Tuple

# ── Per-Camera ROI Polygons ─────────────────────────────────────────────────
# Each polygon defines the road/traffic area to detect in.
# Only detections whose center point falls INSIDE the polygon are counted.
# Coordinates are fractions: (x_fraction, y_fraction)
#
# CAM01 — North Junction: full road area below sky
# CAM02 — East Corridor: road lanes
# CAM03 — South Highway: bridge/highway lanes
# CAM04 — West Bridge: bridge deck only

CAMERA_ROI: Dict[str, List[Tuple[float, float]]] = {
    "CAM01": [
        (0.00, 0.35), (1.00, 0.35),
        (1.00, 1.00), (0.00, 1.00)
    ],
    "CAM02": [
        (0.00, 0.30), (1.00, 0.30),
        (1.00, 1.00), (0.00, 1.00)
    ],
    "CAM03": [
        (0.05, 0.25), (0.95, 0.25),
        (1.00, 1.00), (0.00, 1.00)
    ],
    "CAM04": [
        (0.10, 0.40), (0.90, 0.40),
        (0.90, 1.00), (0.10, 1.00)
    ],
}

# Default ROI for cameras not in the map above (covers lower 70% of frame)
DEFAULT_ROI: List[Tuple[float, float]] = [
    (0.00, 0.30), (1.00, 0.30),
    (1.00, 1.00), (0.00, 1.00)
]

# ── Virtual Counting Line ───────────────────────────────────────────────────
# Y position as a fraction of frame height where vehicles are counted.
# A vehicle is counted exactly once when its center crosses this line.

COUNTING_LINE_Y: Dict[str, float] = {
    "CAM01": 0.65,   # 65% down the frame
    "CAM02": 0.60,
    "CAM03": 0.55,
    "CAM04": 0.70,
}

DEFAULT_COUNTING_LINE_Y: float = 0.60

# ── COCO Class IDs → Vehicle Categories ────────────────────────────────────
# Only include real vehicle classes. Person (0) and bicycle (1) are excluded
# to prevent false positives from pedestrians and cyclists being counted as vehicles.

VEHICLE_CLASS_IDS: List[int] = [2, 3, 5, 7]  # car, motorcycle, bus, truck

COCO_TO_VEHICLE: Dict[int, str] = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# ── Class Display Colors (BGR for OpenCV) ───────────────────────────────────
CLASS_COLORS: Dict[str, Tuple[int, int, int]] = {
    "car":          (246, 130,  59),   # Blue
    "motorcycle":   (129, 185,  16),   # Green
    "auto_rickshaw":(11,  158, 245),   # Amber
    "bus":          (11,  158, 245),   # Amber
    "truck":        (246,  92, 139),   # Purple
}

def get_roi(camera_id: str) -> List[Tuple[float, float]]:
    """Get the ROI polygon for a given camera ID."""
    return CAMERA_ROI.get(camera_id, DEFAULT_ROI)

def get_counting_line_y(camera_id: str) -> float:
    """Get the counting line Y fraction for a given camera ID."""
    return COUNTING_LINE_Y.get(camera_id, DEFAULT_COUNTING_LINE_Y)

def roi_to_pixels(roi: List[Tuple[float, float]], width: int, height: int):
    """Convert normalized ROI polygon to pixel coordinates."""
    import numpy as np
    return np.array([(int(x * width), int(y * height)) for x, y in roi], dtype=np.int32)

def point_in_roi(cx: int, cy: int, roi_pixels) -> bool:
    """Check if center point (cx, cy) is inside the ROI polygon."""
    import cv2
    return cv2.pointPolygonTest(roi_pixels, (float(cx), float(cy)), False) >= 0

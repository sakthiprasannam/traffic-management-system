"""
Upgraded Vehicle Tracker & Crossing Counter
────────────────────────────────────────────
Tracks two separate concepts:

1. CURRENT VEHICLES  — vehicles detected in the current frame (inside ROI)
2. TOTAL CROSSED     — unique vehicles that crossed the counting line this session

Each camera instance has its OWN tracker state to prevent ID cross-contamination.
"""

import numpy as np
from typing import Dict, List, Set, Tuple
import logging

from ai.config import get_counting_line_y

logger = logging.getLogger(__name__)


class VehicleTracker:
    """
    Per-camera tracker that:
    - Receives detections that already have track_id from model.track()
    - Manages a virtual counting line
    - Counts each unique track_id crossing the line exactly once
    - Maintains current-frame vehicle class breakdown
    """

    def __init__(self, camera_id: str = "DEFAULT"):
        self.camera_id = camera_id
        self.counting_line_y_frac = get_counting_line_y(camera_id)

        # Tracks that have already crossed the line (per class)
        self._crossed_ids: Set[int] = set()
        self._crossed_counts: Dict[str, int] = {
            "cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0
        }

        # Position memory — last known Y-center of each track_id
        self._last_y: Dict[int, int] = {}

        # Track history for stopped-vehicle detection
        self._track_history: Dict[int, List[Tuple[int, int]]] = {}

        logger.info(f"✅ VehicleTracker initialized for {camera_id} | counting_line_y={self.counting_line_y_frac:.2f}")

    def update(self, detections: List[Dict], frame_shape: Tuple) -> List[Dict]:
        """
        Process a list of detections (with track_id from model.track).

        Updates:
        - Crossing counter when a vehicle crosses the counting line
        - Track position history

        Returns:
            Same detections list (unchanged content, used downstream)
        """
        if not detections:
            return []

        h = frame_shape[0]
        line_y_px = int(self.counting_line_y_frac * h)

        result = []
        for det in detections:
            track_id = det.get("track_id")
            cx, cy = det["center"]
            class_name = det["class_name"]

            # Update history
            if track_id is not None:
                if track_id not in self._track_history:
                    self._track_history[track_id] = []
                self._track_history[track_id].append((cx, cy))
                if len(self._track_history[track_id]) > 30:
                    self._track_history[track_id].pop(0)

                # ── Crossing line logic ──────────────────────────────
                prev_y = self._last_y.get(track_id)
                if prev_y is not None and track_id not in self._crossed_ids:
                    # Vehicle crossed downward (prev above line, current at/below line)
                    if prev_y < line_y_px <= cy:
                        self._crossed_ids.add(track_id)
                        self._increment_crossed(class_name)
                        logger.debug(f"[{self.camera_id}] Vehicle #{track_id} ({class_name}) crossed line")

                self._last_y[track_id] = cy

            result.append(det)

        return result

    def _increment_crossed(self, class_name: str):
        if class_name == "car":
            self._crossed_counts["cars"] += 1
        elif class_name in ("motorcycle", "bike"):
            self._crossed_counts["bikes"] += 1
        elif class_name == "bus":
            self._crossed_counts["buses"] += 1
        elif class_name == "truck":
            self._crossed_counts["trucks"] += 1
        elif class_name in ("auto_rickshaw", "auto"):
            self._crossed_counts["autos"] += 1

    def get_current_counts(self, detections: List[Dict]) -> Dict[str, int]:
        """
        Count vehicles currently visible in the frame by class.
        This is the CURRENT count — changes every frame.
        """
        counts = {"cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0}
        for det in detections:
            cls = det.get("class_name", "")
            if cls == "car":
                counts["cars"] += 1
            elif cls in ("motorcycle", "bike"):
                counts["bikes"] += 1
            elif cls == "bus":
                counts["buses"] += 1
            elif cls == "truck":
                counts["trucks"] += 1
            elif cls in ("auto_rickshaw", "auto"):
                counts["autos"] += 1
        counts["total"] = sum(counts.values())
        return counts

    def get_total_crossed(self) -> Dict[str, int]:
        """
        Return total unique vehicles that have crossed the counting line.
        These values only go up — never reset unless the tracker is reset.
        """
        result = dict(self._crossed_counts)
        result["total"] = sum(v for k, v in result.items() if k != "total")
        return result

    def is_stopped(self, track_id: int, threshold_px: float = 5.0, min_frames: int = 30) -> bool:
        """Detect if a tracked vehicle has been mostly stationary."""
        history = self._track_history.get(track_id, [])
        if len(history) < min_frames:
            return False
        recent = history[-min_frames:]
        xs = [p[0] for p in recent]
        ys = [p[1] for p in recent]
        movement = ((max(xs) - min(xs)) ** 2 + (max(ys) - min(ys)) ** 2) ** 0.5
        return movement < threshold_px

    def get_stopped_ids(self) -> List[int]:
        """Return list of track IDs currently classified as stopped."""
        return [tid for tid in self._track_history if self.is_stopped(tid)]

    def reset(self):
        """Reset the crossing counter (e.g. start of new monitoring session)."""
        self._crossed_ids.clear()
        self._crossed_counts = {"cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0}
        self._last_y.clear()
        self._track_history.clear()
        logger.info(f"[{self.camera_id}] Tracker reset")

"""
Traffic Analyzer
────────────────
Computes density, congestion, incidents, alerts.

Key improvement over previous version:
- Density is based on CURRENT vehicles in ROI (not cumulative)
- Uses configurable thresholds from Settings
- AnalysisResult now carries both current_counts and total_counts
"""

from typing import List, Dict
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

# Emergency vehicle keywords
EMERGENCY_CLASSES = {"ambulance", "fire_truck", "police_car"}


@dataclass
class AnalysisResult:
    density: str = "Low"
    vehicle_count: int = 0                             # current in-frame count
    vehicle_counts: Dict = field(default_factory=lambda: {
        "cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0, "total": 0
    })
    total_crossed: Dict = field(default_factory=lambda: {
        "cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0, "total": 0
    })
    congestion: bool = False
    incident_detected: bool = False
    emergency_vehicle: bool = False
    stopped_vehicles: List[int] = field(default_factory=list)
    lanes: List[Dict] = field(default_factory=list)
    alerts: List[Dict] = field(default_factory=list)


class TrafficAnalyzer:
    def __init__(self, thresholds: Dict = None):
        # Thresholds: number of CURRENT vehicles → density label
        self.thresholds = thresholds or {
            "Low": (0, 5),
            "Medium": (5, 15),
            "High": (15, 30),
            "Critical": (30, float("inf")),
        }
        self._prev_densities: List[str] = []

    def analyze(
        self,
        detections: List[Dict],
        tracked: List[Dict],
        tracker,
        camera_id: str,
        camera_name: str,
        frame_width: int = 1280,
        frame_height: int = 720,
    ) -> AnalysisResult:
        result = AnalysisResult()

        # ── Current vehicle counts (from tracker) ─────────────────────────
        if hasattr(tracker, "get_current_counts"):
            current_counts = tracker.get_current_counts(detections)
        else:
            current_counts = self._count_from_detections(detections)

        result.vehicle_counts = current_counts
        result.vehicle_count = current_counts.get("total", len(detections))

        # ── Total crossed counts (unique vehicles that passed the line) ────
        if hasattr(tracker, "get_total_crossed"):
            result.total_crossed = tracker.get_total_crossed()

        # ── Emergency vehicles ─────────────────────────────────────────────
        emergency = any(d.get("class_name") in EMERGENCY_CLASSES for d in detections)
        result.emergency_vehicle = emergency

        # ── Density (based on CURRENT vehicles, not cumulative) ───────────
        result.density = self._calc_density(result.vehicle_count)

        # ── Sustained congestion detection ─────────────────────────────────
        self._prev_densities.append(result.density)
        if len(self._prev_densities) > 10:
            self._prev_densities.pop(0)
        critical_count = sum(1 for d in self._prev_densities if d in ("High", "Critical"))
        result.congestion = critical_count >= 5

        # ── Stopped vehicle detection ──────────────────────────────────────
        stopped = []
        if hasattr(tracker, "get_stopped_ids"):
            stopped = tracker.get_stopped_ids()
        result.stopped_vehicles = stopped
        result.incident_detected = len(stopped) > 0

        # ── Lane analysis ──────────────────────────────────────────────────
        result.lanes = self._analyze_lanes(detections, frame_width)

        # ── Alerts ────────────────────────────────────────────────────────
        alerts = []
        if result.density == "Critical":
            alerts.append({
                "severity": "critical",
                "message": "Critical traffic congestion detected",
                "description": f"Current vehicles: {result.vehicle_count}",
                "camera_id": camera_id,
                "camera_name": camera_name,
            })
        elif result.density == "High":
            alerts.append({
                "severity": "warning",
                "message": "High traffic density",
                "description": f"Current vehicles: {result.vehicle_count}",
                "camera_id": camera_id,
                "camera_name": camera_name,
            })
        if result.incident_detected:
            alerts.append({
                "severity": "high",
                "message": "Stopped vehicle / possible incident detected",
                "description": f"Track IDs: {stopped[:3]}",
                "camera_id": camera_id,
                "camera_name": camera_name,
            })
        if result.emergency_vehicle:
            alerts.append({
                "severity": "warning",
                "message": "Emergency vehicle detected",
                "description": "Traffic signal override recommended",
                "camera_id": camera_id,
                "camera_name": camera_name,
            })
        result.alerts = alerts
        return result

    def _calc_density(self, count: int) -> str:
        low_max = self.thresholds.get("Low", (0, 5))[1]
        med_max = self.thresholds.get("Medium", (5, 15))[1]
        high_max = self.thresholds.get("High", (15, 30))[1]
        if count <= low_max:
            return "Low"
        elif count <= med_max:
            return "Medium"
        elif count <= high_max:
            return "High"
        else:
            return "Critical"

    def _count_from_detections(self, detections: List[Dict]) -> Dict:
        counts = {"cars": 0, "bikes": 0, "buses": 0, "trucks": 0, "autos": 0}
        for d in detections:
            cls = d.get("class_name", "")
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

    def _analyze_lanes(self, detections: List[Dict], frame_width: int) -> List[Dict]:
        lane_width = frame_width // 3
        lanes = [{"lane_id": i + 1, "vehicle_count": 0, "density": "Low"} for i in range(3)]
        for d in detections:
            cx = d.get("center", (0, 0))[0]
            lane_idx = min(cx // lane_width, 2)
            lanes[lane_idx]["vehicle_count"] += 1
        for lane in lanes:
            lane["density"] = self._calc_density(lane["vehicle_count"] * 3)
        return lanes

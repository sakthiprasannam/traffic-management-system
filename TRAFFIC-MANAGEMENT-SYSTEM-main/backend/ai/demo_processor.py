"""
Demo Video Processor — processes uploaded/sample video files as camera feeds.
Now passes camera_id to detector (for ROI) and tracker (for counting line).
"""
import cv2
import asyncio
import logging
import time
from pathlib import Path
from typing import Optional, Callable

logger = logging.getLogger(__name__)


def create_test_frame(width: int = 640, height: int = 360, frame_num: int = 0):
    """Generate a synthetic traffic scene frame for demo mode"""
    import numpy as np
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    # Road surface
    frame[int(height * 0.4):, :] = (40, 40, 50)
    # Lane markings
    for x in range(0, width, 60):
        cv2.line(frame, (x, int(height * 0.5)), (x + 30, height), (200, 200, 50), 2)
    # Simulated moving vehicles
    for i in range(5):
        offset = (frame_num * 3 + i * 120) % width
        x = offset
        y = int(height * (0.5 + i * 0.09))
        colors = [(59, 130, 246), (16, 185, 129), (239, 68, 68), (245, 158, 11), (139, 92, 246)]
        cv2.rectangle(frame, (x, y), (x + 50, y + 25), colors[i % len(colors)], -1)
    cv2.putText(frame, "DEMO MODE", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 200, 100), 1)
    return frame


class DemoProcessor:
    def __init__(self, video_path: Optional[str] = None, frame_skip: int = 2):
        self.video_path = video_path
        self.frame_skip = frame_skip
        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_count = 0
        self.running = False

    def open(self) -> bool:
        if self.video_path and Path(self.video_path).exists():
            self.cap = cv2.VideoCapture(self.video_path)
            if self.cap.isOpened():
                logger.info(f"📹 Video opened: {self.video_path}")
                return True
            else:
                logger.warning(f"⚠️ Could not open video: {self.video_path}")
        logger.info("📹 Using synthetic demo frames")
        self.cap = None
        return False

    def read_frame(self):
        """Read next frame, auto-loops video files"""
        if self.cap and self.cap.isOpened():
            for _ in range(self.frame_skip):
                ret, frame = self.cap.read()
                if not ret:
                    # Loop back to start
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()
                if not ret:
                    break
            if ret and frame is not None:
                self.frame_count += 1
                return frame
        self.frame_count += 1
        return create_test_frame(frame_num=self.frame_count)

    def release(self):
        if self.cap:
            self.cap.release()
            self.cap = None

    def get_fps(self) -> float:
        if self.cap and self.cap.isOpened():
            return self.cap.get(cv2.CAP_PROP_FPS) or 24.0
        return 24.0

    async def process_loop(
        self,
        camera_id: str,
        camera_name: str,
        detector,
        tracker,
        analyzer,
        on_result: Callable,
        db=None,
    ):
        """Main AI processing loop — runs until stopped"""
        self.running = True
        self.open()
        fps = self.get_fps()
        interval = 1.0 / max(fps / (self.frame_skip + 1), 1)

        logger.info(f"▶ Processing loop started: {camera_name}")
        while self.running:
            try:
                t0 = time.time()
                frame = self.read_frame()

                if frame is None:
                    await asyncio.sleep(0.1)
                    continue

                # ── AI Processing ──────────────────────────────────────
                # detector.detect() now takes camera_id for ROI filtering
                # use_tracking=True enables model.track() with ByteTrack
                detections, annotated = detector.detect(
                    frame,
                    camera_id=camera_id,
                    use_tracking=True,
                )

                # tracker.update() handles crossing line logic
                tracked = tracker.update(detections, frame.shape)

                result = analyzer.analyze(
                    detections, tracked, tracker,
                    camera_id, camera_name,
                    frame.shape[1], frame.shape[0]
                )

                elapsed = time.time() - t0
                actual_fps = round(1.0 / max(elapsed, 0.001), 1)

                # ── Persist to DB ──────────────────────────────────────
                if db is not None:
                    try:
                        from datetime import datetime
                        record = {
                            "camera_id": camera_id,
                            "camera_name": camera_name,
                            "timestamp": datetime.utcnow(),
                            "vehicle_counts": result.vehicle_counts,
                            "total_crossed": result.total_crossed,
                            "density": result.density,
                            "lanes": result.lanes,
                            "incident_detected": result.incident_detected,
                            "emergency_vehicle": result.emergency_vehicle,
                            "congestion": result.congestion,
                            "fps": actual_fps,
                        }
                        await db.traffic_records.insert_one(record)

                        for alert in result.alerts:
                            import uuid
                            alert_doc = {
                                "id": str(uuid.uuid4()),
                                "read": False,
                                "resolved": False,
                                "timestamp": datetime.utcnow(),
                                **alert,
                            }
                            await db.alerts.insert_one(alert_doc)
                    except Exception as db_err:
                        logger.warning(f"DB write error [{camera_name}]: {db_err}")

                # ── Broadcast result ───────────────────────────────────
                await on_result({
                    "camera_id": camera_id,
                    "camera_name": camera_name,
                    "vehicle_count": result.vehicle_count,
                    "vehicle_counts": result.vehicle_counts,     # current in frame
                    "total_crossed": result.total_crossed,       # unique crossed line
                    "density": result.density,
                    "incident_detected": result.incident_detected,
                    "emergency_vehicle": result.emergency_vehicle,
                    "congestion": result.congestion,
                    "lanes": result.lanes,
                    "fps": actual_fps,
                    "alerts": result.alerts,
                })

                await asyncio.sleep(max(0, interval - elapsed))

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Processing error [{camera_name}]: {e}")
                await asyncio.sleep(1)

        self.release()
        logger.info(f"⏹ Processing loop stopped: {camera_name}")

    def stop(self):
        self.running = False

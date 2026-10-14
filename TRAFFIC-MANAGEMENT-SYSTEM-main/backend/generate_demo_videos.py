"""
Generates synthetic traffic demo video loops for all cameras
"""
import cv2
import numpy as np
import os
import random

def generate_video(filename, scene_type="junction", num_frames=180, fps=24.0, width=640, height=360):
    os.makedirs("uploads", exist_ok=True)
    filepath = os.path.join("uploads", filename)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(filepath, fourcc, fps, (width, height))

    colors = {
        "car": [(59, 130, 246), (16, 185, 129), (245, 158, 11), (220, 220, 220), (30, 30, 30)],
        "truck": [(139, 92, 246), (180, 83, 9)],
        "bus": [(239, 68, 68), (14, 165, 233)],
    }

    # Pre-generate vehicle states
    vehicles = []
    for i in range(12):
        v_type = "car" if i < 8 else ("bus" if i < 10 else "truck")
        v_w = 40 if v_type == "car" else (70 if v_type == "bus" else 80)
        v_h = 22 if v_type == "car" else (28 if v_type == "bus" else 30)
        speed = random.uniform(2.5, 5.0)
        lane = i % 3
        start_x = random.randint(-400, width)
        v_color = random.choice(colors[v_type])
        vehicles.append({
            "type": v_type,
            "w": v_w,
            "h": v_h,
            "speed": speed,
            "lane": lane,
            "x": start_x,
            "color": v_color,
            "dir": 1 if lane < 2 else -1
        })

    for f in range(num_frames):
        frame = np.zeros((height, width, 3), dtype=np.uint8)

        if scene_type == "bridge":
            # Water background
            frame[:] = (120, 70, 30)
            # Bridge deck
            cv2.rectangle(frame, (0, 80), (width, 280), (60, 60, 65), -1)
            cv2.rectangle(frame, (0, 75), (width, 85), (140, 140, 150), -1)
            cv2.rectangle(frame, (0, 275), (width, 285), (140, 140, 150), -1)
            # Lane markings
            for y in [145, 215]:
                for x in range(0, width, 40):
                    cv2.line(frame, (x, y), (x + 20, y), (255, 255, 255), 2)
        elif scene_type == "junction":
            # Grass / Sidewalk
            frame[:] = (40, 80, 45)
            # Horizontal road
            cv2.rectangle(frame, (0, 110), (width, 250), (50, 50, 55), -1)
            # Vertical road
            cv2.rectangle(frame, (230, 0), (410, height), (50, 50, 55), -1)
            # Intersection box
            cv2.rectangle(frame, (230, 110), (410, 250), (60, 60, 65), -1)
            # Zebra crossings
            for y in range(115, 245, 15):
                cv2.rectangle(frame, (215, y), (225, y + 8), (240, 240, 240), -1)
                cv2.rectangle(frame, (415, y), (425, y + 8), (240, 240, 240), -1)
            for x in range(235, 405, 15):
                cv2.rectangle(frame, (x, 95), (x + 8, 105), (240, 240, 240), -1)
                cv2.rectangle(frame, (x, 255), (x + 8, 265), (240, 240, 240), -1)
        else:
            # Multi-lane highway / corridor
            frame[:] = (35, 60, 35) # scenery
            cv2.rectangle(frame, (0, 60), (width, 300), (45, 45, 50), -1)
            # Shoulder
            cv2.line(frame, (0, 65), (width, 65), (255, 255, 255), 2)
            cv2.line(frame, (0, 295), (width, 295), (255, 255, 255), 2)
            # Dash lines
            for y in [120, 180, 240]:
                for x in range(0, width, 40):
                    cv2.line(frame, (x, y), (x + 20, y), (200, 200, 50), 2)

        # Draw moving vehicles
        for v in vehicles:
            if v["dir"] == 1:
                v["x"] += v["speed"]
                if v["x"] > width + 50:
                    v["x"] = -v["w"] - random.randint(10, 100)
            else:
                v["x"] -= v["speed"]
                if v["x"] < -v["w"] - 50:
                    v["x"] = width + random.randint(10, 100)

            base_y = 90 + v["lane"] * 55
            vx = int(v["x"])
            vy = int(base_y)

            # Draw vehicle body
            cv2.rectangle(frame, (vx, vy), (vx + v["w"], vy + v["h"]), v["color"], -1)
            cv2.rectangle(frame, (vx, vy), (vx + v["w"], vy + v["h"]), (255, 255, 255), 1)

            # Windshield
            wx = vx + 8 if v["dir"] == 1 else vx + v["w"] - 14
            cv2.rectangle(frame, (wx, vy + 3), (wx + 6, vy + v["h"] - 3), (40, 40, 40), -1)

            # Headlights / Taillights
            if v["dir"] == 1:
                cv2.circle(frame, (vx + v["w"] - 2, vy + 4), 2, (100, 255, 255), -1)
                cv2.circle(frame, (vx + v["w"] - 2, vy + v["h"] - 4), 2, (100, 255, 255), -1)
                cv2.circle(frame, (vx + 2, vy + 4), 2, (50, 50, 255), -1)
                cv2.circle(frame, (vx + 2, vy + v["h"] - 4), 2, (50, 50, 255), -1)
            else:
                cv2.circle(frame, (vx + 2, vy + 4), 2, (100, 255, 255), -1)
                cv2.circle(frame, (vx + 2, vy + v["h"] - 4), 2, (100, 255, 255), -1)
                cv2.circle(frame, (vx + v["w"] - 2, vy + 4), 2, (50, 50, 255), -1)
                cv2.circle(frame, (vx + v["w"] - 2, vy + v["h"] - 4), 2, (50, 50, 255), -1)

        # OSD Header overlay
        cv2.rectangle(frame, (0, 0), (width, 24), (0, 0, 0), -1)
        cv2.putText(frame, f"TRAFFIC-AI DEMO | {scene_type.upper()} | REC [LIVE]", (10, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 180), 1)

        out.write(frame)

    out.release()
    print(f"Generated {filepath} ({num_frames} frames)")

if __name__ == "__main__":
    generate_video("cam01_junction.mp4", scene_type="junction")
    generate_video("cam02_corridor.mp4", scene_type="corridor")
    generate_video("cam03_highway.mp4", scene_type="highway")
    generate_video("cam04_bridge.mp4", scene_type="bridge")
    print("All demo videos created successfully in uploads/!")

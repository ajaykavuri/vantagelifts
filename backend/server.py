import cv2
import base64
import numpy as np
import uvicorn
import time
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from ultralytics import YOLO
from mechanics import LifterState

app = FastAPI()

# 1. Load YOLOv11 Pose Model
model = YOLO('yolo11n-pose.pt')

class SessionManager:
    def __init__(self):
        self.lifter = LifterState()
        self.rep_velocities = []
        self.current_rep_peak_vel = 0
        self.last_reps = 0
        self.exercise_type = "curl"
        self.last_valid_feedback = "Ready"
        self.frames_since_detection = 0

    def reset(self, exercise_type):
        print(f"\n>>> SESSION RESET: {exercise_type} <<<\n")
        self.lifter = LifterState()
        self.rep_velocities = []
        self.current_rep_peak_vel = 0
        self.last_reps = 0
        self.exercise_type = exercise_type
        self.last_valid_feedback = "Ready"
        self.frames_since_detection = 0
    
    def calculate_rir(self):
        """Estimate Reps in Reserve based on Velocity Loss"""
        # DEBUG: Print the raw history
        print(f"   [RIR DEBUG] History: {self.rep_velocities}")

        if len(self.rep_velocities) < 2: 
            print("   [RIR DEBUG] Not enough reps (Need 2+)")
            return 5
        
        first = self.rep_velocities[0]
        last = self.rep_velocities[-1]
        
        if first == 0: return 5
        
        # Calculate Percentage Loss
        loss = (first - last) / first
        loss_pct = loss * 100
        
        print(f"   [RIR DEBUG] First: {first:.2f} | Last: {last:.2f} | Loss: {loss_pct:.1f}%")

        if loss > 0.40: return 0   # >40% loss = Failure
        if loss > 0.25: return 1   # >25% loss = 1 left
        if loss > 0.15: return 2   # >15% loss = 2 left
        return 4                   # <15% loss = Easy

session = SessionManager()

def clean_for_json(data):
    if isinstance(data, dict):
        return {k: clean_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_for_json(v) for v in data]
    elif isinstance(data, (np.integer, int)):
        return int(data)
    elif isinstance(data, (np.floating, float)):
        return float(data)
    elif isinstance(data, np.ndarray):
        return clean_for_json(data.tolist())
    else:
        return data

@app.websocket("/ws/analyze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print(">>> CLIENT CONNECTED")
    session.reset("curl")
    
    try:
        while True:
            try:
                data = await websocket.receive_text()
                payload = json.loads(data)
                image_data = payload.get("image")
                
                client_exercise = payload.get("exercise", "curl")
                if (client_exercise != session.exercise_type):
                    session.reset(client_exercise)
            except Exception:
                break
            
            try:
                image_bytes = base64.b64decode(image_data)
                np_arr = np.frombuffer(image_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            except Exception:
                continue

            if frame is None: continue

            img_h, img_w, _ = frame.shape
            results = model(frame, verbose=False)
            
            raw_response = {
                "state": "Searching",
                "reps": session.last_reps,
                "velocity": 0.0,
                "rir": 5, # Default
                "feedback": session.last_valid_feedback, 
                "keypoints": None 
            }

            if results and results[0].keypoints is not None:
                keypoints = results[0].keypoints.xy.cpu().numpy()
                confs = results[0].keypoints.conf.cpu().numpy()

                if keypoints.shape[0] > 0:
                    kpts = keypoints[0]
                    conf = confs[0]
                    th = 0.05 
                    
                    wrist_ys, elbow_ys, shoulder_ys = [], [], []

                    if conf[9] > th: wrist_ys.append(kpts[9][1])
                    if conf[10]> th: wrist_ys.append(kpts[10][1])
                    if conf[7] > th: elbow_ys.append(kpts[7][1])
                    if conf[8] > th: elbow_ys.append(kpts[8][1])
                    if conf[5] > th: shoulder_ys.append(kpts[5][1])
                    if conf[6] > th: shoulder_ys.append(kpts[6][1])

                    best_y = None
                    if len(wrist_ys) > 0: best_y = np.mean(wrist_ys)
                    elif len(elbow_ys) > 0: best_y = np.mean(elbow_ys)
                    elif len(shoulder_ys) > 0: best_y = np.mean(shoulder_ys)

                    if best_y is not None:
                        session.frames_since_detection = 0
                        try:
                            stats = session.lifter.update(best_y)
                            if stats:
                                raw_response['state'] = stats['state']
                                raw_response['reps'] = stats['reps']
                                raw_response['velocity'] = stats['velocity']

                                # --- LOGIC: RECORD NEW REP ---
                                if stats['reps'] > session.last_reps:
                                    # Use the Peak Velocity captured during the rep
                                    # For simplicity, we use the average velocity of the concentric phase
                                    # or just the last instant velocity (which might be low at the top).
                                    # Better approach: We use the 'rep_velocity' returned from mechanics
                                    
                                    recorded_vel = stats['rep_velocity']
                                    print(f"\n>>> REP {stats['reps']} COMPLETED. Velocity: {recorded_vel:.2f}")
                                    
                                    session.rep_velocities.append(recorded_vel)
                                    session.last_reps = stats['reps']
                                    
                                    # Calculate RIR now that we have a new rep
                                    raw_response["rir"] = session.calculate_rir()
                                else:
                                    # Keep sending previous RIR
                                    raw_response["rir"] = session.calculate_rir()

                                # Feedback
                                state = stats['state']
                                if state == "DESCENDING": fb = "Control Negative"
                                elif state == "ASCENDING": fb = "EXPLODE UP!"
                                elif state == "TOP": fb = "Lockout"
                                elif state == "BOTTOM": fb = "Drive!"
                                else: fb = "Ready"
                                
                                raw_response['feedback'] = fb
                                session.last_valid_feedback = fb

                        except Exception as e:
                            print(f"Mech Error: {e}")
                    
                    else:
                        session.frames_since_detection += 1
                        if session.frames_since_detection > 10: 
                            raw_response['feedback'] = "Looking for lifter..."
                            session.last_valid_feedback = "Looking for lifter..."
                    
                    # Skeleton Drawing
                    overlay_data = {}
                    def norm(pt): return [pt[0]/img_w, pt[1]/img_h]
                    if conf[5] > th: overlay_data['shoulder_l'] = norm(kpts[5])
                    if conf[7] > th: overlay_data['elbow_l'] = norm(kpts[7])
                    if conf[9] > th: overlay_data['wrist_l'] = norm(kpts[9])
                    elif conf[7] > th: overlay_data['wrist_l'] = norm(kpts[7]) 
                    if conf[6] > th: overlay_data['shoulder_r'] = norm(kpts[6])
                    if conf[8] > th: overlay_data['elbow_r'] = norm(kpts[8])
                    if conf[10]> th: overlay_data['wrist_r'] = norm(kpts[10])
                    elif conf[8] > th: overlay_data['wrist_r'] = norm(kpts[8]) 
                    if conf[11] > th: overlay_data['hip_l'] = norm(kpts[11])
                    if conf[12] > th: overlay_data['hip_r'] = norm(kpts[12])

                    if overlay_data:
                        raw_response['keypoints'] = overlay_data

            safe_response = clean_for_json(raw_response)
            await websocket.send_json(safe_response)

    except WebSocketDisconnect:
        print(">>> CLIENT DISCONNECTED")
    except Exception as e:
        print(f">>> CRITICAL ERROR: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

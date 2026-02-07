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
        """Estimate Reps in Reserve using a Linear Function"""
        if not self.rep_velocities:
            return 8 # Assume fresh start

        # 1. Baseline: Average of all reps so far
        baseline = np.mean(self.rep_velocities)
        last = self.rep_velocities[-1]
        
        if baseline == 0: return 8
        
        # 2. Calculate Loss (0.0 to 1.0)
        loss = (baseline - last) / baseline
        
        # 3. Linear Mapping
        # Formula: RIR = 8 - (13.3 * Loss)
        # This maps 0% loss -> 8 RIR
        # This maps 60% loss -> 0 RIR
        estimated_rir = 8 - (13.3 * loss)
        
        # 4. Clamp & Round
        # Ensure it stays between 0 and 8, and is an integer
        final_rir = int(round(max(0, min(8, estimated_rir))))
        
        # Debug Output
        print(f"   [RIR DEBUG] Avg: {baseline:.2f} | Last: {last:.2f} | Loss: {loss*100:.1f}% | RIR: {final_rir}")

        return final_rir

session = SessionManager()

# Define Lower Body Exercises
LOWER_BODY_EXERCISES = ["squat", "deadlift", "lunge", "legs"]

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
                "rir": 8, # Default to 8 (Fresh)
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
                    
                    is_lower_body = session.exercise_type in LOWER_BODY_EXERCISES
                    
                    best_y = None
                    tracking_source = "NONE"

                    if is_lower_body:
                        # LOWER BODY
                        hip_ys, knee_ys = [], []
                        if conf[11] > th: hip_ys.append(kpts[11][1]) 
                        if conf[12] > th: hip_ys.append(kpts[12][1]) 
                        if conf[13] > th: knee_ys.append(kpts[13][1]) 
                        if conf[14] > th: knee_ys.append(kpts[14][1]) 

                        if len(hip_ys) > 0: best_y = np.mean(hip_ys)
                        elif len(knee_ys) > 0: best_y = np.mean(knee_ys)

                    else:
                        # UPPER BODY
                        wrist_ys, elbow_ys, shoulder_ys = [], [], []
                        if conf[9] > th: wrist_ys.append(kpts[9][1])
                        if conf[10]> th: wrist_ys.append(kpts[10][1])
                        if conf[7] > th: elbow_ys.append(kpts[7][1])
                        if conf[8] > th: elbow_ys.append(kpts[8][1])
                        if conf[5] > th: shoulder_ys.append(kpts[5][1])
                        if conf[6] > th: shoulder_ys.append(kpts[6][1])

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

                                if stats['reps'] > session.last_reps:
                                    recorded_vel = stats['rep_velocity']
                                    print(f"\n>>> REP {stats['reps']} COMPLETED. Velocity: {recorded_vel:.2f}")
                                    session.rep_velocities.append(recorded_vel)
                                    session.last_reps = stats['reps']
                                    raw_response["rir"] = session.calculate_rir()
                                else:
                                    raw_response["rir"] = session.calculate_rir()

                                state = stats['state']
                                if state == "DESCENDING": fb = "Control Negative"
                                elif state == "ASCENDING": fb = "EXPLODE UP!"
                                elif state == "TOP": fb = "Lockout"
                                elif state == "BOTTOM": fb = "Drive!"
                                else: fb = "Ready"
                                raw_response['feedback'] = fb
                                session.last_valid_feedback = fb
                        except Exception:
                            pass
                    else:
                        session.frames_since_detection += 1
                        if session.frames_since_detection > 10: 
                            raw_response['feedback'] = "Looking for lifter..."

                    overlay_data = {}
                    def norm(pt): return [pt[0]/img_w, pt[1]/img_h]
                    
                    if conf[5] > th: overlay_data['shoulder_l'] = norm(kpts[5])
                    if conf[6] > th: overlay_data['shoulder_r'] = norm(kpts[6])
                    if conf[7] > th: overlay_data['elbow_l'] = norm(kpts[7])
                    if conf[8] > th: overlay_data['elbow_r'] = norm(kpts[8])
                    if conf[11]> th: overlay_data['hip_l'] = norm(kpts[11])
                    if conf[12]> th: overlay_data['hip_r'] = norm(kpts[12])
                    if conf[9] > th: overlay_data['wrist_l'] = norm(kpts[9])
                    elif conf[7] > th: overlay_data['wrist_l'] = norm(kpts[7]) 
                    if conf[10]> th: overlay_data['wrist_r'] = norm(kpts[10])
                    elif conf[8] > th: overlay_data['wrist_r'] = norm(kpts[8]) 
                    if conf[13] > th: overlay_data['knee_l'] = norm(kpts[13])
                    if conf[14] > th: overlay_data['knee_r'] = norm(kpts[14])
                    if conf[15] > th: overlay_data['ankle_l'] = norm(kpts[15])
                    if conf[16] > th: overlay_data['ankle_r'] = norm(kpts[16])

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

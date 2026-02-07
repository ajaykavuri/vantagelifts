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
        self.exercise_type = "curl" # default

    def reset(self, exercise_type):
        self.lifter = LifterState()
        self.rep_velocities = []
        self.current_rep_peak_vel = 0
        self.last_reps = 0
        self.exercise_type = exercise_type
    
    def calculate_rir(self):
        """Estimate Reps in Reserve based on Velocity Loss"""
        if len(self.rep_velocities) < 2:
            return 5
        
        first_rep_vel = self.rep_veloities[0]
        last_rep_vel = self.rep_velocities[-1]

        # Velocity Loss % = (First - Last) / First
        loss = (first_rep_vel - last_rep_vel) / first_rep_vel

        if loss > 0.4: return 0  # Failed or Grinding
        if loss > 0.3: return 1
        if loss > 0.2: return 2
        return 4 # Still moving fast

session = SessionManager

def clean_for_json(data):
    """Recursively converts NumPy types to native Python types."""
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
    print(">>> CLIENT CONNECTED: New Session Started")
    
    lifter = LifterState()
    session.reset("curl")
    try:
        while True:
            try:
                data = await websocket.receive_text()
                payload = json.loads(data)
                image_data = payload.get("image")

                # check if user requested reset or new set
                client_exercise = payload.get("exercise", "curl")
                if (client_exercise != session.exercise_type):
                    print(f"Switching to {client_exercise}")
                    session.reset(client_exercise)
            except Exception:
                break
            
            try:
                image_bytes = base64.b64decode(image_data)
                np_arr = np.frombuffer(image_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            except Exception as e:
                print(f"Decoding Error: {e}")
                continue

            if frame is None:
                continue

            # GET IMAGE DIMENSIONS FOR NORMALIZATION
            # This is crucial for the skeleton to align on your phone
            img_h, img_w, _ = frame.shape

            results = model(frame, verbose=False)
            
            raw_response = {
                "state": "Searching",
                "reps": session.last_reps,
                "velocity": 0.0,
                "rir": session.calculate_rir(),
                "feedback": "Looking for lifter...",
                "keypoints": None 
            }

            if results and results[0].keypoints is not None:
                keypoints = results[0].keypoints.xy.cpu().numpy()
                confs = results[0].keypoints.conf.cpu().numpy()

                if keypoints.shape[0] > 0:
                    kpts = keypoints[0]
                    conf = confs[0]

                    if len(kpts) >= 11: 
                        # --- NORMALIZED GRAPHICS OVERLAY ---
                        # We send x/width and y/height (0.0 to 1.0)
                        overlay_data = {}
                        
                        # Lowered threshold to 0.3 so it shows up more easily
                        if conf[5] > 0.3: 
                            overlay_data['shoulder_l'] = [kpts[5][0] / img_w, kpts[5][1] / img_h]
                        if conf[7] > 0.3: 
                            overlay_data['elbow_l']    = [kpts[7][0] / img_w, kpts[7][1] / img_h]
                        if conf[9] > 0.3: 
                            overlay_data['wrist_l']    = [kpts[9][0] / img_w, kpts[9][1] / img_h]
                        
                        raw_response['keypoints'] = overlay_data

                        # --- BIOMECHANICS ---
                        mech_kpts = {}
                        if conf[9] > 0.3: mech_kpts['wrist_l'] = kpts[9]
                        if conf[10] > 0.3: mech_kpts['wrist_r'] = kpts[10]

                        if mech_kpts:
                            try:
                                stats = session.lifter.update(mech_kpts)
                                if stats:
                                    raw_response['state'] = stats['state']
                                    raw_response['reps'] = stats['reps']
                                    raw_response['velocity'] = stats['velocity']

                                    if stats['state'] == "ASCENDING":
                                        session.current_rep_peak_vel = max(session.current_rep_peak_vel, stats['velocity'])
                                    
                                    if stats['reps'] > session.last_reps:
                                        if session.current_rep_peak_vel > 0:
                                            session.rep_velocities.append(session.current_rep_peak_vel)
                                        session.last_reps = stats['reps']
                                        session.current_rep_peak_vel = 0 # reset for next rep
                                    
                                    raw_response["rir"] = session.calculate_rir()

                                    state = stats['state']
                                    
                                    if state == "DESCENDING": raw_response['feedback'] = "Control Negative"
                                    elif state == "ASCENDING": raw_response['feedback'] = "EXPLODE UP!"
                                    elif state == "TOP": raw_response['feedback'] = "Lockout"
                                    elif state == "BOTTOM": raw_response['feedback'] = "Drive!"
                                    else: raw_response['feedback'] = "Ready"
                            except Exception:
                                pass

            safe_response = clean_for_json(raw_response)
            await websocket.send_json(safe_response)

    except WebSocketDisconnect:
        print(">>> CLIENT DISCONNECTED")
    except Exception as e:
        print(f">>> CRITICAL SERVER ERROR: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

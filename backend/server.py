import cv2
import base64
import numpy as np
import uvicorn
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from ultralytics import YOLO
from mechanics import LifterState

app = FastAPI()

# 1. Load YOLOv11 Pose Model
model = YOLO('yolo11n-pose.pt')

def clean_for_json(data):
    """
    Recursively converts NumPy types to native Python types 
    so JSON serialization doesn't crash the server.
    """
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
    
    lifter = LifterState()
    
    try:
        while True:
            # 2. Receive Base64 Image
            try:
                data = await websocket.receive_text()
            except Exception:
                # If receive fails, client likely disconnected
                break
            
            # Decode Logic
            try:
                image_bytes = base64.b64decode(data)
                np_arr = np.frombuffer(image_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            except Exception as e:
                print(f"Decoding Error: {e}")
                continue

            if frame is None:
                continue

            # 3. Run Inference
            # verbose=False keeps terminal clean
            results = model(frame, verbose=False)
            
            # Default response
            raw_response = {
                "state": "Searching",
                "reps": 0,
                "velocity": 0.0,
                "feedback": "Looking for lifter..."
            }

            # 4. Keypoint Extraction
            if results and results[0].keypoints is not None:
                # .xy returns a nice (N, 17, 2) tensor of coordinates
                # .conf returns (N, 17) tensor of confidence
                # We move to CPU and numpy immediately
                keypoints = results[0].keypoints.xy.cpu().numpy()
                confs = results[0].keypoints.conf.cpu().numpy()

                # Check if we have at least one person (Index 0)
                if keypoints.shape[0] > 0:
                    # Get the first person's data
                    # shape is (17, 2) for kpts, (17,) for conf
                    kpts = keypoints[0]
                    conf = confs[0]

                    # Validate we have enough points (COCO has 17)
                    if len(kpts) >= 11: 
                        # COCO Indices: 9=Left Wrist, 10=Right Wrist
                        l_wrist_conf = conf[9]
                        r_wrist_conf = conf[10]

                        keypoints_dict = {}
                        if l_wrist_conf > 0.4:
                            keypoints_dict['wrist_l'] = kpts[9]
                        if r_wrist_conf > 0.4:
                            keypoints_dict['wrist_r'] = kpts[10]

                        if keypoints_dict:
                            # 5. Update Mechanics
                            try:
                                mechanics_feedback = lifter.update(keypoints_dict)
                                if mechanics_feedback:
                                    raw_response.update(mechanics_feedback)
                                    
                                    # Logic to map state to UI text
                                    state = raw_response.get('state', 'wait')
                                    if state == "DESCENDING":
                                        raw_response['feedback'] = "Control Negative"
                                    elif state == "ASCENDING":
                                        raw_response['feedback'] = "EXPLODE UP!"
                                    elif state == "top":
                                        raw_response['feedback'] = "Lockout"
                                    else:
                                        raw_response['feedback'] = "Ready"
                            except Exception as mech_err:
                                print(f"Mechanics Logic Error: {mech_err}")

            # 6. SANITIZE AND SEND
            # This step is CRITICAL. It removes the NumPy types that crash the socket.
            safe_response = clean_for_json(raw_response)
            
            await websocket.send_json(safe_response)

    except WebSocketDisconnect:
        print(">>> CLIENT DISCONNECTED")
    except Exception as e:
        print(f">>> CRITICAL SERVER ERROR: {e}")

if __name__ == "__main__":
    # Ensure uvicorn runs on 0.0.0.0 to be visible to the phone
    uvicorn.run(app, host="0.0.0.0", port=8000)


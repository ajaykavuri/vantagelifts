import cv2
import base64
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from ultralytics import YOLO

app = FastAPI()

# 1. Load YOLOv11 Pose Model (It will download automatically on first run)
# 'yolo11n-pose.pt' is the 'nano' version - fastest for real-time
model = YOLO('yolo11n-pose.pt') 

@app.websocket("/ws/analyze")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # State variables for Rep Counting logic
    rep_count = 0
    is_down = False
    
    try:
        while True:
            # 2. Receive Base64 Image from React Native
            data = await websocket.receive_text()
            
            # Decode Base64 to OpenCV Image
            image_bytes = base64.b64decode(data)
            np_arr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            # 3. Run YOLOv11 Inference
            results = model(frame, verbose=False)
            
            # Default response
            response = {"angle": 0, "reps": rep_count, "feedback": "No human detected"}

            # 4. Extract Keypoints
            if results[0].keypoints is not None:
                # Get keypoints (x, y, confidence)
                kpts = results[0].keypoints.data[0].cpu().numpy()
                
                # Indices for YOLO Pose: 5=L_Shoulder, 7=L_Elbow, 9=L_Wrist
                # (You might need to check if user is facing left or right, assuming Left for demo)
                shoulder = kpts[5]
                elbow = kpts[7]
                wrist = kpts[9]

                # Confidence check
                if shoulder[2] > 0.5 and elbow[2] > 0.5 and wrist[2] > 0.5:
                    
                    # Calculate Elbow Angle
                    angle = calculate_angle(shoulder[:2], elbow[:2], wrist[:2])
                    
                    # Simple Rep Logic (Example: Bicep Curl or Bench Press range)
                    if angle > 160: # Arm straight
                        if is_down:
                            rep_count += 1
                            is_down = False
                    elif angle < 90: # Arm bent
                        is_down = True
                        
                    response = {
                        "angle": int(angle),
                        "reps": rep_count,
                        "feedback": "Good Form" if angle < 90 else "Extend Fully"
                    }
            
            # 5. Send JSON back to Phone
            await websocket.send_json(response)

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

def calculate_angle(a, b, c):
    """Calculates angle between three points (a, b, c) where b is the vertex."""
    ba = a - b
    bc = c - b
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.arccos(np.clip(cosine_angle, -1.0, 1.0))
    return np.degrees(angle)

if __name__ == "__main__":
    # Run on 0.0.0.0 so your phone can access it via local IP
    uvicorn.run(app, host="0.0.0.0", port=8000)
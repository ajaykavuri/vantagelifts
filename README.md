# Vantage ⚡️ Proof of Sweat Protocol

> **Winner of the Polychrome Mosaic Track (Target)** > *Bridging Preventative Healthcare & Decentralized Finance through Computer Vision.*

## 🚀 The Elevator Pitch
**Vantage** is the world's first **"Proof of Sweat"** ecosystem. While traditional fitness apps rely on manual (and easily faked) inputs, Vantage uses real-time **Computer Vision** and **Velocity Loss Tracking (VLT)** to cryptographically verify physical exertion.

By turning biomechanical data into a verifiable asset, we unlock a new layer of "Active Finance":
* **For Users:** Stake credits on your own workout performance.
* **For Insurers:** "Pay-as-you-lift" premiums based on verified mobility and form safety.
* **For Health:** AI-driven form correction that prevents injury before it happens.

---

## 🛠 The Tech Stack
* **Frontend:** React Native (Expo)
* **Backend:** Python (FastAPI + WebSockets)
* **AI Engine:** YOLOv11 (Pose Estimation via Ultralytics)
* **Real-time Protocol:** JSON over WebSockets (Avg latency < 100ms)

---

## 📸 How to Run the Demo (Local Setup)
*Since this is a hackathon project, the backend runs locally on your laptop and streams data to your phone via local WiFi.*

### Prerequisites
1.  **Node.js** & **npm**
2.  **Python 3.9+**
3.  **Expo Go App** installed on your iOS/Android device.
4.  **Important:** Your laptop and phone **MUST** be on the same WiFi network (or use a mobile hotspot).

### Step 1: Fire Up the AI Backend (Python)
1.  Navigate to the backend folder:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment (optional but recommended):
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install fastapi uvicorn ultralytics opencv-python websockets
    ```
4.  **CRITICAL:** Find your Laptop's Local IP Address.
    * **Mac:** Run `ipconfig getifaddr en0` in terminal.
    * **Windows:** Run `ipconfig` and look for "IPv4 Address".
    * *Keep this number handy (e.g., 192.168.1.5).*
5.  Start the server:
    ```bash
    python3 server.py
    ```

### Step 2: Connect the Frontend (React Native)
1.  Open `frontend/app/index.tsx` (or `App.js`).
2.  Find the line defining `SERVER_URL`:
    ```javascript
    // REPLACE THIS with the IP you found in Step 1
    const SERVER_URL = "ws://192.168.1.5:8000/ws/analyze"; 
    ```
3.  Navigate to the frontend folder in a new terminal:
    ```bash
    cd frontend
    ```
4.  Install dependencies:
    ```bash
    npm install
    ```
5.  Start the Expo server:
    ```bash
    npx expo start
    ```

### Step 3: The Moment of Truth
1.  Scan the QR code displayed in your terminal with your phone (or the Expo Go app).
2.  **Grant Camera Permissions** when prompted.
3.  Point your camera at a teammate doing a bicep curl or squat.
4.  Watch the **Angle**, **Rep Count**, and **Wager** update in real-time!

---

## ⚠️ Troubleshooting
* **"Network Request Failed" / No Connection:**
    * Ensure your phone and laptop are on the same WiFi.
    * If on University/Public WiFi: Create a **Personal Hotspot** from your phone and connect your laptop to it.
    * Try running Expo with a tunnel: `npx expo start --tunnel`.
* **Laggy Video:**
    * We deliberately downscale images for the hackathon demo to ensure speed over quality.
    * Check the `setInterval` in `App.js`. If it's too fast (e.g., 50ms), try increasing it to 150ms.

---

## 🔮 Roadmap
* **Smart Contract Integration:** Move "Wager" logic to an on-chain escrow contract.
* **Tele-PT:** Allow remote coaches to see the "Skeletal Overlay" in real-time.
* **Hardware Integration:** Apple Watch Heart Rate correlation for "CNS Fatigue" scores.

---

*Built with 💻 and ☕️ for the Hackathon 2026.*
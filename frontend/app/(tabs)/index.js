import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [ws, setWs] = useState(null);
  const [feedback, setFeedback] = useState({ angle: 0, reps: 0, feedback: "Ready" });
  const cameraRef = useRef(null);
  const processingRef = useRef(false); // Mutex to prevent flooding the server
  // Disable automatic captures to avoid saving photos / clogging camera roll
  const CAPTURE_ENABLED = false;

  // REPLACE WITH YOUR COMPUTER'S LOCAL IP ADDRESS (e.g., 192.168.1.5)
  const SERVER_URL = "ws://172.26.50.62:8000/ws/analyze"; 

  useEffect(() => {
    // 1. Setup WebSocket
    const socket = new WebSocket(SERVER_URL);
    
    socket.onopen = () => console.log("Connected to Server");
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setFeedback(data); // Update UI
      processingRef.current = false; // Unlock for next frame
    };
    socket.onerror = (e) => console.log("Error:", e.message);

    setWs(socket);

    // 2. Start Frame Loop (Every 150ms) - disabled by default
    let interval = null;
    if (CAPTURE_ENABLED) {
      interval = setInterval(() => {
        captureAndSend();
      }, 150);
    }

    return () => {
      socket.close();
      clearInterval(interval);
    };
  }, []);

  const captureAndSend = async () => {
    if (!CAPTURE_ENABLED) return; // capturing disabled
    if (!cameraRef.current || processingRef.current) return;

    processingRef.current = true; // Lock

    try {
      // Take low-quality snapshot to keep it fast
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
        skipProcessing: true, // Android specific - speeds up capture
      });

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(photo.base64);
      } else {
        processingRef.current = false;
      }
    } catch (error) {
      console.log(error);
      processingRef.current = false;
    }
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* CAMERA FEED */}
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        
        {/* OVERLAY UI */}
        <View style={styles.overlay}>
          {/* Center: Angle & Feedback */}
          <View style={styles.centerFeedback}>
              <Text style={styles.subText}>Angle: {feedback.angle}°</Text>
          </View>

          {/* Bottom: Rep Counter */}
          <View style={styles.bottomBar}>
            <Text style={styles.repText}>REPS: {feedback.reps}</Text>
          </View>
        </View>

      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  camera: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'space-between' },
  topBar: { padding: 40, alignItems: 'flex-start' },
  coinText: { fontSize: 20, color: 'gold', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 },
  centerFeedback: { alignItems: 'center' },
  largeText: { fontSize: 40, color: 'white', fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 10 },
  subText: { fontSize: 20, color: 'yellow' },
  bottomBar: { padding: 40, alignItems: 'center' },
  repText: { fontSize: 60, color: 'white', fontWeight: 'bold' }
});
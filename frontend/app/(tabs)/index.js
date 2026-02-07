import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Button, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Line, Circle } from 'react-native-svg'; // Import SVG tools

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [ws, setWs] = useState(null);
  
  // We now store the full keypoint data, not just feedback
  const [feedback, setFeedback] = useState({ 
    state: "Searching", 
    reps: 0, 
    feedback: "Looking for lifter...",
    keypoints: null // Expecting { wrist_l: [x,y], shoulder_l: [x,y], ... }
  });
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);
  const processingRef = useRef(false);

  // --- CONFIGURATION ---
  const CAPTURE_ENABLED = true; 
  const SERVER_URL = "ws://172.26.60.115:8000/ws/analyze"; 
  // ---------------------

  // Screen dimensions for scaling normalized coordinates
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    let socket = null;
    let intervalId = null;

    const cleanup = () => {
      if (socket) socket.close();
      if (intervalId) clearInterval(intervalId);
    };

    if (isCameraReady) {
      socket = new WebSocket(SERVER_URL);
      
      socket.onopen = () => setWs(socket);
      
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setFeedback(data);
          processingRef.current = false; 
        } catch (err) {
          processingRef.current = false;
        }
      };

      socket.onclose = () => setWs(null);

      intervalId = setInterval(() => {
        if (CAPTURE_ENABLED && socket && socket.readyState === 1) {
          captureAndSend(socket);
        }
      }, 500); // 500ms for balance
    }

    return cleanup;
  }, [isCameraReady]); 

  const captureAndSend = async (currentSocket) => {
    if (!cameraRef.current || processingRef.current) return;
    processingRef.current = true;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3, 
        base64: true,
        skipProcessing: true, 
      });

      if (currentSocket.readyState === 1) {
        currentSocket.send(photo.base64);
      } else {
        processingRef.current = false;
      }
    } catch (error) {
      processingRef.current = false;
    }
  };

  // --- RENDERING THE SKELETON ---
  const renderSkeleton = () => {
    if (!feedback.keypoints) return null;

    // Helper to scale generic coordinates (assuming 640x640 YOLO output)
    // You might need to tweak these ratios based on your camera aspect ratio
    const scaleX = width / 640; 
    const scaleY = height / 640; 

    const { shoulder_l, elbow_l, wrist_l } = feedback.keypoints;

    // Only draw if we have the full arm
    if (shoulder_l && elbow_l && wrist_l) {
        return (
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                {/* Upper Arm Line */}
                <Line
                    x1={shoulder_l[0] * scaleX}
                    y1={shoulder_l[1] * scaleY}
                    x2={elbow_l[0] * scaleX}
                    y2={elbow_l[1] * scaleY}
                    stroke="#00FF00"
                    strokeWidth="4"
                />
                {/* Forearm Line */}
                <Line
                    x1={elbow_l[0] * scaleX}
                    y1={elbow_l[1] * scaleY}
                    x2={wrist_l[0] * scaleX}
                    y2={wrist_l[1] * scaleY}
                    stroke="#00FF00"
                    strokeWidth="4"
                />
                {/* Joint Circles */}
                <Circle cx={elbow_l[0] * scaleX} cy={elbow_l[1] * scaleY} r="8" fill="#FFD700" />
                <Circle cx={wrist_l[0] * scaleX} cy={wrist_l[1] * scaleY} r="8" fill="#FFD700" />
            </Svg>
        );
    }
    return null;
  };

  if (!permission?.granted) return <Button onPress={requestPermission} title="Grant Permission" />;

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        ref={cameraRef} 
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
      />
      
      {/* OVERLAY GRAPHICS */}
      <View style={styles.overlayLayer}>
          {renderSkeleton()}
      </View>

      <View style={styles.uiLayer}>
        <View style={styles.centerFeedback}>
            <Text style={styles.largeText}>{feedback.feedback || "Analyzing..."}</Text>
            <Text style={styles.subText}>Vel: {feedback.velocity?.toFixed(2)}</Text>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.repText}>REPS: {feedback.reps}</Text>
          <View style={[styles.statusDot, { backgroundColor: ws ? '#4CAF50' : '#F44336' }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlayLayer: { ...StyleSheet.absoluteFillObject, zIndex: 1 }, // Graphics go here
  uiLayer: { flex: 1, justifyContent: 'space-between', zIndex: 2 }, // Text goes on top
  centerFeedback: { alignItems: 'center', marginTop: 100, backgroundColor: 'rgba(0,0,0,0.3)', padding: 20, alignSelf: 'center', borderRadius: 10 },
  largeText: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  subText: { fontSize: 18, color: '#FFD700' },
  bottomBar: { padding: 30, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  repText: { fontSize: 70, color: 'white', fontWeight: 'bold' },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 10 }
});

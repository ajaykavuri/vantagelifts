import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Button, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Line, Circle } from 'react-native-svg';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [ws, setWs] = useState(null);
  
  // --- CONFIGURATION ---
  const CAPTURE_ENABLED = true; 
  const SERVER_URL = "ws://172.26.50.62:8000/ws/analyze"; 
  
  // ADJUST THIS VALUE TO CHANGE SPEED (in milliseconds)
  const CAPTURE_INTERVAL_MS = 20; 
  // ---------------------

  const [feedback, setFeedback] = useState({ 
    state: "Searching", 
    reps: 0, 
    feedback: "Looking for lifter...",
    keypoints: null 
  });
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);
  const processingRef = useRef(false);

  const { width, height } = Dimensions.get('window');

  // Helper to convert Normalized Coords (0-1) to Screen Pixels
  const toScreen = (pt) => {
    if (!pt) return { x: 0, y: 0 };
    return { x: pt[0] * width, y: pt[1] * height };
  };

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

      // Uses the CAPTURE_INTERVAL_MS constant
      intervalId = setInterval(() => {
        if (CAPTURE_ENABLED && socket && socket.readyState === 1) {
          captureAndSend(socket);
        }
      }, CAPTURE_INTERVAL_MS); 
    }

    return cleanup;
  }, [isCameraReady]); // Re-runs only if camera restarts

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

  const renderSkeleton = () => {
    if (!feedback.keypoints) return null;
    const { shoulder_l, elbow_l, wrist_l } = feedback.keypoints;

    return (
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            {shoulder_l && elbow_l && (
                <Line
                    x1={toScreen(shoulder_l).x} y1={toScreen(shoulder_l).y}
                    x2={toScreen(elbow_l).x}    y2={toScreen(elbow_l).y}
                    stroke="#00FF00" strokeWidth="6"
                />
            )}
            {elbow_l && wrist_l && (
                <Line
                    x1={toScreen(elbow_l).x} y1={toScreen(elbow_l).y}
                    x2={toScreen(wrist_l).x} y2={toScreen(wrist_l).y}
                    stroke="#00FF00" strokeWidth="6"
                />
            )}
            {shoulder_l && <Circle cx={toScreen(shoulder_l).x} cy={toScreen(shoulder_l).y} r="8" fill="#FFD700" />}
            {elbow_l &&    <Circle cx={toScreen(elbow_l).x}    cy={toScreen(elbow_l).y}    r="8" fill="#FFD700" />}
            {wrist_l &&    <Circle cx={toScreen(wrist_l).x}    cy={toScreen(wrist_l).y}    r="8" fill="#FFD700" />}
        </Svg>
    );
  };

  if (!permission?.granted) {
  return (
    <View style={styles.permissionContainer}>
      {/* This empty View with flex: 1 acts as a spacer, pushing everything below it down */}
      <View style={{ flex: 1 }} /> 
      
      <View style={styles.buttonWrapper}>
        <Text style={styles.permissionText}>
          Vantage needs camera access to analyze your form.
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        ref={cameraRef} 
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
      />
      
      <View style={styles.overlayLayer}>{renderSkeleton()}</View>

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
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000', // Matches the gym app aesthetic
    padding: 20,
  },
  buttonWrapper: {
    marginBottom: 50, // Keeps it away from the bottom edge/home bar
    alignItems: 'center',
  },
  permissionText: {
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  permissionButton: {
    backgroundColor: '#007AFF', // Standard iOS Blue
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#white',
    fontSize: 18,
    fontWeight: '600',
  },
  container: { flex: 1, backgroundColor: '#000' },
  overlayLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10 }, 
  uiLayer: { flex: 1, justifyContent: 'space-between', zIndex: 20 },
  
  centerFeedback: { alignItems: 'center', marginTop: 150, backgroundColor: 'rgba(0,0,0,0.3)', padding: 20, alignSelf: 'center', borderRadius: 10 },
  largeText: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  subText: { fontSize: 18, color: '#FFD700' },
  bottomBar: { padding: 30, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  repText: { fontSize: 70, color: 'white', fontWeight: 'bold' },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 10 }
});

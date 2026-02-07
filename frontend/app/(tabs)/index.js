import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Button, TouchableOpacity, Dimensions, ScrollView, Touchable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Line, Circle } from 'react-native-svg';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [ws, setWs] = useState(null);
  
  // --- CONFIGURATION ---
  // CHANGE THIS TO YOUR LOCAL IP
  const CAPTURE_ENABLED = true; 
  const SERVER_URL = "ws://172.26.50.62:8000/ws/analyze"; 
  
  // ADJUST THIS VALUE TO CHANGE SPEED (in milliseconds)
  const CAPTURE_INTERVAL_MS = 20; 
  // ---------------------

  // APP STATES
  const [exercise, setExercise] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // DATA STATES
  const [feedback, setFeedback] = useState({ 
    state: "Searching", 
    reps: 0, 
    velocity: 0,
    rir: 5,
    feedback: "Looking for lifter...",
    keypoints: null 
  });
  const [repHistory, setRepHistory] = useState([])

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

    if (isRecording) {
      socket = new WebSocket(SERVER_URL);
      socket.onopen = () => setWs(socket);
      
      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          setFeedback(data);
          processingRef.current = false; 

          if (data.reps > repHistory.length) {
            setRepHistory(prev => [...prev, { rep: data.reps, vel: data.velocity, rir: data.rir }]);
          }
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
    } else {
      if (ws) ws.close();
      setWs(null);
    }

    return cleanup;
  }, [isRecording]); // Re-runs only if camera restarts

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
        const payload = JSON.stringify({
          image: photo.base64,
          exercise: exercise // Sends "bench" or "curl" to reset the server
        });
        currentSocket.send(payload);
      } else {
        processingRef.current = false;
      }
    } catch (error) {
      processingRef.current = false;
    }
  };
  const startSet = (type) => {
    setExercise(type);
    setRepHistory([]);
    setFeedback({ state: "Searching", reps: 0, velocity: 0, rir: 5, feedback: "Looking for lifter...", keypoints: null});
    setIsRecording(true);
    setShowSummary(false);
  };
  const finishSet = () => {
    setIsRecording(false);
    setShowSummary(true);
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

  // --- View 1: HOME MENU
  if (!isRecording && !showSummary) {
    return (
        <View style={styles.menuContainer}>
            <Text style={styles.title}>Vantage</Text>
            <Text style={styles.subtitle}>Select Exercise</Text>
            
            <TouchableOpacity style={styles.menuBtn} onPress={() => startSet('curl')}>
                <Text style={styles.menuBtnText}>💪 Bicep Curl</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuBtn} onPress={() => startSet('bench')}>
                <Text style={styles.menuBtnText}>🏋️ Bench Press</Text>
            </TouchableOpacity>
        </View>
    );
  }
  if (showSummary) {
    return (
        <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Set Complete!</Text>
            <Text style={styles.statBig}>{feedback.reps} Reps</Text>
            
            <View style={styles.statRow}>
                <Text style={styles.statLabel}>Reps in Reserve (RIR):</Text>
                <Text style={styles.statValue}>{feedback.rir}</Text>
            </View>

            <ScrollView style={styles.historyList}>
                <Text style={styles.historyHeader}>Velocity Breakdown:</Text>
                {repHistory.map((item, index) => (
                    <View key={index} style={styles.historyRow}>
                        <Text style={styles.historyText}>Rep {item.rep}</Text>
                        <Text style={styles.historyText}>{item.vel.toFixed(2)}</Text>
                    </View>
                ))}
            </ScrollView>

            <TouchableOpacity style={styles.btn} onPress={() => setShowSummary(false)}>
                <Text style={styles.btnText}>Back to Home</Text>
            </TouchableOpacity>
        </View>
    );
  }
  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        ref={cameraRef} 
        facing="front"
        onCameraReady={() => setIsCameraReady(true)}
      />
      
      <View style={styles.overlayLayer}>{renderSkeleton()}</View>

      <View style={styles.uiLayer}>
        <View style={styles.topBar}>
          <Text style = {styles.liveText}>🔴 LIVE | {exercise?.toUpperCase()}</Text>
        </View>
        <View style={styles.centerFeedback}>
            <Text style={styles.largeText}>{feedback.feedback || "Analyzing..."}</Text>
            <Text style={styles.subText}>Vel: {feedback.velocity?.toFixed(2)}</Text>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.repText}>REPS: {feedback.reps}</Text>
          <TouchableOpacity style={styles.stopBtn} onPress = {finishSet}>
            <Text style={styles.stopBtnText}>Finish Set</Text>
          </TouchableOpacity>
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
  uiLayer: { flex: 1, justifyContent: 'space-between', zIndex: 20, paddingVertical: 40 },
  
  menuContainer: {
    flex: 1, 
    backgroundColor: '#121212', 
    justifyContent: 'center', 
    padding: 20 
  },
  title: {
    fontSize: 40, 
    color: 'white', 
    fontWeight: 'bold', 
    marginBottom: 10, 
    textAlign: 'center' 
  },
  subtitle: {
    fontSize : 20, 
    color: 'gray', 
    marginBottom: 40, 
  textAlign: 'center' 
  },
  menuBtn: {
    backgroundColor: '#333', 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 15
  },
  menuBtnText: {
    color: 'white', 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  topBar: {alignItems: 'center', marginTop: 10},
  liveText: {color: 'red', fontWeight: 'bold', fontSize: 16 },
  centerFeedback: { alignItems: 'center', marginTop: 150, backgroundColor: 'rgba(0,0,0,0.3)', padding: 20, alignSelf: 'center', borderRadius: 10 },
  largeText: { fontSize: 32, color: 'white', fontWeight: 'bold' },
  subText: { fontSize: 18, color: '#FFD700' },
  bottomBar: { padding: 30, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  repText: { fontSize: 70, color: 'white', fontWeight: 'bold' },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 10 },

  stopBtn: { backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 60, borderRadius: 30 },
  stopBtnText: { color: 'white', fontSize: 20, fontWeight: '900' },

  summaryContainer: { flex: 1, backgroundColor: '#000', padding: 40, justifyContent: 'center' },
  summaryTitle: { fontSize: 32, color: 'white', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  statBig: { fontSize: 60, color: '#4CD964', fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statLabel: { color: 'gray', fontSize: 20 },
  statValue: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  historyList: { maxHeight: 250, backgroundColor: '#222', borderRadius: 10, padding: 10, marginBottom: 30 },
  historyHeader: { color: 'white', fontWeight: 'bold', marginBottom: 10 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  historyText: { color: '#ccc' },
  btn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});

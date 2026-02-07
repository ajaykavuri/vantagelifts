import React, { useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Line, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons'; 

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [ws, setWs] = useState(null);
  
  // --- CONFIGURATION ---
  const CAPTURE_ENABLED = true; 
  // REPLACE WITH YOUR IP
  const SERVER_URL = "ws://172.26.60.115:8000/ws/analyze"; 
  const CAPTURE_INTERVAL_MS = 50; 
  // ---------------------

  const [viewMode, setViewMode] = useState("menu"); 
  const [exercise, setExercise] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('front'); 
  const [workoutLog, setWorkoutLog] = useState([]); 
  const [repHistory, setRepHistory] = useState([]); 
  const [feedback, setFeedback] = useState({ 
    state: "Searching", reps: 0, velocity: 0, rir: 5, feedback: "Looking for lifter...", keypoints: null 
  });
  const [isCameraReady, setIsCameraReady] = useState(false);
  const cameraRef = useRef(null);
  const processingRef = useRef(false);
  const { width, height } = Dimensions.get('window');

  const toScreen = (pt) => {
    if (!pt) return { x: 0, y: 0 };
    return { x: pt[0] * width, y: pt[1] * height };
  };

  useEffect(() => {
    let socket = null;
    let intervalId = null;
    const cleanup = () => { if (socket) socket.close(); if (intervalId) clearInterval(intervalId); };

    if (viewMode === 'recording') {
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
        } catch (err) { processingRef.current = false; }
      };
      socket.onclose = () => setWs(null);
      intervalId = setInterval(() => {
        if (CAPTURE_ENABLED && socket && socket.readyState === 1) captureAndSend(socket);
      }, CAPTURE_INTERVAL_MS); 
    } else { if (ws) ws.close(); setWs(null); }
    return cleanup;
  }, [viewMode]); 

  const captureAndSend = async (currentSocket) => {
    if (!cameraRef.current || processingRef.current) return;
    processingRef.current = true;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.3, base64: true, skipProcessing: true });
      if (currentSocket.readyState === 1) {
        currentSocket.send(JSON.stringify({ image: photo.base64, exercise: exercise }));
      } else { processingRef.current = false; }
    } catch (error) { processingRef.current = false; }
  };

  const startSet = (type) => {
    setExercise(type);
    setRepHistory([]);
    setFeedback({ state: "Searching", reps: 0, velocity: 0, rir: 5, feedback: "Looking for lifter...", keypoints: null});
    setViewMode('recording');
  };

  const finishSet = () => {
    setWorkoutLog([...workoutLog, { exercise, totalReps: feedback.reps, finalRIR: feedback.rir, details: repHistory }]);
    setViewMode('set_summary');
  };

  const toggleCamera = () => setCameraFacing(current => (current === 'front' ? 'back' : 'front'));

  // --- FULL BODY SKELETON RENDERER ---
  const renderSkeleton = () => {
    if (!feedback.keypoints) return null;
    
    const { 
        shoulder_l, elbow_l, wrist_l, 
        shoulder_r, elbow_r, wrist_r, 
        hip_l, hip_r, 
        knee_l, knee_r, 
        ankle_l, ankle_r 
    } = feedback.keypoints;

    const lineProps = { stroke: "#00FF00", strokeWidth: "6" };
    const jointProps = { r: "8", fill: "#FFD700" };

    const drawLine = (p1, p2) => {
        if (p1 && p2) {
            return <Line x1={toScreen(p1).x} y1={toScreen(p1).y} x2={toScreen(p2).x} y2={toScreen(p2).y} {...lineProps} />;
        }
        return null;
    };
    
    const drawJoint = (pt) => {
        if(pt) return <Circle cx={toScreen(pt).x} cy={toScreen(pt).y} {...jointProps} />
        return null;
    }

    return (
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            {/* Upper Body */}
            {drawLine(shoulder_l, elbow_l)} 
            {drawLine(elbow_l, wrist_l)}
            {drawLine(shoulder_r, elbow_r)} 
            {drawLine(elbow_r, wrist_r)}
            
            {/* Torso */}
            {drawLine(shoulder_l, shoulder_r)}
            {drawLine(shoulder_l, hip_l)} 
            {drawLine(shoulder_r, hip_r)}
            {drawLine(hip_l, hip_r)}

            {/* Legs */}
            {drawLine(hip_l, knee_l)} 
            {drawLine(knee_l, ankle_l)}
            {drawLine(hip_r, knee_r)} 
            {drawLine(knee_r, ankle_r)}

            {/* Joints */}
            {drawJoint(shoulder_l)}
            {drawJoint(shoulder_r)}
            {drawJoint(elbow_l)}
            {drawJoint(elbow_r)}
            {drawJoint(wrist_l)}
            {drawJoint(wrist_r)}
            {drawJoint(hip_l)}
            {drawJoint(hip_r)}
            {drawJoint(knee_l)}
            {drawJoint(knee_r)}
            {drawJoint(ankle_l)}
            {drawJoint(ankle_r)}
        </Svg>
    );
  };

  const getDisplayText = () => {
    if (feedback.feedback === "Looking for lifter...") return "Looking for lifter...";
    if (feedback.feedback === "Show Wrists!") return "Show Wrists!";
    return "GO GO GO!!";
  };

  if (!permission?.granted) {
    return (
        <View style={styles.permissionContainer}>
            <View style={{ flex: 1 }} /> 
            <View style={styles.buttonWrapper}>
                <Text style={styles.permissionText}>Vantage needs camera access.</Text>
                <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}><Text style={styles.permissionButtonText}>Grant Permission</Text></TouchableOpacity>
            </View>
        </View>
    );
  }

  // --- MENU ---
  if (viewMode === 'menu') {
    return (
        <View style={styles.menuContainer}>
            <Text style={styles.title}>Vantage</Text>
            <Text style={styles.subtitle}>Select Workout</Text>
            <ScrollView contentContainerStyle={styles.gridContainer}>
                {/* Upper Body */}
                <View style={styles.gridRow}>
                    <TouchableOpacity style={styles.gridBtn} onPress={() => startSet('curl')}>
                        <Text style={styles.gridEmoji}>💪</Text>
                        <Text style={styles.gridText}>Curls</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.gridBtn} onPress={() => startSet('bench')}>
                        <Text style={styles.gridEmoji}>🏋️</Text>
                        <Text style={styles.gridText}>Bench</Text>
                    </TouchableOpacity>
                </View>
                {/* Lower Body */}
                <View style={styles.gridRow}>
                    <TouchableOpacity style={styles.gridBtn} onPress={() => startSet('squat')}>
                        <Text style={styles.gridEmoji}>🦵</Text>
                        <Text style={styles.gridText}>Squat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.gridBtn} onPress={() => startSet('deadlift')}>
                        <Text style={styles.gridEmoji}>☠️</Text>
                        <Text style={styles.gridText}>Deadlift</Text>
                    </TouchableOpacity>
                </View>
                 {/* Extras */}
                 <View style={styles.gridRow}>
                    <TouchableOpacity style={styles.gridBtn} onPress={() => startSet('press')}>
                        <Text style={styles.gridEmoji}>👐</Text>
                        <Text style={styles.gridText}>Press</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.gridBtn} onPress={() => startSet('lunge')}>
                        <Text style={styles.gridEmoji}>🏃</Text>
                        <Text style={styles.gridText}>Lunge</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
  }

  // --- SUMMARY SCREENS ---
  if (viewMode === 'set_summary') {
    return (
        <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Set Complete!</Text>
            <Text style={styles.statBig}>{feedback.reps} Reps</Text>
            <View style={styles.statRow}><Text style={styles.statLabel}>RIR:</Text><Text style={styles.statValue}>{feedback.rir}</Text></View>
            <TouchableOpacity style={styles.btn} onPress={() => setViewMode('menu')}><Text style={styles.btnText}>Next Set</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {marginTop: 20, backgroundColor: '#333'}]} onPress={() => setViewMode('workout_summary')}><Text style={styles.btnText}>Finish Workout</Text></TouchableOpacity>
        </View>
    );
  }
  if (viewMode === 'workout_summary') {
    return (
      <ScrollView style = {{flex:1, backgroundColor:'black', paddingTop: 80, paddingHorizontal: 20}}>
        <Text style = {styles.summaryTitle}>Workout Log</Text>
        {workoutLog.map((set, i) => (
          <View key={i} style={styles.historyRow}>
              <View><Text style={{color:'white', fontWeight:'bold', fontSize:18}}>{set.exercise.toUpperCase()}</Text><Text style={{color:'gray'}}>Reps: {set.totalReps}</Text></View>
              <View><Text style={{color:'#4CD964', fontSize:24, fontWeight:'bold'}}>{set.finalRIR} RIR</Text></View>
            </View>
        ))}
        <TouchableOpacity style={[styles.btn, {marginTop: 40}]} onPress={() => {setWorkoutLog([]); setViewMode('menu');}}><Text style={styles.btnText}>New Workout</Text></TouchableOpacity>
      </ScrollView>
    )
  }

  // --- RECORDING ---
  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing={cameraFacing} onCameraReady={() => setIsCameraReady(true)} />
      <View style={styles.overlayLayer}>{renderSkeleton()}</View>
      <View style={styles.uiLayer}>
        <View style={styles.topBar}>
          <Text style = {styles.liveText}>🔴 {exercise?.toUpperCase()}</Text>
          <TouchableOpacity style={styles.flipBtn} onPress={toggleCamera}><Ionicons name="camera-reverse" size={28} color="white" /></TouchableOpacity>
        </View>
        <View style={styles.centerFeedback}>
            <Text style={styles.largeText}>{getDisplayText()}</Text>
            {getDisplayText() === "GO GO GO!!" && (
                <Text style={styles.subText}>Vel: {feedback.velocity?.toFixed(2)}</Text>
            )}
        </View>
        <View style={styles.bottomBar}>
          <Text style={styles.repText}>REPS: {feedback.reps}</Text>
          <TouchableOpacity style={styles.stopBtn} onPress = {finishSet}><Text style={styles.stopBtnText}>Finish Set</Text></TouchableOpacity>
          <View style={[styles.statusDot, { backgroundColor: ws ? '#4CAF50' : '#F44336' }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  permissionContainer: { flex: 1, backgroundColor: '#000', padding: 20 },
  buttonWrapper: { marginBottom: 50, alignItems: 'center' },
  permissionText: { color: '#ccc', textAlign: 'center', marginBottom: 20, fontSize: 16 },
  permissionButton: { backgroundColor: '#007AFF', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 12, width: '100%', alignItems: 'center' },
  permissionButtonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  container: { flex: 1, backgroundColor: '#000' },
  overlayLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10 }, 
  uiLayer: { flex: 1, justifyContent: 'space-between', zIndex: 20, paddingVertical: 50, paddingHorizontal: 20 },
  menuContainer: { flex: 1, backgroundColor: '#121212', paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 40, color: 'white', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize : 20, color: 'gray', marginBottom: 30, textAlign: 'center' },
  gridContainer: { paddingBottom: 50 },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  gridBtn: { backgroundColor: '#333', width: '48%', aspectRatio: 1, borderRadius: 20, justifyContent: 'center', alignItems: 'center', padding: 10 },
  gridEmoji: { fontSize: 50, marginBottom: 10 },
  gridText: { color: 'white', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  liveText: { color: 'red', fontWeight: 'bold', fontSize: 16 },
  flipBtn: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20 },
  centerFeedback: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: 20, alignSelf: 'center', borderRadius: 10 },
  largeText: { fontSize: 32, color: 'white', fontWeight: 'bold', textAlign: 'center' },
  subText: { fontSize: 18, color: '#FFD700', marginTop: 5 },
  bottomBar: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: 20 },
  repText: { fontSize: 70, color: 'white', fontWeight: 'bold' },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 10 },
  stopBtn: { backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 60, borderRadius: 30, marginTop: 10 },
  stopBtnText: { color: 'white', fontSize: 20, fontWeight: '900' },
  summaryContainer: { flex: 1, backgroundColor: '#000', padding: 40, justifyContent: 'center' },
  summaryTitle: { fontSize: 32, color: 'white', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  statBig: { fontSize: 60, color: '#4CD964', fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statLabel: { color: 'gray', fontSize: 20 },
  statValue: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 10 },
  btn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});

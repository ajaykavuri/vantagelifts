
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// REPLACE WITH YOUR COMPUTER'S LOCAL IP ADDRESS
// e.g., 'ws://192.168.1.10:8000/ws/analyze'
const WS_URL = 'ws://127.0.0.1:8000/ws/analyze';

export default function CameraScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [isRecording, setIsRecording] = useState(false);
    const [feedback, setFeedback] = useState("Ready");
    const [reps, setReps] = useState(0);
    const [velocity, setVelocity] = useState(0);
    const [rir, setRir] = useState<string | number>("N/A");
    const [state, setState] = useState("WAITING");
    const [angle, setAngle] = useState(0);

    const cameraRef = useRef<CameraView>(null);
    const ws = useRef<WebSocket | null>(null);
    const loopRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            stopAnalysis();
        };
    }, []);

    const startAnalysis = () => {
        setIsRecording(true);
        setFeedback("Connecting...");

        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            console.log('Connected to server');
            setFeedback("Analyzing...");
            startFrameLoop();
        };

        ws.current.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.reps !== undefined) setReps(data.reps);
                if (data.velocity !== undefined) setVelocity(data.velocity);
                if (data.rir !== undefined) setRir(data.rir);
                if (data.state !== undefined) setState(data.state);
                if (data.feedback) setFeedback(data.feedback);
            } catch (err) {
                console.error("Failed to parse response", err);
            }
        };

        ws.current.onerror = (e) => {
            console.log('WebSocket error:', e);
            setFeedback("Connection Error");
            setIsRecording(false);
        };

        ws.current.onclose = () => {
            console.log('Disconnected');
            stopAnalysis();
        };
    };

    const stopAnalysis = () => {
        setIsRecording(false);
        setFeedback("Ready");
        if (loopRef.current) {
            clearInterval(loopRef.current);
            loopRef.current = null;
        }
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
    };

    const startFrameLoop = () => {
        if (loopRef.current) clearInterval(loopRef.current);

        // Send frames every 200ms (5 FPS) to balance load
        loopRef.current = setInterval(async () => {
            if (cameraRef.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                try {
                    // Take a picture with low quality and base64
                    // Note: takePictureAsync is not the most efficient way for video streaming 
                    // but it is the easiest for an Expo Go MVP.
                    const photo = await cameraRef.current.takePictureAsync({
                        quality: 0.3,
                        base64: true,
                        skipProcessing: true, // faster
                        imageType: 'jpg',
                    });

                    if (photo?.base64) {
                        ws.current.send(photo.base64);
                    }
                } catch (err) {
                    console.log("Error taking picture:", err);
                }
            }
        }, 200);
    };

    if (!permission) {
        // Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', color: 'white', marginBottom: 20 }}>
                    We need your permission to show the camera
                </Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.text}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <CameraView
                style={styles.camera}
                facing="front"
                ref={cameraRef}
            >
                <View style={styles.overlay}>
                    {/* Top Info Bar */}
                    <View style={styles.infoBar}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>REPS</Text>
                            <Text style={styles.statValue}>{reps}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>VELOCITY</Text>
                            <Text style={styles.statValue}>{velocity?.toFixed(2) || "0.00"}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>RIR</Text>
                            <Text style={styles.statValue}>{rir}</Text>
                        </View>
                    </View>

                    {/* Feedback Overlay */}
                    <View style={styles.feedbackContainer}>
                        <Text style={styles.feedbackText}>{feedback}</Text>
                        <Text style={styles.subFeedbackText}>{state}</Text>
                    </View>

                    {/* Controls */}
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={[styles.recordButton, isRecording && styles.recordingButton]}
                            onPress={isRecording ? stopAnalysis : startAnalysis}
                        >
                            <View style={[styles.innerRecordButton, isRecording && styles.innerRecordingButton]} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => {
                                stopAnalysis();
                                router.back();
                            }}
                        >
                            <Text style={styles.text}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </CameraView >
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'black',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-between',
        padding: 20,
        marginTop: 40,
    },
    infoBar: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 10,
    },
    statBox: {
        alignItems: 'center',
    },
    statLabel: {
        color: '#aaa',
        fontSize: 12,
        fontWeight: 'bold',
    },
    statValue: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    feedbackContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackText: {
        color: 'yellow',
        fontSize: 28,
        fontWeight: 'bold',
        textShadowColor: 'black',
        textShadowRadius: 5,
        textAlign: 'center',
    },
    subFeedbackText: {
        color: 'white',
        fontSize: 18,
        marginTop: 10,
        textAlign: 'center',
    },
    controls: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 40,
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    recordingButton: {
        borderColor: 'red',
    },
    innerRecordButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'white',
    },
    innerRecordingButton: {
        backgroundColor: 'red',
        width: 40,
        height: 40,
        borderRadius: 6,
    },
    closeButton: {
        padding: 10,
    },
    button: {
        padding: 15,
        backgroundColor: '#333',
        borderRadius: 8,
    },
    text: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
    },
});

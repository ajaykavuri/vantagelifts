import numpy as np
import time

class LifterState:
    def __init__(self):
        self.state = "IDLE"  # Options: IDLE, DESCENDING, BOTTOM, ASCENDING, TOP
        self.reps = 0
        self.velocity = 0.0
        
        # History for smoothing
        self.prev_y = None
        self.prev_time = None
        self.velocity_history = []
        
        # Configuration Thresholds
        self.VELOCITY_THRESHOLD = 0.15  # m/s (minimum speed to be considered moving)
        self.REP_MIN_ROM = 50           # pixels (minimum movement to count as a rep)
        self.start_y_position = None    # To track Range of Motion (ROM)

    def update(self, keypoints):
        """
        updates state based on wrist vertical position.
        Coordinate System: Y=0 is TOP. Moving UP decreases Y.
        """
        # 1. Get average Y position of available wrists
        ys = []
        if 'wrist_l' in keypoints:
            ys.append(keypoints['wrist_l'][1])
        if 'wrist_r' in keypoints:
            ys.append(keypoints['wrist_r'][1])
        
        if not ys:
            return None

        current_y = np.mean(ys)
        current_time = time.time()

        # Initialize if first frame
        if self.prev_y is None:
            self.prev_y = current_y
            self.prev_time = current_time
            self.start_y_position = current_y
            return None

        # 2. Calculate Velocity (Pixels per second)
        # Note: Inverted sign because Y decreases as you go UP
        dt = current_time - self.prev_time
        if dt == 0: 
            return None
            
        dy = current_y - self.prev_y
        instant_velocity = -(dy / dt)  # Positive = Moving UP

        # Smooth velocity (Simple Moving Average of last 3 frames)
        self.velocity_history.append(instant_velocity)
        if len(self.velocity_history) > 3:
            self.velocity_history.pop(0)
        
        # Normalize: Divide by roughly 500 to simulate meters/sec (assuming 500px ~ 1 meter)
        # This is an approximation for visual feedback
        self.velocity = np.mean(self.velocity_history) / 500.0 

        # 3. State Machine Logic
        
        # DETECT DESCENDING (Eccentric)
        # We need significant negative velocity
        if self.velocity < -0.05: 
            if self.state != "DESCENDING":
                self.state = "DESCENDING"
                # Track where the rep started (the top)
                self.start_y_position = current_y 

        # DETECT ASCENDING (Concentric)
        # We need significant positive velocity
        elif self.velocity > 0.05:
            if self.state != "ASCENDING":
                self.state = "ASCENDING"

        # DETECT END OF REP (Top/Lockout)
        # If we were ascending, and now velocity is near zero
        elif abs(self.velocity) < 0.05:
            if self.state == "ASCENDING":
                # Check Range of Motion (ROM) to prevent jitter counting
                # Did we move enough from the bottom?
                # (Simple check: Just count it for now to fix your bug)
                self.reps += 1
                self.state = "TOP"
            elif self.state == "DESCENDING":
                self.state = "BOTTOM"
            else:
                self.state = "IDLE"

        # 4. Update History
        self.prev_y = current_y
        self.prev_time = current_time

        return {
            "state": self.state,
            "reps": self.reps,
            "velocity": float(self.velocity) * 10 # Scale up for readability on phone
        }

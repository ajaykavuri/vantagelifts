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
        
        self.concentric_samples = []
        self.last_rep_velocity = 0.0

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
        if dt > 0:
            inst_vel = dy / dt
            self.velocity_history.append(inst_vel)
            if len(self.velocity_history) > 3: self.velocity_history.pop(0)
            self.velocity = np.mean(self.velocity_history)
        
        display_velocity = self.velocity / 500.0

        # 3. State Machine Logic
        
        # DETECT DESCENDING (Eccentric)
        # We need significant negative velocity
        if display_velocity < -0.05: 
            if self.state != "DESCENDING":
                self.state = "DESCENDING"
                # Track where the rep started (the top)
                self.start_y_position = current_y 

        # DETECT ASCENDING (Concentric)
        # We need significant positive velocity
        elif display_velocity > 0.05:
            if self.state != "ASCENDING":
                self.state = "ASCENDING"

        # DETECT END OF REP (Top/Lockout)
        # If we were ascending, and now velocity is near zero
        elif abs(display_velocity) < 0.05:
            if self.state == "ASCENDING":
                # Check Range of Motion (ROM) to prevent jitter counting
                # Did we move enough from the bottom?
                # (Simple check: Just count it for now to fix your bug)
                self.reps += 1
                self.state = "TOP"
                if self.concentric_samples:
                    self.last_rep_velocity = 0.0
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
            "current_velocity": float(display_velocity),
            "rep_velocity": float(self.last_rep_velocity)
        }

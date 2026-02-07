import numpy as np
import time

class LifterState:
    def __init__(self):
        self.state = "IDLE" 
        self.reps = 0
        self.velocity = 0.0
        
        self.prev_y = None
        self.prev_time = None
        self.velocity_history = []
        
        # NEW: Track the fastest point of the current rep
        self.peak_velocity = 0.0

    def update(self, current_y):
        """
        Calculates velocity from Y-coordinate changes.
        """
        # 1. Handle First Frame
        current_time = time.time()
        if self.prev_y is None:
            self.prev_y = current_y
            self.prev_time = current_time
            return None

        # 2. Calculate Time Delta (dt)
        dt = current_time - self.prev_time
        if dt == 0: 
            return None 
        
        # 3. Calculate Raw Velocity
        dy = current_y - self.prev_y
        raw_velocity = -(dy / dt) 

        # 4. Smoothing
        self.velocity_history.append(raw_velocity)
        if len(self.velocity_history) > 5: 
            self.velocity_history.pop(0)
        
        avg_pixel_velocity = np.mean(self.velocity_history)

        # 5. Normalization
        self.velocity = avg_pixel_velocity / 500.0

        # 6. State Machine
        THRESHOLD = 0.02 
        
        # Variable to store the velocity of the rep we JUST finished
        finished_rep_velocity = 0.0

        # --- CASE 1: MOVING DOWN (Eccentric) ---
        if self.velocity < -THRESHOLD: 
            # If we were just going UP, and now we are going DOWN -> Rep Count
            if self.state == "ASCENDING":
                self.reps += 1
                # SAVE THE PEAK we saw during the lift
                finished_rep_velocity = self.peak_velocity
                # Reset peak for next rep
                self.peak_velocity = 0.0
            
            self.state = "DESCENDING"

        # --- CASE 2: MOVING UP (Concentric) ---
        elif self.velocity > THRESHOLD:
            self.state = "ASCENDING"
            # TRACK PEAK VELOCITY
            if self.velocity > self.peak_velocity:
                self.peak_velocity = self.velocity

        # --- CASE 3: HOLDING STILL (Top or Bottom) ---
        else:
            if self.state == "ASCENDING":
                self.reps += 1
                finished_rep_velocity = self.peak_velocity
                self.peak_velocity = 0.0
                self.state = "TOP"
            elif self.state == "DESCENDING":
                self.state = "BOTTOM"
            else:
                self.state = "IDLE"

        # 7. Update History
        self.prev_y = current_y
        self.prev_time = current_time

        return {
            "state": self.state,
            "reps": self.reps,
            "velocity": float(self.velocity) * 10,       
            "current_velocity": float(self.velocity) * 10,
            
            # CRITICAL FIX: Return the PEAK velocity of the finished rep
            # If we didn't finish a rep this frame, return the current peak
            "rep_velocity": float(finished_rep_velocity if finished_rep_velocity > 0 else self.peak_velocity) * 10 
        }

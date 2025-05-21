import numpy as np
from datetime import datetime, timedelta

class FSRS:
    def __init__(self):
        # Default parameters for FSRS
        self.w = np.array([
            0.4,  # Initial stability
            0.6,  # Initial difficulty
            2.4,  # Initial ease factor
            0.9,  # Retrievability threshold
            0.2,  # Stability increase factor
            0.1,  # Difficulty decrease factor
        ])

    def review(self, stability: float, difficulty: float, review_count: int, rating: int) -> dict:
        """
        Update card parameters based on user rating.
        Rating scale:
        1: Complete blackout
        2: Incorrect response, but the correct one remembered after seeing it
        3: Correct response recalled with serious difficulty
        4: Perfect response
        """
        # Convert rating to a factor influencing difficulty change (e.g., 1->+ve, 4->-ve)
        # Rating scale: 1=Again, 2=Hard, 3=Good, 4=Easy
        difficulty_delta_factor = 3.5 - rating # Results in: 2.5 (Again), 1.5 (Hard), 0.5 (Good), -0.5 (Easy)
        difficulty_change = self.w[5] * difficulty_delta_factor * (1 - difficulty) # Change more if difficulty is low
        new_difficulty = min(1.0, max(0.1, difficulty + difficulty_change)) # Keep difficulty between 0.1 and 1.0

        # Stability gain depends on rating and current difficulty (harder cards gain less stability)
        # Map rating to a base stability multiplier
        if rating == 1:
            stability_multiplier = 0.5 # Again significantly reduces stability
            retrievability = 0.0
        elif rating == 2:
            stability_multiplier = 1.0 # Hard doesn't change stability much directly
            retrievability = 0.4
        elif rating == 3:
            stability_multiplier = 1.0 + (self.w[4] * (1 - new_difficulty)) # Good increases stability, less if difficult
            retrievability = 0.8
        else: # rating == 4
            stability_multiplier = 1.0 + (self.w[4] * 1.5 * (1 - new_difficulty)) # Easy increases stability more, less if difficult
            retrievability = 1.0
            
        new_stability = max(0.1, stability * stability_multiplier) # Ensure stability doesn't drop below 0.1

        # Calculate next review interval using the refined interval function
        interval = self._calculate_interval(new_stability, retrievability, rating)
        next_review = datetime.utcnow() + timedelta(days=interval)

        # print(f"DEBUG FSRS Review: S={stability:.2f}, D={difficulty:.2f}, Rating={rating} -> New S={new_stability:.2f}, New D={new_difficulty:.2f}, Interval={interval:.2f}d")

        return {
            'stability': new_stability,
            'difficulty': new_difficulty,
            'next_review': next_review
        }

    def _calculate_interval(self, stability: float, retrievability: float, rating: int) -> float:
        """Calculate the next review interval in days (simplified)."""
        
        # Handle the 'Again' case directly
        if rating == 1:
             interval = max(0.01, stability * 0.1) 
             # print(f"DEBUG FSRS (Again): S={stability:.2f} -> Interval={interval:.2f} days")
             return interval

        # Handle the 'Easy' case
        if rating == 4: 
            # Calculate theoretical 'Good' interval for comparison
            safe_good_retrievability = 0.8 
            good_interval = stability * np.log(0.9) / np.log(safe_good_retrievability)
            
            # Calculate a potential interval based on Easy retrievability (1.0)
            # This might result in infinity if stability is high, handle appropriately
            # We avoid direct division by log(1) by calculating it conceptually
            # An infinitely high interval means the card is very stable
            # For practical purposes, we can cap it or use the good_interval as reference
            # Let's ensure it's at least good_interval + 1 day, and at least 1 day absolute min.
            interval = max(good_interval + 1, 1.0)
            # print(f"DEBUG FSRS (Easy): S={stability:.2f} -> Interval={interval:.2f} days")
            return interval
        
        # Handle Hard (2) or Good (3) cases
        # Now it's safe to calculate base_interval as retrievability is not 1.0
        safe_retrievability = max(retrievability, 0.01) # retrievability is 0.4 or 0.8 here
        base_interval = stability * np.log(0.9) / np.log(safe_retrievability)
        interval = max(0.1, base_interval) # Minimum interval of ~2.4 hours
        
        # print(f"DEBUG FSRS (Hard/Good): S={stability:.2f}, R={retrievability}, Rating={rating} -> Interval={interval:.2f} days")
        return interval 
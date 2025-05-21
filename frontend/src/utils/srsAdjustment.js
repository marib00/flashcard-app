/**
 * SRS Algorithm Adjustment Utility
 * 
 * This utility intercepts SRS calculations from the backend and applies
 * more sensible values for scheduling based on standard SRS principles.
 */

// Stability multipliers for different ratings
const STABILITY_MULTIPLIERS = {
  1: 0.2,  // Again - decrease stability by 80%
  2: 1.0,  // Hard - keep the same stability
  3: 2.5,  // Good - increase by 150%
  4: 4.0   // Easy - increase by 300%
};

// Minimum stability values (in days) for new cards by rating
const MIN_STABILITY = {
  1: 0.1,  // Again - review in ~2.4 hours
  2: 0.5,  // Hard - review in 12 hours
  3: 1.0,  // Good - review in 1 day
  4: 3.0   // Easy - review in 3 days
};

/**
 * Calculates next review date based on stability
 * @param {number} stability - Stability value in days
 * @returns {string} - ISO date string for next review
 */
const calculateNextReview = (stability) => {
  const now = new Date();
  const nextReview = new Date(now.getTime() + stability * 24 * 60 * 60 * 1000);
  return nextReview.toISOString();
};

/**
 * Adjusts SRS parameters to more sensible values
 * @param {Object} originalResponse - The original API response
 * @param {number} rating - The user's rating (1-4)
 * @param {boolean} isNewCard - Whether this is a new card (no previous reviews)
 * @returns {Object} - Adjusted SRS parameters
 */
export const adjustSrsParameters = (originalResponse, rating, isNewCard) => {
  // Get original values or use defaults
  const originalStability = originalResponse.stability || 0;
  const originalDifficulty = originalResponse.difficulty || 0.3;
  const reviewCount = originalResponse.review_count || 0;
  
  let adjustedStability;
  
  if (isNewCard || reviewCount <= 1) {
    // For new cards, use minimum stability values based on rating
    adjustedStability = MIN_STABILITY[rating];
  } else {
    // For reviewed cards, apply multiplier to current stability
    adjustedStability = originalStability * STABILITY_MULTIPLIERS[rating];
    
    // Apply reasonable caps to prevent extreme values
    adjustedStability = Math.max(adjustedStability, MIN_STABILITY[rating]);
    if (rating === 4) { // Cap "Easy" to 6 months
      adjustedStability = Math.min(adjustedStability, 180);
    } else if (rating === 3) { // Cap "Good" to 2 months
      adjustedStability = Math.min(adjustedStability, 60);
    } else if (rating === 2) { // Cap "Hard" to 2 weeks
      adjustedStability = Math.min(adjustedStability, 14);
    }
  }
  
  // Calculate adjusted difficulty (slightly reduced from original algorithm)
  // Lower difficulty = easier to learn
  let adjustedDifficulty = originalDifficulty;
  if (rating === 1) {
    adjustedDifficulty = Math.min(adjustedDifficulty + 0.05, 0.9);
  } else if (rating === 4) {
    adjustedDifficulty = Math.max(adjustedDifficulty - 0.05, 0.1);
  }
  
  // Calculate next review date
  const nextReview = calculateNextReview(adjustedStability);
  
  return {
    ...originalResponse,
    stability: adjustedStability,
    difficulty: adjustedDifficulty,
    next_review: nextReview
  };
};

/**
 * Determines if a card should be considered new (no established stability)
 * @param {Object} card - The card object
 * @returns {boolean} - Whether this is a new card
 */
export const isNewCard = (card) => {
  return !card.stability || card.stability === 0 || card.review_count === 0;
};

export default adjustSrsParameters; 
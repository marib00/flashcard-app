import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, Typography, Button, Box, CircularProgress, Alert, Grid, Tooltip, Paper, Divider, LinearProgress, Slider, IconButton, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import AssessmentIcon from '@mui/icons-material/Assessment';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BarChartIcon from '@mui/icons-material/BarChart';
import axios from 'axios';
import { formatDistanceToNow, parseISO, format, startOfDay, subDays, addDays, isWithinInterval } from 'date-fns';
import { useAuth } from '../context/AuthContext'; // Import useAuth
import adjustSrsParameters, { isNewCard } from '../utils/srsAdjustment'; // Import our SRS adjustment utility
import { isToday as isDateToday } from 'date-fns'; // For direct today check

// --- SRS Stats Display Component ---
const SrsStatsDisplay = ({ stats, label }) => {
  const ratingCounts = useMemo(() => {
    if (!stats) return { counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, total: 0 };
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let total = 0;
    (stats.rating_history || []).forEach(rating => {
      if (counts.hasOwnProperty(rating)) {
        counts[rating]++;
        total++;
      }
    });
    return { counts, total };
  }, [stats]);

  if (!stats) {
    return null; // Don't render if no stats
  }

  // Check if it's a new card (all relevant stats are null/undefined or zero)
  const isNewCard = (
    (stats.stability === null || stats.stability === undefined || stats.stability === 0) &&
    (stats.difficulty === null || stats.difficulty === undefined || stats.difficulty === 0) &&
    (stats.review_count === null || stats.review_count === undefined || stats.review_count === 0)
  );

  if (isNewCard) {
    return (
      <Box sx={{ mt: 3, p: 2, border: '1px dashed #ccc', borderRadius: '4px', backgroundColor: '#fafafa' }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          New card - no review history yet.
        </Typography>
      </Box>
    );
  }
  
  const formatStat = (value) => (typeof value === 'number' ? value.toFixed(2) : 'N/A');
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseISO(dateString);
      const distance = formatDistanceToNow(date, { addSuffix: true });
      const absoluteDate = format(date, 'dd/MM/yyyy HH:mm'); // Add time for precision
      return `${distance} (${absoluteDate})`;
    } catch (e) {
      console.error("Error parsing date:", e);
      return 'Invalid date';
    }
  };
  
  // Generate dynamic tooltips
  const tooltips = {
    stability: `Stability (S): ${formatStat(stats.stability)} days
Represents memory strength, measured in days. This value determines the base interval for the next review. Higher stability leads to longer intervals.`,
    difficulty: `Difficulty (D): ${formatStat(stats.difficulty)}
How hard the card is for you (0-1 scale). Higher values mean it requires more effort to stabilize, affecting how much stability increases after a review.`,
    reviewCount: `Review Count: ${stats.review_count || 0}
The total number of times you have reviewed this card.`,
    nextReview: `Next Review: ${formatDate(stats.next_review)}
The optimally scheduled time for the next review based on your previous ratings.`
  };

  return (
    <Box sx={{ 
      mt: 3, 
      p: 2, 
      border: '1px solid #eee',
      borderRadius: '4px', 
      backgroundColor: '#fcfcfc',
      whiteSpace: 'pre-wrap' // Ensure multi-line tooltips render correctly
    }}>
      <Typography variant="overline" display="block" color="text.secondary" gutterBottom>
        {label || 'CARD STATISTICS'}
      </Typography>
      <Grid container spacing={1}>
        <Grid item xs={5}>
          <Tooltip title={tooltips.stability} placement="top" arrow>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
              Stability:
              <InfoOutlinedIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.secondary' }} />
            </Typography>
          </Tooltip>
        </Grid>
        <Grid item xs={7}><Typography variant="body2" align="right">{formatStat(stats.stability)}</Typography></Grid>

        <Grid item xs={5}>
          <Tooltip title={tooltips.difficulty} placement="top" arrow>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
              Difficulty:
              <InfoOutlinedIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.secondary' }} />
            </Typography>
          </Tooltip>
        </Grid>
        <Grid item xs={7}><Typography variant="body2" align="right">{formatStat(stats.difficulty)}</Typography></Grid>

        <Grid item xs={5}>
          <Tooltip title={tooltips.reviewCount} placement="top" arrow>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
              Review Count:
              <InfoOutlinedIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.secondary' }} />
            </Typography>
          </Tooltip>
        </Grid>
        <Grid item xs={7}><Typography variant="body2" align="right">{stats.review_count || 0}</Typography></Grid>

        <Grid item xs={5}>
          <Tooltip title={tooltips.nextReview} placement="top" arrow>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
              Next Review:
              <InfoOutlinedIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.secondary' }} />
            </Typography>
          </Tooltip>
        </Grid>
        <Grid item xs={7}><Typography variant="body2" align="right">{formatDate(stats.next_review)}</Typography></Grid>
      </Grid>

      {/* --- Rating History Histogram --- */}
      {(
        <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #eee' }}>
          <Typography variant="overline" display="block" color="text.secondary" gutterBottom>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <EqualizerIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="subtitle2">Rating History</Typography>
            </Box>
          </Typography>
          <Grid container spacing={1}>
            {/* Again */} 
            <Grid item xs={3}>
              <Typography variant="caption" color="error" align="center" display="block">
                Again
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={ratingCounts.total ? (ratingCounts.counts[1] / ratingCounts.total * 100) : 0} 
                sx={{ 
                  height: 8, 
                  borderRadius: 2,
                  bgcolor: 'rgba(244, 67, 54, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'error.main',
                  }
                }}
              />
              <Typography variant="body2" align="center">{ratingCounts.counts[1]}</Typography>
            </Grid>
            {/* Hard */} 
            <Grid item xs={3}>
              <Typography variant="caption" color="warning.main" align="center" display="block">
                Hard
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={ratingCounts.total ? (ratingCounts.counts[2] / ratingCounts.total * 100) : 0}
                sx={{ 
                  height: 8, 
                  borderRadius: 2,
                  bgcolor: 'rgba(255, 152, 0, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'warning.main',
                  }
                }}
              />
              <Typography variant="body2" align="center">{ratingCounts.counts[2]}</Typography>
            </Grid>
            {/* Good */} 
            <Grid item xs={3}>
              <Typography variant="caption" color="primary" align="center" display="block">
                Good
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={ratingCounts.total ? (ratingCounts.counts[3] / ratingCounts.total * 100) : 0}
                sx={{ 
                  height: 8, 
                  borderRadius: 2,
                  bgcolor: 'rgba(25, 118, 210, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'primary.main',
                  }
                }}
              />
              <Typography variant="body2" align="center">{ratingCounts.counts[3]}</Typography>
            </Grid>
            {/* Easy */} 
            <Grid item xs={3}>
              <Typography variant="caption" sx={{ color: '#388e3c' }} align="center" display="block">
                Easy
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={ratingCounts.total ? (ratingCounts.counts[4] / ratingCounts.total * 100) : 0}
                sx={{ 
                  height: 8, 
                  borderRadius: 2,
                  bgcolor: 'rgba(56, 142, 60, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: '#388e3c',
                  }
                }}
              />
              <Typography variant="body2" align="center">{ratingCounts.counts[4]}</Typography>
            </Grid>
          </Grid>
        </Box>
      )}
      {/* --- End Rating History Histogram --- */}
    </Box>
  );
};

// ---------- User Statistics Panel Component ----------
const UserStatsPanel = ({ 
  reviewHistory = [], 
  totalCards = 0, 
  todaysReviewCount = 0, // <--- ADD PROP for today's count
  onResetHistory, 
  onResetStats, 
}) => {
  // NOTE: reviewHistory prop might change format depending on backend response
  // The calculation logic itself might need adjustment based on /users/me/progress/ data structure
  
  // Calculate statistics based on review history
  const stats = useMemo(() => {
    console.log("--- UserStatsPanel useMemo START ---"); // Entry log
    const history = [...reviewHistory]; 
    
    // Each item in the reviewHistory represents a card, not a review.
    // The review_count field in each item tells us how many reviews that card has had.
    const uniqueCardsStudied = history.length;
    
    // Calculate total reviews by summing up the review_count field
    const totalReviews = history.reduce((sum, record) => {
      return sum + (record.review_count || 0);
    }, 0);
    
    // --- REMOVED Local 'Today's Reviews' calculation --- 
    // const todayDateString = format(new Date(), 'yyyy-MM-dd');
    // console.log(`[UserStatsPanel] Today's Date String (Local): ${todayDateString}`);
    // const todaysReviews = history.filter(review => { ... }); // Removed complex filtering logic
    // const cardsToday = todaysReviews.length; // Removed length calculation

    // --- Calculate today's difficulty counts from the history --- 
    // Filter reviews where the last_review timestamp is today (UTC based)
    const todayDateUtcStart = startOfDay(new Date()); // Uses local time but for UTC comparison
    const todaysReviewRecords = history.filter(review => {
      if (!review.timestamp) return false;
      try {
        const reviewDate = parseISO(review.timestamp);
        // Use date-fns isToday for reliable check against local today
        return isDateToday(reviewDate);
      } catch (e) {
        console.error("Error parsing review timestamp for today's stats:", review.timestamp, e);
        return false;
      }
    });

    // Define a reducer for today's reviews, using only last rating
    const todayCountReducer = (acc, review) => {
      // We already filtered for today's reviews in `todaysReviewRecords`.
      // Just count the last rating for these reviews.
      const lastRating = review.rating_history && review.rating_history.length > 0 
                       ? review.rating_history[review.rating_history.length - 1]
                       : null; // Get the *actual* last rating from history array
                       
      if (lastRating !== null && lastRating !== undefined) {
        const key = lastRating === 1 ? 'again' :
                  lastRating === 2 ? 'hard' :
                  lastRating === 3 ? 'good' : 'easy';
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    };
    const todayDifficultyCount = todaysReviewRecords.reduce(todayCountReducer, { again: 0, hard: 0, good: 0, easy: 0 });

    // --- Original Overall Difficulty Count (unchanged) --- 
    const countReducer = (acc, review) => {
        // Process the complete rating history array if available
        if (review.rating_history && Array.isArray(review.rating_history) && review.rating_history.length > 0) {
            // Count each rating in the history
            review.rating_history.forEach(rating => {
                if (rating === null || rating === undefined) return;
                
                const historyKey = rating === 1 ? 'again' : 
                           rating === 2 ? 'hard' : 
                           rating === 3 ? 'good' : 
                           rating === 4 ? 'easy' : null;
                
                if (historyKey) acc[historyKey] = (acc[historyKey] || 0) + 1;
            });
        } else if (review.rating !== null && review.rating !== undefined) {
            // Fallback to last_rating if no history is available (less likely with reviewed-cards endpoint)
            const lastRatingKey = review.rating === 1 ? 'again' : 
                       review.rating === 2 ? 'hard' : 
                       review.rating === 3 ? 'good' : 'easy'; // Rating 4 is easy
            acc[lastRatingKey] = (acc[lastRatingKey] || 0) + 1;
        }
        return acc;
    };
    const difficultyCount = history.reduce(countReducer, { again: 0, hard: 0, good: 0, easy: 0 });

    // --- Calculate Day Streak (simplified, use date-fns) ---
    const calculateDayStreak = (reviews) => {
      if (!reviews || reviews.length === 0) {
        return 0;
      }

      // Get unique review days (start of day UTC)
      const reviewDays = new Set();
      reviews.forEach(review => {
        if (review.timestamp) {
          try {
            const reviewDate = parseISO(review.timestamp);
            reviewDays.add(format(startOfDay(reviewDate), 'yyyy-MM-dd'));
          } catch (e) { /* ignore invalid dates */ }
        }
      });

      if (reviewDays.size === 0) return 0;

      const sortedDays = Array.from(reviewDays).sort().reverse(); // Newest first
      const todayFormatted = format(startOfDay(new Date()), 'yyyy-MM-dd');

      if (sortedDays[0] !== todayFormatted) return 0; // Didn't study today

      let streak = 1;
      for (let i = 0; i < sortedDays.length - 1; i++) {
        const currentDay = parseISO(sortedDays[i]);
        const previousDay = parseISO(sortedDays[i + 1]);
        const expectedPreviousDay = subDays(currentDay, 1);

        if (format(previousDay, 'yyyy-MM-dd') === format(expectedPreviousDay, 'yyyy-MM-dd')) {
          streak++;
        } else {
          break; // Streak broken
        }
      }
      return streak;
    };
    const streak = calculateDayStreak(history);

    // --- End Calculate Day Streak ---

    // --- Placeholder for Next Week Due (unchanged) --- 
    const nextWeekDue = 25; 
    
    // --- Retention Rate Calculation (unchanged) --- 
    const retentionStats = history.reduce((acc, review) => {
      if (review.rating_history && Array.isArray(review.rating_history) && review.rating_history.length > 0) {
        // Count correct ratings (3 or 4) in the full history
        review.rating_history.forEach(rating => {
          if (rating === 3 || rating === 4) {
            acc.correctCount++;
          }
          acc.totalCount++;
        });
      } 
      // No fallback needed if using reviewed-cards endpoint, as it should provide history
      return acc;
    }, { correctCount: 0, totalCount: 0 });

    const retentionRate = retentionStats.totalCount > 0 
      ? (retentionStats.correctCount / retentionStats.totalCount * 100).toFixed(1) 
      : 0;
    
    console.log(`UserStatsPanel counts: totalReviews=${totalReviews}, uniqueCardsStudied=${uniqueCardsStudied}`);
    console.log("--- UserStatsPanel useMemo END ---");
    
    return {
      totalReviews,
      // cardsToday, // Removed - use prop instead
      difficultyCount,
      todayDifficultyCount,
      nextWeekDue,
      retentionRate,
      streak,
      uniqueCardsStudied
    };
  }, [reviewHistory]); // Removed cardsToday calculation dependencies
  
  const handleResetStatsClick = () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset your study statistics? This will clear your streaks and counts but preserve your learning progress on each card."
    );
    if (confirmed) {
      console.log("User confirmed statistics reset.");
      onResetStats(); 
    }
  };
  
  const handleResetProgressClick = () => {
    const confirmed = window.confirm(
      "WARNING: This will reset all your flashcard progress and spaced repetition data. Your cards will be treated as new. This action cannot be undone."
    );
    if (confirmed) {
      console.log("User confirmed complete progress reset.");
      onResetHistory(); 
    }
  };

  return (
    <Paper elevation={2} sx={{ 
      p: 2,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      maxHeight: 'calc(100vh - 150px)'
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" gutterBottom textAlign="center" sx={{ flexGrow: 1 }}>
          Study Statistics
        </Typography>
      </Box>
      
      <Divider sx={{ my: 1 }} />
      
      {/* Today's Progress */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <CalendarTodayIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1">Today's Progress</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Paper elevation={0} sx={{ p: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
              <Typography variant="h5" color="primary">{todaysReviewCount}</Typography> {/* <--- USE PROP HERE */} 
              <Typography variant="caption">Cards Reviewed</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper elevation={0} sx={{ p: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
              <Typography variant="h5" color="secondary">{stats.streak}</Typography>
              <Typography variant="caption">Day Streak</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      
      {/* Today's Difficulty Distribution */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <EqualizerIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1">Today's Ratings</Typography>
        </Box>
        <Grid container spacing={1}>
          <Grid item xs={3}>
            <Typography variant="caption" color="error" align="center" display="block">
              Again
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={todaysReviewCount > 0 ? (stats.todayDifficultyCount.again / todaysReviewCount * 100) : 0} // Use prop for denominator
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(244, 67, 54, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'error.main',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.todayDifficultyCount.again}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="warning.main" align="center" display="block">
              Hard
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={todaysReviewCount > 0 ? (stats.todayDifficultyCount.hard / todaysReviewCount * 100) : 0} // Use prop for denominator
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(255, 152, 0, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'warning.main',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.todayDifficultyCount.hard}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="primary" align="center" display="block">
              Good
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={todaysReviewCount > 0 ? (stats.todayDifficultyCount.good / todaysReviewCount * 100) : 0} // Use prop for denominator
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(25, 118, 210, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'primary.main',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.todayDifficultyCount.good}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" sx={{ color: '#388e3c' }} align="center" display="block">
              Easy
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={todaysReviewCount > 0 ? (stats.todayDifficultyCount.easy / todaysReviewCount * 100) : 0} // Use prop for denominator
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(56, 142, 60, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#388e3c',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.todayDifficultyCount.easy}</Typography>
          </Grid>
        </Grid>
      </Box>
      
      {/* Overall Difficulty Distribution */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <EqualizerIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1">Overall Ratings</Typography>
        </Box>
        <Grid container spacing={1}>
          <Grid item xs={3}>
            <Typography variant="caption" color="error" align="center" display="block">
              Again
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={stats.totalReviews ? (stats.difficultyCount.again / stats.totalReviews * 100) : 0} 
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(244, 67, 54, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'error.main',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.difficultyCount.again}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="warning.main" align="center" display="block">
              Hard
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={stats.totalReviews ? (stats.difficultyCount.hard / stats.totalReviews * 100) : 0} 
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(255, 152, 0, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'warning.main',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.difficultyCount.hard}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" color="primary" align="center" display="block">
              Good
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={stats.totalReviews ? (stats.difficultyCount.good / stats.totalReviews * 100) : 0} 
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(25, 118, 210, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: 'primary.main',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.difficultyCount.good}</Typography>
          </Grid>
          <Grid item xs={3}>
            <Typography variant="caption" sx={{ color: '#388e3c' }} align="center" display="block">
              Easy
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={stats.totalReviews ? (stats.difficultyCount.easy / stats.totalReviews * 100) : 0} 
              sx={{ 
                height: 8, 
                borderRadius: 2,
                bgcolor: 'rgba(56, 142, 60, 0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#388e3c',
                }
              }}
            />
            <Typography variant="body2" align="center">{stats.difficultyCount.easy}</Typography>
          </Grid>
        </Grid>
      </Box>
      
      {/* Review Forecast */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <TrendingUpIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1">Review Forecast</Typography>
        </Box>
        <Paper elevation={0} sx={{ p: 1, bgcolor: 'background.paper', mb: 1 }}>
          <Typography variant="body2">Due in next 7 days: <strong>{stats.nextWeekDue}</strong></Typography>
        </Paper>
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', fontSize: '0.75rem' }}>
          A more detailed forecast graph will be available with more review data.
        </Typography>
      </Box>
      
      {/* Performance Trend */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <AssessmentIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1">Performance</Typography>
        </Box>
        <Paper elevation={0} sx={{ p: 1, bgcolor: 'background.paper', mb: 1, textAlign: 'center' }}>
          <Typography variant="h5" color={stats.retentionRate > 70 ? 'success.main' : 'warning.main'}>
            {stats.retentionRate}%
          </Typography>
          <Typography variant="caption">Retention Rate</Typography>
        </Paper>
        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', fontSize: '0.75rem' }}>
          Percentage of cards rated "Good" or "Easy"
        </Typography>
      </Box>
      
      <Box sx={{ mt: 'auto', pt: 1, borderTop: '1px solid #eee' }}>
        {/* Total number of reviews */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Total Reviews: <strong>{stats.totalReviews}</strong>
        </Typography>
        {/* Unique cards studied out of total unique cards available */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}> 
          Unique Cards Studied: <strong>{stats.uniqueCardsStudied} / {totalCards}</strong>
        </Typography>
        
        {/* Two separate reset buttons */}
        <Grid container spacing={1} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <Button 
              variant="outlined" 
              color="primary" 
              size="small"
              fullWidth
              onClick={handleResetStatsClick}
            >
              Reset Statistics Only
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button 
              variant="contained" 
              color="error" 
              size="small"
              fullWidth
              onClick={handleResetProgressClick}
            >
              Reset All Flashcard Progress
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

const FlashcardReview = () => {
  console.log("FlashcardReview: Component rendering");
  const { API, user } = useAuth(); // Get API instance and user info
  
  const [currentCard, setCurrentCard] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Start with false
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState(null); 
  const [latestReviewStats, setLatestReviewStats] = useState(null);
  const [totalCardsCount, setTotalCardsCount] = useState(0);
  
  // State for review history fetched from backend
  const [reviewHistory, setReviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // State for current card suspended status
  const [isCurrentCardSuspended, setIsCurrentCardSuspended] = useState(false);

  // State for the queue of fetched cards
  const [cardQueue, setCardQueue] = useState([]);

  // State for showing/hiding statistics panel
  const [showStats, setShowStats] = useState(true); // Default to shown

  // --- State for Priority Presets ---
  const [priorityPreset, setPriorityPreset] = useState(() => {
    const savedPreset = localStorage.getItem('priorityPreset');
    return savedPreset || 'srs'; // Default to 'srs' if nothing saved
  });

  // --- State for Today's Review Count --- 
  const [todaysReviewCount, setTodaysReviewCount] = useState(0);
  
  // --- State to control initialization ---
  const [isInitialized, setIsInitialized] = useState(false);

  // --- Helper function to update review history locally after a rating ---
  const updateReviewHistoryLocally = useCallback((cardId, rating, responseData) => {
    if (!cardId || !responseData) return;
    
    // Create the new review entry with updated data
    const newReviewEntry = {
      cardId: cardId,
      rating: rating,
      timestamp: new Date().toISOString(),
      updatedToday: true,
      stability: responseData.stability,
      difficulty: responseData.difficulty,
      review_count: responseData.review_count,
      next_review: responseData.next_review,
      is_suspended: responseData.is_suspended || false,
      rating_history: responseData.rating_history || []
    };
    
    // Update reviewHistory by replacing any existing entry for this card
    // or adding a new entry if this card isn't in the history yet
    setReviewHistory(prev => {
      const updatedHistory = [...prev];
      const existingIndex = updatedHistory.findIndex(entry => entry.cardId === cardId);
      
      if (existingIndex >= 0) {
        // Card exists in history - update it
        console.log(`[updateReviewHistoryLocally] Updating existing review for card ${cardId}`);
        updatedHistory[existingIndex] = newReviewEntry;
      } else {
        // New card - add to history
        console.log(`[updateReviewHistoryLocally] Adding new review for card ${cardId}`);
        updatedHistory.push(newReviewEntry);
      }
      
      return updatedHistory;
    });
  }, []);

  // Function to toggle statistics visibility
  const toggleStats = useCallback(() => {
    setShowStats(prev => !prev);
  }, []);

  // --- State for Review Priorities ---
  const priorityLevels = ['Highest', 'High', 'Normal', 'Low', 'Off'];
  const defaultPriorities = {
    new: 'Normal',
    again: 'Highest',
    hard: 'High',
    good: 'Normal',
    easy: 'Low'
  };

  const [priorities, setPriorities] = useState(() => {
    const saved = localStorage.getItem('reviewPriorities');
    return saved ? JSON.parse(saved) : defaultPriorities;
  });

  // Fisher-Yates (Knuth) Shuffle
  const shuffleArray = useCallback((array) => {
    if (!array || !Array.isArray(array)) return [];
    // Clone array to avoid mutation
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Random index from 0 to i
      const j = Math.floor(Math.random() * (i + 1));
      // Swap elements at i and j
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []);

  // Update priority for a specific category
  const handlePriorityChange = useCallback((category) => (event) => {
    const newPriority = event.target.value;
    setPriorities(prev => ({
      ...prev,
      [category]: newPriority
    }));
  }, []);

  // Save priorities to localStorage when they change
  useEffect(() => {
    if (!isInitialized) return; // Skip during initialization
    
    localStorage.setItem('reviewPriorities', JSON.stringify(priorities));
    console.log('Saved review priorities:', priorities);
    // Also save the current preset
    localStorage.setItem('priorityPreset', priorityPreset);
    console.log('Saved priority preset:', priorityPreset);
  }, [priorities, priorityPreset, isInitialized]);

  // Check API connectivity
  const checkAPIConnectivity = useCallback(async () => {
    setApiStatus("checking");
    try {
      console.log("Checking API connectivity...");
      const response = await API.get('/');
      console.log("API connectivity check successful", response.data);
      setApiStatus("connected");
      return true;
    } catch (err) {
      console.error("API connectivity check failed:", err);
      setApiStatus("disconnected");
      
      let errorMessage = 'Cannot connect to the backend server.';
      if (err && err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
      } else if (err && err.response && err.response.status) {
        errorMessage += ` Server responded with: ${err.response.status}`;
      } else if (err && err.request) {
        errorMessage += ' No response received from server.';
      } else if (err && err.message && typeof err.message === 'string') {
        errorMessage = err.message;
      }
      
      setError(String(errorMessage)); // Ensure it's a string
      setIsLoading(false);
      return false;
    }
  }, [API]);

  // Alternative method to get total card count if primary method fails
  const fetchTotalCardCountAlternative = useCallback(async () => {
    try {
      // Try to get all cards and count them
      const response = await API.get('/cards/all/');
      console.log("Using alternative method to count cards");
      if (Array.isArray(response.data)) {
        setTotalCardsCount(response.data.length);
        console.log(`Found ${response.data.length} total cards via alternative method`);
      } else {
        console.error('Alternative card counting failed, unexpected response format');
        setTotalCardsCount(0); // Set a default if alternative fails
      }
    } catch (err) {
      console.error('Alternative card counting failed:', err);
      setTotalCardsCount(0); // Set a default on error
    }
  }, [API]);

  // Function to fetch user progress
  const fetchUserProgress = useCallback(async () => {
    console.log('[fetchUserProgress] Starting fetch');
    try {
      setHistoryLoading(true); // Set loading true at the start
      const response = await API.get('/users/me/reviewed-cards/'); // Use reviewed-cards endpoint
      console.log('[fetchUserProgress] Fetched successfully:', response.data?.length || 0, 'cards');

      // Process and update the review history state
      const updatedHistory = Array.isArray(response.data) ? response.data.map(progress => {
        // Map backend progress to frontend format
        return {
          cardId: progress.card_id,
          question: progress.question,
          stability: progress.stability,
          difficulty: progress.difficulty,
          review_count: progress.review_count,
          next_review: progress.next_review,
          timestamp: progress.last_review,
          is_suspended: progress.is_suspended,
          rating_history: progress.rating_history || []
        };
      }) : [];

      setReviewHistory(updatedHistory);
      setHistoryLoading(false);
      return updatedHistory;
    } catch (err) {
      console.error('[fetchUserProgress] Error:', err);
      setHistoryLoading(false);
      return [];
    }
  }, [API]);

  // Function to fetch total card count
  const fetchTotalCardCount = useCallback(async () => {
    console.log('[fetchTotalCardCount] Starting fetch');
    try {
      const response = await API.get('/cards/count/');
      console.log('[fetchTotalCardCount] Response:', response.data);
      
      // Handle different possible response formats
      if (response.data && response.data.count !== undefined) {
        setTotalCardsCount(response.data.count);
      } else if (typeof response.data === 'number') {
        setTotalCardsCount(response.data);
      } else if (response.data && response.data.total !== undefined) {
        setTotalCardsCount(response.data.total);
      } else {
        console.error('[fetchTotalCardCount] Unexpected format:', response.data);
        setTotalCardsCount(0);
      }
    } catch (err) {
      console.error('[fetchTotalCardCount] Error:', err);
      setTotalCardsCount(0);
    }
  }, [API]);

  // Function to fetch today's review count
  const fetchTodaysCount = useCallback(async () => {
    console.log('[fetchTodaysCount] Starting fetch');
    try {
      const response = await API.get('/users/me/progress/today-count');
      const count = response.data && response.data.count ? response.data.count : 0;
      console.log('[fetchTodaysCount] Count:', count);
      setTodaysReviewCount(count);
    } catch (err) {
      console.error('[fetchTodaysCount] Error:', err);
      setTodaysReviewCount(0);
    }
  }, [API]);

  // --- Function to fetch the next card (due or new) ---
  const fetchNextCard = useCallback(async (excludeCardId = null) => {
    // Note: excludeCardId is now mainly for the initial SRS/New fallback, not batch fetching
    console.log(`[fetchNextCard] START - Fetching BATCH with preset: ${priorityPreset}${excludeCardId ? `, excluding ID: ${excludeCardId} for SRS fallback` : ''}`);
    console.log('[fetchNextCard] Current Individual Priorities:', priorities);
    
    setIsLoading(true);
    // Don't reset current card here, wait for the result
    setError(null);
    
    let endpoint = '';
    let fetchMethod = 'GET';
    let payload = null;
    let batchLimit = 5; // Reduced batch size from 20 to 5 to avoid overwhelming the UI

    try {
      if (priorityPreset === 'srs') {
        // --- Strict SRS Mode --- 
        endpoint = `/cards/due/?limit=${batchLimit}` + (excludeCardId ? `&exclude_card_id=${excludeCardId}` : ''); 
        console.log(`[fetchNextCard] Preset=srs. Calling: ${endpoint}`);

      } else if (priorityPreset === 'custom') {
        // --- Custom Mode --- 
        const { new: pNew, again: pAgain, hard: pHard, good: pGood, easy: pEasy } = priorities;
        
        // Always use the /cards/next/ endpoint for custom priorities
        const params = new URLSearchParams();
        params.append('priority_new', pNew.toLowerCase());
        params.append('priority_again', pAgain.toLowerCase());
        params.append('priority_hard', pHard.toLowerCase());
        params.append('priority_good', pGood.toLowerCase());
        params.append('priority_easy', pEasy.toLowerCase());
        params.append('limit', batchLimit.toString()); // Add limit parameter explicitly
        endpoint = `/cards/next/?${params.toString()}`;
        
        // Logging for verification
        console.log(`[fetchNextCard] USING CUSTOM PRESET. Endpoint: ${endpoint}`); 
        console.log(`[fetchNextCard] Params: ${params.toString()}`);
        console.log(`[fetchNextCard] Preset=custom. General priorities. Calling: ${endpoint}`);
      } else {
        // Fallback or future presets - default to SRS for now
        console.warn(`[fetchNextCard] Unknown priorityPreset: ${priorityPreset}. Defaulting to SRS.`);
        endpoint = '/cards/due/?limit=5' + (excludeCardId ? `&exclude_card_id=${excludeCardId}` : '');
      }
      
      // --- Execute API Call ---
      let response = await API.request({ 
          method: fetchMethod, 
          url: endpoint, 
          data: payload 
      });

      // --- Handle Response --- 
      let fetchedCards = [];
      if (Array.isArray(response.data)) {
        fetchedCards = response.data; // For /cards/due/ and /cards/by-rating/ (when limit > 1)
      } else if (response.data && typeof response.data === 'object') {
        fetchedCards = [response.data]; // For /cards/next/ (returns single object)
      } else {
        console.log('[fetchNextCard] No card data received from the API call.');
        fetchedCards = [];
      }

      if (fetchedCards.length > 0) {
          console.log(`[fetchNextCard] Fetched ${fetchedCards.length} cards. Shuffling and queuing.`);
          const shuffled = shuffleArray(fetchedCards);
          const firstCard = shuffled.shift(); // Take the first one to display now
          
          // Reset UI state BEFORE setting the current card to avoid race conditions
          setSelectedAnswers(new Set());
          setIsSubmitted(false);
          setLatestReviewStats(null);
          setIsCurrentCardSuspended(firstCard?.is_suspended || false);
          
          // First update the queue, then set current card to avoid race conditions
          setCardQueue(shuffled); // Queue the rest
          
          // Finally set the current card - this should be the last state update to avoid races
          setCurrentCard(firstCard);
      } else {
          // --- Handle No Cards Found --- 
          if (priorityPreset === 'srs') {
            // Try fallback to /cards/new/ only in SRS mode
            console.log(`[fetchNextCard] SRS mode: No due card found. Attempting fallback to /cards/new/`);
            endpoint = '/cards/new/?limit=5' + (excludeCardId ? `&exclude_card_id=${excludeCardId}` : '');
            console.log(`[fetchNextCard] Making API call: ${fetchMethod} ${endpoint}`);
            response = await API.request({ method: fetchMethod, url: endpoint, data: payload });
            if (Array.isArray(response.data) && response.data.length > 0) {
               const newCards = response.data;
               console.log(`[fetchNextCard] Found ${newCards.length} cards via new card fallback`);
               const shuffled = shuffleArray(newCards);
               const firstCard = shuffled.shift();
               
               // Same ordering as above - reset UI state first
               setSelectedAnswers(new Set());
               setIsSubmitted(false);
               setLatestReviewStats(null);
               setIsCurrentCardSuspended(firstCard?.is_suspended || false);
               
               // Update queue first
               setCardQueue(shuffled);
               
               // Finally set current card
               setCurrentCard(firstCard);
            } else {
               console.log('[fetchNextCard] No new card found via fallback.');
               setCurrentCard(null);
               setCardQueue([]);
            }
          } else {
             // No card found in custom modes
             console.log('[fetchNextCard] No card found based on custom priorities/filters.');
             setCurrentCard(null);
             setCardQueue([]);
          }
      } // End of fetchedCards.length > 0 check
       
     } catch (err) {
       console.error('[fetchNextCard] ERROR fetching next card:', err);
       let UImessage = "An error occurred while fetching the next card.";
       if (err && err.response && err.response.data && err.response.data.detail) {
           UImessage = err.response.data.detail;
       } else if (err && err.message && typeof err.message === 'string') {
           UImessage = err.message;
       }
       setError(String(UImessage)); // Ensure it's a string
       setCurrentCard(null);
       setCardQueue([]); // Clear queue on error
     } finally {
       console.log('[fetchNextCard] END - Finished fetching.');
       setIsLoading(false);
     }
  }, [API, priorities, priorityPreset, shuffleArray]);

  // --- Function to display the next card from the queue or fetch a new batch ---
  const displayNextCardFromQueue = useCallback(async (excludeCardId = null) => {
    console.log('[displayNextCardFromQueue] Called. Queue length:', cardQueue.length);
    
    // Check if we should preload more cards (when queue gets low)
    const shouldPreload = cardQueue.length <= 3; // Preload when 3 or fewer cards left
    
    if (cardQueue.length > 0) {
      const nextQueue = [...cardQueue];
      const nextCard = nextQueue.shift(); // Get the next card
      console.log('[displayNextCardFromQueue] Displaying card from queue:', nextCard?.id);
      
      // Reset UI state BEFORE setting the current card to avoid race conditions
      setSelectedAnswers(new Set());
      setIsSubmitted(false);
      setLatestReviewStats(null); 
      setIsCurrentCardSuspended(nextCard?.is_suspended || false);
      
      // First update the queue, then set current card to avoid race conditions
      setCardQueue(nextQueue);
      
      // Finally set the current card - this should be the last state update to avoid races
      setCurrentCard(nextCard);
      
      setIsLoading(false); // Stop loading once card is displayed
      
      // If queue is getting low, preload more cards in the background
      // BUT don't modify the current card!
      if (shouldPreload) {
        console.log('[displayNextCardFromQueue] Queue is low, preloading more cards in background');
        // Use a separate function that only adds to queue without changing current card
        setTimeout(() => {
          // Preload in background after a slight delay, only adding to queue, not updating current card
          if (nextCard) {
            console.log('[Preload] Starting preload of more cards for queue');
            const preloadMore = async () => {
              try {
                // Simplified preload endpoint based on current preset
                let endpoint = '';
                if (priorityPreset === 'srs') {
                  endpoint = `/cards/due/?limit=5&exclude_card_id=${nextCard.id}`; // Reduced to 5
                } else if (priorityPreset === 'custom') {
                  const { new: pNew, again: pAgain, hard: pHard, good: pGood, easy: pEasy } = priorities;
                  const params = new URLSearchParams();
                  params.append('priority_new', pNew.toLowerCase());
                  params.append('priority_again', pAgain.toLowerCase());
                  params.append('priority_hard', pHard.toLowerCase());
                  params.append('priority_good', pGood.toLowerCase());
                  params.append('priority_easy', pEasy.toLowerCase());
                  params.append('limit', '5'); // Reduced from 10 to 5
                  params.append('exclude_card_id', nextCard.id);
                  endpoint = `/cards/next/?${params.toString()}`;
                } else {
                  endpoint = `/cards/due/?limit=5&exclude_card_id=${nextCard.id}`; // Reduced to 5
                }
                
                // Execute the API call
                const response = await API.request({ method: 'GET', url: endpoint });
                
                // Process response
                let fetchedCards = [];
                if (Array.isArray(response.data)) {
                  fetchedCards = response.data;
                } else if (response.data && typeof response.data === 'object') {
                  fetchedCards = [response.data];
                }
                
                if (fetchedCards.length > 0) {
                  console.log(`[Preload] Fetched ${fetchedCards.length} additional cards for queue`);
                  // Shuffle the fetched cards
                  const shuffled = shuffleArray(fetchedCards);
                  // Add to queue WITHOUT changing current card
                  setCardQueue(prevQueue => [...prevQueue, ...shuffled]);
                }
              } catch (err) {
                // Just log errors for background preloading, don't show to user
                console.error('[Preload] Error preloading additional cards:', err);
              }
            };
            
            // Execute the preload function
            preloadMore();
          }
        }, 3000); // Increased to 3 seconds to ensure no interference with viewing the current card
      }
    } else {
      console.log('[displayNextCardFromQueue] Queue empty.');
      // Only fetch a new card when this function is explicitly called after user interaction,
      // not automatically on mount
      if (excludeCardId) {
        console.log('[displayNextCardFromQueue] Fetching new card after user rating...');
        await fetchNextCard(excludeCardId);
      } else {
        setIsLoading(false);
      }
    }
  }, [cardQueue, fetchNextCard, API, priorities, priorityPreset, shuffleArray]);

  // Function to initialize the app - defined after all required functions
  const initializeApp = useCallback(async () => {
    console.log('[INIT] Starting initialization sequence');
    
    try {
      setIsLoading(true);
      
      // First check API connectivity
      const isConnected = await checkAPIConnectivity();
      if (!isConnected) {
        console.log('[INIT] API connectivity check failed');
        setIsLoading(false);
        return;
      }
      
      // Then fetch the total card count (OPTIONAL)
      await fetchTotalCardCount();
      
      // Fetch user review history
      await fetchUserProgress();
      
      // Fetch today's review count
      await fetchTodaysCount();
      
      // Finally fetch the first card (ONLY ONCE)
      await fetchNextCard();
      
      // Mark initialization as complete
      setIsInitialized(true);
    } catch (initError) {
      console.error("Initialization error:", initError);
      let UImessage = "Failed to initialize the application.";
      if (initError && initError.message && typeof initError.message === 'string') {
        UImessage = initError.message;
      } else if (typeof initError === 'string') {
        UImessage = initError;
      }
      setError(String(UImessage)); // Ensure it's a string
    } finally {
      // Always set loading to false when initialization completes or fails
      setIsLoading(false);
    }
  }, [checkAPIConnectivity, fetchTotalCardCount, fetchUserProgress, fetchTodaysCount, fetchNextCard]);

  // Master initialization effect - controls the entire app startup
  useEffect(() => {
    console.log('[INIT] Component mounted, starting initialization');
    
    // Only run initialization once
    if (!isInitialized) {
      initializeApp();
    }
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      console.log('[INIT] Component unmounting');
    };
  }, [isInitialized, initializeApp]); // Only depend on isInitialized and initializeApp

  // Add a useEffect to refresh statistics when a card is rated
  // But ONLY if the component is fully mounted
  const [isFullyMounted, setIsFullyMounted] = useState(false);
  
  useEffect(() => {
    setIsFullyMounted(true);
    return () => setIsFullyMounted(false);
  }, []);
  
  useEffect(() => {
    if (latestReviewStats && isFullyMounted) {
      // Only refresh data after a card has been reviewed and component is fully mounted
      fetchUserProgress();
    }
  }, [latestReviewStats, fetchUserProgress, isFullyMounted]);

  // Function to handle rating a card
  const handleRating = async (rating) => {
    if (!currentCard) return;
    console.log(`[handleRating] Card ID: ${currentCard.id}, Rating: ${rating}`);
    setIsLoading(true); // Indicate loading state during review processing
    setIsSubmitted(true); // Keep card face visible, show loading indicator over rating buttons
    setError(null);

    try {
      // Save current card ID to local variable before any async operations
      const cardId = currentCard.id;
      
      // API call to submit the review
      const reviewPayload = { 
        rating: rating,
        card_id: cardId // Use local variable
      };
      
      const response = await API.request({
        method: 'POST',
        url: `/cards/${cardId}/review/`, // Use local variable
        data: reviewPayload,
      });

      console.log('[handleRating] Review API success:', response.data);
      
      // Update stats with the latest review data
      setLatestReviewStats(response.data); 
      
      // Also manually update review history for immediate UI feedback
      updateReviewHistoryLocally(cardId, rating, response.data);

      // Increment today's review count locally for immediate feedback
      setTodaysReviewCount(prev => prev + 1);
      
      // Add a delay before fetching/displaying the next card
      setTimeout(() => {
        displayNextCardFromQueue(cardId); 
      }, 600); // Adjusted to provide better visibility of rated card

    } catch (err) {
      console.error('[handleRating] ERROR submitting review:', err);
      let UImessage = 'Failed to submit review. Please try again.';
      if (err && err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          // Handle Pydantic validation errors (usually an array of objects)
          UImessage = detail.map(e => `${e.loc.join('.')} - ${e.msg}`).join('; \n');
        } else if (typeof detail === 'string') {
          UImessage = detail;
        } else {
          UImessage = JSON.stringify(detail); // Fallback for other object types
        }
      } else if (err && err.message && typeof err.message === 'string') {
        UImessage = err.message;
      }
      setError(String(UImessage)); // Ensure it's a string
      setIsLoading(false); // Stop loading on error
      setIsSubmitted(false); // Allow re-submission or other actions
    }
  };

  // --- handleResetReviewHistory function ---
  const handleResetReviewHistory = async () => {
    if (!user) return; 
    console.log("Resetting user progress for:", user.username); // Corrected: user.email if that's the identifier
    try {
      // Use the user-specific endpoint
      const response = await API.delete('/users/me/progress/');
      console.log("Backend progress reset successfully:", response.data);
      
      // Clear local state
      setReviewHistory([]); 
      setLatestReviewStats(null);
      
      // No need to clear localStorage history anymore
      
      // Manually update the current card display to reflect reset (set stats to null)
      // This forces SrsStatsDisplay to show "New card" message
      if (currentCard) {
          setCurrentCard(prev => prev ? { ...prev, stability: null, difficulty: null, review_count: null, next_review: null } : null);
      }
      
    } catch (err) {
      console.error("Error resetting user progress:", err);
      let UImessage = "Failed to reset statistics on the server.";
      if (err && err.response && err.response.data && err.response.data.detail) {
        UImessage = err.response.data.detail;
      } else if (err && err.message && typeof err.message === 'string') {
        UImessage = err.message;
      }
      setError(String(UImessage)); // Ensure it's a string
    }
  };

  // --- handleResetStatsOnly function ---
  const handleResetStatsOnly = async () => {
    if (!user) return; 
    console.log("Resetting stats only for user:", user.username); // Corrected: user.email if that's the identifier
    try {
      // Call a new endpoint that should be created on the backend for resetting only statistics
      // This endpoint should reset stats counters but preserve card parameters
      const response = await API.post('/users/me/reset-stats/');
      console.log("Statistics reset successfully:", response.data);
      
      // Refresh user progress to update the UI
      fetchUserProgress();
      
    } catch (err) {
      console.error("Error resetting statistics:", err);
      let UImessage = "Failed to reset statistics. This feature may require backend implementation.";
       if (err && err.response && err.response.data && err.response.data.detail) {
        UImessage = err.response.data.detail;
      } else if (err && err.message && typeof err.message === 'string') {
        UImessage = err.message;
      }
      setError(String(UImessage)); // Ensure it's a string
    }
  };

  // Shuffle the answers whenever currentCard changes
  const shuffledAnswers = useMemo(() => {
    if (!currentCard || !currentCard.answers) return [];
    return shuffleArray(currentCard.answers);
  }, [currentCard, shuffleArray]);

  const { isMultiAnswer, correctAnswerIds } = useMemo(() => {
    if (!currentCard || !currentCard.answers) {
      return { isMultiAnswer: false, correctAnswerIds: new Set() };
    }
    const correctIds = new Set();
    currentCard.answers.forEach(answer => {
      if (answer.is_correct) {
        correctIds.add(answer.id);
      }
    });
    return {
      isMultiAnswer: correctIds.size > 1,
      correctAnswerIds: correctIds
    };
  }, [currentCard]);

  const handleAnswerSelect = (answerId) => {
    if (isSubmitted) return;

    setSelectedAnswers(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (isMultiAnswer) {
        if (newSelected.has(answerId)) {
          newSelected.delete(answerId);
        } else {
          newSelected.add(answerId);
        }
      } else {
        newSelected.clear();
        newSelected.add(answerId);
        setIsSubmitted(true);
      }
      console.log("Selected answers:", Array.from(newSelected));
      return newSelected;
    });
  };

  const handleSubmitAnswers = () => {
    if (!isMultiAnswer || isSubmitted) return;
    console.log("Submitting answers:", Array.from(selectedAnswers));
    setIsSubmitted(true);
  };

  const getAnswerButtonStyle = (answer) => {
    const isSelected = selectedAnswers.has(answer.id);
    const isCorrect = correctAnswerIds.has(answer.id);

    // --- Define Style Fragments --- 
    const baseStyle = {
        mb: 1, 
        textTransform: 'none', 
        justifyContent: 'flex-start',
        textAlign: 'left',
        px: 2,
        '& .MuiButton-startIcon': {
          marginRight: 1
        },
        '& .MuiButton-endIcon': {
          marginLeft: 1
        }
    };

    const initialOutlinedStyle = {
        color: 'rgba(0, 0, 0, 0.87)',
        border: '1px solid rgba(0, 0, 0, 0.23)',
        '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)'
        }
    };

    const selectedContainedStyle = {
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        border: '1px solid #90caf9',
        '&:hover': {
            backgroundColor: '#bbdefb'
        }
    };

    const submittedCorrectStyle = {
        backgroundColor: '#dcedc8',
        color: '#2e7d32',
        border: '1px solid #a5d6a7',
        '&:hover': { backgroundColor: '#dcedc8' }, // No hover change
        '&.Mui-disabled': {
            backgroundColor: '#dcedc8',
            color: '#2e7d32',
            border: '1px solid #a5d6a7',
            opacity: 0.8
        }
    };

    const submittedIncorrectSelectedStyle = {
        backgroundColor: '#ffcdd2',
        color: '#c62828',
        border: '1px solid #ef9a9a',
        '&:hover': { backgroundColor: '#ffcdd2' }, // No hover change
        '&.Mui-disabled': {
            backgroundColor: '#ffcdd2',
            color: '#c62828',
            border: '1px solid #ef9a9a',
            opacity: 0.8
        }
    };
    
    const submittedIncorrectUnselectedStyle = {
         // Use outlined styles but specifically for disabled greyed-out state
        color: 'rgba(0, 0, 0, 0.3)',
        border: '1px dashed rgba(0, 0, 0, 0.2)',
        backgroundColor: 'transparent', // Ensure background is transparent for outlined
        '&:hover': { backgroundColor: 'transparent' }, // No hover change
        '&.Mui-disabled': {
            backgroundColor: 'transparent',
            color: 'rgba(0, 0, 0, 0.3)',
            border: '1px dashed rgba(0, 0, 0, 0.2)'
        }
    };
    
    // --- Determine Final Style and Variant ---
    let finalStyle = { ...baseStyle };
    let finalVariant = "outlined"; // Default variant

    // Log entry state
    console.log(`Button Style Check: Answer ID=${answer.id}, isSelected=${isSelected}, isSubmitted=${isSubmitted}, isCorrect=${isCorrect}`);

    if (isSubmitted) {
        console.log(` -> State: Submitted`);
        if (isCorrect) {
            console.log(` -> Condition: Correct`);
            finalVariant = "contained";
            finalStyle = { ...finalStyle, ...submittedCorrectStyle };
        } else if (isSelected && !isCorrect) {
            console.log(` -> Condition: Selected Incorrect`);
            finalVariant = "contained";
            finalStyle = { ...finalStyle, ...submittedIncorrectSelectedStyle };
        } else {
            console.log(` -> Condition: Unselected Incorrect`);
            // Non-selected, incorrect answers after submission
            finalVariant = "outlined"; 
            finalStyle = { ...finalStyle, ...submittedIncorrectUnselectedStyle };
        }
    } else if (isSelected) {
        console.log(` -> State: Selected (Pre-Submit)`);
        // Selected before submission
        finalVariant = "contained";
        finalStyle = { ...finalStyle, ...selectedContainedStyle };
    } else {
        console.log(` -> State: Initial (Not Submitted, Not Selected)`);
        // Initial state: Not submitted, not selected
        finalVariant = "outlined";
        finalStyle = { ...finalStyle, ...initialOutlinedStyle };
    }

    console.log(` -> Final Variant: ${finalVariant}`);
    // console.log(' -> Final Style:', finalStyle); // Style object can be large, log variant first

    return { style: finalStyle, variant: finalVariant };
  };

  // Calculate stats to display (either latest review or current card stats)
  const displayStats = useMemo(() => {
    if (currentCard) {
      // Check if this card exists in the reviewHistory
      const existingReview = reviewHistory.find(record => record.cardId === currentCard.id);
      
      // Use either the existing review's rating history or extract from current card
      let cardRatingHistory = [];
      
      // If we have history from the user progress endpoint, use that first
      if (existingReview && existingReview.rating_history && 
          Array.isArray(existingReview.rating_history) && 
          existingReview.rating_history.length > 0) {
        cardRatingHistory = [...existingReview.rating_history];
        console.log(`Using rating history from reviewHistory for card ${currentCard.id}:`, cardRatingHistory);
      } 
      // Fall back to card's rating history if available
      else if (currentCard.rating_history && 
               Array.isArray(currentCard.rating_history) && 
               currentCard.rating_history.length > 0) {
        cardRatingHistory = [...currentCard.rating_history];
        console.log(`Using rating history directly from card ${currentCard.id}:`, cardRatingHistory);
      }
      // Last resort: if we have a review count but no history, create a synthetic one
      else if (currentCard.review_count && currentCard.review_count > 0) {
        // If review count is available but no actual ratings, create a synthetic history
        // Default to "Good" ratings
        const syntheticRating = currentCard.last_rating || 3; // Default to "Good" if not available
        cardRatingHistory = Array(currentCard.review_count).fill(syntheticRating);
        console.log(`Created synthetic rating history for card ${currentCard.id} based on review count:`, cardRatingHistory);
      }
      
      // If we have latestReviewStats (from a recent review), use those values
      if (latestReviewStats) {
        // If a review just happened, include that rating in history if not already there
        if (latestReviewStats.last_rating && 
            (!cardRatingHistory.length || 
             cardRatingHistory[cardRatingHistory.length - 1] !== latestReviewStats.last_rating)) {
          cardRatingHistory.push(latestReviewStats.last_rating);
          console.log(`Added latest rating ${latestReviewStats.last_rating} to history for card ${currentCard.id}`);
        }
        
        return {
          stability: latestReviewStats.stability,
          difficulty: latestReviewStats.difficulty,
          review_count: latestReviewStats.review_count || cardRatingHistory.length,
          next_review: latestReviewStats.next_review,
          rating_history: cardRatingHistory
        };
      }
      
      // Otherwise use the current card's stats
      return {
        stability: currentCard.stability,
        difficulty: currentCard.difficulty,
        review_count: currentCard.review_count || cardRatingHistory.length,
        next_review: currentCard.next_review,
        rating_history: cardRatingHistory
      };
    }
    return null; // Return null if no card or stats available
  }, [currentCard, latestReviewStats, reviewHistory]);

  const displayStatsLabel = isSubmitted && latestReviewStats ? "Stats After Review:" : "Current Stats:";

  // --- Function to handle suspend/unsuspend --- 
  const handleSuspendToggle = async () => {
      if (!currentCard || isSubmitted) return;
      console.log(`Toggling suspend status for card ${currentCard.id}`);
      setIsSubmitted(true); // Keep loading until action is complete
      setError(null); // Clear previous errors
      try {
          const response = await API.post(`/cards/${currentCard.id}/suspend`);
          console.log("Suspend toggle successful", response.data);
          // Update UI state immediately
          setIsCurrentCardSuspended(response.data.is_suspended);
          // Optionally, fetch next card immediately after suspending
          if (response.data.is_suspended) {
              console.log("Card suspended, fetching next card...");
              // Add a small delay for user to see the suspension confirmation briefly
              setTimeout(() => {
                  fetchNextCard(currentCard.id); // Exclude current card from next fetch
              }, 300);
          } else {
            // If unsuspended, don't automatically fetch next, just allow interaction
            setIsSubmitted(false); 
            setIsLoading(false);
          }
      } catch (err) {
          console.error('Error toggling suspend status:', err);
          let UImessage = 'Failed to update suspend status.';
          if (err && err.response && err.response.data && err.response.data.detail) {
            UImessage = err.response.data.detail;
          } else if (err && err.message && typeof err.message === 'string') {
            UImessage = err.message;
          }
          setError(String(UImessage)); // Ensure it's a string
          setIsSubmitted(false); // Reset submitted state on error
          setIsLoading(false); // Reset loading state on error
      } 
      // 'finally' block removed as setIsLoading and setIsSubmitted are handled per path
  };

  // --- handleDontShowAgain function ---
  const handleDontShowAgain = async () => {
    if (!currentCard) return;
    console.log('Rating Button Clicked: Dont show again (Suspend + Easy 4)');
    
    // Prevent multiple clicks
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      console.log(`Suspending card ${currentCard.id} via "Don't show again" button`);
      
      // First, suspend the card - no data needed, just POST to the endpoint
      const suspendResponse = await API.post(`/cards/${currentCard.id}/suspend`);
      console.log("Suspend API response:", suspendResponse.data);
      
      // Update UI to show card is suspended
      setIsCurrentCardSuspended(true);
      
      // Next, rate the card as easy (4)
      // Must include both rating and card_id
      const ratingData = {
        rating: 4, // Easy
        card_id: currentCard.id
      };
      console.log("Submitting rating with data:", ratingData);
      
      const ratingResponse = await API.post(`/cards/${currentCard.id}/review/`, ratingData);
      console.log("Rating response:", ratingResponse.data);
      
      // Apply our custom SRS adjustment to the response data
      const isCardNew = isNewCard(currentCard);
      const adjustedStats = adjustSrsParameters(ratingResponse.data, 4, isCardNew);
      console.log("Original SRS data:", ratingResponse.data);
      console.log("Adjusted SRS data:", adjustedStats);
      
      // The rating may have automatically unsuspended the card, so suspend it again
      const resuspendResponse = await API.post(`/cards/${currentCard.id}/suspend`);
      console.log("Re-suspend response:", resuspendResponse.data);
      
      // Update local state
      setLatestReviewStats({
        ...adjustedStats,
        is_suspended: true
      });
      
      // Fetch updated today's count after successful review - make non-blocking
      fetchTodaysCount().catch(err => console.error("Error updating today's count:", err));
      
      // --- Local history update (for UI only, not sent to backend) ---
      // Create the new review entry with updated data
      const newReviewEntry = {
        cardId: currentCard.id,
        rating: 4, // Easy
        timestamp: new Date().toISOString(),
        updatedToday: true, // Mark as updated today
        stability: adjustedStats.stability, // Use adjusted stability
        difficulty: adjustedStats.difficulty, // Use adjusted difficulty
        review_count: adjustedStats.review_count,
        next_review: adjustedStats.next_review,
        is_suspended: true,
        // Add proper rating_history tracking
        rating_history: ratingResponse.data.rating_history || 
                       (currentCard.rating_history ? 
                        [...currentCard.rating_history, 4] : 
                        [4])
      };
      
      // Update reviewHistory by replacing any existing entry for this card
      // or adding a new entry if this card isn't in the history yet
      setReviewHistory(prev => {
        const updatedHistory = [...prev];
        const existingIndex = updatedHistory.findIndex(entry => entry.cardId === currentCard.id);
        
        if (existingIndex >= 0) {
          // Card exists in history - replace the entry but preserve rating history
          console.log(`Updating existing review for card ${currentCard.id} at index ${existingIndex}`);
          
          // Preserve existing rating history and add new rating
          const existingRatingHistory = updatedHistory[existingIndex].rating_history || [];
          
          updatedHistory[existingIndex] = {
            ...newReviewEntry,
            rating_history: [...existingRatingHistory, 4]
          };
        } else {
          // New card - add to history
          console.log(`Adding new review for previously unseen card ${currentCard.id}`);
          updatedHistory.push(newReviewEntry);
        }
        
        return updatedHistory;
      });
      // --- End local history update ---
      
      // Reduce the delay before showing next card (was 300ms)
      setTimeout(() => {
        displayNextCardFromQueue(currentCard.id); // Pass potentially excluded ID for initial fetch
      }, 100);
      
    } catch (error) { // Renamed to avoid conflict
      console.error("Error in Don't show again workflow:", error);
      let UImessage = "Failed to process card. Please try again.";
      if (error && error.message && typeof error.message === 'string') {
        UImessage = error.message;
      }
      setError(String(UImessage)); // Ensure it's a string
      setIsLoading(false);
    }
  };

  // --- Card Display ---
  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto', mt: 2 }}>
      {/* --- Priority Controls --- */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Review Priorities
          </Typography>
          <Tooltip title={showStats ? "Hide Statistics Panel" : "Show Statistics Panel"}>
            <IconButton onClick={toggleStats} size="small" sx={{ bgcolor: 'action.hover' }}>
              <EqualizerIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Grid container spacing={2}>
          {/* --- Preset Selector --- */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="priority-preset-label">Preset</InputLabel>
              <Select
                labelId="priority-preset-label"
                id="priority-preset-select"
                value={priorityPreset}
                label="Preset"
                onChange={(e) => {
                  setPriorityPreset(e.target.value);
                  console.log("Preset changed to:", e.target.value);
                  // Optional: Reset individual priorities when preset changes?
                  // if (e.target.value === 'srs') {
                  //   setPriorities(defaultPriorities);
                  // }
                }}
              >
                <MenuItem value="srs">Auto/SRS</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
                {/* Add more presets here if needed */}
              </Select>
            </FormControl>
          </Grid>

          {/* --- Individual Priority Selectors (adjust grid size) --- */}
          {[ { key: 'new', label: 'New' }, 
             { key: 'again', label: 'Again' }, 
             { key: 'hard', label: 'Hard' }, 
             { key: 'good', label: 'Good' }, 
             { key: 'easy', label: 'Easy' } ].map(cat => (
            <Grid item xs={6} sm={4} md={1.8} key={cat.key}>
              <FormControl fullWidth size="small">
                <InputLabel id={`${cat.key}-priority-label`}>{cat.label}</InputLabel>
                <Select
                  labelId={`${cat.key}-priority-label`}
                  id={`${cat.key}-priority-select`}
                  value={priorities[cat.key]}
                  label={cat.label}
                  // When changing individual priority, switch preset to Custom
                  onChange={(e) => {
                    handlePriorityChange(cat.key)(e);
                    if (priorityPreset !== 'custom') {
                      setPriorityPreset('custom');
                      console.log("Switched preset to Custom due to individual change");
                    }
                  }}
                  // Disable individual controls if preset is SRS
                  disabled={priorityPreset === 'srs'}
                >
                  {priorityLevels.map(level => (
                    <MenuItem key={level} value={level}>{level}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          ))}
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Left side - Flashcard Area (Adjust width based on showStats) */}
        <Grid item xs={12} md={showStats ? 7 : 12}>
          {/* === Conditional Rendering Start === */}
          {isLoading && apiStatus !== "disconnected" ? (
            // --- Loading State --- 
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', border: '1px solid #eee', borderRadius: '4px', p: 3 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>Loading flashcards...</Typography>
            </Box>
          ) : error ? (
            // --- Error State --- 
            <Box sx={{ textAlign: 'center', border: '1px solid #fcc', borderRadius: '4px', p: 3, backgroundColor: '#fff5f5' }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
              <Typography variant="body1" sx={{ mb: 3 }}>
                Make sure the backend server is running at {API.defaults.baseURL}
              </Typography>
              <Button variant="contained" onClick={() => {
                console.log("Retrying connection...");
                setError(null); // Clear error before retry
                setIsLoading(true);
                checkAPIConnectivity()
                  .then(isConnected => {
                    if (isConnected) {
                      fetchNextCard();
                    }
                  });
              }} sx={{ mt: 2 }}>
                Retry Connection
              </Button>
            </Box>
          ) : currentCard ? (
            // --- Render Flashcard --- 
            <Card sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: '#ffffff'
            }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h5" component="div">
                    {currentCard?.question}
                  </Typography>
                </Box>

                {/* Answer Buttons */}
                <Box sx={{ display: 'flex', flexDirection: 'column', mb: 2 }}>
                  {shuffledAnswers.map((answer) => {
                    const { style, variant } = getAnswerButtonStyle(answer);
                    return (
                      <Button
                        key={answer.id}
                        variant={variant}
                        onClick={() => handleAnswerSelect(answer.id)}
                        disabled={isSubmitted}
                        sx={{ 
                          ...style, 
                          py: { xs: 1.5, sm: 1.2 }, // More vertical padding on mobile
                          fontSize: '0.9rem' // Slightly adjust font size
                        }}
                        fullWidth
                      >
                        <Box sx={{ width: '100%', textAlign: 'left' }}>
                          {answer.text}
                        </Box>
                      </Button>
                    );
                  })}
                </Box>

                {/* Submit Button for Multi-Answer */}
                {isMultiAnswer && !isSubmitted && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleSubmitAnswers}
                      disabled={selectedAnswers.size === 0}
                      sx={{ px: 4 }} // Add padding to submit button
                    >
                      Check Answers
                    </Button>
                  </Box>
                )}

                {/* --- Explanation and Rating Buttons Area --- */}
                <Box sx={{ minHeight: '120px' /* Adjust height as needed */ }}>
                    {/* Explanation Text */}    
                    <Typography 
                        variant="body1" 
                        sx={{ 
                            mt: 3, mb: 2, p: 2, 
                            border: '1px solid #eee', borderRadius: '4px', backgroundColor: '#f9f9f9',
                            visibility: isSubmitted ? 'visible' : 'hidden', // Control visibility
                            minHeight: '50px' // Reserve space for explanation
                        }}
                    >
                        <strong>Explanation:</strong>{' '}
                        {/* Only render content when submitted to avoid brief flash */}
                        {isSubmitted ? currentCard.explanation.replace(/\s+([),.])/g, '$1') : ' '} 
                    </Typography>
                    
                    {/* Rating Buttons Box */} 
                    <Box 
                        sx={{
                          display: 'flex',
                          flexDirection: { xs: 'column', sm: 'row' }, // Stack vertically on extra-small screens
                          justifyContent: 'space-around',
                          alignItems: 'center', // Center items when stacked
                          mt: 3,
                          mb: 3,
                          visibility: isSubmitted ? 'visible' : 'hidden' // Control visibility
                        }}
                    >
                        {/* Render buttons only when visible to potentially save resources, visibility handles space */}
                        {isSubmitted && (
                          <>
                            {/* Button styles adjusted for responsiveness */}
                            {[ {label: 'Again', rating: 1, color: 'error.main', hoverColor: '#c62828'},
                               {label: 'Hard', rating: 2, color: 'warning.main', hoverColor: '#ef6c00'},
                               {label: 'Good', rating: 3, color: 'primary.main', hoverColor: '#1565c0'},
                               {label: 'Easy', rating: 4, color: 'success.main', hoverColor: '#2e7d32'} ].map((btn) => (
                              <Button
                                key={btn.rating}
                                variant="contained"
                                onClick={() => { console.log(`Rating Button Clicked: ${btn.label} (${btn.rating})`); handleRating(btn.rating); }}
                                sx={{
                                  backgroundColor: btn.color,
                                  '&:hover': { backgroundColor: btn.hoverColor },
                                  width: { xs: '80%', sm: 'auto' }, // Wider on mobile
                                  minWidth: { xs: 'unset', sm: '80px' }, // Allow natural width on larger screens
                                  mb: { xs: 1.5, sm: 0 }, // Add bottom margin when stacked
                                  py: 1.2, // Increase padding
                                }}
                              >
                                {btn.label}
                              </Button>
                            ))}
                          </>
                        )}
                    </Box>
                </Box>
                {/* --- End Explanation and Rating Buttons Area --- */}
              </CardContent>

              {/* Loading Indicator for Rating/Fetch (conditionally rendered) */}
              {isLoading && isSubmitted && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, alignItems: 'center', borderTop: '1px solid #eee' }}>
                  <CircularProgress size={24} sx={{ mr: 1 }} /> 
                  <Typography variant="caption">Updating stats & loading next...</Typography>
                </Box>
              )}
              
              {/* Display Stats at the very bottom */}
              {displayStats && (
                <Box sx={{ borderTop: '1px solid #eee', p: 0 }}>
                    <SrsStatsDisplay stats={displayStats} label={displayStatsLabel} />
                </Box>
              )}
            </Card>
          ) : (
            // --- No Cards Available State --- 
            <Box sx={{ textAlign: 'center', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px dashed #ccc', borderRadius: '4px', p: 3, backgroundColor: '#fafafa' }}>
              <Typography variant="h5" gutterBottom>
                {priorityPreset === 'srs' 
                  ? "Congratulations! No more cards are due right now based on the SRS schedule."
                  : "No cards match your current custom priority settings right now."
                }
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                You can check again later, adjust your custom priorities, or switch to the Auto/SRS preset.
              </Typography>
        
              <Button variant="contained" onClick={() => {
                  console.log("Checking for cards again...");
                  fetchNextCard();
                }} sx={{ mt: 2, mr: 1 }}>
                   Check Again
              </Button>
              {/* Add button to switch to SRS mode if not already in it */} 
              {priorityPreset !== 'srs' && (
                <Button variant="outlined" onClick={() => {
                    console.log("Switching preset to Auto/SRS and checking again...");
                    setPriorityPreset('srs');
                    fetchNextCard(); 
                  }} sx={{ mt: 2, ml: 1 }}>
                    Review Auto/SRS Cards
                </Button>
              )}
            </Box>
          )}
          {/* === Conditional Rendering End === */}
        </Grid>
        
        {/* Right side - Statistics Panel (Conditionally Rendered) */}
        {showStats && (
          <Grid item xs={12} md={5}>
            <UserStatsPanel 
              reviewHistory={reviewHistory} 
              totalCards={totalCardsCount}
              todaysReviewCount={todaysReviewCount} // <--- PASS PROP DOWN
              onResetHistory={handleResetReviewHistory}
              onResetStats={handleResetStatsOnly}
            />
          </Grid>
        )}
      </Grid>

    </Box>
  );
};

export default FlashcardReview;
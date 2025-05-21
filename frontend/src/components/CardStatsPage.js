import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Box, Grid, Typography, CircularProgress, Paper, Alert, Button, Tooltip, 
  LinearProgress, IconButton, TextField, MenuItem, Select, FormControl, 
  InputLabel, Checkbox, FormControlLabel, InputAdornment, Chip, Stack,
  Divider
} from '@mui/material';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';

// Helper to format dates consistently
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = parseISO(dateString);
    const distance = formatDistanceToNow(date, { addSuffix: true });
    const absoluteDate = format(date, 'dd/MM/yyyy'); // Simplified date format for list
    return `${distance} (${absoluteDate})`;
  } catch (e) {
    return 'Invalid date';
  }
};

// --- SRS Stats Display Component --- Extracted from FlashcardReview.js
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

function CardStatsPage() {
  const { API, user } = useAuth();
  const [reviewedCards, setReviewedCards] = useState([]);
  const [selectedCardDetails, setSelectedCardDetails] = useState(null); // To hold full details for right panel
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    showSuspended: true,
    showActive: true,
    minReviews: 0,
    maxReviews: 999,
  });
  const [sortOption, setSortOption] = useState('last_review_desc');
  
  // Batch operations
  const [selectedCards, setSelectedCards] = useState(new Set());
  const [batchMode, setBatchMode] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return; // Wait for user context

    const fetchReviewedCards = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Fetching reviewed card summaries...");
        const response = await API.get('/users/me/reviewed-cards/');
        console.log("Received reviewed cards:", response.data);
        setReviewedCards(response.data || []);
      } catch (err) {
        console.error("Error fetching reviewed cards:", err);
        setError("Failed to load reviewed card statistics. Please try again later.");
      }
      setLoading(false);
    };

    fetchReviewedCards();
  }, [API, user]);

  // Handle suspending/unsuspending a card
  const handleSuspendToggle = async (cardId) => {
    if (!selectedCardDetails) return;
    
    setActionLoading(true);
    try {
      console.log(`Toggling suspend status for card ${cardId}`);
      const response = await API.post(`/cards/${cardId}/suspend`);
      console.log("Suspend toggle successful", response.data);
      
      // Update selected card details
      setSelectedCardDetails(prev => ({
        ...prev,
        is_suspended: response.data.is_suspended
      }));
      
      // Update card in the list
      setReviewedCards(prev => 
        prev.map(card => 
          card.card_id === cardId 
            ? { ...card, is_suspended: response.data.is_suspended }
            : card
        )
      );
    } catch (err) {
      console.error('Error toggling suspend status:', err);
      setError("Failed to update card suspension status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Batch unsuspend cards
  const handleBatchUnsuspend = async () => {
    if (selectedCards.size === 0) return;
    
    setBatchActionLoading(true);
    setError(null);
    
    try {
      console.log(`Batch unsuspending ${selectedCards.size} cards`);
      
      // Create an array of promises for each card to unsuspend
      const unsuspendPromises = Array.from(selectedCards).map(async (cardId) => {
        const card = reviewedCards.find(c => c.card_id === cardId);
        
        // Only process cards that are currently suspended
        if (card && card.is_suspended) {
          try {
            const response = await API.post(`/cards/${cardId}/suspend`);
            return { cardId, success: true, is_suspended: response.data.is_suspended };
          } catch (err) {
            console.error(`Error unsuspending card ${cardId}:`, err);
            return { cardId, success: false, error: err };
          }
        }
        return { cardId, success: true, skipped: true }; // Card wasn't suspended, skip it
      });
      
      // Wait for all promises to resolve
      const results = await Promise.all(unsuspendPromises);
      console.log("Batch unsuspend results:", results);
      
      // Count successful operations
      const successCount = results.filter(r => r.success && !r.skipped).length;
      const skippedCount = results.filter(r => r.skipped).length;
      const failureCount = results.filter(r => !r.success).length;
      
      // Update the reviewedCards state with the updated suspension statuses
      setReviewedCards(prev => {
        return prev.map(card => {
          const result = results.find(r => r.cardId === card.card_id);
          if (result && result.success && !result.skipped) {
            return { ...card, is_suspended: false };
          }
          return card;
        });
      });
      
      // If the currently selected card was in the batch, update its detail view
      if (selectedCardDetails && selectedCards.has(selectedCardDetails.card_id)) {
        setSelectedCardDetails(prev => ({
          ...prev,
          is_suspended: false
        }));
      }
      
      // Clear selections
      setSelectedCards(new Set());
      
      // Show success feedback (we'll use the error state with a success severity)
      setError(`Successfully unsuspended ${successCount} cards. ${skippedCount ? `${skippedCount} cards were already active.` : ''} ${failureCount ? `Failed to unsuspend ${failureCount} cards.` : ''}`);
      
    } catch (err) {
      console.error('Error in batch unsuspend operation:', err);
      setError("Failed to complete the batch unsuspend operation.");
    } finally {
      setBatchActionLoading(false);
      // Optionally exit batch mode after completion
      setBatchMode(false);
    }
  };

  // Handle card selection for batch operations
  const handleCardCheckbox = (cardId) => {
    setSelectedCards(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(cardId)) {
        newSelected.delete(cardId);
      } else {
        newSelected.add(cardId);
      }
      return newSelected;
    });
  };

  // Toggle all suspended cards for batch operations
  const handleSelectAllSuspended = () => {
    const suspendedCardIds = filteredAndSortedCards
      .filter(card => card.is_suspended)
      .map(card => card.card_id);
    
    if (suspendedCardIds.length === 0) return;
    
    // If all suspended cards are already selected, clear the selection
    const allSuspendedSelected = suspendedCardIds.every(id => selectedCards.has(id));
    
    if (allSuspendedSelected) {
      // Remove all suspended cards from selection
      setSelectedCards(prev => {
        const newSelected = new Set(prev);
        suspendedCardIds.forEach(id => newSelected.delete(id));
        return newSelected;
      });
    } else {
      // Add all suspended cards to selection
      setSelectedCards(prev => {
        const newSelected = new Set(prev);
        suspendedCardIds.forEach(id => newSelected.add(id));
        return newSelected;
      });
    }
  };

  // Handle card selection
  const handleCardSelect = (cardSummary) => {
    if (batchMode) {
      handleCardCheckbox(cardSummary.card_id);
    } else {
    console.log("Card selected:", cardSummary);
    setSelectedCardDetails(cardSummary);
    }
  };

  // Filter and sort cards based on current settings
  const filteredAndSortedCards = useMemo(() => {
    return reviewedCards
      .filter(card => {
        // Text search filter
        const matchesSearch = searchQuery === '' || 
          card.question.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Suspension status filter
        const matchesSuspension = 
          (card.is_suspended && filterOptions.showSuspended) || 
          (!card.is_suspended && filterOptions.showActive);
        
        // Review count filter
        const reviewCount = card.review_count || 0;
        const matchesReviewCount = 
          reviewCount >= filterOptions.minReviews &&
          reviewCount <= filterOptions.maxReviews;
        
        return matchesSearch && matchesSuspension && matchesReviewCount;
      })
      .sort((a, b) => {
        // Handle sorting based on the selected option
        switch (sortOption) {
          case 'last_review_desc':
            // Sort by last review date (most recent first)
            if (!a.last_review) return 1;
            if (!b.last_review) return -1;
            return new Date(b.last_review) - new Date(a.last_review);
          
          case 'last_review_asc':
            // Sort by last review date (oldest first)
            if (!a.last_review) return 1;
            if (!b.last_review) return -1;
            return new Date(a.last_review) - new Date(b.last_review);
          
          case 'next_review_asc':
            // Sort by next review date (soonest first)
            if (!a.next_review) return 1;
            if (!b.next_review) return -1;
            return new Date(a.next_review) - new Date(b.next_review);
          
          case 'reviews_desc':
            // Sort by number of reviews (highest first)
            return (b.review_count || 0) - (a.review_count || 0);
          
          case 'reviews_asc':
            // Sort by number of reviews (lowest first)
            return (a.review_count || 0) - (b.review_count || 0);
          
          case 'alphabetical':
            // Sort alphabetically by question
            return a.question.localeCompare(b.question);
          
          default:
            return 0;
        }
      });
  }, [reviewedCards, searchQuery, filterOptions, sortOption]);

  // Count the number of suspended cards in the filtered list
  const suspendedCount = useMemo(() => {
    return filteredAndSortedCards.filter(card => card.is_suspended).length;
  }, [filteredAndSortedCards]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading card statistics...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, mt: 3 }}>
      <Typography variant="h4" gutterBottom>Card Browser & Statistics</Typography>
      
      {error && (
        <Alert 
          severity={error.includes("Successfully") ? "success" : "error"} 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Left Column: Card List with Filters */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            {/* Top controls for search, filter, sort, and batch mode */}
            <Box sx={{ mb: 2 }}>
              {/* Search */}
              <TextField
                fullWidth
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                {/* Filter dropdown */}
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel id="filter-label">Filter</InputLabel>
                  <Select
                    labelId="filter-label"
                    value="default"
                    label="Filter"
                    onChange={(e) => {
                      if (e.target.value === "suspended") {
                        setFilterOptions({
                          ...filterOptions,
                          showSuspended: true,
                          showActive: false
                        });
                      } else if (e.target.value === "active") {
                        setFilterOptions({
                          ...filterOptions,
                          showSuspended: false,
                          showActive: true
                        });
                      } else {
                        setFilterOptions({
                          ...filterOptions,
                          showSuspended: true,
                          showActive: true
                        });
                      }
                    }}
                    startAdornment={
                      <InputAdornment position="start">
                        <FilterListIcon fontSize="small" />
                      </InputAdornment>
                    }
                  >
                    <MenuItem value="default">All Cards</MenuItem>
                    <MenuItem value="suspended">Suspended Only</MenuItem>
                    <MenuItem value="active">Active Only</MenuItem>
                  </Select>
                </FormControl>
                
                {/* Sort dropdown */}
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="sort-label">Sort By</InputLabel>
                  <Select
                    labelId="sort-label"
                    value={sortOption}
                    label="Sort By"
                    onChange={(e) => setSortOption(e.target.value)}
                    startAdornment={
                      <InputAdornment position="start">
                        <SortIcon fontSize="small" />
                      </InputAdornment>
                    }
                  >
                    <MenuItem value="last_review_desc">Latest Review</MenuItem>
                    <MenuItem value="last_review_asc">Oldest Review</MenuItem>
                    <MenuItem value="next_review_asc">Due Date (Soonest)</MenuItem>
                    <MenuItem value="reviews_desc">Most Reviews</MenuItem>
                    <MenuItem value="reviews_asc">Least Reviews</MenuItem>
                    <MenuItem value="alphabetical">Alphabetical</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              {/* Batch mode toggle and actions */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox 
                      checked={batchMode}
                      onChange={(e) => {
                        setBatchMode(e.target.checked);
                        // Clear selections when exiting batch mode
                        if (!e.target.checked) {
                          setSelectedCards(new Set());
                        }
                      }}
                    />
                  }
                  label="Batch Selection Mode"
                />
                
                {batchMode && (
            <Box>
                    <Button 
                      size="small" 
                      onClick={handleSelectAllSuspended}
                      disabled={suspendedCount === 0}
                    >
                      Select All Suspended
                    </Button>
                    <Button 
                      size="small" 
                      variant="contained" 
                      color="primary" 
                      onClick={handleBatchUnsuspend}
                      disabled={selectedCards.size === 0 || batchActionLoading}
                      sx={{ ml: 1 }}
                    >
                      {batchActionLoading ? "Processing..." : "Unsuspend Selected"}
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
            
            {/* Stats chips */}
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1}>
                <Chip 
                  label={`Total: ${filteredAndSortedCards.length}`} 
                  variant="outlined" 
                  color="primary"
                />
                <Chip 
                  label={`Suspended: ${suspendedCount}`} 
                  variant="outlined" 
                  color={suspendedCount > 0 ? "warning" : "default"}
                  icon={<VisibilityOffIcon />}
                />
                <Chip 
                  label={`Active: ${filteredAndSortedCards.length - suspendedCount}`} 
                  variant="outlined" 
                  color="success"
                />
              </Stack>
            </Box>
            
            <Divider sx={{ my: 1 }} />
            
            {/* Cards list */}
            <Box sx={{ maxHeight: '65vh', overflow: 'auto' }}>
              {filteredAndSortedCards.length === 0 && (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                  No cards match your filters.
                </Typography>
              )}
              
              {filteredAndSortedCards.map((card) => (
                <Paper 
                  key={card.card_id} 
                  elevation={1} 
                  sx={{ 
                    p: 1.5, 
                    mb: 1, 
                    cursor: 'pointer', 
                    '&:hover': { backgroundColor: 'action.hover' },
                    backgroundColor: (batchMode && selectedCards.has(card.card_id)) || 
                                    (!batchMode && selectedCardDetails?.card_id === card.card_id) 
                                    ? 'action.selected' : 'inherit',
                    // Add visual indication for suspended cards
                    opacity: card.is_suspended ? 0.7 : 1,
                    borderLeft: card.is_suspended ? '3px solid #757575' : 'none'
                  }}
                  onClick={() => handleCardSelect(card)} 
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {batchMode && (
                      <Checkbox 
                        checked={selectedCards.has(card.card_id)}
                        onChange={() => handleCardCheckbox(card.card_id)}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                      />
                    )}
                    
                    <Typography 
                      variant="body1" 
                      noWrap 
                      title={card.question} 
                      sx={{ 
                        maxWidth: batchMode ? '75%' : '85%',
                        textDecoration: card.is_suspended ? 'line-through' : 'none',
                        flexGrow: 1
                      }}
                    >
                    {card.question}
                  </Typography>
                    
                    {card.is_suspended && (
                      <Tooltip title="Card is suspended">
                        <VisibilityOffIcon fontSize="small" color="action" />
                      </Tooltip>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Next Review: {formatDate(card.next_review)} | Reviews: {card.review_count ?? 0}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Card Details */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, minHeight: '75vh' }}>
            <Typography variant="h6" gutterBottom>Card Details</Typography>
            {selectedCardDetails ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h5" sx={{ 
                    maxWidth: '85%',
                    textDecoration: selectedCardDetails.is_suspended ? 'line-through' : 'none',
                    opacity: selectedCardDetails.is_suspended ? 0.8 : 1
                  }}>
                    {selectedCardDetails.question}
                  </Typography>
                  
                  {/* Suspension toggle button */}
                  <Tooltip title={selectedCardDetails.is_suspended ? "Unsuspend Card" : "Suspend Card"}>
                    <IconButton 
                      onClick={() => handleSuspendToggle(selectedCardDetails.card_id)} 
                      disabled={actionLoading}
                      size="small"
                    >
                      {selectedCardDetails.is_suspended ? 
                        <VisibilityIcon color="action" /> : 
                        <VisibilityOffIcon color="action" />
                      }
                    </IconButton>
                  </Tooltip>
                </Box>
                
                {/* Suspension status indicator */}
                {selectedCardDetails.is_suspended && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    This card is currently suspended and won't appear in reviews.
                  </Alert>
                )}
                
                {/* TODO: Add display for Answers and Explanation here (requires fetching full card data) */} 
                
                {/* Card Statistics using the SrsStatsDisplay component */}
                <SrsStatsDisplay stats={selectedCardDetails} label="Current Statistics" />
                
                <Typography variant="subtitle1" sx={{ mt: 4, fontStyle: 'italic' }} color="text.secondary">
                  Detailed answer information will be added in a future update.
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ mt: 4, textAlign: 'center', color: 'text.secondary' }}>
                {batchMode 
                  ? "Batch mode active. Select cards to perform actions on multiple cards at once." 
                  : "Select a card from the list to view its details."}
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default CardStatsPage; 
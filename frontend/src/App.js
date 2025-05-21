import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

// Import Components & Context
import FlashcardReview from './components/FlashcardReview';
import AuthPage from './components/AuthPage';
import CardStatsPage from './components/CardStatsPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

// UK flag themed colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#012169', // UK flag blue
      light: '#303F9F',
      dark: '#000051',
    },
    secondary: {
      main: '#C8102E', // UK flag red
      light: '#FF5252',
      dark: '#8E0000',
    },
    success: {
      main: '#388e3c', // Green for "Easy" ratings
    },
    warning: {
      main: '#f57c00', // Orange for "Hard" ratings
    },
    error: {
      main: '#d32f2f', // Red for "Again" ratings
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)',
          borderRadius: '8px',
        },
      },
    },
  },
});

// Updated Protected Route Component
const ProtectedRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();
  
  console.log("ProtectedRoute - Auth State:", { isAuthenticated, loading, hasUser: !!user });
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Check both isAuthenticated flag AND presence of user data
  // This provides a more reliable authentication check
  if (!isAuthenticated && !user) {
    console.log("ProtectedRoute - Not authenticated, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  console.log("ProtectedRoute - Authentication successful, rendering protected content");
  return <Outlet />;
};

// Updated App Bar
const AppHeader = () => {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const iconPath = `${process.env.PUBLIC_URL}/logo192.png`;

  console.log("AppHeader - Auth State:", { isAuthenticated, loading, user: user?.email });

  if (loading) {
    return (
       <AppBar position="static" sx={{ bgcolor: '#012169' }}>
         <Toolbar>
           <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
             <img src={iconPath} alt="App Icon" width="32" height="32" style={{ marginRight: '8px' }} />
           </Box>
           <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
             Memorable Active Repetition Cards for Intelligent Navigation
           </Typography>
           <CircularProgress color="inherit" size={24} />
         </Toolbar>
       </AppBar>
    );
  }

  return (
    <AppBar position="static" sx={{ bgcolor: '#012169' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
          <img src={iconPath} alt="App Icon" width="32" height="32" />
        </Box>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>Memorable Active Repetition Cards for Intelligent Navigation</Link>
        </Typography>
        
        {isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button color="inherit" component={Link} to="/stats" sx={{ mr: 2 }}>Card Stats</Button>
            <Typography variant="body2" sx={{ mr: 2 }}>Logged in as: {user?.email}</Typography>
            <Button color="inherit" onClick={logout}>Logout</Button>
          </Box>
        ) : (
          <Button color="inherit" component={Link} to="/auth">Sign In</Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

// Main App Structure
function AppContent() {
  return (
    <>
      <AppHeader />
      <Container component="main" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<FlashcardReview />} />
            <Route path="/app" element={<FlashcardReview />} />
            <Route path="/stats" element={<CardStatsPage />} />
          </Route>
          
          {/* Fallback */}
           <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </>
  );
}

// App Wrapper with Providers
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App; 
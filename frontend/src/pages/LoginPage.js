import React from 'react';
import { Button, Container, Typography, Box, Paper } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../context/AuthContext'; // Assuming useAuth provides API base URL

const LoginPage = () => {
  const { API } = useAuth(); // Get API base URL for constructing the link

  const handleGoogleLogin = () => {
    // Construct the full URL to the backend login endpoint
    const googleLoginUrl = `${API.defaults.baseURL}/auth/google/login`;
    console.log('Redirecting to Google Login:', googleLoginUrl);
    // Redirect the browser to the backend endpoint
    window.location.href = googleLoginUrl;
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 4 }}>
        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
          Sign In
        </Typography>
        <Box sx={{ width: '100%', mt: 1 }}>
          {/* Add traditional email/password form here eventually if needed */}
          
          <Button
            type="button"
            fullWidth
            variant="contained"
            color="primary"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            sx={{ mt: 2, mb: 2, backgroundColor: '#4285F4', '&:hover': { backgroundColor: '#357ae8' } }}
          >
            Sign in with Google
          </Button>
          {/* Add Sign Up link or other options here */}
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginPage; 
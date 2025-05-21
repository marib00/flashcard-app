import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';

const AuthCallbackPage = () => {
  const { loginWithToken } = useAuth(); // We don't need isAuthenticated for the callback process
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const tokenType = params.get('token_type'); // Usually 'bearer'
    const authError = params.get('error'); // Check if backend redirected with an error

    console.log("Auth Callback - Token:", token ? `${token.substring(0, 10)}...` : 'null',
               "Type:", tokenType,
               "Error:", authError);

    if (authError) {
      setError(`Login failed: ${authError}`);
      console.error("Auth Callback - Error from OAuth provider:", authError);
      // Optional: redirect to login page after delay
      // setTimeout(() => navigate('/login'), 5000);
    } else if (token && tokenType === 'bearer') {
      try {
        console.log("Auth Callback - About to call loginWithToken");
        loginWithToken(token) // Call the specific function for token login
          .then(userData => {
            console.log('Auth Callback - Login successful:', userData);
            // Add a small delay before navigation to allow AuthContext state to update
            setTimeout(() => {
              navigate('/');
            }, 500); // 500ms should be enough for React to update state
          })
          .catch(error => {
            console.error("Auth Callback - loginWithToken promise rejected:", error);
            setError(`Login failed: ${error.message}`);
          });
      } catch (e) {
          console.error("Auth Callback - Error during login process:", e);
          setError('An unexpected error occurred during login.');
      }
    } else {
      // Handle cases where token is missing or type is wrong
      console.error("Auth Callback - Invalid token or token type:", { token: !!token, tokenType });
      setError('Invalid authentication response received.');
      // Optional: redirect to login page
      // setTimeout(() => navigate('/login'), 5000);
    }
  }, [location, loginWithToken, navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <CircularProgress />
      )}
      <Typography sx={{ mt: 2 }}>Processing authentication...</Typography>
    </Box>
  );
};

export default AuthCallbackPage; 
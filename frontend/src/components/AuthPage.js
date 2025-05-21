import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TextField, 
  Button, 
  Container, 
  Typography, 
  Box, 
  Alert, 
  Checkbox, 
  FormControlLabel,
  CircularProgress
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useFormik } from 'formik';
import * as Yup from 'yup';

function AuthPage() {
  const navigate = useNavigate();
  const { login, register, user, loading: authLoading } = useAuth();
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  // Email validation regex - simple version
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Form validation schema - dynamically add confirmPassword field if isNewUser
  const validationSchema = Yup.object({
    email: Yup.string()
      .required('Email is required')
      .matches(emailRegex, 'Invalid email format'),
    password: Yup.string()
      .required('Password is required')
      .min(6, 'Password must be at least 6 characters'),
    ...(isNewUser && {
      confirmPassword: Yup.string()
        .required('Please confirm your password')
        .oneOf([Yup.ref('password')], 'Passwords must match')
    }),
    rememberMe: Yup.boolean()
  });

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      rememberMe: false
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setError('');
      setIsSubmitting(true);
      
      try {
        if (isNewUser) {
          // Register and auto-login
          await register(values.email, values.password, values.rememberMe);
        } else {
          // Just login
          await login(values.email, values.password, values.rememberMe);
        }
        navigate('/app');
      } catch (err) {
        console.error("Authentication failed:", err);
        setError(err.message || 'Authentication failed. Please check your credentials.');
      } finally {
        setIsSubmitting(false);
      }
    }
  });

  // When user clicks on email field, check if it exists
  const handleEmailBlur = async (e) => {
    // Only run validation if we have a valid email
    const email = formik.values.email;
    if (!email || !emailRegex.test(email)) {
      formik.setFieldTouched('email', true);
      return;
    }

    try {
      // Try to check if the email exists - this requires a backend endpoint
      const response = await fetch(`/auth/check-email?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      // If the email doesn't exist, show registration fields
      setIsNewUser(!data.exists);
      
    } catch (error) {
      // If there's an error or the endpoint doesn't exist, just continue with normal flow
      console.error("Email check failed:", error);
    }
    
    // Make sure Formik knows the field was touched
    formik.setFieldTouched('email', true);
  };

  // If we don't have the email check endpoint, we can use this to toggle registration mode manually
  const handleModeToggle = () => {
    setIsNewUser(!isNewUser);
    formik.setErrors({});
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h5">
          {isNewUser ? 'Create an Account' : 'Sign In'}
        </Typography>
        <Box component="form" onSubmit={formik.handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={handleEmailBlur}
            error={formik.touched.email && Boolean(formik.errors.email)}
            helperText={formik.touched.email && formik.errors.email}
            disabled={isSubmitting || authLoading}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete={isNewUser ? 'new-password' : 'current-password'}
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.password && Boolean(formik.errors.password)}
            helperText={formik.touched.password && formik.errors.password}
            disabled={isSubmitting || authLoading}
          />
          
          {isNewUser && (
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
              helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
              disabled={isSubmitting || authLoading}
            />
          )}
          
          <FormControlLabel
            control={
              <Checkbox 
                name="rememberMe"
                color="primary" 
                checked={formik.values.rememberMe} 
                onChange={formik.handleChange} 
                disabled={isSubmitting || authLoading}
              />
            }
            label="Remember me"
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isSubmitting || authLoading || (isNewUser && !formik.isValid)}
          >
            {isSubmitting || authLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              isNewUser ? 'Create Account' : 'Sign In'
            )}
          </Button>
          
          <Box textAlign="center">
            <Button 
              variant="text" 
              onClick={handleModeToggle}
              disabled={isSubmitting || authLoading}
            >
              {isNewUser 
                ? "Already have an account? Sign in" 
                : "Don't have an account? Create one"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

export default AuthPage; 
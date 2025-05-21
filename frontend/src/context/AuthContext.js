import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios'; // Use axios directly here for auth calls
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode
import { useNavigate } from 'react-router-dom';

// --- Config Values ---
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Read initial token directly
  const initialToken = localStorage.getItem('token') || sessionStorage.getItem('token');
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); 
  const [authError, setAuthError] = useState(null);
  const navigate = useNavigate();

  // --- Logout Function --- 
  // Define logout early so it can be used in interceptors and useEffect
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    // Optional: navigate to login. Handled by ProtectedRoute currently.
    // navigate('/login'); 
  }, []); // No dependencies needed

  // --- API Instance --- 
  const API = useMemo(() => {
    console.log("AuthContext - Creating/updating API instance, current token:", token ? "exists" : "null");
    const instance = axios.create({
      baseURL: BASE_URL,
    });

    // Request interceptor (injects current token)
    instance.interceptors.request.use(
      (config) => {
        // Read token directly from state for requests
        const currentToken = token; 
        if (currentToken) {
          console.log("API Request - Adding token to header");
          config.headers['Authorization'] = `Bearer ${currentToken}`;
        } else {
          console.log("API Request - No token available");
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor (handles 401 errors)
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
          if (error.response && error.response.status === 401) {
              console.warn("Auth token invalid or expired, logging out.");
              // Call the logout function defined above
              logout(); 
          }
          return Promise.reject(error);
      }
    );
    return instance;
  // Depend only on BASE_URL and logout. Token is read dynamically in interceptor.
  }, [BASE_URL, logout, token]); // Add token here to ensure interceptor gets updated

  // --- Initialization Effect (Runs ONCE on mount) ---
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      // Use the initialToken read at the start
      if (initialToken) { 
        try {
          const decoded = jwtDecode(initialToken);
          const currentTime = Date.now() / 1000;

          if (decoded.exp > currentTime) {
            // Token is valid and not expired
            // Set the token state (important for API instance interceptor)
            setToken(initialToken); 
            
            // Fetch user data using the initial token directly in headers
            // This avoids relying on the potentially not-yet-updated API instance
            const response = await axios.get(`${BASE_URL}/users/me`, {
              headers: { Authorization: `Bearer ${initialToken}` }
            });
            setUser(response.data);
            console.log("Auth Initialized: Valid token found, user set.");
          } else {
            // Token expired
            console.log("Auth Initialized: Token expired.");
            logout(); // Clear expired token
          }
        } catch (error) {
          // Invalid token format or other error during decoding/fetch
          console.error("Auth Initialized: Error validating token or fetching user:", error);
          logout(); // Clear invalid token
        }
      } else {
        // No token found
        console.log("Auth Initialized: No token found.");
        setUser(null); // Ensure user is null
        setToken(null); // Ensure token state is also null
      }
      setLoading(false);
    };

    initializeAuth();
  // Run only once on mount, dependencies are static or stable refs
  }, [logout]); 

  // --- Login Function (Email/Password) --- // Renamed
  const loginWithPassword = useCallback(async (email, password, rememberMe = false) => {
    setLoading(true);
    setAuthError(null);
    let newToken = null; // Define newToken outside try block
    try {
      const response = await API.post('/auth/login', new URLSearchParams({
          username: email, 
          password: password
      }), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      newToken = response.data.access_token;
      
      // Store token based on rememberMe flag BEFORE setting state
      if (rememberMe) {
        localStorage.setItem('token', newToken);
        sessionStorage.removeItem('token'); 
      } else {
        sessionStorage.setItem('token', newToken);
        localStorage.removeItem('token');
      }

      // Set token state AFTER storing it
      setToken(newToken);
      
      // Fetch user data using the new token EXPLICITLY in headers for this call
      const userResponse = await API.get('/users/me', {
        headers: { Authorization: `Bearer ${newToken}` }
      }); 
      setUser(userResponse.data);
      console.log("Login successful, user set.");
      return userResponse.data; 

    } catch (error) {
      console.error("Login error:", error);
      const errorMsg = error.response?.data?.detail || "Login failed. Invalid credentials.";
      setAuthError(errorMsg);
      logout(); // Logout on login failure to clear any partial state
      throw new Error(errorMsg); 
    } finally {
      setLoading(false);
    }
  }, [API, logout]); // Depend on API and logout
  
  // --- Login Function (OAuth Token Callback) --- // Added New Function
  const loginWithToken = useCallback(async (receivedToken, rememberMe = true) => {
    setLoading(true);
    setAuthError(null);
    console.log("AuthContext.loginWithToken - Started with token:", receivedToken ? `${receivedToken.substring(0, 10)}...` : 'null');
    try {
      // Validate token structure (basic check)
      if (!receivedToken || typeof receivedToken !== 'string') {
        console.error("AuthContext.loginWithToken - Invalid token format:", receivedToken);
        throw new Error("Invalid token received");
      }
      
      console.log("AuthContext.loginWithToken - Storing token in", rememberMe ? "localStorage" : "sessionStorage");
      // Store token (assuming 'rememberMe' behavior for OAuth)
      if (rememberMe) {
        localStorage.setItem('token', receivedToken);
        sessionStorage.removeItem('token'); 
      } else {
        sessionStorage.setItem('token', receivedToken);
        localStorage.removeItem('token');
      }
      
      // Set token state AFTER storing it
      setToken(receivedToken);
      console.log("AuthContext.loginWithToken - Token state updated, fetching user data");
      
      // Use the receivedToken directly in the API call instead of relying on state update
      const userResponse = await axios.get(`${BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${receivedToken}` }
      });
      console.log("AuthContext.loginWithToken - User data fetched:", userResponse.data);
      setUser(userResponse.data);
      console.log("AuthContext.loginWithToken - User state updated, isAuthenticated should now be true");
      
      return userResponse.data;
      
    } catch (error) {
      console.error("AuthContext.loginWithToken - Error details:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail || error.message || "OAuth login failed.";
      setAuthError(errorMsg);
      logout(); // Logout on failure
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [logout]); // Remove API dependency since we're using axios directly

  // --- Register Function --- (Modified to use loginWithPassword)
  const register = useCallback(async (email, password, rememberMe = false) => {
    setLoading(true);
    setAuthError(null);
    try {
      const userData = { email, password }; // Only email and password
      // Register the user
      await API.post('/auth/register', userData);
      
      // Automatically login after successful registration
      return await loginWithPassword(email, password, rememberMe); // Use renamed function
    } catch (error) {
      console.error("Registration error:", error);
      const errorMsg = error.response?.data?.detail || "Registration failed.";
      setAuthError(errorMsg);
      throw new Error(errorMsg); // Re-throw for component handling
    } finally {
      setLoading(false);
    }
  }, [API, loginWithPassword]); // Updated dependency

  // --- Context Value --- 
  const value = useMemo(
    () => ({
      token, // Provide the current token state
      user,
      isAuthenticated: !!token && !!user, // More robust check
      loading,
      authError,
      login: loginWithPassword, // Default login is password-based
      loginWithToken, // Provide the new function
      logout,
      register,
      API // Provide the configured API instance
    }),
    [token, user, loading, authError, loginWithPassword, loginWithToken, logout, register, API] // Updated dependencies
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
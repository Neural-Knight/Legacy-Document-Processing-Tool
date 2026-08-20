import axios, { AxiosError } from 'axios';
import { User, LoginCredentials, RegisterCredentials, AuthTokens } from '../types/auth';

// Define the structure of API error responses
interface ApiErrorResponse {
  detail?: string;
  message?: string;
  error?: string;
  [key: string]: any; // Allow for any other properties
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

// Access token storage key
const ACCESS_TOKEN_KEY = 'access_token';
// Refresh token storage key
const REFRESH_TOKEN_KEY = 'refresh_token';
// Expiration time storage key
const TOKEN_EXPIRY_KEY = 'token_expiry';
// User data storage key
const USER_DATA_KEY = 'user_data';

// Configure axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Export the api instance for use in other services
export const authApi = api;

// Add request interceptor to include token in API requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 Unauthorized and not a retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if we have a refresh token
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          originalRequest._retry = true;
          
          // Try to refresh the token
          const response = await axios.post<AuthTokens>(`${API_URL}/auth/refresh-token`, {
            refresh_token: refreshToken
          });
          
          // Save new tokens
          const { access_token, refresh_token, expires_in } = response.data;
          setAuthTokens(access_token, refresh_token, expires_in);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return axios(originalRequest);
        } catch (refreshError) {
          // If token refresh fails, log out user
          console.error('Token refresh failed:', refreshError);
          logout();
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token available, log out user
        logout();
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Handle API errors consistently
 */
const handleApiError = (error: unknown, defaultMessage: string): never => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  if (axiosError.response?.data) {
    throw new Error(
      axiosError.response.data.detail || 
      axiosError.response.data.message || 
      axiosError.response.data.error || 
      defaultMessage
    );
  }
  throw new Error(defaultMessage);
};

/**
 * Register a new user
 */
export const register = async (credentials: RegisterCredentials): Promise<User> => {
  try {
    const response = await api.post<User>('/auth/register', credentials);
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to register user');
    throw new Error('Failed to register user'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Login user with credentials
 */
export const login = async (credentials: LoginCredentials): Promise<User> => {
  try {
    const response = await api.post<AuthTokens>('/auth/login', credentials);
    const { access_token, refresh_token, expires_in } = response.data;
    
    // Store tokens
    setAuthTokens(access_token, refresh_token, expires_in);
    
    // Get user profile
    const user = await getUserProfile();
    
    // Store user data
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    
    return user;
  } catch (error) {
    handleApiError(error, 'Failed to login');
    throw new Error('Failed to login'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Get current user profile
 */
export const getUserProfile = async (): Promise<User> => {
  try {
    const response = await api.get<User>('/auth/me');
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to get user profile');
    throw new Error('Failed to get user profile'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userData: Partial<User>): Promise<User> => {
  try {
    const response = await api.put<User>('/auth/me', userData);
    
    // Update stored user data
    const updatedUser = response.data;
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
    
    return updatedUser;
  } catch (error) {
    handleApiError(error, 'Failed to update profile');
    throw new Error('Failed to update profile'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Change user password
 */
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  try {
    await api.put('/auth/me', {
      password: newPassword,
      current_password: currentPassword
    });
  } catch (error) {
    handleApiError(error, 'Failed to change password');
    throw new Error('Failed to change password'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Attempt to revoke the refresh token on the server
      await api.post('/auth/logout', { refresh_token: refreshToken });
    }
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    // Clear all auth data from localStorage
    clearAuthData();
  }
};

/**
 * Logout from all devices
 */
export const logoutAllDevices = async (): Promise<void> => {
  try {
    await api.post('/auth/logout-all-devices');
    // Clear local auth data
    clearAuthData();
  } catch (error) {
    handleApiError(error, 'Failed to logout from all devices');
    throw new Error('Failed to logout from all devices'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Refresh authentication token
 */
export const refreshAuthToken = async (): Promise<AuthTokens> => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await axios.post<AuthTokens>(`${API_URL}/auth/refresh-token`, {
      refresh_token: refreshToken
    });
    
    const { access_token, refresh_token, expires_in } = response.data;
    setAuthTokens(access_token, refresh_token, expires_in);
    
    return response.data;
  } catch (error) {
    // On refresh failure, logout user
    clearAuthData();
    handleApiError(error, 'Token refresh failed');
    throw new Error('Token refresh failed'); // This line is never reached but satisfies TypeScript
  }
};

// HELPER FUNCTIONS

/**
 * Store authentication tokens in localStorage
 */
const setAuthTokens = (accessToken: string, refreshToken: string, expiresIn: number): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  
  // Calculate expiry time from expiresIn (in seconds)
  const expiryTime = Date.now() + (expiresIn * 1000);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
};

/**
 * Get access token from localStorage
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

/**
 * Get refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Check if access token is expired
 */
export const isTokenExpired = (): boolean => {
  const expiryTime = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryTime) return true;
  
  return Date.now() > parseInt(expiryTime, 10);
};

/**
 * Clear all authentication data from localStorage
 */
export const clearAuthData = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(USER_DATA_KEY);
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  const token = getAccessToken();
  return !!token && !isTokenExpired();
};

/**
 * Get stored user data
 */
export const getStoredUser = (): User | null => {
  const userData = localStorage.getItem(USER_DATA_KEY);
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }
  return null;
};
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  login as apiLogin, 
  register as apiRegister,
  logout as apiLogout,
  getUserProfile,
  updateUserProfile,
  changePassword as apiChangePassword,
  logoutAllDevices as apiLogoutAllDevices,
  isAuthenticated,
  getStoredUser,
  isTokenExpired,
  refreshAuthToken
} from '../services/authService';
import { User, LoginCredentials, RegisterCredentials, AuthContextType } from '../types/auth';

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  updateProfile: async () => false,
  changePassword: async () => false,
  logoutAllDevices: async () => false,
  clearError: () => {}
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// The provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check if user is authenticated on mount and setup token refresh
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        // Check if we have a valid authentication state
        if (isAuthenticated()) {
          // Get stored user data first for faster UI rendering
          const storedUser = getStoredUser();
          if (storedUser) {
            setUser(storedUser);
          }
          
          try {
            // Fetch fresh user data from the API
            const userData = await getUserProfile();
            setUser(userData);
          } catch (profileError) {
            console.error('Failed to fetch user profile:', profileError);
            // If we can't get the profile but have stored user, keep using that
            if (!storedUser) {
              setUser(null);
            }
          }
        } else if (isTokenExpired()) {
          // Token is expired, try to refresh
          try {
            await refreshAuthToken();
            // If refresh successful, get user profile
            const userData = await getUserProfile();
            setUser(userData);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Failed to initialize authentication:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
    
    // Setup token refresh interval (every 15 minutes)
    const refreshInterval = setInterval(async () => {
      if (isAuthenticated() && isTokenExpired()) {
        try {
          await refreshAuthToken();
        } catch (error) {
          console.error('Background token refresh failed:', error);
        }
      }
    }, 15 * 60 * 1000); // 15 minutes in milliseconds
    
    // Clear interval on unmount
    return () => clearInterval(refreshInterval);
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const userData = await apiLogin(credentials);
      setUser(userData);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await apiRegister(credentials);
      
      // After registration, automatically log in
      await apiLogin({
        username: credentials.username,
        password: credentials.password
      });
      
      const userData = await getUserProfile();
      setUser(userData);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to register');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiLogout();
      setUser(null);
    } catch (err: any) {
      console.error('Logout error:', err);
      // Still clear user even if API call fails
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update profile function
  const updateProfile = async (userData: Partial<User>): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const updatedUser = await updateUserProfile(userData);
      setUser(updatedUser);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Change password function
  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await apiChangePassword(currentPassword, newPassword);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Logout from all devices
  const logoutAllDevices = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await apiLogoutAllDevices();
      setUser(null);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to logout from all devices');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Clear error state
  const clearError = () => {
    setError(null);
  };

  // Provide auth context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    logoutAllDevices,
    clearError
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
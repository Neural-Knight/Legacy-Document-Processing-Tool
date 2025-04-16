/**
 * User interface representing the authenticated user
 */
export interface User {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    is_active: boolean;
    is_superuser: boolean;
    created_at: string;
    updated_at?: string;
  }
  
  /**
   * Login credentials for authenticating a user
   */
  export interface LoginCredentials {
    username: string;  // Can be username or email
    password: string;
    remember_me?: boolean;
  }
  
  /**
   * Registration credentials for creating a new user
   */
  export interface RegisterCredentials {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }
  
  /**
   * Authentication tokens returned from login/refresh
   */
  export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;  // Seconds until expiration
  }
  
  /**
   * Auth state for context
   */
  export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
  }
  
  /**
   * Auth context actions
   */
  export interface AuthContextType extends AuthState {
    login: (credentials: LoginCredentials) => Promise<boolean>;
    register: (credentials: RegisterCredentials) => Promise<boolean>;
    logout: () => Promise<void>;
    updateProfile: (userData: Partial<User>) => Promise<boolean>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
    logoutAllDevices: () => Promise<boolean>;
    clearError: () => void;
  }
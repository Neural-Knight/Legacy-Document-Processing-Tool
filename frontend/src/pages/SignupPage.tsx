import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Paper, 
  Link, 
  InputAdornment, 
  IconButton, 
  CircularProgress, 
  Alert,
  FormControlLabel,
  Checkbox,
  useTheme,
  alpha,
  LinearProgress
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RegisterCredentials } from '../types/auth';

// Icons
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

// Password strength indicator component
const PasswordStrengthIndicator: React.FC<{ password: string }> = ({ password }) => {
  const theme = useTheme();
  
  // Calculate password strength
  const calculateStrength = (password: string): number => {
    if (!password) return 0;
    
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 25;
    
    // Character type checks
    if (/[A-Z]/.test(password)) strength += 25; // Uppercase
    if (/[a-z]/.test(password)) strength += 25; // Lowercase
    if (/[0-9]/.test(password)) strength += 15; // Numbers
    if (/[^A-Za-z0-9]/.test(password)) strength += 10; // Special characters
    
    return Math.min(100, strength);
  };
  
  const strength = calculateStrength(password);
  
  // Determine color based on strength
  const getStrengthColor = (strength: number) => {
    if (strength < 30) return theme.palette.error.main;
    if (strength < 70) return theme.palette.warning.main;
    return theme.palette.success.main;
  };
  
  // Determine label based on strength
  const getStrengthLabel = (strength: number) => {
    if (strength < 30) return 'Weak';
    if (strength < 70) return 'Moderate';
    return 'Strong';
  };
  
  return (
    <Box sx={{ mt: 1, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="textSecondary">
          Password Strength
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: getStrengthColor(strength),
            fontWeight: 600
          }}
        >
          {getStrengthLabel(strength)}
        </Typography>
      </Box>
      <LinearProgress 
        variant="determinate" 
        value={strength} 
        sx={{ 
          height: 8, 
          borderRadius: 4,
          bgcolor: alpha(theme.palette.grey[500], 0.2),
          '& .MuiLinearProgress-bar': {
            bgcolor: getStrengthColor(strength),
            borderRadius: 4,
          }
        }}
      />
      
      {/* Password requirements */}
      {password && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Requirements:
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {password.length >= 8 ? (
                <CheckCircleIcon 
                  fontSize="small" 
                  color="success" 
                  sx={{ fontSize: '0.9rem' }}
                />
              ) : (
                <CancelIcon 
                  fontSize="small" 
                  color="error" 
                  sx={{ fontSize: '0.9rem' }}
                />
              )}
              <Typography variant="body2" color="textSecondary">
                8+ characters
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/[A-Z]/.test(password) ? (
                <CheckCircleIcon 
                  fontSize="small" 
                  color="success" 
                  sx={{ fontSize: '0.9rem' }}
                />
              ) : (
                <CancelIcon 
                  fontSize="small" 
                  color="error" 
                  sx={{ fontSize: '0.9rem' }}
                />
              )}
              <Typography variant="body2" color="textSecondary">
                Uppercase letters
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/[0-9]/.test(password) ? (
                <CheckCircleIcon 
                  fontSize="small" 
                  color="success" 
                  sx={{ fontSize: '0.9rem' }}
                />
              ) : (
                <CancelIcon 
                  fontSize="small" 
                  color="error" 
                  sx={{ fontSize: '0.9rem' }}
                />
              )}
              <Typography variant="body2" color="textSecondary">
                Numbers
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/[^A-Za-z0-9]/.test(password) ? (
                <CheckCircleIcon 
                  fontSize="small" 
                  color="success" 
                  sx={{ fontSize: '0.9rem' }}
                />
              ) : (
                <CancelIcon 
                  fontSize="small" 
                  color="error" 
                  sx={{ fontSize: '0.9rem' }}
                />
              )}
              <Typography variant="body2" color="textSecondary">
                Special characters
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const SignupPage: React.FC = () => {
  const theme = useTheme();
  const { register, error, isLoading, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Validation state
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [termsError, setTermsError] = useState('');

  // Clear any previous auth errors when component mounts
  useEffect(() => {
    clearError?.();
  }, [clearError]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = (): boolean => {
    let valid = true;
    
    // Name validation
    if (!fullName) {
      setNameError('Name is required');
      valid = false;
    } else if (fullName.length < 2) {
      setNameError('Name must be at least 2 characters');
      valid = false;
    } else {
      setNameError('');
    }
    
    // Username validation
    if (!username) {
      setUsernameError('Username is required');
      valid = false;
    } else if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      valid = false;
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setUsernameError('Username can only contain letters, numbers, underscores and hyphens');
      valid = false;
    } else {
      setUsernameError('');
    }
    
    // Email validation
    if (!email) {
      setEmailError('Email is required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Please enter a valid email address');
      valid = false;
    } else {
      setEmailError('');
    }
    
    // Password validation
    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      valid = false;
    } else if (!/[A-Z]/.test(password)) {
      setPasswordError('Password must contain at least one uppercase letter');
      valid = false;
    } else if (!/[0-9]/.test(password)) {
      setPasswordError('Password must contain at least one number');
      valid = false;
    } else {
      setPasswordError('');
    }
    
    // Confirm password validation
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      valid = false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }
    
    // Terms validation
    if (!agreeToTerms) {
      setTermsError('You must agree to the terms and conditions');
      valid = false;
    } else {
      setTermsError('');
    }
    
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Extract first and last name from full name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Create registration credentials object for the new auth system
    const credentials: RegisterCredentials = {
      username: username,
      email: email,
      password: password,
      first_name: firstName,
      last_name: lastName
    };
    
    const success = await register(credentials);
    if (success) {
      navigate('/');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Generate username suggestion from email
  const suggestUsername = () => {
    if (email && !username) {
      const suggested = email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
      setUsername(suggested);
    }
  };

  return (
    <Box 
      sx={{
        minHeight: '100vh',
        display: 'flex',
        background: theme.palette.mode === 'light'
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.secondary.light, 0.1)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.1)} 0%, ${alpha(theme.palette.secondary.dark, 0.15)} 100%)`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '120%',
          height: '120%',
          background: theme.palette.mode === 'light'
            ? `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 60%)`
            : `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 60%)`,
          zIndex: 0
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '120%',
          height: '120%',
          background: theme.palette.mode === 'light'
            ? `radial-gradient(circle at bottom right, ${alpha(theme.palette.secondary.main, 0.03)} 0%, transparent 60%)`
            : `radial-gradient(circle at bottom right, ${alpha(theme.palette.secondary.main, 0.05)} 0%, transparent 60%)`,
          zIndex: 0
        }
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          width: '100%', 
          justifyContent: 'center', 
          alignItems: 'center',
          py: 5,
          position: 'relative',
          zIndex: 1
        }}
      >
        <Paper 
          elevation={6} 
          sx={{
            width: '100%',
            maxWidth: 550,
            p: { xs: 3, sm: 5 },
            mx: 2,
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            backgroundColor: theme.palette.mode === 'light' 
              ? alpha(theme.palette.background.paper, 0.9)
              : alpha(theme.palette.background.paper, 0.8),
            transition: 'transform 0.3s, box-shadow 0.3s',
            '&:hover': {
              boxShadow: theme.shadows[10],
            }
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              gutterBottom
              sx={{ fontWeight: 700 }}
            >
              Create an Account
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Join our platform and start managing your documents
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="fullName"
              label="Full Name"
              name="fullName"
              autoComplete="name"
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={!!nameError}
              helperText={nameError}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={suggestUsername}
              error={!!emailError}
              helperText={emailError}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={!!usernameError}
              helperText={usernameError || "This will be used to log in"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!passwordError}
              helperText={passwordError}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={togglePasswordVisibility}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: password ? 1 : 3 }}
            />
            
            {/* Password strength indicator */}
            {password && <PasswordStrengthIndicator password={password} />}
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!confirmPasswordError}
              helperText={confirmPasswordError}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={toggleConfirmPasswordVisibility}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2">
                  I agree to the{' '}
                  <Link 
                    component={RouterLink} 
                    to="/terms" 
                    sx={{
                      color: theme.palette.primary.main,
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      }
                    }}
                  >
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link 
                    component={RouterLink} 
                    to="/privacy" 
                    sx={{
                      color: theme.palette.primary.main,
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      }
                    }}
                  >
                    Privacy Policy
                  </Link>
                </Typography>
              }
              sx={{ mb: termsError ? 0 : 3 }}
            />
            
            {termsError && (
              <Typography 
                variant="caption" 
                color="error" 
                sx={{ 
                  display: 'block', 
                  mt: 0.5, 
                  mb: 3, 
                  ml: 2 
                }}
              >
                {termsError}
              </Typography>
            )}
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ 
                py: 1.5, 
                mb: 3,
                position: 'relative',
                '&.Mui-disabled': {
                  bgcolor: alpha(theme.palette.primary.main, 0.7),
                  color: theme.palette.primary.contrastText
                }
              }}
            >
              {isLoading ? (
                <CircularProgress
                  size={24}
                  sx={{
                    color: theme.palette.primary.contrastText,
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginTop: '-12px',
                    marginLeft: '-12px',
                  }}
                />
              ) : (
                'Create Account'
              )}
            </Button>
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Already have an account?{' '}
                <Link 
                  component={RouterLink} 
                  to="/login" 
                  sx={{
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline',
                    }
                  }}
                >
                  Sign In
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default SignupPage;
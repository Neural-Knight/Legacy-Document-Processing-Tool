import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Link,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginCredentials } from '../types/auth';

// Icons
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';

const LoginPage: React.FC = () => {
  const theme = useTheme();
  const { login, error, isLoading, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Validation state
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Error dialog state
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  // Get the redirect path from location state or default to '/'
  const from = (location.state as any)?.from?.pathname || '/';

  // Check for remembered user
  useEffect(() => {
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
      try {
        const { email } = JSON.parse(rememberedUser);
        setUsername(email);
        setRememberMe(true);
      } catch (error) {
        console.error('Error parsing remembered user:', error);
      }
    }
  }, []);

  // Clear any previous auth errors when component mounts
  useEffect(() => {
    clearError?.();
  }, [clearError]);

  // Show error dialog when error occurs
  useEffect(() => {
    if (error) {
      setErrorDialogOpen(true);
    }
  }, [error]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const validateForm = (): boolean => {
    let valid = true;

    // Username/Email validation
    if (!username) {
      setUsernameError('Email or username is required');
      valid = false;
    } else {
      setUsernameError('');
    }

    // Password validation
    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      valid = false;
    } else {
      setPasswordError('');
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }
    // Create login credentials object for the new auth system
    const credentials: LoginCredentials = {
      username: username,
      password: password,
      remember_me: rememberMe
    };

    const success = await login(credentials);
    if (success) {
      navigate(from, { replace: true });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleCloseErrorDialog = () => {
    setErrorDialogOpen(false);
    clearError?.();
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
          position: 'relative',
          zIndex: 1
        }}
      >
        <Paper
          elevation={6}
          sx={{
            width: '100%',
            maxWidth: 480,
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
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 700 }}
            >
              Welcome Back
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Sign in to continue to your account
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Email or Username"
              name="username"
              autoComplete="email username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={!!usernameError}
              helperText={usernameError}
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
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
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
              sx={{ mb: 1 }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                  />
                }
                label="Remember me"
              />

              <Link
                component={RouterLink}
                to="/forgot-password"
                variant="body2"
                sx={{
                  color: theme.palette.primary.main,
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                  alignSelf: 'center'
                }}
              >
                Forgot password?
              </Link>
            </Box>

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
                'Sign In'
              )}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Don't have an account?{' '}
                <Link
                  component={RouterLink}
                  to="/signup"
                  sx={{
                    color: theme.palette.primary.main,
                    textDecoration: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline',
                    }
                  }}
                >
                  Sign Up
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
      {/* Error Dialog */}
      <Dialog
        open={errorDialogOpen}
        onClose={handleCloseErrorDialog}
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxWidth: 380,
            overflow: 'hidden',
            position: 'relative'
          }
        }}
      >
        <IconButton
          aria-label="close"
          onClick={handleCloseErrorDialog}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
            zIndex: 2
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            p: 3,
            pt: 4
          }}
        >
          {/* Top error indicator bar */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.error.light} 100%)`
            }}
          />

          {/* Error icon with centered pulsing animation */}
          <Box
            sx={{
              position: 'relative',
              mb: 3,
              width: 80,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Pulsing circle background */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: alpha(theme.palette.error.main, 0.1),
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%': {
                    transform: 'translate(-50%, -50%) scale(0.95)',
                    opacity: 0.8,
                  },
                  '70%': {
                    transform: 'translate(-50%, -50%) scale(1.1)',
                    opacity: 0,
                  },
                  '100%': {
                    transform: 'translate(-50%, -50%) scale(0.95)',
                    opacity: 0,
                  },
                },
              }}
            />

            {/* Error Icon */}
            <ErrorOutlineIcon
              sx={{
                fontSize: 40,
                color: theme.palette.error.main,
                zIndex: 1,
              }}
            />
          </Box>

          {/* Error message content */}
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontWeight: 600,
              textAlign: 'center',
              color: theme.palette.error.main,
              mb: 1
            }}
          >
            Authentication Failed
          </Typography>

          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              color: theme.palette.text.secondary,
              mb: 3,
              maxWidth: '280px'
            }}
          >
            {error}
          </Typography>

          {/* Action button */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleCloseErrorDialog}
            sx={{
              bgcolor: theme.palette.error.main,
              py: 1.5,
              '&:hover': {
                bgcolor: theme.palette.error.dark,
              },
              boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.2)}`,
              transition: 'all 0.2s ease-in-out',
              '&:active': {
                transform: 'scale(0.98)'
              }
            }}
          >
            Try Again
          </Button>
        </Box>
      </Dialog>

    </Box >
  );
};

export default LoginPage;
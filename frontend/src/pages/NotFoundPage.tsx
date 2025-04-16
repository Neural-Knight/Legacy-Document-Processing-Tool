import React from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  useTheme, 
  alpha,
  Container 
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Icon
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const NotFoundPage: React.FC = () => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();

  // Redirect to appropriate page based on authentication status
  const homePath = isAuthenticated ? '/' : '/landing';

  return (
    <Box 
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.palette.mode === 'light'
          ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.secondary.light, 0.1)} 100%)`
          : `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.1)} 0%, ${alpha(theme.palette.secondary.dark, 0.15)} 100%)`,
        overflow: 'hidden',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: theme.palette.mode === 'light'
            ? `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 70%)`
            : `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`,
          zIndex: 0
        }
      }}
    >
      <Container 
        maxWidth="md" 
        sx={{ 
          textAlign: 'center', 
          py: 8,
          position: 'relative',
          zIndex: 1
        }}
      >
        <ErrorOutlineIcon 
          sx={{ 
            fontSize: 100, 
            color: theme.palette.mode === 'light' 
              ? alpha(theme.palette.primary.main, 0.7)
              : alpha(theme.palette.primary.main, 0.8),
            mb: 4
          }} 
        />
        
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { xs: '5rem', md: '7rem' },
            fontWeight: 800,
            mb: 2,
            background: theme.palette.mode === 'dark' 
              ? '-webkit-linear-gradient(45deg, #1ddef0 30%, #7be854 90%)'
              : '-webkit-linear-gradient(45deg, #00695c 30%, #b9935a 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </Typography>
        
        <Typography 
          variant="h4" 
          component="h2"
          sx={{ 
            mb: 2,
            fontWeight: 600
          }}
        >
          Page Not Found
        </Typography>
        
        <Typography 
          variant="h6" 
          color="textSecondary"
          sx={{ 
            mb: 6,
            maxWidth: '600px',
            mx: 'auto'
          }}
        >
          We couldn't find the page you're looking for. The page may have been moved, deleted, or never existed.
        </Typography>
        
        <Button
          component={RouterLink}
          to={homePath}
          variant="contained"
          size="large"
          sx={{ 
            py: 1.5, 
            px: 4,
            borderRadius: 2
          }}
        >
          Return Home
        </Button>
      </Container>
    </Box>
  );
};

export default NotFoundPage;
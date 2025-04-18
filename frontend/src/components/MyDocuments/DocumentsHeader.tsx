import React from 'react';
import { Box, Typography, Paper, alpha, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

const DocumentsHeader: React.FC = () => {
  const theme = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Paper 
        elevation={0}
        sx={{ 
          p: 3, 
          mb: 4, 
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          
          background: theme.palette.mode === 'dark' 
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.4)} 0%, ${alpha(theme.palette.secondary.dark, 0.2)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          boxShadow: theme.palette.mode === 'dark'
            ? `0 8px 32px 0 ${alpha('#000', 0.37)}`
            : `0 8px 32px 0 ${alpha(theme.palette.primary.main, 0.1)}`,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: `linear-gradient(
              to bottom right,
              ${alpha(theme.palette.primary.main, 0.03)},
              ${alpha(theme.palette.primary.main, 0.01)},
              ${alpha(theme.palette.secondary.main, 0.01)},
              ${alpha(theme.palette.secondary.main, 0.03)}
            )`,
            transform: 'rotate(30deg)',
            zIndex: 0,
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              fontWeight: 700, 
              mb: 1,
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(90deg, #fff 0%, #e0e0e0 100%)'
                : 'black',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: theme.palette.mode === 'dark' ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
            }}
          >
            My Documents
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse and manage your uploaded documents and their extracted data.
          </Typography>
        </Box>
      </Paper>
    </motion.div>
  );
};

export default DocumentsHeader;
import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { Fade } from '@mui/material';
import { PageDragOverlayProps } from '../../types/fileUploadtypes';

/**
 * Full-screen overlay that appears when dragging files over the page
 */
const PageDragOverlay: React.FC<PageDragOverlayProps> = ({ 
  isPageDragging, 
  isDarkMode 
}) => {
  const theme = useTheme();

  return (
    <Fade in={isPageDragging}>
      <Box 
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: alpha(theme.palette.background.default, 0.85),
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center', 
            maxWidth: 500,
            textAlign: 'center',
            p: 3,
          }}
        >
          <motion.div
            animate={{ 
              y: [0, -15, 0],
              scale: [1, 1.05, 1],
              transition: { 
                y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                scale: { repeat: Infinity, duration: 2, ease: "easeInOut" }
              }
            }}
          >
            <CloudUploadIcon 
              sx={{ 
                fontSize: 120, 
                color: theme.palette.primary.main,
                mb: 2,
                filter: isDarkMode ? 'drop-shadow(0 0 12px rgba(29,222,240,0.6))' : undefined
              }} 
            />
          </motion.div>
          
          <Typography 
            variant="h3" 
            sx={{
              fontWeight: 'bold',
              mb: 2,
              background: isDarkMode 
                ? `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` 
                : undefined,
              backgroundClip: isDarkMode ? 'text' : undefined,
              WebkitBackgroundClip: isDarkMode ? 'text' : undefined,
              color: isDarkMode ? 'transparent' : 'text.primary',
              textAlign: 'center'
            }}
          >
            Drop Files Anywhere
          </Typography>
          
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Release to upload your documents
          </Typography>
        </Box>
      </Box>
    </Fade>
  );
};

export default PageDragOverlay;
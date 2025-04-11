import React from 'react';
import { Box, Typography, Paper, Button, alpha, useTheme, Fade } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { motion } from 'framer-motion';
import { DragDropAreaProps } from '../../../types/fileUploadtypes';

/**
 * Component for the drag and drop upload area
 */
const DragDropArea: React.FC<DragDropAreaProps> = ({
  isDragging,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleFileSelect,
  files,
  uploading,
  dropAreaRef,
  isDarkMode,
  children
}) => {
  const theme = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Paper
        ref={dropAreaRef}
        sx={{
          p: 6,
          mt: 4,
          mb: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: isDragging 
            ? `3px dashed ${theme.palette.primary.main}`
            : `2px dashed ${isDarkMode ? alpha(theme.palette.primary.main, 0.4) : '#ccc'}`,
          borderRadius: 4,
          backgroundColor: isDragging 
            ? alpha(theme.palette.primary.main, 0.06)
            : theme.palette.background.paper,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 220,
          backgroundImage: isDarkMode && !isDragging && !uploading
            ? 'radial-gradient(circle, rgba(29,222,240,0.07) 0%, rgba(123,232,84,0.04) 100%)' 
            : undefined,
          backgroundSize: '200% 200%',
          backgroundPosition: '50% 50%',
          '&::before': isDarkMode && isDragging ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle, rgba(29,222,240,0.15) 0%, rgba(123,232,84,0.08) 100%)',
            opacity: 0.7,
            zIndex: 0,
            animation: 'pulse 2s infinite'
          } : {},
          '@keyframes pulse': {
            '0%': { opacity: 0.5, backgroundSize: '100% 100%' },
            '50%': { opacity: 0.8, backgroundSize: '120% 120%' },
            '100%': { opacity: 0.5, backgroundSize: '100% 100%' }
          },
          boxShadow: isDragging 
            ? `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`
            : '0 8px 16px rgba(0,0,0,0.06)'
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleFileSelect}
        elevation={isDragging ? 4 : 1}
      >
        <Fade in={isDragging} timeout={400}>
          <Box 
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: isDragging ? 'flex' : 'none',
              alignItems: 'center',
              justifyContent: 'center',
              background: alpha(theme.palette.background.paper, 0.8),
              backdropFilter: 'blur(4px)',
              zIndex: 10
            }}
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                transition: { 
                  y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                }
              }}
            >
              <CloudUploadIcon 
                sx={{ 
                  fontSize: 100, 
                  color: theme.palette.primary.main,
                  filter: isDarkMode ? 'drop-shadow(0 0 8px rgba(29,222,240,0.5))' : undefined
                }} 
              />
            </motion.div>
            <Typography 
              variant="h4" 
              sx={{ 
                position: 'absolute',
                bottom: '20%',
                fontWeight: 'bold',
                color: theme.palette.primary.main
              }}
            >
              Drop Files Here
            </Typography>
          </Box>
        </Fade>
        
        <Box sx={{ 
          textAlign: 'center',
          position: 'relative',
          zIndex: 5
        }}>
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              transition: { 
                y: { repeat: Infinity, duration: 2, ease: "easeInOut" }
              }
            }}
          >
            <CloudUploadIcon 
              sx={{ 
                fontSize: 80, 
                color: isDarkMode ? theme.palette.primary.main : 'text.secondary',
                mb: 2,
                filter: isDarkMode ? 'drop-shadow(0 0 8px rgba(29,222,240,0.2))' : undefined
              }} 
            />
          </motion.div>
          
          <Typography 
            variant="h6"
            sx={{
              mb: 1,
              fontWeight: 'bold',
              background: isDarkMode 
                ? `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` 
                : undefined,
              backgroundClip: isDarkMode ? 'text' : undefined,
              WebkitBackgroundClip: isDarkMode ? 'text' : undefined,
              // color: isDarkMode ? 'transparent' : 'text.primary',
            }}
          >
            {files.length > 0 
              ? 'Drop more files or click to browse' 
              : 'Drag & Drop or Click to Upload'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {files.length > 0 
              ? `${files.length} ${files.length === 1 ? 'file' : 'files'} selected` 
              : 'All document types supported'}
          </Typography>
          
          <Button
            variant="outlined"
            color="primary"
            sx={{
              borderRadius: '50px',
              px: 3,
              py: 1,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2
              }
            }}
          >
            Browse Files
          </Button>
        </Box>
        
        {children}
      </Paper>
    </motion.div>
  );
};

export default DragDropArea;
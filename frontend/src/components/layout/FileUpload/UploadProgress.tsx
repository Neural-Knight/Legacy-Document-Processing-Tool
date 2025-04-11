import React from 'react';
import { Box, Typography, LinearProgress, alpha, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { UploadProgressProps } from '../../../types/fileUploadtypes';
import { calculateOverallProgress } from '../../../utils/fileUploadutils';

/**
 * Component that displays overall upload progress
 */
const UploadProgress: React.FC<UploadProgressProps> = ({ 
  uploading,
  progress, 
  fileStatuses,
  files,
  isDarkMode
}) => {
  const theme = useTheme();
  
  if (!uploading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.4 }}
    >
      <Box sx={{ width: '100%', mt: 4 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1 
        }}>
          <Typography variant="body2" color="text.secondary">
            Overall Upload Progress
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 'bold',
              color: progress === 100 
                ? theme.palette.success.main 
                : theme.palette.primary.main
            }}
          >
            {progress}%
          </Typography>
        </Box>
        
        <Box sx={{ position: 'relative' }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 10, 
              borderRadius: 5,
              backgroundColor: alpha(theme.palette.primary.main, 0.15),
              '& .MuiLinearProgress-bar': {
                backgroundColor: progress === 100 
                  ? theme.palette.success.main 
                  : theme.palette.primary.main,
                borderRadius: 5,
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }
            }} 
          />
          
          {progress > 0 && progress < 100 && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: isDarkMode 
                  ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' 
                  : undefined,
                backgroundSize: '50% 100%',
                animation: 'shimmer 1.5s infinite',
                '@keyframes shimmer': {
                  '0%': { backgroundPosition: '-50% 0' },
                  '100%': { backgroundPosition: '150% 0' }
                }
              }}
            />
          )}
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 1,
          mt: 2 
        }}>
          <Typography variant="body2" color="text.secondary">
            {fileStatuses.filter(s => s.success).length} of {files.length} files completed
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
};

export default UploadProgress;
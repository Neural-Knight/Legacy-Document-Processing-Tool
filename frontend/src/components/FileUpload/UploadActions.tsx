import React from 'react';
import { Button, Stack, CircularProgress, alpha, useTheme } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CancelIcon from '@mui/icons-material/Cancel';
import { motion } from 'framer-motion';
import { UploadActionsProps } from '../../types/fileUploadtypes';

/**
 * Component for upload and cancel buttons
 */
const UploadActions: React.FC<UploadActionsProps> = ({
  files,
  uploading,
  fileStatuses,
  handleUpload,
  handleCancel,
  isDarkMode
}) => {
  const theme = useTheme();

  // Don't show buttons if there are no files
  if (files.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Stack direction="row" spacing={2} justifyContent="center" mt={2}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
          onClick={handleUpload}
          disabled={uploading || files.length === 0 || files.every((_, i) => 
            fileStatuses.find(s => s.fileIndex === i)?.success
          )}
          sx={{ 
            minWidth: 180,
            height: 54,
            borderRadius: '12px',
            fontSize: '1rem',
            textTransform: 'none',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`,
            '&::after': isDarkMode ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              transition: 'all 0.5s ease',
            } : {},
            '&:hover::after': isDarkMode ? {
              left: '100%',
            } : {},
          }}
        >
          {uploading ? 'Uploading...' : 'Upload All'}
        </Button>
        
        <Button
          variant="outlined"
          color="error"
          size="large"
          startIcon={<CancelIcon />}
          onClick={handleCancel}
          disabled={files.length === 0}
          sx={{ 
            minWidth: 150,
            height: 54,
            borderRadius: '12px',
            fontSize: '1rem',
            borderWidth: 2,
            '&:hover': {
              borderWidth: 2
            }
          }}
        >
          Cancel All
        </Button>
      </Stack>
    </motion.div>
  );
};

export default UploadActions;
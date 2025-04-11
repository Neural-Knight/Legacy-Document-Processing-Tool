import React from 'react';
import { Box, IconButton, Fade } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { FilePreviewProps } from '../../../types/fileUploadtypes';

/**
 * Modal component for previewing files
 */
const FilePreview: React.FC<FilePreviewProps> = ({
  previewOpen,
  previewUrl,
  handleClosePreview
}) => {
  return (
    <Fade in={previewOpen}>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4
        }}
        onClick={handleClosePreview}
      >
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 20, 
            right: 20,
            zIndex: 10
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconButton 
            onClick={handleClosePreview}
            sx={{ 
              color: 'white',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Box 
          sx={{ 
            width: '100%', 
            height: '90%', 
            maxWidth: 1000,
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {previewUrl && (
            <iframe
              src={`${previewUrl}#toolbar=0`}
              width="100%"
              height="100%"
              style={{ 
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
              }}
              title="File Preview"
            />
          )}
        </Box>
      </Box>
    </Fade>
  );
};

export default FilePreview;
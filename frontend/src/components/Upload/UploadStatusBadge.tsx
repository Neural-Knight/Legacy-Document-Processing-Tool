import React from 'react';
import {
  Badge,
  Box,
  Tooltip,
  IconButton,
  CircularProgress,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useUpload } from '../../contexts/UploadContext';

interface UploadStatusBadgeProps {
  onClick?: () => void;
}

const UploadStatusBadge: React.FC<UploadStatusBadgeProps> = ({ onClick }) => {
  const theme = useTheme();
  const { 
    isUploading, 
    uploadProgress, 
    recentlyUploadedDocuments, 
    openUploadDialog 
  } = useUpload();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      openUploadDialog();
    }
  };

  if (isUploading) {
    return (
      <Tooltip title={`Uploading... ${uploadProgress}%`}>
        <IconButton
          onClick={handleClick}
          sx={{
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <CloudUploadIcon color="primary" />
          <CircularProgress
            size={36}
            thickness={2}
            variant="determinate"
            value={uploadProgress}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              color: theme.palette.primary.main
            }}
          />
        </IconButton>
      </Tooltip>
    );
  }

  if (recentlyUploadedDocuments.length > 0) {
    return (
      <Tooltip title={`${recentlyUploadedDocuments.length} documents uploaded successfully`}>
        <Badge
          badgeContent={recentlyUploadedDocuments.length}
          color="success"
          overlap="circular"
        >
          <IconButton
            onClick={handleClick}
            color="success"
            sx={{
              animation: 'pulse 1.5s',
              '@keyframes pulse': {
                '0%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0.4)' },
                '70%': { boxShadow: '0 0 0 10px rgba(76, 175, 80, 0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(76, 175, 80, 0)' }
              }
            }}
          >
            <CheckCircleIcon />
          </IconButton>
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Upload documents">
      <IconButton onClick={handleClick} color="inherit">
        <CloudUploadIcon />
      </IconButton>
    </Tooltip>
  );
};

export default UploadStatusBadge;
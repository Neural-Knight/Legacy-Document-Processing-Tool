import React from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Tooltip, 
  LinearProgress, 
  Chip, 
  alpha, 
  useTheme,
  Zoom
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/material/CircularProgress';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import TableChartIcon from '@mui/icons-material/TableChart';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import FilePresentIcon from '@mui/icons-material/FilePresent';

import { FileItemProps } from '../../../types/fileUploadtypes';
import { formatFileSize, getFileStatusText, getProgressColor } from '../../../utils/fileUploadutils';

/**
 * Component for displaying a single file item with its status
 */
const FileItem: React.FC<FileItemProps> = ({
  file,
  index,
  status,
  onRemove,
  onPreview,
  isDarkMode
}) => {
  const theme = useTheme();
  
  const isUploading = status?.uploading || false;
  const progress = status?.progress || 0;
  const hasError = status?.error !== null;
  const isSuccess = status?.success || false;
  const statusText = getFileStatusText(status ? [status] : [], index);
  const progressColor = getProgressColor(status ? [status] : [], index, theme);
  
  // Get the appropriate icon for the file type
  const getFileIcon = () => {
    const fileType = file.type;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Document types
    if (fileType.includes('pdf') || extension === 'pdf') {
      return <PictureAsPdfIcon sx={{ color: '#f44336' }} />;
    } 
    
    // Microsoft Office
    if (fileType.includes('word') || extension === 'doc' || extension === 'docx') {
      return <DescriptionIcon sx={{ color: '#2196f3' }} />;
    }
    
    if (fileType.includes('spreadsheet') || extension === 'xls' || extension === 'xlsx') {
      return <TableChartIcon sx={{ color: '#4caf50' }} />;
    }
    
    if (fileType.includes('presentation') || extension === 'ppt' || extension === 'pptx') {
      return <DescriptionIcon sx={{ color: '#ff9800' }} />;
    }
    
    // Images
    if (fileType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
      return <ImageIcon sx={{ color: '#9c27b0' }} />;
    }
    
    // Text files
    if (fileType.includes('text') || extension === 'txt' || extension === 'rtf') {
      return <TextSnippetIcon sx={{ color: '#607d8b' }} />;
    }
    
    // Code files
    if (['html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml', 'csv'].includes(extension)) {
      return <CodeIcon sx={{ color: '#ff5722' }} />;
    }
    
    // Default icon for other types
    return <FilePresentIcon sx={{ color: theme.palette.text.secondary }} />;
  };
  
  const isPreviewable = ['pdf', 'jpg', 'jpeg', 'png', 'gif'].includes(
    file.name.split('.').pop()?.toLowerCase() || ''
  );

  return (
    <Zoom in style={{ transitionDelay: `${index * 100}ms` }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          p: 1.5,
          mb: 1,
          borderRadius: 2,
          backgroundColor: isDarkMode 
            ? alpha(theme.palette.background.paper, 0.8)
            : alpha(theme.palette.background.paper, 0.9),
          border: `1px solid ${alpha(
            isSuccess ? theme.palette.success.main : 
            hasError ? theme.palette.error.main :
            theme.palette.divider, 
            isSuccess || hasError ? 0.3 : 0.1
          )}`,
          backdropFilter: 'blur(4px)',
          boxShadow: isDarkMode
            ? `0 2px 6px ${alpha(theme.palette.common.black, 0.2)}`
            : '0 2px 6px rgba(0,0,0,0.05)',
          transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          position: 'relative',
          overflow: 'hidden',
          
          '&:hover': {
            backgroundColor: isDarkMode 
              ? alpha(theme.palette.background.paper, 0.95)
              : alpha(theme.palette.background.paper, 1),
            boxShadow: isDarkMode
              ? `0 3px 0px ${alpha(theme.palette.primary.light, 0.15)}`
              : `0 3px 0px ${alpha(theme.palette.primary.main, 0.15)}`,
            transform: 'translateY(-4px) scale(1.01)',
            border: `1px solid ${alpha(theme.palette.primary.main, isDarkMode ? 0.3 : 0.2)}`,
            '&:before': {
              opacity: 1,
            },
            '&:after': {
              left: '150%',
              opacity: 0.5,
              transition: 'left 1s ease',
            }
          },
          '&:active': {
            transform: 'translateY(-2px) scale(1.005)',
            boxShadow: isDarkMode
              ? `0 5px 10px ${alpha(theme.palette.common.black, 0.25)}, 0 0 0 1px ${alpha(theme.palette.primary.dark, 0.35)}`
              : `0 5px 10px ${alpha(theme.palette.primary.main, 0.1)}`,
            transition: 'all 0.15s ease',
          }
        }}
      >
        {/* File info row */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: isUploading || hasError || isSuccess ? 1 : 0 }}>
          {getFileIcon()}
          
          <Box sx={{ flexGrow: 1, ml: 1.5, overflow: 'hidden' }}>
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 'medium',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFileSize(file.size)}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Status indicator */}
            {(isUploading || hasError || isSuccess) && (
              <Chip 
                size="small"
                label={statusText}
                color={
                  isSuccess ? "success" : 
                  hasError ? "error" : 
                  "primary"
                }
                icon={
                  isSuccess ? <CheckCircleIcon /> : 
                  hasError ? <ErrorIcon /> : 
                  <CircularProgress size={16} />
                }
                sx={{ mr: 1, height: 24 }}
              />
            )}
          
            {isPreviewable && (
              <Tooltip title="Preview">
                <IconButton 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(file);
                  }}
                  sx={{
                    color: theme.palette.primary.main,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.2),
                    },
                    mr: 1
                  }}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title={isUploading ? "Cancel" : "Remove"}>
              <IconButton 
                size="small"
                onClick={async (e) => {
                  e.stopPropagation();
                  await onRemove(index);
                }}
                sx={{
                  color: theme.palette.error.main,
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.error.main, 0.2),
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {/* Progress bar */}
        {(isUploading || hasError || isSuccess) && (
          <Box sx={{ width: '100%', mt: 1 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 4, 
                borderRadius: 2,
                backgroundColor: alpha(progressColor, 0.15),
                '& .MuiLinearProgress-bar': {
                  backgroundColor: progressColor,
                  borderRadius: 2,
                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }
              }} 
            />
            
            {/* Error message if there is one */}
            {hasError && status?.error && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                {status.error}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Zoom>
  );
};

export default FileItem;
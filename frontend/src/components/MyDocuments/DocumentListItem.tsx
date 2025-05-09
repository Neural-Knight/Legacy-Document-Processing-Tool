import React from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import CheckIcon from '@mui/icons-material/Check';
import { motion } from 'framer-motion';
import { Document } from '../../services/documentService';
import { DocumentOperationsProps } from '../../utils/myDocumentTypes';
import {
  getDocumentIcon,
  getDocumentType,
  getOriginalName,
  formatFileSize,
  getStatusIcon,
  getStatusText,
  getStatusColor
} from '../../utils/documentHelpers.tsx';

interface DocumentListItemProps extends DocumentOperationsProps {
  document: Document;
  isFavorite: boolean;
  onContextMenu: (event: React.MouseEvent) => void;
  onClick: () => void;
  isSelected?: boolean;
}

const DocumentListItem: React.FC<DocumentListItemProps> = ({
  document: doc,
  isFavorite,
  isSelected = false,
  onContextMenu,
  onClick,
  onDownload,
  onDelete,
  onView,
}) => {
  const theme = useTheme();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
    >
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          border: isSelected 
            ? `2px solid ${theme.palette.primary.main}`
            : `1px solid ${theme.palette.divider}`,
          boxShadow: isSelected
            ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
            : 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            transform: 'translateY(-2px)',
            '& .list-item-actions': {
              opacity: 1,
              transform: 'translateX(0)',
            }
          }
        }}
        onContextMenu={onContextMenu}
        onClick={onClick}
      >
               {isSelected && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            <CheckIcon fontSize="small" />
          </Box>
        )}

        <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
          {/* Document Icon */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            mr: { xs: 1.5, sm: 2 }
          }}>
            <Box 
              sx={{ 
                width: 42,
                height: 42,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.default, 0.6)
                  : alpha(theme.palette.background.default, 0.7),
                boxShadow: '0 4px 8px rgba(0,0,0,0.04)'
              }}
            >
              {getDocumentIcon(doc.filename)}
            </Box>
          </Box>

          {/* Document Name and Type - Middle section */}
          <Box sx={{ 
            flexGrow: 1,
            width: { xs: 'auto', sm: '45%' },
            mr: { xs: 1, sm: 2 }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography 
                variant="subtitle1" 
                component="h2" 
                noWrap 
                title={getOriginalName(doc.filename)}
                sx={{ 
                  fontWeight: 600,
                  mr: 1
                }}
              >
                {getOriginalName(doc.filename)}
              </Typography>
              
              {isFavorite && (
                <Tooltip title="Favorite">
                  <StarIcon 
                    fontSize="small" 
                    sx={{ 
                      color: theme.palette.warning.main, 
                      fontSize: '0.875rem' 
                    }} 
                  />
                </Tooltip>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {getDocumentType(doc.filename)}
            </Typography>
          </Box>

          {/* Hidden on mobile, visible on larger screens */}
          <Box sx={{ 
            display: { xs: 'none', sm: 'block' },
            width: '15%'
          }}>
            <Typography 
              variant="body2" 
              color="text.secondary"
              noWrap
            >
              {new Date(doc.upload_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </Typography>
          </Box>

          {/* Hidden on mobile, visible on larger screens */}
          <Box sx={{ 
            display: { xs: 'none', sm: 'block' },
            width: '15%'
          }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {doc.file_size ? formatFileSize(doc.file_size) : 'Unknown'}
            </Typography>
          </Box>

          {/* Processing Status */}
          <Box sx={{ 
            display: 'flex',
            justifyContent: 'flex-start',
            width: { xs: 'auto', sm: '15%' }
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getStatusIcon(doc, theme)}
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 500, 
                  color: getStatusColor(doc, theme),
                  ml: 0.5,
                  display: { xs: 'none', md: 'block' }
                }}
                noWrap
              >
                {getStatusText(doc)}
              </Typography>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ 
            display: 'flex',
            justifyContent: 'flex-end',
            ml: 'auto',
            width: { xs: 'auto', sm: '10%' }
          }}>
            <Box 
              className="list-item-actions"
              sx={{ 
                display: 'flex',
                gap: 0.5,
                opacity: { xs: 1, sm: 0.4 },
                transform: { xs: 'none', sm: 'translateX(10px)' },
                transition: 'all 0.3s ease',
              }}
            >
              <Tooltip title="Download">
                <IconButton 
                  size="small" 
                  onClick={() => onDownload(doc)}
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.default, 0.4)
                      : alpha(theme.palette.background.default, 0.7),
                  }}
                >
                  <CloudDownloadIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="View Data">
                <IconButton 
                  size="small"
                  onClick={() => onView(doc.id)}
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.default, 0.4)
                      : alpha(theme.palette.background.default, 0.7),
                  }}
                >
                  <TableChartIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Delete">
                <IconButton 
                  size="small"
                  onClick={() => onDelete(doc.id)}
                  sx={{
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.default, 0.4)
                      : alpha(theme.palette.background.default, 0.7),
                  }}
                >
                  <DeleteIcon fontSize="small" sx={{ color: theme.palette.error.main }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Paper>
    </motion.div>
  );
};

export default DocumentListItem;
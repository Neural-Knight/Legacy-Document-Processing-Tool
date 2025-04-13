import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  alpha,
  useTheme
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
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

interface DocumentCardProps extends DocumentOperationsProps {
  document: Document;
  isFavorite: boolean;
  onContextMenu: (event: React.MouseEvent) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  document: doc,
  isFavorite,
  onContextMenu,
  onDownload,
  onView,
  onDetails,
  onToggleFavorite
}) => {
  const theme = useTheme();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      layout
    >
      <Card 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'visible',
          transition: 'all 0.3s ease',
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`
            : `linear-gradient(145deg, #fff 0%, #fafcfa 100%)`,
          backdropFilter: 'blur(10px)',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.2)'
            : '0 8px 32px rgba(0, 0, 0, 0.03)',
          '&:hover': {
            boxShadow: theme.palette.mode === 'dark'
              ? `0 12px 40px ${alpha(theme.palette.primary.main, 0.3)}`
              : `0 12px 40px ${alpha(theme.palette.primary.main, 0.15)}`,
            transform: 'translateY(-4px)',
            '& .document-actions': {
              opacity: 1,
            }
          }
        }}
        onContextMenu={onContextMenu}
      >
        {/* Favorite Badge */}
        {isFavorite && (
          <Box 
            sx={{ 
              position: 'absolute',
              top: -10,
              right: -10,
              zIndex: 1,
            }}
          >
            <Tooltip title="Favorite">
              <IconButton
                size="small"
                onClick={() => onToggleFavorite(doc.id)}
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  color: theme.palette.warning.main,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.warning.main, 0.1),
                  }
                }}
              >
                <StarIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        
        {/* Document Type Indicator */}
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          background: theme.palette.mode === 'dark'
            ? `linear-gradient(145deg, ${alpha(theme.palette.primary.dark, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0)} 100%)`
            : `linear-gradient(145deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0)} 100%)`,
        }}>
          <Box 
            sx={{ 
              width: 48,
              height: 48,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.default, 0.4)
                : alpha(theme.palette.background.default, 0.5),
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
          >
            {getDocumentIcon(doc.filename)}
          </Box>
        </Box>
        
        <CardContent sx={{ flexGrow: 1, pb: 1 }}>
          <Typography 
            variant="h6" 
            component="h2" 
            gutterBottom 
            noWrap 
            title={getOriginalName(doc.filename)}
            sx={{ 
              fontWeight: 600,
              fontSize: '1.1rem'
            }}
          >
            {getOriginalName(doc.filename)}
          </Typography>
          
          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ mb: 0.5 }}
          >
            {getDocumentType(doc.filename)}
          </Typography>
          
          <Box sx={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 2
          }}>
            <Typography variant="body2" color="text.secondary">
              {new Date(doc.upload_date).toLocaleDateString()}
            </Typography>
            
            {doc.file_size && (
              <Typography variant="body2" color="text.secondary">
                {formatFileSize(doc.file_size)}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ 
            mt: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            {getStatusIcon(doc, theme)}
            <Typography 
              variant="body2" 
              sx={{ 
                fontWeight: 500, 
                color: getStatusColor(doc,theme)
              }}
            >
              {getStatusText(doc)}
            </Typography>
          </Box>
        </CardContent>
        
        <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.1) }} />
        
        <CardActions 
          sx={{ 
            p: 2, 
            justifyContent: 'space-between',
            backgroundColor: theme.palette.mode === 'dark'
              ? alpha(theme.palette.background.default, 0.2)
              : alpha(theme.palette.background.default, 0.3)
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View Data">
              <IconButton 
                size="small" 
                color="primary"
                onClick={() => onView(doc.id)}
                sx={{
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.1)
                    : alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                <TableChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton 
                size="small" 
                color="primary" 
                onClick={() => onDownload(doc)}
                sx={{
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.1)
                    : alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                <CloudDownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Details">
              <IconButton 
                size="small" 
                color="primary"
                onClick={() => onDetails(doc)}
                sx={{
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.1)
                    : alpha(theme.palette.primary.main, 0.05),
                  '&:hover': {
                    backgroundColor: theme.palette.mode === 'dark'
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Tooltip title={isFavorite ? "Remove Favorite" : "Add to Favorites"}>
            <IconButton 
              size="small" 
              onClick={() => onToggleFavorite(doc.id)}
              sx={{
                color: isFavorite 
                  ? theme.palette.warning.main 
                  : 'text.secondary',
                backgroundColor: isFavorite
                  ? alpha(theme.palette.warning.main, 0.1)
                  : theme.palette.mode === 'dark'
                    ? alpha(theme.palette.background.paper, 0.3)
                    : alpha(theme.palette.background.paper, 0.5),
                '&:hover': {
                  backgroundColor: isFavorite
                    ? alpha(theme.palette.warning.main, 0.2)
                    : theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.paper, 0.4)
                      : alpha(theme.palette.background.paper, 0.7),
                }
              }}
            >
              {isFavorite ? (
                <StarIcon fontSize="small" />
              ) : (
                <StarBorderIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </CardActions>
      </Card>
    </motion.div>
  );
};

export default DocumentCard;
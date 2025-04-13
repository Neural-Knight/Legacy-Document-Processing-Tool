import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  alpha,
  useTheme
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { motion } from 'framer-motion';

interface DocumentsEmptyStateProps {
  searchQuery: string;
  onUpload: () => void;
}

const DocumentsEmptyState: React.FC<DocumentsEmptyStateProps> = ({ searchQuery, onUpload }) => {
  const theme = useTheme();
  
  return (
    <Paper sx={{ 
      p: 6, 
      textAlign: 'center', 
      borderRadius: '16px',
      background: theme.palette.mode === 'dark'
        ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`
        : `linear-gradient(145deg, ${alpha('#fff', 0.9)} 0%, ${alpha('#fafafa', 0.7)} 100%)`,
      backdropFilter: 'blur(10px)',
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      boxShadow: theme.palette.mode === 'dark'
        ? '0 10px 40px rgba(0, 0, 0, 0.2)'
        : '0 10px 40px rgba(0, 0, 0, 0.03)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Box sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.2
            }}
          >
            <Box sx={{ 
              width: 100,
              height: 100,
              borderRadius: '24px',
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: theme.palette.mode === 'dark'
                ? `linear-gradient(145deg, ${alpha(theme.palette.primary.dark, 0.2)} 0%, ${alpha(theme.palette.secondary.dark, 0.2)} 100%)`
                : `linear-gradient(145deg, ${alpha(theme.palette.primary.light, 0.2)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
              boxShadow: theme.palette.mode === 'dark'
                ? `0 8px 32px 0 ${alpha(theme.palette.primary.dark, 0.3)}`
                : `0 8px 32px 0 ${alpha(theme.palette.primary.main, 0.15)}`,
            }}>
              <FolderIcon sx={{ 
                fontSize: 50, 
                color: theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.main 
              }} />
            </Box>
          </motion.div>
          
          <Typography variant="h5" gutterBottom fontWeight={600}>
            {searchQuery ? 'No matching documents found' : 'No Documents Found'}
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500 }}>
            {searchQuery
              ? `We couldn't find any documents matching "${searchQuery}". Try changing your search or upload a new document.`
              : 'Upload a document to get started with extraction and analysis of your data.'
            }
          </Typography>
          
          <Button 
            variant="contained" 
            size="large"
            onClick={onUpload}
            startIcon={<UploadFileIcon />}
            sx={{ 
              px: 4,
              py: 1.5,
              borderRadius: '12px',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
              background: theme.palette.mode === 'dark'
                ? theme.palette.primary.dark 
                : theme.palette.primary.main,
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 20px rgba(0, 0, 0, 0.15)',
              }
            }}
          >
            Upload Document
          </Button>
        </Box>
      </motion.div>
    </Paper>
  );
};

export default DocumentsEmptyState;
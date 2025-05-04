import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Tabs,
  Tab
} from '@mui/material';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

// Services and Helpers
import { getDocumentById, downloadDocument, Document } from '../services/documentService';
import { getFavoriteDocuments, toggleFavoriteDocument } from '../services/dashboardService';
import { getOriginalName, isProcessed } from '../utils/documentHelpers.tsx';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`document-tabpanel-${index}`}
      aria-labelledby={`document-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `document-tab-${index}`,
    'aria-controls': `document-tabpanel-${index}`,
  };
}

const DocumentViewerPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get document details
        const doc = await getDocumentById(documentId);
        setDocument(doc);
        
        // Check if it's a favorite
        const favorites = await getFavoriteDocuments();
        setIsFavorite(favorites.some(favDoc => String(favDoc.id) === documentId)); 
      } catch (err: any) {
        console.error('Error loading document:', err);
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    
    loadDocument();
  }, [documentId]);

  const handleDownload = async () => {
    if (!document) return;
    
    try {
      await downloadDocument(
        document.id, 
        document.file_path, 
        getOriginalName(document.filename),
        document.file_type
      );
    } catch (err: any) {
      console.error('Download failed:', err);
      setError('Failed to download document');
    }
  };

  const handleToggleFavorite = async () => {
    if (!document) return;
    
    try {
      await toggleFavoriteDocument(document.id, !isFavorite);
      setIsFavorite(!isFavorite);
    } catch (err: any) {
      console.error('Failed to toggle favorite status:', err);
      setError('Failed to update favorite status');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '80vh'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/documents')}>
              Back to Documents
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!document) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/documents')}>
              Back to Documents
            </Button>
          }
        >
          Document not found
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            sx={{ mr: 1 }}
            onClick={() => navigate('/documents')}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            {getOriginalName(document.filename)}
          </Typography>
        </Box>
        
        <Box>
          <Tooltip title="Download Document">
            <IconButton 
              onClick={handleDownload}
              sx={{
                mr: 1,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                }
              }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}>
            <IconButton 
              onClick={handleToggleFavorite}
              sx={{
                color: isFavorite ? theme.palette.warning.main : 'inherit',
                '&:hover': {
                  color: isFavorite ? theme.palette.warning.main : theme.palette.warning.light
                }
              }}
            >
              {isFavorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {/* Content Tabs */}
      <Paper 
        elevation={0}
        sx={{ 
          borderRadius: '16px',
          boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            aria-label="document content tabs"
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontSize: '1rem',
                minHeight: 48,
                px: 3
              }
            }}
          >
            <Tab label="Data View" {...a11yProps(0)} />
            <Tab label="Raw Content" {...a11yProps(1)} />
            <Tab label="Processing Details" {...a11yProps(2)} />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {/* Data View (structured tables, etc.) */}
          <Box sx={{ minHeight: '400px' }}>
            {/* In a real implementation, this would show structured data from the document */}
            <Typography variant="body1">
              Structured data from the document would be displayed here based on the processing results.
            </Typography>
            
            {/* Placeholder for structured data view */}
            <Box sx={{ 
              mt: 3, 
              p: 3, 
              backgroundColor: alpha(theme.palette.background.default, 0.6),
              borderRadius: '8px',
              border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`
            }}>
              <Typography variant="body2" color="text.secondary">
                {isProcessed(document) 
                  ? 'This document has been processed. The extracted data would be displayed here.'
                  : 'This document is still being processed or encountered errors during processing.'}
              </Typography>
            </Box>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {/* Raw Content */}
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="body1" mb={2}>
              Raw content extracted from document:
            </Typography>
            
            {/* Placeholder for raw content */}
            <Box sx={{ 
              p: 3, 
              backgroundColor: alpha(theme.palette.background.default, 0.6),
              borderRadius: '8px',
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto'
            }}>
              {/* This would contain actual document text content in a real implementation */}
              <Typography variant="body2" component="code" sx={{ display: 'block' }}>
                {`# Document Content\n\nThis would contain the actual text content extracted from ${getOriginalName(document.filename)}.\n\nIn a real implementation, this would display the raw text, JSON, or other format of the document's content depending on its type.`}
              </Typography>
            </Box>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {/* Processing Details */}
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="body1" mb={2}>
              Document Processing Information:
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Processing Status</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {isProcessed(document) 
                  ? 'This document has been successfully processed.' 
                  : document.processing_error 
                    ? 'This document encountered errors during processing.' 
                    : 'This document is currently being processed.'}
              </Typography>
              {document.processing_error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Error: {document.processing_error}
                  </Typography>
                </Alert>
              )}
            </Box>
            
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2">Processing Details</Typography>
              <Box sx={{ 
                mt: 1,
                p: 2, 
                backgroundColor: alpha(theme.palette.background.default, 0.6),
                borderRadius: '8px',
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
              }}>
                <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                  <strong>Processing Method:</strong> Automatic Text Extraction
                </Typography>
              </Box>
            </Box>
          </Box>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default DocumentViewerPage;
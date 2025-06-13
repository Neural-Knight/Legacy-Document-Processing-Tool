import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

// Services and Helpers
import { getDocumentById, downloadDocument, Document } from '../services/documentService';
import { getFavoriteDocuments, toggleFavoriteDocument } from '../services/dashboardService';
import { getOriginalName } from '../utils/documentHelpers.tsx';
import DocumentContentViewer from '../components/DocumentContent/DocumentContentViewer';

// interface TabPanelProps {
//   children?: React.ReactNode;
//   index: number;
//   value: number;
// }

// function TabPanel(props: TabPanelProps) {
//   const { children, value, index, ...other } = props;

//   return (
//     <div
//       role="tabpanel"
//       hidden={value !== index}
//       id={`document-tabpanel-${index}`}
//       aria-labelledby={`document-tab-${index}`}
//       {...other}
//     >
//       {value === index && (
//         <Box sx={{ p: 3 }}>
//           {children}
//         </Box>
//       )}
//     </div>
//   );
// }

// function a11yProps(index: number) {
//   return {
//     id: `document-tab-${index}`,
//     'aria-controls': `document-tabpanel-${index}`,
//   };
// }

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

  // const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
  //   setTabValue(newValue);
  // };

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
      {/* Content Viewer */}
      <DocumentContentViewer 
        documentId={documentId || ''} 
        selectedTab={tabValue}
        onTabChange={(newValue) => setTabValue(newValue)}
      />
    </Box>
  );
};

export default DocumentViewerPage;
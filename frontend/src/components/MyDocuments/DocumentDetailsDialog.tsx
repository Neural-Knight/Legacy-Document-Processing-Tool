import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';

import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { Document } from '../../services/documentService';
import {
  getDocumentIcon,
  getDocumentType,
  getOriginalName,
  formatFileSize,
  getStatusIcon,
  getStatusText
} from '../../utils/documentHelpers.tsx';

interface DocumentDetailsDialogProps {
  open: boolean;
  document: Document | null;
  onClose: () => void;
  onDownload: (doc: Document) => void;
  onView: (docId: string) => void;
  onDelete: (docId: string) => void;
}

const DocumentDetailsDialog: React.FC<DocumentDetailsDialogProps> = ({
  open,
  document: selectedDocument,
  onClose,
  onDownload,
  onView,
  onDelete
}) => {
  const theme = useTheme();

  if (!selectedDocument) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '16px',
          background: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.background.paper, 0.95)
            : theme.palette.background.paper,
          backdropFilter: 'blur(10px)',
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1, 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        background: theme.palette.mode === 'dark'
          ? `linear-gradient(90deg, ${alpha(theme.palette.primary.dark, 0.2)} 0%, transparent 100%)`
          : `linear-gradient(90deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, transparent 100%)`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
      }}>
        <Typography variant='h6'>Document Details</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Box sx={{ 
            p: 1.5,
            mr: 2,
            borderRadius: '12px',
            background: theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.dark, 0.2)
              : alpha(theme.palette.primary.light, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getDocumentIcon(selectedDocument.filename)}
          </Box>
          <Box>
            <Typography variant="h6" gutterBottom>{getOriginalName(selectedDocument.filename)}</Typography>
            <Typography variant="body2" color="text.secondary">{getDocumentType(selectedDocument.filename)}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1, mb: 2 }}>
          <Box sx={{ width: { xs: '100%', sm: '50%' }, p: 1 }}>
            <Typography variant="body2" color="text.secondary">Upload Date</Typography>
            <Typography variant="body1">
              {new Date(selectedDocument.upload_date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: '50%' }, p: 1 }}>
            <Typography variant="body2" color="text.secondary">File Size</Typography>
            <Typography variant="body1">
              {selectedDocument.file_size ? formatFileSize(selectedDocument.file_size) : 'Unknown'}
            </Typography>
          </Box>
          <Box sx={{ width: '100%', p: 1 }}>
            <Typography variant="body2" color="text.secondary">Status</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              {getStatusIcon(selectedDocument, theme)}
              <Typography variant="body1" sx={{ ml: 1 }}>
                {getStatusText(selectedDocument)}
              </Typography>
            </Box>
          </Box>
          {selectedDocument.processing_error && (
            <Box sx={{ width: '100%', p: 1 }}>
              <Typography variant="body2" color="text.secondary">Processing Error</Typography>
              <Typography variant="body1" color="error.main">
                {selectedDocument.processing_error}
              </Typography>
            </Box>
          )}
          <Box sx={{ width: '100%', p: 1 }}>
            <Typography variant="body2" color="text.secondary">File Path</Typography>
            <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
              {selectedDocument.file_path}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
      <Button 
          onClick={() => {
            onClose();
            onView(selectedDocument.id);
          }} 
          startIcon={<TableChartIcon />}
          variant="outlined"
        >
          View Data
        </Button>
        <Button 
          onClick={() => onDownload(selectedDocument)} 
          startIcon={<CloudDownloadIcon />}
          variant="outlined"
        >
          Download
        </Button>
        <Button 
          onClick={() => {
            onClose();
            onDelete(selectedDocument.id);
          }} 
          startIcon={<DeleteIcon />}
          variant="contained" 
          color="error"
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentDetailsDialog;
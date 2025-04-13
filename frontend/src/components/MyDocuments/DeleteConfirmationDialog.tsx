import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  alpha,
  useTheme,
  IconButton
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface DeleteConfirmationDialogProps {
  open: boolean;
  documentName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  documentName,
  onClose,
  onConfirm
}) => {
  const theme = useTheme();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          maxWidth: '450px',
          width: '100%',
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        pb: 1,
        background: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.error.dark, 0.1)
          : alpha(theme.palette.error.light, 0.1),
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningAmberIcon 
            fontSize="small" 
            color="error" 
            sx={{ mr: 1 }} 
          />
          <Typography variant="h6" component="span">
            Confirm Deletion
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          display: 'flex',
          justifyContent: 'center', 
          background: theme.palette.mode === 'dark' 
            ? alpha(theme.palette.error.dark, 0.05)
            : alpha(theme.palette.error.light, 0.05),
          borderRadius: '8px',
        }}>
          <DeleteForeverIcon 
            color="error" 
            sx={{ 
              fontSize: 64,
              opacity: 0.8
            }} 
          />
        </Box>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Are you sure you want to delete <strong>{documentName}</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          This action cannot be undone and will permanently delete:
        </Typography>
        <Box component="ul" sx={{ 
          pl: 2, 
          color: 'text.secondary',
          '& li': {
            mb: 0.5
          }
        }}>
          <Typography component="li" variant="body2">
            The document file
          </Typography>
          <Typography component="li" variant="body2">
            All extracted data
          </Typography>
          <Typography component="li" variant="body2">
            Associated metadata and processing results
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ 
        p: 2, 
        pt: 0,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <Button 
          onClick={onClose}
          variant="outlined"
          sx={{ minWidth: '120px' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm}
          variant="contained" 
          color="error"
          startIcon={<DeleteForeverIcon />}
          sx={{ 
            minWidth: '120px',
            boxShadow: theme.palette.mode === 'dark' 
              ? `0 4px 12px ${alpha(theme.palette.error.main, 0.4)}`
              : `0 4px 12px ${alpha(theme.palette.error.main, 0.2)}`,
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteConfirmationDialog;
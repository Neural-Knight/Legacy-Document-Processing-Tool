import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Snackbar,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Slide
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import CloseIcon from '@mui/icons-material/Close';
import { uploadDocument } from "../../services/documentService";
import { fileStorage } from '../../utils/fileStorage';

// Import components
import DragDropArea from '../FileUpload/DragDropArea';
import FileList from '../FileUpload/FileList';
import FilePreview from '../FileUpload/FilePreview';
import UploadProgress from '../FileUpload/UploadProgress';
import UploadActions from '../FileUpload/UploadActions';

// Import types and utilities
import { FileUploadStatus } from '../../types/fileUploadtypes';
import { calculateOverallProgress, isAnyFileUploading,isStatisticalDocument } from '../../utils/fileUploadUtils';

// Dialog transition
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  initialFiles?: File[];
  onUploadComplete?: (documentIds: string[]) => void;
}

/**
 * Modal dialog component for file upload
 */
const UploadDialog: React.FC<UploadDialogProps> = ({ 
  open, 
  onClose, 
  initialFiles = [],
  onUploadComplete
}) => {
  const theme = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const [dragCounter, setDragCounter] = useState(0);
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  const [uploadedDocumentIds, setUploadedDocumentIds] = useState<string[]>([]);
  
  const isDarkMode = theme.palette.mode === 'dark';
  const overallProgress = calculateOverallProgress(fileStatuses);
  const uploadingAny = isAnyFileUploading(fileStatuses);

  // Set initial files when dialog opens
  useEffect(() => {
    if (open && initialFiles.length > 0) {
      validateAndAddFiles(initialFiles);
    }
  }, [open, initialFiles]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Only reset on close if not uploading
      if (!uploadingAny) {
        setFiles([]);
        setFileStatuses([]);
        setGlobalError(null);
        setGlobalSuccess(false);
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setUploadedDocumentIds([]);
      }
    }
  }, [open, uploadingAny, previewUrl]);

  // Initialize file statuses when files change
  useEffect(() => {
    const newStatuses = files.map((_, index) => {
      const existingStatus = fileStatuses.find(status => status.fileIndex === index);
      if (existingStatus) {
        return existingStatus;
      }
      return {
        fileIndex: index,
        uploading: false,
        progress: 0,
        error: null,
        success: false,
        cancelled: false
      };
    });

    setFileStatuses(newStatuses);
  }, [files]);

  // Check for completed uploads and set global success
  useEffect(() => {
    const allProcessed = fileStatuses.every(status =>
      status.success || (status.error !== null) || status.cancelled
    );

    if (allProcessed && fileStatuses.some(status => status.success)) {
      setGlobalSuccess(true);
    }
  }, [fileStatuses]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (dragCounter === 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      validateAndAddFiles(droppedFiles);
    }
  };

  const validateAndAddFiles = (newFiles: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Set maximum file size to 50MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024;

    newFiles.forEach(file => {
      // Check if file is a valid statistical document
      if(!isStatisticalDocument(file)){
        errors.push(`${file.name} is not a supported statistical document format`)
        return
      }
      // Check file size limit
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 50MB size limit`);
        return;
      }

      // Check if file already exists in the list
      const fileExists = files.some(f =>
        f.name === file.name &&
        f.size === file.size &&
        f.lastModified === file.lastModified
      );

      if (fileExists) {
        errors.push(`${file.name} is already in the list`);
        return;
      }

      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      setGlobalError(null);
    }

    if (errors.length > 0) {
      setGlobalError(errors.join('. '));
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = files[index];

    // Cancel upload if in progress
    if (fileStatuses[index]?.uploading) {
      setFileStatuses(prev => {
        const newStatuses = [...prev];
        const statusIndex = newStatuses.findIndex(s => s.fileIndex === index);
        if (statusIndex !== -1) {
          newStatuses[statusIndex] = {
            ...newStatuses[statusIndex],
            uploading: false,
            cancelled: true,
            error: "Upload cancelled"
          };
        }
        return newStatuses;
      });
    }

    // Remove file from list
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });

    // Update other files' indexes
    setFileStatuses(prev => {
      return prev
        .filter(status => status.fileIndex !== index)
        .map(status => ({
          ...status,
          fileIndex: status.fileIndex > index ? status.fileIndex - 1 : status.fileIndex
        }));
    });

    try {
      await fileStorage.removeFile(fileToRemove);
    } catch (error) {
      console.error('Error removing file from storage:', error);
    }

    // If removing the previewed file, close the preview
    if (previewUrl && index === files.findIndex(file => URL.createObjectURL(file) === previewUrl)) {
      handleClosePreview();
    }
  };

  const handlePreviewFile = (file: File) => {
    // Clean up previous preview URL to avoid memory leaks
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    // Delay revoking the URL until after animation completes
    setTimeout(() => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }, 300);
  };
  
  // Upload a single file with progress tracking
  const uploadSingleFile = async (fileIndex: number) => {
    const file = files[fileIndex];
    if (!file) return { success: false, fileIndex };

    // Set file as uploading
    setFileStatuses(prev => {
      const newStatuses = [...prev];
      const statusIndex = newStatuses.findIndex(s => s.fileIndex === fileIndex);
      if (statusIndex !== -1) {
        newStatuses[statusIndex] = {
          ...newStatuses[statusIndex],
          uploading: true,
          progress: 0,
          error: null,
          success: false,
          cancelled: false
        };
      }
      return newStatuses;
    });

    try {
      // Use the actual API with progress tracking
      const result = await uploadDocument(
        file,
        (progress) => {
          // Update progress from the actual API
          setFileStatuses(prev => {
            const newStatuses = [...prev];
            const statusIndex = newStatuses.findIndex(s => s.fileIndex === fileIndex);
            if (statusIndex !== -1 && !newStatuses[statusIndex].cancelled) {
              newStatuses[statusIndex] = {
                ...newStatuses[statusIndex],
                progress: Math.min(progress, 95) // Cap at 95% until fully complete
              };
            }
            return newStatuses;
          });
        }
      );

      // Mark as complete
      setFileStatuses(prev => {
        const newStatuses = [...prev];
        const statusIndex = newStatuses.findIndex(s => s.fileIndex === fileIndex);
        if (statusIndex !== -1 && !newStatuses[statusIndex].cancelled) {
          newStatuses[statusIndex] = {
            ...newStatuses[statusIndex],
            uploading: false,
            progress: 100,
            success: true
          };
        }
        return newStatuses;
      });
      
      // Store the uploaded document ID
      if (result && result.id) {
        setUploadedDocumentIds(prev => [...prev, result.id]);
      }
      
      return { success: true, fileIndex, documentId: result.id };
    } catch (err) {
      // Handle error for this specific file
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during upload';

      setFileStatuses(prev => {
        const newStatuses = [...prev];
        const statusIndex = newStatuses.findIndex(s => s.fileIndex === fileIndex);
        if (statusIndex !== -1 && !newStatuses[statusIndex].cancelled) {
          newStatuses[statusIndex] = {
            ...newStatuses[statusIndex],
            uploading: false,
            error: errorMessage
          };
        }
        return newStatuses;
      });

      return { success: false, fileIndex, error: errorMessage };
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Reset global states
    setGlobalError(null);
    setGlobalSuccess(false);
    setUploadedDocumentIds([]);

    // Process all files in parallel
    const uploadPromises = files.map((_, index) => {
      // Skip files that are already uploaded or have errors
      const status = fileStatuses.find(s => s.fileIndex === index);
      if (status?.success || status?.error) {
        return Promise.resolve({ 
          success: !!status.success, 
          fileIndex: index,
          documentId: status.success ? uploadedDocumentIds[index] : undefined
        });
      }
    return uploadSingleFile(index).catch(err => {
      console.error(`Error uploading file ${index}:`, err);
      return { success: false, fileIndex: index, documentId: undefined, error: err };
    });
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result.success);
      const documentIds = results
        .filter(result => result.success && result.documentId)
        .map(result => result.documentId as string);

      if (successfulUploads.length > 0) {
        // If we have at least one success, consider the overall operation successful
        setGlobalSuccess(true);

        // Get indexes of successful files
        const successIndexes = successfulUploads.map(result => result.fileIndex);

        // Notify parent component of successful uploads if callback exists
        if (onUploadComplete && documentIds.length > 0) {
          // Wait a bit to show the success state before potentially closing
          setTimeout(() => {
            onUploadComplete(documentIds);
          }, 800);
        }

        // Schedule cleanup
        setTimeout(() => {
          // Use functional updates to ensure we're working with the latest state
          setFiles(prevFiles => {
            const filesToKeep = prevFiles.filter((_, i) => !successIndexes.includes(i));

            // Use an immediately invoked async function for storage operations
            (async () => {
              // Clear files from storage
              await fileStorage.clearFiles();

              // If any files remain, store them
              if (filesToKeep.length > 0) {
                await fileStorage.storeFiles(filesToKeep);
              }
            })();

            return filesToKeep;
          });

          // Update fileStatuses to remove successful files
          setFileStatuses(prevStatuses =>
            prevStatuses.filter(s => !successIndexes.includes(s.fileIndex))
          );
        }, 2000);
      }
    } catch (err) {
      console.error('Unhandled error during upload:', err);
    }
  };

  const handleCancel = async () => {
    // Cancel all in-progress uploads
    fileStatuses.forEach(status => {
      if (status.uploading) {
        setFileStatuses(prev => {
          const newStatuses = [...prev];
          const statusIndex = newStatuses.findIndex(s => s.fileIndex === status.fileIndex);
          if (statusIndex !== -1) {
            newStatuses[statusIndex] = {
              ...newStatuses[statusIndex],
              uploading: false,
              cancelled: true,
              error: "Upload cancelled"
            };
          }
          return newStatuses;
        });
      }
    });

    setFiles([]);
    setFileStatuses([]);
    setGlobalError(null);
    setGlobalSuccess(false);
    setUploadedDocumentIds([]);
    await fileStorage.clearFiles();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewOpen(false);
    }
  };

  const handleDialogClose = () => {
    if (!uploadingAny) {
      onClose();
    } else {
      setGlobalError("Please cancel or complete uploads before closing");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      fullWidth
      maxWidth="md"
      TransitionComponent={Transition}
      PaperProps={{
        sx: {
          borderRadius: '12px',
          overflow: 'hidden',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
          Upload Documents
        </Typography>
        <IconButton
          edge="end"
          color="inherit"
          onClick={handleDialogClose}
          aria-label="close"
          disabled={uploadingAny}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Upload statistical documents for automated content extraction and analysis.
            Supported formats: Excel (.xlsx, .xls), CSV, PDF with tables.
          </Typography>
        </Box>
        
        {/* Drag and drop area */}
        <DragDropArea
          isDragging={isDragging}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleFileSelect={handleFileSelect}
          files={files}
          uploading={uploadingAny}
          dropAreaRef={dropAreaRef}
          isDarkMode={isDarkMode}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".xlsx,.xls,.csv,.pdf,.json,.xml"
            onChange={handleFileChange}
            disabled={uploadingAny}
            multiple
          />
        </DragDropArea>

        {/* File list */}
        <FileList
          files={files}
          fileStatuses={fileStatuses}
          handleRemoveFile={handleRemoveFile}
          handlePreviewFile={handlePreviewFile}
          isDarkMode={isDarkMode}
        />

        {/* Upload actions */}
        <UploadActions
          files={files}
          uploading={uploadingAny}
          fileStatuses={fileStatuses}
          handleUpload={handleUpload}
          handleCancel={handleCancel}
          isDarkMode={isDarkMode}
        />

        {/* Upload progress */}
        <UploadProgress
          uploading={uploadingAny}
          progress={overallProgress}
          fileStatuses={fileStatuses}
          files={files}
          isDarkMode={isDarkMode}
        />

        {/* File preview */}
        <FilePreview
          previewOpen={previewOpen}
          previewUrl={previewUrl}
          handleClosePreview={handleClosePreview}
        />

        {/* Notification snackbars */}
        <Snackbar
          open={!!globalError}
          autoHideDuration={6000}
          onClose={() => setGlobalError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="error"
            onClose={() => setGlobalError(null)}
            sx={{
              borderRadius: '10px',
              boxShadow: `0 8px 16px ${alpha(theme.palette.error.main, 0.24)}`
            }}
          >
            {globalError}
          </Alert>
        </Snackbar>

        <Snackbar
          open={globalSuccess}
          autoHideDuration={6000}
          onClose={() => setGlobalSuccess(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            onClose={() => setGlobalSuccess(false)}
            sx={{
              borderRadius: '10px',
              boxShadow: `0 8px 16px ${alpha(theme.palette.success.main, 0.24)}`
            }}
          >
            Documents processed successfully!
          </Alert>
        </Snackbar>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
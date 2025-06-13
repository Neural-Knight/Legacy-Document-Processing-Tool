import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Snackbar,
  alpha,
  useTheme
} from '@mui/material';
import { motion } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import { useNavigate } from 'react-router-dom';
import { uploadDocument } from "../services/documentService"
import { fileStorage } from '../utils/fileStorage'; // Adjust the import path as necessary

// Import components
import DragDropArea from '../components/FileUpload/DragDropArea';
import FileList from '../components/FileUpload/FileList';
import FilePreview from '../components/FileUpload/FilePreview';
import PageDragOverlay from '../components/FileUpload/PageDragOverlay';
import UploadProgress from '../components/FileUpload/UploadProgress';
import UploadActions from '../components/FileUpload/UploadActions';
// Import types and utilities
import { FileUploadStatus } from '../types/fileUploadtypes';
import { calculateOverallProgress, isAnyFileUploading, isStatisticalDocument } from '../utils/fileUploadUtils';

/**
 * Main component for the file upload page
 */
const UploadPage: React.FC = () => {
  const theme = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPageDragging, setIsPageDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const [dragCounter, setDragCounter] = useState(0);
  const [pageDragCounter, setPageDragCounter] = useState(0);
  // Track individual file upload status
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  // const navigate = useNavigate();

  const isDarkMode = theme.palette.mode === 'dark';

  // Track mouse position for interactive background effects
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Calculate overall progress
  const overallProgress = calculateOverallProgress(fileStatuses);

  // Check if any file is currently uploading
  const uploadingAny = isAnyFileUploading(fileStatuses);

  // Initialize file statuses when files change
  useEffect(() => {
    // Initialize status for each file that doesn't have one yet
    const newStatuses = files.map((_, index) => {
      // Find existing status or create a new one
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
    // Check if all files have been processed (success or error)
    const allProcessed = fileStatuses.every(status =>
      status.success || (status.error !== null) || status.cancelled
    );

    // Set global success state if all files have been processed and at least one succeeded
    if (allProcessed && fileStatuses.some(status => status.success)) {
      setGlobalSuccess(true);
    }
  }, [fileStatuses]);

  // Listen for page-level drag events
  useEffect(() => {
    const handlePageDragEnter = (e: DragEvent) => {
      e.preventDefault();
      setPageDragCounter(prev => prev + 1);
      if (pageDragCounter === 0) {
        setIsPageDragging(true);
      }
    };

    const handlePageDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setPageDragCounter(prev => prev - 1);
      if (pageDragCounter <= 1) {
        setIsPageDragging(false);
      }
    };

    const handlePageDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handlePageDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsPageDragging(false);
      setPageDragCounter(0);
    };

    document.addEventListener('dragenter', handlePageDragEnter);
    document.addEventListener('dragleave', handlePageDragLeave);
    document.addEventListener('dragover', handlePageDragOver);
    document.addEventListener('drop', handlePageDrop);

    return () => {
      document.removeEventListener('dragenter', handlePageDragEnter);
      document.removeEventListener('dragleave', handlePageDragLeave);
      document.removeEventListener('dragover', handlePageDragOver);
      document.removeEventListener('drop', handlePageDrop);
    };
  }, [pageDragCounter]);

  // Effect for tracking mouse movement across the drop zone
  useEffect(() => {
    const trackMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('mousemove', trackMouseMove);

    return () => {
      document.removeEventListener('mousemove', trackMouseMove);
    };
  }, []);

  // Effect for animated background on the drop zone
  useEffect(() => {
    const dropArea = dropAreaRef.current;
    if (!dropArea) return;

    const updateBackgroundEffect = () => {
      if (isDragging || uploadingAny) return;

      const rect = dropArea.getBoundingClientRect();

      // Calculate relative mouse position within the element
      const relativeX = mousePosition.x - rect.left;
      const relativeY = mousePosition.y - rect.top;

      // Check if mouse is within the element bounds
      if (relativeX >= 0 && relativeX <= rect.width && relativeY >= 0 && relativeY <= rect.height) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const xOffset = (relativeX - centerX) / centerX * 15;
        const yOffset = (relativeY - centerY) / centerY * 15;

        dropArea.style.backgroundPosition = `${50 + xOffset}% ${50 + yOffset}%`;

        // Subtle shadow movement
        const shadowX = xOffset / 5;
        const shadowY = yOffset / 5;
        dropArea.style.boxShadow = isDarkMode
          ? `0 10px 25px rgba(0,0,0,0.2), ${shadowX}px ${shadowY}px 15px rgba(29,222,240,0.07)`
          : `0 10px 25px rgba(0,0,0,0.07), ${shadowX}px ${shadowY}px 15px rgba(0,0,0,0.05)`;
      }
    };

    // Use requestAnimationFrame for smoother animation
    let animationFrameId: number;

    const animate = () => {
      updateBackgroundEffect();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging, uploadingAny, mousePosition, isDarkMode]);

  // Simulate progress updates during processing for a specific file
  const simulateProgress = useCallback((fileIndex: number) => {
    // Start file upload simulation (0-50%)
    const uploadInterval = setInterval(() => {
      setFileStatuses(prevStatuses => {
        const newStatuses = [...prevStatuses];
        const statusIndex = newStatuses.findIndex(s => s.fileIndex === fileIndex);

        if (statusIndex === -1 || newStatuses[statusIndex].progress >= 50 || !newStatuses[statusIndex].uploading) {
          clearInterval(uploadInterval);
          return prevStatuses;
        }

        newStatuses[statusIndex] = {
          ...newStatuses[statusIndex],
          progress: newStatuses[statusIndex].progress + 1
        };

        return newStatuses;
      });
    }, 50);

    // After reaching 50%, simulate processing progress (50-100%)
    setTimeout(() => {
      const processInterval = setInterval(() => {
        setFileStatuses(prevStatuses => {
          const newStatuses = [...prevStatuses];
          const statusIndex = newStatuses.findIndex(s => s.fileIndex === fileIndex);

          if (statusIndex === -1 || newStatuses[statusIndex].progress >= 95 || !newStatuses[statusIndex].uploading) {
            clearInterval(processInterval);
            return prevStatuses;
          }

          newStatuses[statusIndex] = {
            ...newStatuses[statusIndex],
            progress: newStatuses[statusIndex].progress + 1
          };

          return newStatuses;
        });
      }, 200);
    }, 2500);
  }, []);

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
    setIsPageDragging(false);
    setPageDragCounter(0);

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
      if (!isStatisticalDocument(file)) {
      errors.push(`${file.name} is not a supported statistical document format`);
      return;
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

  // Load files from IndexedDB on component mount
  useEffect(() => {
    const loadStoredFiles = async () => {
      try {
        const storedFiles = await fileStorage.getFiles();
        if (storedFiles.length > 0) {
          setFiles(storedFiles);
        }
      } catch (error) {
        console.error('Error loading stored files:', error);
      }
    };

    loadStoredFiles();
  }, []);

  // Store files in IndexedDB when they change
  useEffect(() => {
    const storeFiles = async () => {
      try {
        await fileStorage.storeFiles(files);
      } catch (error) {
        console.error('Error storing files:', error);
      }
    };

    if (files.length > 0) {
      storeFiles();
    }
  }, [files]);

  // Handle cancellation of all uploads
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
    await fileStorage.clearFiles();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewOpen(false);
    }
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

    // Start progress simulation
    simulateProgress(fileIndex);
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
      console.log("Upload result: ", result);

      // Return success status with fileIndex
      return { success: true, fileIndex };
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

  // Then modify handleUpload to use these results directly
  const handleUpload = async () => {
    if (files.length === 0) return;

    // Reset global states
    setGlobalError(null);
    setGlobalSuccess(false);

    // Process all files in parallel
    const uploadPromises = files.map((_, index) => {
      // Skip files that are already uploaded or have errors
      const status = fileStatuses.find(s => s.fileIndex === index);
      if (status?.success || status?.error) {
        return Promise.resolve({ success: !!status.success, fileIndex: index });
      }
      return uploadSingleFile(index).catch(err => {
        console.error(`Error uploading file ${index}:`, err);
        return { success: false, fileIndex: index, error: err };
      });
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result.success);

      console.log("Upload results:", results);
      console.log("Successful uploads:", successfulUploads.length);

      if (successfulUploads.length > 0) {
        // If we have at least one success, consider the overall operation successful
        setGlobalSuccess(true);

        // Get indexes of successful files
        const successIndexes = successfulUploads.map(result => result.fileIndex);
        console.log("SuccessIndexes:", successIndexes);

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
      // This won't get called unless there's an unhandled error
      console.error('Unhandled error during upload:', err);
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 4 }}>
      {/* Page-level drag overlay */}
      <PageDragOverlay
        isPageDragging={isPageDragging}
        isDarkMode={isDarkMode}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            position: 'relative',
            display: 'inline-block',
            background: isDarkMode
              ? 'linear-gradient(90deg, #fff 0%, #e0e0e0 100%)'
              : 'black',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontWeight: 700,
            mb: 2
          }}
        >
          Upload Documents
        </Typography>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Typography variant="body1" color="text.secondary" paragraph>
          Upload any type of document for automated content extraction and analysis.
          The system will process your documents and extract relevant information.
        </Typography>
      </motion.div>

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
          accept="*/*" // Accept all file types
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
          icon={<CheckCircleIcon fontSize="inherit" />}
          onClose={() => setGlobalSuccess(false)}
          sx={{
            borderRadius: '10px',
            boxShadow: `0 8px 16px ${alpha(theme.palette.success.main, 0.24)}`
          }}
        >
          Documents processed successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UploadPage;
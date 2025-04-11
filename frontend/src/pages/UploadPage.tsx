import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress, 
  Alert, 
  Snackbar,
  LinearProgress,
  Stack,
  IconButton,
  Chip,
  Fade,
  Zoom,
  Tooltip,
  alpha,
  useTheme
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import TableChartIcon from '@mui/icons-material/TableChart';
import CodeIcon from '@mui/icons-material/Code';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import FilePresentIcon from '@mui/icons-material/FilePresent';
import ErrorIcon from '@mui/icons-material/Error';
import { useNavigate } from 'react-router-dom';
import { uploadDocument } from "../services/documentService"; // Adjust the import path as necessary
import { motion } from 'framer-motion'; // You'll need to install this package
import { fileStorage } from '../utils/fileStorage';

// New interface to track individual file upload status
interface FileUploadStatus {
  fileIndex: number;
  uploading: boolean;
  progress: number;
  error: string | null;
  success: boolean;
  cancelled: boolean;
}

const UploadFilePage: React.FC = () => {
  const theme = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isPageDragging, setIsPageDragging] = useState(false);
  const [uploadingAny, setUploadingAny] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
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
  const navigate = useNavigate();
  
  const isDarkMode = theme.palette.mode === 'dark';
  
  // Track mouse position for interactive background effects
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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

  // Calculate overall progress based on individual file progress
  useEffect(() => {
    if (fileStatuses.length === 0) {
      setOverallProgress(0);
      return;
    }
    
    const uploadingStatuses = fileStatuses.filter(status => status.uploading || status.success);
    if (uploadingStatuses.length === 0) {
      setOverallProgress(0);
      return;
    }
    
    const totalProgress = uploadingStatuses.reduce((sum, status) => sum + status.progress, 0);
    setOverallProgress(Math.round(totalProgress / uploadingStatuses.length));
    
    // Check if all files have been processed (success or error)
    const allProcessed = fileStatuses.every(status => 
      status.success || (status.error !== null) || status.cancelled
    );
    
    // Set global uploading state
    setUploadingAny(fileStatuses.some(status => status.uploading));
    
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

  // Modify handleCancel to clear IndexedDB
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
    setUploadingAny(false);
    setOverallProgress(0);
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
    if (!file) return;
    
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
      
      return result;
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
      
      throw err;
    }
  };

  // Modify handleUpload to process all files in parallel
  const handleUpload = async () => {
    if (files.length === 0) return;
    
    // Reset global states
    setGlobalError(null);
    setGlobalSuccess(false);
    setUploadingAny(true);
    
    // Process all files in parallel
    const uploadPromises = files.map((_, index) => {
      // Skip files that are already uploaded or have errors
      const status = fileStatuses.find(s => s.fileIndex === index);
      if (status?.success || status?.error) {
        return Promise.resolve();
      }
      return uploadSingleFile(index).catch(err => {
        console.error(`Error uploading file ${index}:`, err);
        // We've already handled the error in uploadSingleFile
        // Just catching here to prevent the Promise.all from failing completely
      });
    });
    
    try {
      await Promise.all(uploadPromises);
      
      // Count successful uploads
      const successCount = fileStatuses.filter(s => s.success).length;
      
      if (successCount > 0) {
        // If we have at least one success, consider the overall operation successful
        setGlobalSuccess(true);
        
        // Remove successfully uploaded files from storage after a delay
        setTimeout(async () => {
          // Get indexes of successful files
          const successIndexes = fileStatuses
            .filter(s => s.success)
            .map(s => s.fileIndex);
          
          // Update files state to remove successful files
          setFiles(prev => prev.filter((_, i) => !successIndexes.includes(i)));
          
          // Update fileStatuses to remove successful files
          setFileStatuses(prev => prev.filter(s => !successIndexes.includes(s.fileIndex)));
          
          // Clear files from storage
          await fileStorage.clearFiles();
          
          // If any files remain, store them
          if (files.length > successIndexes.length) {
            const remainingFiles = files.filter((_, i) => !successIndexes.includes(i));
            await fileStorage.storeFiles(remainingFiles);
          }
        }, 2000);
      }
    } catch (err) {
      // This won't get called unless there's an unhandled error
      console.error('Unhandled error during upload:', err);
    } finally {
      // Update uploading state based on individual file states
      setUploadingAny(fileStatuses.some(s => s.uploading));
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFileIcon = (file: File) => {
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

  // Get status text for a file
  const getFileStatusText = (index: number) => {
    const status = fileStatuses.find(s => s.fileIndex === index);
    
    if (!status) return '';
    if (status.success) return 'Completed';
    if (status.error) return 'Failed';
    if (status.cancelled) return 'Cancelled';
    if (status.uploading) {
      if (status.progress < 50) return 'Uploading...';
      if (status.progress < 95) return 'Processing...';
      return 'Finalizing...';
    }
    
    return '';
  };

  // Get progress color for a file
  const getProgressColor = (index: number) => {
    const status = fileStatuses.find(s => s.fileIndex === index);
    
    if (!status) return theme.palette.primary.main;
    if (status.success) return theme.palette.success.main;
    if (status.error || status.cancelled) return theme.palette.error.main;
    
    return theme.palette.primary.main;
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 4 }}>
      {/* Page-level drag overlay */}
      <Fade in={isPageDragging}>
        <Box 
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(theme.palette.background.default, 0.85),
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center', 
              maxWidth: 500,
              textAlign: 'center',
              p: 3,
            }}
          >
            <motion.div
              animate={{ 
                y: [0, -15, 0],
                scale: [1, 1.05, 1],
                transition: { 
                  y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                  scale: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                }
              }}
            >
              <CloudUploadIcon 
                sx={{ 
                  fontSize: 120, 
                  color: theme.palette.primary.main,
                  mb: 2,
                  filter: isDarkMode ? 'drop-shadow(0 0 12px rgba(29,222,240,0.6))' : undefined
                }} 
              />
            </motion.div>
            
            <Typography 
              variant="h3" 
              sx={{
                fontWeight: 'bold',
                mb: 2,
                background: isDarkMode 
                  ? `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` 
                  : undefined,
                backgroundClip: isDarkMode ? 'text' : undefined,
                WebkitBackgroundClip: isDarkMode ? 'text' : undefined,
                color: isDarkMode ? 'transparent' : 'text.primary',
                textAlign: 'center'
              }}
            >
              Drop Files Anywhere
            </Typography>
            
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              Release to upload your documents
            </Typography>
          </Box>
        </Box>
      </Fade>
    
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
              ? `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` 
              : theme.palette.primary.main,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
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
      
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Paper
          ref={dropAreaRef}
          sx={{
            p: 6,
            mt: 4,
            mb: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: isDragging 
              ? `3px dashed ${theme.palette.primary.main}`
              : `2px dashed ${isDarkMode ? alpha(theme.palette.primary.main, 0.4) : '#ccc'}`,
            borderRadius: 4,
            backgroundColor: isDragging 
              ? alpha(theme.palette.primary.main, 0.06)
              : theme.palette.background.paper,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'hidden',
            minHeight: 220,
            backgroundImage: isDarkMode && !isDragging && !uploadingAny
              ? 'radial-gradient(circle, rgba(29,222,240,0.07) 0%, rgba(123,232,84,0.04) 100%)' 
              : undefined,
            backgroundSize: '200% 200%',
            backgroundPosition: '50% 50%',
            '&::before': isDarkMode && isDragging ? {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle, rgba(29,222,240,0.15) 0%, rgba(123,232,84,0.08) 100%)',
              opacity: 0.7,
              zIndex: 0,
              animation: 'pulse 2s infinite'
            } : {},
            '@keyframes pulse': {
              '0%': { opacity: 0.5, backgroundSize: '100% 100%' },
              '50%': { opacity: 0.8, backgroundSize: '120% 120%' },
              '100%': { opacity: 0.5, backgroundSize: '100% 100%' }
            },
            boxShadow: isDragging 
              ? `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`
              : '0 8px 16px rgba(0,0,0,0.06)'
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleFileSelect}
          elevation={isDragging ? 4 : 1}
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
          
          <Fade in={isDragging} timeout={400}>
            <Box 
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: isDragging ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                background: alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(4px)',
                zIndex: 10
              }}
            >
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  transition: { 
                    y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
                  }
                }}
              >
                <CloudUploadIcon 
                  sx={{ 
                    fontSize: 100, 
                    color: theme.palette.primary.main,
                    filter: isDarkMode ? 'drop-shadow(0 0 8px rgba(29,222,240,0.5))' : undefined
                  }} 
                />
              </motion.div>
              <Typography 
                variant="h4" 
                sx={{ 
                  position: 'absolute',
                  bottom: '20%',
                  fontWeight: 'bold',
                  color: theme.palette.primary.main
                }}
              >
                Drop Files Here
              </Typography>
            </Box>
          </Fade>
          
          <Box sx={{ 
            textAlign: 'center',
            position: 'relative',
            zIndex: 5
          }}>
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                transition: { 
                  y: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                }
              }}
            >
              <CloudUploadIcon 
                sx={{ 
                  fontSize: 80, 
                  color: isDarkMode ? theme.palette.primary.main : 'text.secondary',
                  mb: 2,
                  filter: isDarkMode ? 'drop-shadow(0 0 8px rgba(29,222,240,0.2))' : undefined
                }} 
              />
            </motion.div>
            
            <Typography 
              variant="h6"
              sx={{
                mb: 1,
                fontWeight: 'bold',
                background: isDarkMode 
                  ? `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` 
                  : undefined,
                backgroundClip: isDarkMode ? 'text' : undefined,
                WebkitBackgroundClip: isDarkMode ? 'text' : undefined,
              }}
            >
              {files.length > 0 
                ? 'Drop more files or click to browse' 
                : 'Drag & Drop or Click to Upload'}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {files.length > 0 
                ? `${files.length} ${files.length === 1 ? 'file' : 'files'} selected` 
                : 'All document types supported'}
            </Typography>
            
            <Button
              variant="outlined"
              color="primary"
              sx={{
                borderRadius: '50px',
                px: 3,
                py: 1,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              Browse Files
            </Button>
          </Box>
        </Paper>
      </motion.div>
      
      {/* Uploaded files list section - moved outside the upload area */}
      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Paper
            sx={{
              p: 3,
              mb: 4,
              borderRadius: 4,
              backgroundColor: theme.palette.background.paper,
              boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.07)}`,
              overflow: 'hidden'
            }}
            elevation={1}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                display: 'flex', 
                alignItems: 'center',
                color: theme.palette.primary.main,
                fontWeight: 'bold'
              }}
            >
              <AttachFileIcon sx={{ mr: 1 }} />
              Selected Documents
            </Typography>
            
            <Box 
              sx={{
                maxHeight: 320,
                overflowY: 'auto',
                width: '100%',
                pr: 1
              }}
            >
              {files.map((file, index) => {
                const status = fileStatuses.find(s => s.fileIndex === index);
                const isUploading = status?.uploading || false;
                const progress = status?.progress || 0;
                const hasError = status?.error !== null;
                const isSuccess = status?.success || false;
                const statusText = getFileStatusText(index);
                const progressColor = getProgressColor(index);
                
                return (
                  <Zoom in key={`${file.name}-${index}`} style={{ transitionDelay: `${index * 100}ms` }}>
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
                        {getFileIcon(file)}
                        
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
                        
                          {['pdf', 'jpg', 'jpeg', 'png', 'gif'].includes(file.name.split('.').pop()?.toLowerCase() || '') && (
                            <Tooltip title="Preview">
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreviewFile(file);
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
                                await handleRemoveFile(index);
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
              })}
            </Box>
          </Paper>
        </motion.div>
      )}
      
      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Stack direction="row" spacing={2} justifyContent="center" mt={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={uploadingAny ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
              onClick={handleUpload}
              disabled={uploadingAny || files.length === 0 || files.every((_, i) => 
                fileStatuses.find(s => s.fileIndex === i)?.success
              )}
              sx={{ 
                minWidth: 180,
                height: 54,
                borderRadius: '12px',
                fontSize: '1rem',
                textTransform: 'none',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`,
                '&::after': isDarkMode ? {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  transition: 'all 0.5s ease',
                } : {},
                '&:hover::after': isDarkMode ? {
                  left: '100%',
                } : {},
              }}
            >
              {uploadingAny ? 'Uploading...' : 'Upload All'}
            </Button>
            
            <Button
              variant="outlined"
              color="error"
              size="large"
              startIcon={<CancelIcon />}
              onClick={handleCancel}
              disabled={files.length === 0}
              sx={{ 
                minWidth: 150,
                height: 54,
                borderRadius: '12px',
                fontSize: '1rem',
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              Cancel All
            </Button>
          </Stack>
        </motion.div>
      )}
      
      {uploadingAny && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.4 }}
        >
          <Box sx={{ width: '100%', mt: 4 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1 
            }}>
              <Typography variant="body2" color="text.secondary">
                Overall Upload Progress
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold',
                  color: overallProgress === 100 
                    ? theme.palette.success.main 
                    : theme.palette.primary.main
                }}
              >
                {overallProgress}%
              </Typography>
            </Box>
            
            <Box sx={{ position: 'relative' }}>
              <LinearProgress 
                variant="determinate" 
                value={overallProgress} 
                sx={{ 
                  height: 10, 
                  borderRadius: 5,
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: overallProgress === 100 
                      ? theme.palette.success.main 
                      : theme.palette.primary.main,
                    borderRadius: 5,
                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                  }
                }} 
              />
              
              {overallProgress > 0 && overallProgress < 100 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: isDarkMode 
                      ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' 
                      : undefined,
                    backgroundSize: '50% 100%',
                    animation: 'shimmer 1.5s infinite',
                    '@keyframes shimmer': {
                      '0%': { backgroundPosition: '-50% 0' },
                      '100%': { backgroundPosition: '150% 0' }
                    }
                  }}
                />
              )}
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 1,
              mt: 2 
            }}>
              <Typography variant="body2" color="text.secondary">
                {fileStatuses.filter(s => s.success).length} of {files.length} files completed
              </Typography>
            </Box>
          </Box>
        </motion.div>
      )}
      
      {/* Preview Dialog */}
      <Fade in={previewOpen}>
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4
          }}
          onClick={handleClosePreview}
        >
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 20, 
              right: 20,
              zIndex: 10
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton 
              onClick={handleClosePreview}
              sx={{ 
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Box 
            sx={{ 
              width: '100%', 
              height: '90%', 
              maxWidth: 1000,
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {previewUrl && (
              <iframe
                src={`${previewUrl}#toolbar=0`}
                width="100%"
                height="100%"
                style={{ 
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                }}
                title="File Preview"
              />
            )}
          </Box>
        </Box>
      </Fade>
      
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

export default UploadFilePage;
import { SxProps, Theme } from '@mui/material';
import { FileUploadStatus } from '../types/fileUploadtypes';

/**
 * Format file size in human-readable format
 * @param bytes File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get the appropriate icon for a file based on its type or extension
 * @param file The file object
 * @param theme The current MUI theme
 * @returns Icon component with appropriate styling
 */
export const getFileIcon = (file: File, theme: Theme) => {
  // This function will be imported from the main component
  // and implemented in the FileItem component
  return null;
};

/**
 * Get status text for a file based on its upload status
 * @param fileStatuses Array of file statuses
 * @param index File index to check
 * @returns Status text to display
 */
export const getFileStatusText = (fileStatuses: FileUploadStatus[], index: number): string => {
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

/**
 * Get progress color for a file based on its upload status
 * @param fileStatuses Array of file statuses
 * @param index File index to check
 * @param theme The current MUI theme
 * @returns Color to use for the progress bar
 */
export const getProgressColor = (fileStatuses: FileUploadStatus[], index: number, theme: Theme): string => {
  const status = fileStatuses.find(s => s.fileIndex === index);
  
  if (!status) return theme.palette.primary.main;
  if (status.success) return theme.palette.success.main;
  if (status.error || status.cancelled) return theme.palette.error.main;
  
  return theme.palette.primary.main;
};

/**
 * Calculate overall progress based on individual file progress
 * @param fileStatuses Array of file statuses
 * @returns Overall progress percentage (0-100)
 */
export const calculateOverallProgress = (fileStatuses: FileUploadStatus[]): number => {
  if (fileStatuses.length === 0) {
    return 0;
  }
  
  const uploadingStatuses = fileStatuses.filter(status => status.uploading || status.success);
  if (uploadingStatuses.length === 0) {
    return 0;
  }
  
  const totalProgress = uploadingStatuses.reduce((sum, status) => sum + status.progress, 0);
  return Math.round(totalProgress / uploadingStatuses.length);
};

/**
 * Check if any file is currently uploading
 * @param fileStatuses Array of file statuses
 * @returns True if any file is uploading
 */
export const isAnyFileUploading = (fileStatuses: FileUploadStatus[]): boolean => {
  return fileStatuses.some(status => status.uploading);
};
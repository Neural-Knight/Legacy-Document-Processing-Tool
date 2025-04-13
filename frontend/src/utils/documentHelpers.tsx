import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { Theme } from '@mui/material';
import { Document } from '../services/documentService';

// Document type icon mapping
export const getDocumentIcon = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'pdf':
      return <PictureAsPdfIcon sx={{ color: '#F40F02' }} />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
      return <ImageIcon sx={{ color: '#00C2FF' }} />;
    case 'doc':
    case 'docx':
      return <DescriptionIcon sx={{ color: '#2B579A' }} />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <ArticleIcon sx={{ color: '#217346' }} />;
    default:
      return <DescriptionIcon sx={{ color: 'text.secondary' }} />;
  }
};

// Document type name mapping
export const getDocumentType = (filename: string) => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'pdf':
      return 'PDF Document';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'svg':
      return 'Image';
    case 'doc':
    case 'docx':
      return 'Word Document';
    case 'xls':
    case 'xlsx':
      return 'Excel Spreadsheet';
    case 'csv':
      return 'CSV Data';
    default:
      return 'Document';
  }
};

// Format file size
export const formatFileSize = (size: string) => {
  // If size is already formatted, return it
  if (typeof size === 'string' && (size.includes('KB') || size.includes('MB'))) {
    return size;
  }

  // Otherwise, assume it's in bytes and format it
  const bytes = parseInt(size);
  if (isNaN(bytes)) return 'Unknown';
  
  if (bytes < 1024) return `${bytes} B`;
  else if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  else return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Extract original filename without timestamp prefix
export const getOriginalName = (filename: string) => {
  const parts = filename.split('_');
  return parts.length > 1 ? parts.slice(3).join('_') : filename;
};

// Helper to determine if a document is processed
export const isProcessed = (doc: Document) => {
  // If processed is a boolean, use it directly
  if (typeof doc.processed === 'boolean') {
    return doc.processed;
  } 
  // If somehow processed is a string (from API serialization), handle it
  else if (typeof (doc.processed as any) === 'string') {
    return (doc.processed as string).toLowerCase() === 'true';
  } 
  // Fallback: check for processing errors
  else {
    return doc.processing_error === null || doc.processing_error === undefined;
  }
};

// Get status color based on processing state
export const getStatusColor = (doc: Document, theme: Theme) => {
  const processed = isProcessed(doc);
  
  if (doc.processing_error) {
    return theme.palette.error.main;
  } else if (processed) {
    return theme.palette.success.main;
  } else {
    return theme.palette.warning.main;
  }
};

// Get status icon based on processing state
export const getStatusIcon = (doc: Document, theme: Theme) => {
  const processed = isProcessed(doc);

  if (doc.processing_error) {
    return <ErrorOutlineIcon fontSize="small" sx={{ color: theme.palette.error.main }} />;
  } else if (processed) {
    return <CheckCircleIcon fontSize="small" sx={{ color: theme.palette.success.main }} />;
  } else {
    return <HourglassEmptyIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />;
  }
};

// Get status text based on processing state
export const getStatusText = (doc: Document) => {
  const processed = isProcessed(doc);
  
  if (doc.processing_error) {
    return 'Error';
  } else if (processed) {
    return 'Processed';
  } else {
    return 'Processing';
  }
};
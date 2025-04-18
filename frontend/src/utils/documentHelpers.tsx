// src/utils/documentHelpers.ts
import React from 'react';
import { Document } from '../services/documentService';
import { Theme } from '@mui/material/styles';

// Icons
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import CodeIcon from '@mui/icons-material/Code';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

/**
 * Get the appropriate icon based on file extension
 * @param filename The filename to check
 * @returns The corresponding icon component
 */
export const getDocumentIcon = (filename: string): React.ReactElement | undefined => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return <PictureAsPdfIcon />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'tiff':
    case 'webp':
      return <ImageIcon />;
    case 'doc':
    case 'docx':
    case 'txt':
    case 'rtf':
      return <DescriptionIcon />;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <TableChartIcon />;
    case 'json':
    case 'xml':
    case 'html':
    case 'js':
    case 'ts':
    case 'py':
    case 'java':
    case 'c':
    case 'cpp':
      return <CodeIcon />;
    default:
      return <InsertDriveFileIcon />;
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

/**
 * Format file size to human-readable format
 * @param sizeInBytes File size in bytes as string
 * @returns Formatted file size string
 */
export const formatFileSize = (sizeInBytes: string): string => {
  const size = parseInt(sizeInBytes, 10);
  
  if (isNaN(size)) {
    return '0 B';
  }
  
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
};




/**
 * Parse a formatted file size string back to bytes
 * @param formattedSize Formatted file size string (e.g., "1.5 MB")
 * @returns Size in bytes as number
 */
export const parseFileSize = (formattedSize: string): number => {
  const [value, unit] = formattedSize.split(' ');
  const numericValue = parseFloat(value);
  
  if (isNaN(numericValue)) {
    return 0;
  }
  
  switch (unit.toUpperCase()) {
    case 'B':
      return numericValue;
    case 'KB':
      return numericValue * 1024;
    case 'MB':
      return numericValue * 1024 * 1024;
    case 'GB':
      return numericValue * 1024 * 1024 * 1024;
    default:
      return 0;
  }
};

/**
 * Calculate total storage size from an array of documents
 * @param documents Array of documents
 * @returns Total size in bytes
 */
export const calculateTotalStorageSize = (documents: Document[]): number => {
  return documents.reduce((total, doc) => {
    if (!doc.file_size) return total;
    return total + parseFileSize(doc.file_size.toString());
  }, 0);
};

/**
 * Extract original filename from stored filename (which might contain UUID or timestamp)
 * @param filename The stored filename
 * @returns The original filename
 */
export const getOriginalName = (filename: string): string => {
  // Assuming stored filenames have a format like: "uuid_originalName.ext"
  // or "timestamp_originalName.ext"
  const parts = filename.split('_');
  
  // If the filename doesn't have the expected format, just return it as is
  if (parts.length < 2) {
    return filename;
  }
  
  // Remove the first part (UUID or timestamp) and join the rest
  return parts.slice(1).join('_');
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

/**
 * Check if a document has been processed
 * @param document The document to check
 * @returns True if processed, false otherwise
 */
export const isProcessed = (document: Document): boolean => {
  return document.processed === true;
};

/**
 * Get the appropriate status icon for a document
 * @param document The document to check
 * @param theme The current theme
 * @returns The status icon component
 */
export const getStatusIcon = (document: Document, theme: Theme): React.ReactNode => {
  if (isProcessed(document)) {
    return <CheckCircleIcon fontSize="small" sx={{ color: theme.palette.success.main }} />;
  } else if (document.processing_error) {
    return <ErrorOutlineIcon fontSize="small" sx={{ color: theme.palette.error.main }} />;
  } else {
    return <HourglassEmptyIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />;
  }
};


/**
 * Sort documents by various criteria
 * @param documents Array of documents
 * @param sortBy Sort criterion
 * @param sortOrder Sort order (asc or desc)
 * @returns Sorted array of documents
 */
export const sortDocuments = (
  documents: Document[],
  sortBy: 'name' | 'date' | 'size' | 'type' | 'status',
  sortOrder: 'asc' | 'desc'
): Document[] => {
  const sortedDocs = [...documents];
  
  sortedDocs.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = getOriginalName(a.filename).localeCompare(getOriginalName(b.filename));
        break;
      case 'date':
        comparison = new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime();
        break;
      case 'size':
        comparison = parseFileSize(a.file_size?.toString() || '0') - parseFileSize(b.file_size?.toString() || '0');
        break;
      case 'type':
        const extA = a.filename.split('.').pop()?.toLowerCase() || '';
        const extB = b.filename.split('.').pop()?.toLowerCase() || '';
        comparison = extA.localeCompare(extB);
        break;
      case 'status':
        // Order: processed, processing, error
        const statusValueA = isProcessed(a) ? 0 : (a.processing_error ? 2 : 1);
        const statusValueB = isProcessed(b) ? 0 : (b.processing_error ? 2 : 1);
        comparison = statusValueA - statusValueB;
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });
  
  return sortedDocs;
};

/**
 * Filter documents by various criteria
 * @param documents Array of documents
 * @param filters Filter criteria
 * @returns Filtered array of documents
 */
export const filterDocuments = (
  documents: Document[],
  filters: {
    searchTerm?: string;
    status?: 'processed' | 'processing' | 'error' | 'all';
    type?: string;
    dateRange?: { start: Date; end: Date };
  }
): Document[] => {
  return documents.filter(doc => {
    // Search term filter
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const searchTerm = filters.searchTerm.toLowerCase();
      const originalName = getOriginalName(doc.filename).toLowerCase();
      if (!originalName.includes(searchTerm)) {
        return false;
      }
    }
    
    // Status filter
    if (filters.status && filters.status !== 'all') {
      switch (filters.status) {
        case 'processed':
          if (!isProcessed(doc)) return false;
          break;
        case 'processing':
          if (isProcessed(doc) || doc.processing_error) return false;
          break;
        case 'error':
          if (!doc.processing_error) return false;
          break;
      }
    }
    
    // File type filter
    if (filters.type) {
      const extension = doc.filename.split('.').pop()?.toLowerCase() || '';
      if (extension !== filters.type) {
        return false;
      }
    }
    
    // Date range filter
    if (filters.dateRange) {
      const docDate = new Date(doc.upload_date);
      if (
        docDate < filters.dateRange.start ||
        docDate > filters.dateRange.end
      ) {
        return false;
      }
    }
    
    return true;
  });
};
/**
 * Get the status text based on processing state
 * @param doc The document to check
 * @returns The status text
 */
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
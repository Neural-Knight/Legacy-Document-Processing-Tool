import axios from 'axios';
import { getOriginalName } from '../utils/documentHelpers';

const API_URL = 'http://localhost:8000/api';

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_type: string;
  upload_date: string;
  processed: boolean;
  processing_error?: string;
  file_size?: string;
  originalName?: string;
}

/**
 * Upload a document to the server
 * @param file The file to upload
 * @param onUploadProgress Optional callback for upload progress
 * @returns Promise with the uploaded document data
 */
export const uploadDocument = async (
  file: File,
  onUploadProgress?: (progress: number) => void
): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          // Calculate upload percentage
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress?.(percentCompleted);
        }
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Failed to upload document');
    }
    throw new Error('Failed to upload document');
  }
};

/**
 * Get all documents
 * @returns Promise with an array of documents
 */
export const getAllDocuments = async (): Promise<Document[]> => {
  try {
    const response = await axios.get(`${API_URL}/documents`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Failed to fetch documents');
    }
    throw new Error('Failed to fetch documents');
  }
};

/**
 * Get a document by ID
 * @param id The document ID
 * @returns Promise with the document data
 */
export const getDocumentById = async (id: string): Promise<Document> => {
  try {
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      console.error(`Invalid document ID format: ${id}`);
      throw new Error('Invalid document ID format');
    }
    const response = await axios.get(`${API_URL}/documents/${numericId}`);
    return {
      ...response.data,
      originalName: getOriginalName(response.data.filename),
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Failed to fetch document');
    }
    throw new Error('Failed to fetch document');
  }
};

/**
 * Delete a document
 * @param id The document ID
 * @returns Promise with the delete confirmation
 */
export const deleteDocument = async (id: string): Promise<void> => {
  try {
    console.log(`Attempting to delete document with ID: ${id}`);
    
    // Ensure we have a valid ID format - the backend expects a numeric ID
    // This handles both string IDs ("123") and numeric IDs (123)
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      console.error(`Invalid document ID format: ${id}`);
      throw new Error('Invalid document ID format');
    }
    
    const response = await axios.delete(`${API_URL}/documents/${numericId}`);
    console.log('Delete response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Response error:', error.response.data);
      throw new Error(error.response.data.error || 'Failed to delete document');
    }
    throw new Error('Failed to delete document');
  }
};

//-------------------------------------------------------------------------------------------------------
/**
 * Download a document
 * @param filePath The path to the document file
 * @param filename The filename to save as
 * @param fileType The MIME type of the file (defaults to 'application/pdf')
 */
export const downloadDocument = async (
  id: string,
  filePath: string, 
  filename: string, 
  fileType: string = 'application/pdf'
): Promise<void> => {
  try {
    const response = await axios.get(`${API_URL}/documents/${id}/download`, {
      params: { filePath },
      responseType: 'blob',
    });
    console.log('Download response:', response);
    // Create a blob with the appropriate file type
    const blob = new Blob([response.data], { type: fileType });
    console.log('Blob created:', blob);
    // Create a link element to trigger the download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Sanitize filename if needed
    const sanitizedFilename = filename.replace(/[^\w\s.-]/g, '');
    link.setAttribute('download', sanitizedFilename || 'document');
    
    // Use this approach for better browser compatibility
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Download error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.message || 'Failed to download document');
    }
    throw new Error('Failed to download document');
  }
};

// // Define a type for table data
// interface TableData {
//   page_number: number;
//   markdown_content: string;
//   file_name: string;
// }

// // Define a type for tables response that can include an error
// interface TablesResponse {
//   error?: string;
// }

// /**
//  * Get tables for a document
//  * @param id The document ID
//  * @returns Promise with the tables data or an error object
//  */
// export const getDocumentTables = async (id: string): Promise<TableData[] | TablesResponse> => {
//   try {
//     console.log(`API call: Fetching tables for document ID ${id}`);
//     const response = await axios.get(`${API_URL}/documents/${id}/tables`);
    
//     // Check if the response is an array (success case)
//     if (Array.isArray(response.data)) {
//       return response.data;
//     }
    
//     // If it's an error response with an 'error' field, pass it through
//     if (response.data && typeof response.data === 'object' && 'error' in response.data) {
//       return response.data as TablesResponse;
//     }
    
//     // Unexpected format
//     console.error('Unexpected response format:', response.data);
//     return [];
//   } catch (error) {
//     console.error('Error in getDocumentTables:', error);
//     if (axios.isAxiosError(error) && error.response) {
//       // Return the error response so we can display it
//       return { error: error.response.data.error || error.message || 'Failed to fetch tables' };
//     }
//     return { error: 'Failed to fetch tables' };
//   }
// };


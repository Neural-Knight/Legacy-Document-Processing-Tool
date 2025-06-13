import axios, { AxiosError } from 'axios';
import { getOriginalName } from '../utils/documentHelpers';
import { getAccessToken, isAuthenticated, refreshAuthToken } from '../services/authService';

const API_URL = 'http://localhost:8000/api';

// Define the structure of API error responses
interface ApiErrorResponse {
  detail?: string;
  message?: string;
  error?: string;
  [key: string]: any; // Allow for any other properties
}

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
  user_id: number; // Added to track document ownership
}

// Create an authenticated Axios instance
const authApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
authApi.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle authentication errors in responses
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is due to an expired token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt token refresh
        await refreshAuthToken();
        
        // Update the authorization header with the new token
        const newToken = getAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        
        // Retry the original request
        return axios(originalRequest);
      } catch (refreshError) {
        // If refresh fails, let the error propagate
        console.error('Authentication refresh failed:', refreshError);
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// Helper function for consistent error handling
const handleApiError = (error: unknown, defaultMessage: string): never => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  if (axiosError.response?.data) {
    throw new Error(
      axiosError.response.data.detail || 
      axiosError.response.data.message || 
      axiosError.response.data.error || 
      defaultMessage
    );
  }
  throw new Error(defaultMessage);
};

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
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to upload documents');
  }
  
  const formData = new FormData();
  formData.append('file', file);

  try {
    console.log('Uploading document:', file.name);
    const response = await authApi.post<Document>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          // Calculate upload percentage
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Upload progress for ${file.name}: ${percentCompleted}%`);
          onUploadProgress?.(percentCompleted);
        }
      },
    });
    console.log('Upload successful for:', file.name, response.data);
    return response.data;
  } catch (error: any) {
    console.error('Upload error details:', error.response?.data || error.message);
    handleApiError(error, 'Failed to upload document');
    throw new Error(error.response?.data?.message || 'Failed to upload document');
  }
};

/**
 * Get all documents
 * @param ownedOnly Whether to return only the current user's documents (true) or all documents for admins (false)
 * @returns Promise with an array of documents
 */
export const getAllDocuments = async (ownedOnly = true): Promise<Document[]> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view documents');
  }
  
  try {
    const response = await authApi.get<Document[]>('/documents', {
      params: { owned_only: ownedOnly }
    });
    return response.data;
  } catch (error) {
    handleApiError(error, 'Failed to fetch documents');
    throw new Error('Failed to fetch documents'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Get a document by ID
 * @param id The document ID
 * @returns Promise with the document data
 */
export const getDocumentById = async (id: string): Promise<Document> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view documents');
  }
  
  try {
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      console.error(`Invalid document ID format: ${id}`);
      throw new Error('Invalid document ID format');
    }
    
    const response = await authApi.get<Document>(`/documents/${numericId}`);
    return {
      ...response.data,
      originalName: getOriginalName(response.data.filename),
    };
  } catch (error) {
    handleApiError(error, 'Failed to fetch document');
    throw new Error('Failed to fetch document'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Delete a document
 * @param id The document ID
 * @returns Promise with the delete confirmation
 */
export const deleteDocument = async (id: string): Promise<void> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to delete documents');
  }
  
  try {
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      console.error(`Invalid document ID format: ${id}`);
      throw new Error('Invalid document ID format');
    }
    
    await authApi.delete(`/documents/${numericId}`);
  } catch (error) {
    handleApiError(error, 'Failed to delete document');
    throw new Error('Failed to delete document'); // This line is never reached but satisfies TypeScript
  }
};

/**
 * Download a document
 * @param id The document ID
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
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to download documents');
  }
  
  try {
    const response = await authApi.get(`/documents/${id}/download`, {
      params: { filePath },
      responseType: 'blob',
    });
    
    // Create a blob with the appropriate file type
    const blob = new Blob([response.data], { type: fileType });
    
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
    handleApiError(error, 'Failed to download document');
    throw new Error('Failed to download document'); // This line is never reached but satisfies TypeScript
  }
};


/**
 * Get extraction status for a document
 * @param documentId Document ID
 * @returns Promise with extraction status info
 */
export const getExtractionStatus = async (documentId: string): Promise<any> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view document extraction status');
  }
  
  try {
    const response = await authApi.get<any>(`/documents/${documentId}/extraction`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching extraction status:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch extraction status');
  }
};

/**
 * Get extracted content for a document
 * @param documentId Document ID
 * @returns Promise with extraction content
 */
export const getDocumentContent = async (documentId: string): Promise<any> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view document content');
  }
  
  try {
    const response = await authApi.get<any>(`/documents/${documentId}/content`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching document content:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch document content');
  }
};

/**
 * Get table markdown content for a document
 * @param documentId Document ID
 * @param pageNumber Optional specific page number
 * @returns Promise with the markdown content
 */
export const getTableMarkdown = async (documentId: string, pageNumber?: number): Promise<any> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view document content');
  }
  
  try {
    const params: any = {};
    if (pageNumber !== undefined) {
      params.page_number = pageNumber;
    }
    
    const response = await authApi.get<any>(`/documents/${documentId}/table-markdown`, { params });
    return response.data;
  } catch (error: any) {
    console.error('Error fetching table markdown content:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch table markdown content');
  }
};
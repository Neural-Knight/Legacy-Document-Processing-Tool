// src/services/dashboardService.ts
import axios from 'axios';
import { Document } from './documentService';
import { getAccessToken, isAuthenticated } from './authService';

const API_URL = 'http://localhost:8000/api';

// Interface definitions
export interface StorageInfo {
  used: number;
  total: number;
  usedFormatted: string;
  totalFormatted: string;
  percentage: number;
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'maintenance' | 'down';
  apiLatency: number;
  queueStatus: {
    length: number;
    processingRate: number;
    estimatedTime: number;
  };
  components: {
    api: 'operational' | 'degraded' | 'down';
    database: 'operational' | 'degraded' | 'down';
    storage: 'operational' | 'degraded' | 'down';
    processing: 'operational' | 'degraded' | 'down';
  };
  maintenanceNotice?: {
    active: boolean;
    message: string;
    endTime?: Date;
  };
}

export interface ProcessingEvent {
  id: string;
  documentId: string;
  documentName: string;
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  timestamp: Date;
  details?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  documentId?: string;
  actionRequired?: boolean;
  actionText?: string;
  actionLink?: string;
}

export interface PerformanceMetric {
  date: Date;
  documentsProcessed: number;
  queriesExecuted: number;
  avgQueryTime: number;
  avgProcessingTime: number;
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

/**
 * Get storage usage information
 * @returns Promise with storage usage data
 */
export const getStorageUsage = async (): Promise<StorageInfo> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view storage information');
  }
  
  try {
    const response = await authApi.get<StorageInfo>('/storage/usage');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching storage usage:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch storage information');
  }
};

/**
 * Get system status information
 * @returns Promise with system status data
 */
export const getSystemStatus = async (): Promise<SystemStatus> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view system status');
  }
  
  try {
    const response = await authApi.get<SystemStatus>('/system/status');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching system status:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch system status');
  }
};

/**
 * Get document processing history
 * @param limit Number of events to return (optional)
 * @returns Promise with processing events array
 */
export const getDocumentProcessingHistory = async (limit?: number): Promise<ProcessingEvent[]> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view processing history');
  }
  
  try {
    const response = await authApi.get<ProcessingEvent[]>('/documents/processing-history', {
      params: { limit }
    });
    
    // Convert string timestamps to Date objects
    return response.data.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp)
    }));
  } catch (error: any) {
    console.error('Error fetching processing history:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch processing history');
  }
};

/**
 * Toggle favorite status for a document
 * @param documentId Document ID
 * @param isFavorite New favorite status
 * @returns Promise with success status
 */
export const toggleFavoriteDocument = async (documentId: string, isFavorite: boolean): Promise<boolean> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to update document favorites');
  }
  
  try {
    const response = await authApi.post<{ success: boolean }>(`/documents/${documentId}/favorite`, {
      favorite: isFavorite
    });
    return response.data.success;
  } catch (error: any) {
    console.error('Error toggling document favorite status:', error);
    throw new Error(error.response?.data?.message || 'Failed to update favorite status');
  }
};

/**
 * Get user's favorite documents
 * @returns Promise with array of favorite documents
 */
export const getFavoriteDocuments = async (): Promise<Document[]> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view favorite documents');
  }
  
  try {
    const response = await authApi.get<Document[]>('/documents/favorites');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching favorite documents:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch favorite documents');
  }
};

/**
 * Get user notifications
 * @param unreadOnly Only fetch unread notifications if true
 * @returns Promise with array of notifications
 */
export const getNotifications = async (unreadOnly = false): Promise<Notification[]> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view notifications');
  }
  
  try {
    const response = await authApi.get<Notification[]>('/notifications', {
      params: { unread_only: unreadOnly }
    });
    
    // Convert string timestamps to Date objects
    return response.data.map(notification => ({
      ...notification,
      timestamp: new Date(notification.timestamp)
    }));
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch notifications');
  }
};

/**
 * Mark a notification as read
 * @param notificationId Notification ID
 * @returns Promise with success status
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to update notifications');
  }
  
  try {
    const response = await authApi.post<{ success: boolean }>(`/notifications/${notificationId}/read`);
    return response.data.success;
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    throw new Error(error.response?.data?.message || 'Failed to update notification');
  }
};

/**
 * Dismiss a notification
 * @param notificationId Notification ID
 * @returns Promise with success status
 */
export const dismissNotification = async (notificationId: string): Promise<boolean> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to dismiss notifications');
  }
  
  try {
    const response = await authApi.delete<{ success: boolean }>(`/notifications/${notificationId}`);
    return response.data.success;
  } catch (error: any) {
    console.error('Error dismissing notification:', error);
    throw new Error(error.response?.data?.message || 'Failed to dismiss notification');
  }
};

/**
 * Get performance metrics
 * @param days Number of days of history to return (default: 7)
 * @returns Promise with array of performance metrics
 */
export const getPerformanceMetrics = async (days = 7): Promise<PerformanceMetric[]> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view performance metrics');
  }
  
  try {
    const response = await authApi.get<PerformanceMetric[]>('/analytics/performance', {
      params: { days }
    });
    
    // Convert string timestamps to Date objects
    return response.data.map(metric => ({
      ...metric,
      date: new Date(metric.date)
    }));
  } catch (error: any) {
    console.error('Error fetching performance metrics:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch performance metrics');
  }
};
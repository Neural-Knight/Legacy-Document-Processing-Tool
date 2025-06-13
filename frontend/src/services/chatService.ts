import { authApi, isAuthenticated } from './authService';

export interface ChatRequest {
  message: string;
  document_ids?: string[];
  conversation_id?: string;
}

export interface ChatSource {
  document_id: string;
  page_number?: number;
  metadata?: any;
}

export interface ChatResponse {
  response: string;
  sources: ChatSource[];
  conversation_id: string;
}

/**
 * Send a message to the chatbot
 * @param request Chat request parameters
 * @returns Promise with chat response
 */
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to use the chat');
  }
  
  try {
    const response = await authApi.post<ChatResponse>('/chat', request);
    return response.data;
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    throw new Error(error.response?.data?.message || 'Failed to send message');
  }
};

/**
 * Get chat history for a conversation
 * @param conversationId Conversation ID
 * @returns Promise with chat history
 */
export const getChatHistory = async (conversationId: string): Promise<any> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view chat history');
  }
  
  try {
    const response = await authApi.get<any>(`/chat/${conversationId}/history`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch chat history');
  }
};

/**
 * Get all chat sessions for the user
 * @returns Promise with list of chat sessions
 */
export const getChatSessions = async (): Promise<any> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to view chat sessions');
  }
  
  try {
    const response = await authApi.get<any>('/chat/sessions');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching chat sessions:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch chat sessions');
  }
};

/**
 * Delete a chat session
 * @param conversationId Conversation ID
 * @returns Promise with success status
 */
export const deleteChatSession = async (conversationId: string): Promise<boolean> => {
  if (!isAuthenticated()) {
    throw new Error('You must be logged in to delete chat sessions');
  }
  
  try {
    await authApi.delete(`/chat/sessions/${conversationId}`);
    return true;
  } catch (error: any) {
    console.error('Error deleting chat session:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete chat session');
  }
};
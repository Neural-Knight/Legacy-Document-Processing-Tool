import { Document } from '../services/documentService';

// Define message types
export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  references?: Document[];
  attachments?: any[];
}

// Interface for a chat session
export interface ChatSession {
  id: string;
  title: string;
  lastUpdated: Date;
  messages: ChatMessage[];
  previewText?: string; // First few characters of last message
  // Conversation id returned by the backend chat API. The local `id` is used
  // for tab/session management in IndexedDB; this links the tab to its
  // server-side conversation so follow-up messages resume it.
  backendConversationId?: string;
}

// Type for chat-related actions
export type ChatAction = 
  | { type: 'CREATE_CHAT'; payload: ChatSession }
  | { type: 'UPDATE_CHAT'; payload: ChatSession }
  | { type: 'DELETE_CHAT'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { chatId: string; message: ChatMessage } }
  | { type: 'EDIT_MESSAGE'; payload: { chatId: string; messageId: string; content: string } }
  | { type: 'SET_ACTIVE_CHAT'; payload: string };
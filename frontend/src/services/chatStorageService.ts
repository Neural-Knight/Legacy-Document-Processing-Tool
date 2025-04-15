// src/services/chatStorageService.ts
import { ChatSession } from '../types/chat';

// Database configuration
const DB_NAME = 'ChatAppDB';
const DB_VERSION = 1;
const CHAT_STORE = 'chatSessions';

// Initialize the database
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      reject('IndexedDB error: ' + request.error);
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      // Create object store for chat sessions if it doesn't exist
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        const store = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
        // Create indexes for searching and sorting
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };
  });
};

// Get all chat sessions
export const getAllChatSessions = async (): Promise<ChatSession[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readonly');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      // Sort by most recent first
      const sessions = request.result.sort((a, b) => 
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      );
      resolve(sessions);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Get a specific chat session
export const getChatSession = async (id: string): Promise<ChatSession | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readonly');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.get(id);
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Create a new chat session
export const createChatSession = async (title: string = "New Chat"): Promise<ChatSession> => {
  const db = await initDB();
  const newChat: ChatSession = {
    id: Date.now().toString(),
    title,
    lastUpdated: new Date(),
    messages: []
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.add(newChat);
    
    request.onsuccess = () => {
      resolve(newChat);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Update a chat session
export const updateChatSession = async (session: ChatSession): Promise<ChatSession> => {
  const db = await initDB();
  // Make sure lastUpdated is current
  session.lastUpdated = new Date();
  
  // Create preview text from the last message
  if (session.messages.length > 0) {
    const lastMessage = session.messages[session.messages.length - 1];
    session.previewText = lastMessage.content.substring(0, 60) + (lastMessage.content.length > 60 ? '...' : '');
  }
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.put(session);
    
    request.onsuccess = () => {
      resolve(session);
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Delete a chat session
export const deleteChatSession = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
};

// Search chat sessions by title
export const searchChatSessions = async (query: string): Promise<ChatSession[]> => {
  const allSessions = await getAllChatSessions();
  const lowerQuery = query.toLowerCase();
  
  return allSessions.filter(session => 
    session.title.toLowerCase().includes(lowerQuery) || 
    (session.previewText && session.previewText.toLowerCase().includes(lowerQuery))
  );
};
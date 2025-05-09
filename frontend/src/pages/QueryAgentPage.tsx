import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    TextField,
    IconButton,
    Chip,
    Divider,
    useTheme,
    alpha,
    Tooltip,
    Menu,
    MenuItem,
    Paper,
    Container,
    Button,
    Snackbar,
    Alert
} from '@mui/material';

// Icons
import SendIcon from '@mui/icons-material/Send';
import ArticleIcon from '@mui/icons-material/Article';
import MicIcon from '@mui/icons-material/Mic';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MarkdownPreview from '../components/QueryAgent/MarkDownPreview';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useNavigate } from 'react-router-dom';
import { getDocumentIcon, getOriginalName } from '../utils/documentHelpers';
import { Document, getAllDocuments } from '../services/documentService';
import FloatingActionButtons from '../components/QueryAgent/FloatingActionButtons';
import { ChatMessage, ChatSession } from '../types/chat';
import ChatTabBar from '../components/QueryAgent/ChatTabBar';

import {
    createChatSession,
    getChatSession,
    updateChatSession,
    getAllChatSessions
} from '../services/chatStorageService';
import ChatHistoryDrawer from '../components/QueryAgent/ChatHistoryDrawer';

// Add these imports:
import { useUpload } from '../contexts/UploadContext';

// Define speech recognition type
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const QueryAgent: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { openUploadDialog, recentlyUploadedDocuments } = useUpload();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
    const [documentsAnchorEl, setDocumentsAnchorEl] = useState<null | HTMLElement>(null);
    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editedContent, setEditedContent] = useState<string>('');
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    // Warning message state
    const [showLimitWarning, setShowLimitWarning] = useState(false);

    // Voice input state
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recognition, setRecognition] = useState<any>(null);

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const inputFieldRef = useRef<HTMLInputElement | null>(null);
    const editFieldRef = useRef<HTMLInputElement | null>(null);

    const [currentChatSession, setCurrentChatSession] = useState<ChatSession | null>(null);

    const [openTabs, setOpenTabs] = useState<ChatSession[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);
    const [initialized, setInitialized] = useState<boolean>(false);

    // Add a new state for the empty documents warning
    const [showEmptyDocsWarning, setShowEmptyDocsWarning] = useState(false);

    // Single unified initialization effect
    useEffect(() => {
        const initializeChat = async () => {
            if (initialized) return; // Prevent multiple initializations
            
            try {
                // First, check if any chat sessions already exist
                const existingSessions = await getAllChatSessions();
                
                if (existingSessions.length > 0) {
                    // Use the most recent session as the default
                    const mostRecentSession = existingSessions[0]; // Already sorted by lastUpdated
                    setCurrentChatSession(mostRecentSession);
                    setMessages(mostRecentSession.messages || []);
                    setOpenTabs([mostRecentSession]);
                    setActiveTabId(mostRecentSession.id);
                } else {
                    // Only create a new session if none exist
                    const newSession = await createChatSession();
                    setCurrentChatSession(newSession);
                    setMessages([]);
                    setOpenTabs([newSession]);
                    setActiveTabId(newSession.id);
                }
                
                setInitialized(true);
            } catch (error) {
                console.error('Failed to initialize chat:', error);
            }
        };

        initializeChat();
    }, [initialized]);

    // Update this effect to handle tab changes
    useEffect(() => {
        if (activeTabId) {
            const activeSession = openTabs.find(tab => tab.id === activeTabId);
            if (activeSession) {
                setCurrentChatSession(activeSession);
                setMessages(activeSession.messages || []);
            }
        }
    }, [activeTabId, openTabs]);

    // 2. Fix the tab change handler to ensure clean state transitions
    const handleTabChange = (tabId: string) => {
        if (tabId === activeTabId) return; // No need to update if already active

        const activeSession = openTabs.find(tab => tab.id === tabId);
        if (activeSession) {
            // Clear current UI state before changing tab
            setInputMessage('');
            setSelectedDocuments([]);

            // Then update the active tab
            setActiveTabId(tabId);
            setCurrentChatSession(activeSession);
            setMessages(activeSession.messages || []);
        }
    };

    const handleNewTab = async () => {
        try {
            const newSession = await createChatSession();

            // Important: Update state in the correct order
            setMessages([]); // Clear messages first
            setCurrentChatSession(newSession); // Set new session

            // Update tabs last to ensure proper rendering
            setOpenTabs(prev => [...prev, newSession]);
            setActiveTabId(newSession.id);

            // Reset input state to prevent carrying over text
            setInputMessage('');
            setSelectedDocuments([]);
        } catch (error) {
            console.error('Failed to create new tab:', error);
        }
    };
    
    const handleTabClose = async (tabId: string) => {
        // We don't need the warning message anymore as the close buttons are hidden
        // when there's only one tab, but let's keep the check for safety
        if (openTabs.length <= 1) {
            return;
        }

        // If closing the active tab, switch to another tab first
        if (tabId === activeTabId) {
            const tabIndex = openTabs.findIndex(tab => tab.id === tabId);

            // Select the previous tab, or the next one if we're at the first tab
            const newActiveIndex = tabIndex === 0 ? 1 : tabIndex - 1;
            const newActiveTab = openTabs[newActiveIndex];

            setActiveTabId(newActiveTab.id);
            setCurrentChatSession(newActiveTab);
            setMessages(newActiveTab.messages || []);
        }

        // Remove the tab from open tabs (after state transition is complete)
        setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));
    };

    // Fix for infinite loop: Separate effect for saving to storage without updating UI state
    useEffect(() => {
        const saveMessages = async () => {
            if (currentChatSession && messages.length > 0 && activeTabId) {
                // Create a copy of the current session with updated messages
                const updatedSession = {
                    ...currentChatSession,
                    messages,
                    lastUpdated: new Date()
                };
    
                // Update the session in storage WITHOUT updating state
                try {
                    await updateChatSession(updatedSession);
                    // NO STATE UPDATES HERE - This breaks the circular dependency
                } catch (error) {
                    console.error('Failed to save messages:', error);
                }
            }
        };
    
        // Only save if we have messages and a current session
        if (messages.length > 0 && currentChatSession && activeTabId) {
            saveMessages();
        }
    }, [messages, currentChatSession, activeTabId]);
    
    // Update the chat selection handler to also open the tab
    const handleSelectChat = async (session: ChatSession) => {
        try {
            // Load the full session data first
            const loadedSession = await getChatSession(session.id);
            if (loadedSession) {
                // Check if this chat is already open in a tab
                const existingTab = openTabs.find(tab => tab.id === loadedSession.id);

                if (existingTab) {
                    // If already open, just switch to that tab
                    setActiveTabId(loadedSession.id);
                } else {
                    // Otherwise, add it as a new tab and switch to it
                    setOpenTabs(prev => [...prev, loadedSession]);
                    setActiveTabId(loadedSession.id);
                }

                setCurrentChatSession(loadedSession);
                setMessages(loadedSession.messages || []);
            }
        } catch (error) {
            console.error('Failed to load chat session:', error);
        }
    };

    // Enhanced handler for when a chat is deleted from the drawer
    const handleChatDeleted = async (deletedId: string) => {
        // Check if the deleted chat is open in a tab
        const isTabOpen = openTabs.some(tab => tab.id === deletedId);
        
        if (isTabOpen) {
            // Special handling for active tab deletion to prevent double tab creation
            if (deletedId === activeTabId) {
                if (openTabs.length > 1) {
                    // If there are other tabs, switch to another tab first
                    const tabIndex = openTabs.findIndex(tab => tab.id === deletedId);
                    const newActiveIndex = tabIndex === 0 ? 1 : tabIndex - 1;
                    const newActiveTab = openTabs[newActiveIndex];
                    
                    // Update state with the new active tab
                    setActiveTabId(newActiveTab.id);
                    setCurrentChatSession(newActiveTab);
                    setMessages(newActiveTab.messages || []);
                    
                    // Then remove the deleted tab
                    setOpenTabs(prev => prev.filter(tab => tab.id !== deletedId));
                } else {
                    // If this was the only open tab, check if other sessions exist in database
                    try {
                        const availableSessions = await getAllChatSessions();
                        // Filter out the deleted session
                        const otherSessions = availableSessions.filter(session => session.id !== deletedId);
                        
                        if (otherSessions.length > 0) {
                            // Use the most recent other session
                            const sessionToLoad = otherSessions[0]; // Already sorted by lastUpdated
                            
                            // Load the session and set it as the active tab
                            setOpenTabs([sessionToLoad]);
                            setActiveTabId(sessionToLoad.id);
                            setCurrentChatSession(sessionToLoad);
                            setMessages(sessionToLoad.messages || []);
                        } else {
                            // Only create a new tab if there are no other sessions in the database
                            const newSession = await createChatSession();
                            setOpenTabs([newSession]);
                            setActiveTabId(newSession.id);
                            setCurrentChatSession(newSession);
                            setMessages([]);
                        }
                    } catch (error) {
                        console.error('Error checking for available sessions:', error);
                        // Fallback to creating a new session in case of error
                        const newSession = await createChatSession();
                        setOpenTabs([newSession]);
                        setActiveTabId(newSession.id);
                        setCurrentChatSession(newSession);
                        setMessages([]);
                    }
                }
            } else {
                // For non-active tabs, just remove them from the tabs list
                setOpenTabs(prev => prev.filter(tab => tab.id !== deletedId));
            }
        }
    };
    const handleNewChat = async () => {
        try {
            const newSession = await createChatSession();
            
            // Add the new session to open tabs and select it
            setOpenTabs(prev => [...prev, newSession]);
            setActiveTabId(newSession.id);
            
            setCurrentChatSession(newSession);
            setMessages([]);
            setInputMessage('');
        } catch (error) {
            console.error('Failed to create new chat:', error);
        }
    };
    
    const handleHistoryClick = () => {
        setHistoryDrawerOpen(true);
    };

    const handleShareClick = () => {
        setShareDialogOpen(true);
    };
    
    // New handler for chat rename notifications
    const handleChatRenamed = (renamedSession: ChatSession) => {
        // Update the current session if it's the one being renamed
        if (currentChatSession && currentChatSession.id === renamedSession.id) {
            setCurrentChatSession(renamedSession);
        }
        
        // Update the session in the open tabs
        setOpenTabs(prev => 
            prev.map(tab => 
                tab.id === renamedSession.id ? renamedSession : tab
            )
        );
    };
    // Add handlers for copy and edit functionality
    const handleCopy = (messageId: string, text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                // Show copy success feedback
                setCopiedMessageId(messageId);
                // Reset after a short delay
                setTimeout(() => {
                    setCopiedMessageId(null);
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    };

    const handleEditStart = (messageId: string, content: string) => {
        setEditingMessageId(messageId);
        setEditedContent(content);
        // Focus the edit field after rendering
        setTimeout(() => {
            if (editFieldRef.current) {
                editFieldRef.current.focus();
            }
        }, 0);
    };
    const handleEditCancel = () => {
        setEditingMessageId(null);
        setEditedContent('');
    };

    // Update handleEditSave to manually update openTabs
    const handleEditSave = (messageId: string) => {
        // Find the index of the message being edited
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) return;

        // Get a copy of only the messages up to and including the edited message
        const updatedMessages = [...messages.slice(0, messageIndex)];

        // Add the edited message
        const editedMessage = {
            ...messages[messageIndex],
            content: editedContent
        };
        updatedMessages.push(editedMessage);

        // Update messages state with truncated conversation
        setMessages(updatedMessages);

        // Exit edit mode
        setEditingMessageId(null);
        setEditedContent('');

        // Show typing indicator
        setIsTyping(true);

        // Generate new bot response
        setTimeout(() => {
            const botResponse: ChatMessage = {
                id: Date.now().toString(),
                content: createBotResponse(editedContent, editedMessage.references || []),
                sender: "bot",
                timestamp: new Date(),
            };

            const finalMessages = [...updatedMessages, botResponse];
            setMessages(finalMessages);
            setIsTyping(false);

            // Update the current chat session and tabs
            if (currentChatSession && activeTabId) {
                const updatedSession = {
                    ...currentChatSession,
                    messages: finalMessages,
                    lastUpdated: new Date()
                };

                // First update the currentChatSession state
                setCurrentChatSession(updatedSession);
                
                // Then update the openTabs array
                setOpenTabs(prev =>
                    prev.map(tab => tab.id === updatedSession.id ? updatedSession : tab)
                );
                
                // Save to storage
                updateChatSession(updatedSession)
                    .catch(err => console.error('Failed to update chat after edit:', err));
            }
        }, 1500);
    };

    const loadDocuments = async () => {
        try {
            const docs = await getAllDocuments();
            setDocuments(docs);
            return docs; // Return the documents for chaining
        } catch (err) {
            console.error("Failed to load documents:", err);
            return []; // Return empty array on error
        }
    };
    useEffect(() => {
        loadDocuments();
    }, []);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Update handleSendMessage to manually update openTabs
    const handleSendMessage = () => {
        if (inputMessage.trim() === '' && selectedDocuments.length === 0) return;

        // Add user message
        const newUserMessage: ChatMessage = {
            id: Date.now().toString(),
            content: inputMessage,
            sender: 'user',
            timestamp: new Date(),
            references: selectedDocuments.length > 0 ? [...selectedDocuments] : undefined
        };

        const updatedMessages = [...messages, newUserMessage];
        setMessages(updatedMessages);
        setInputMessage('');
        setSelectedDocuments([]);

        // Simulate bot typing
        setIsTyping(true);

        // Simulate bot response after delay
        setTimeout(() => {
            const botResponse: ChatMessage = {
                id: (Date.now() + 1).toString(),
                content: createBotResponse(inputMessage, selectedDocuments),
                sender: 'bot',
                timestamp: new Date(),
            };

            const finalMessages = [...updatedMessages, botResponse];
            setMessages(finalMessages);
            setIsTyping(false);

            // Update the tab title based on the conversation content
            if (currentChatSession && activeTabId) {
                // If this is the first message, set the title based on user input
                let updatedSession = {
                    ...currentChatSession,
                    messages: finalMessages,
                    lastUpdated: new Date()
                };
                
                if (messages.length === 0) {
                    const titleText = inputMessage.length > 30
                        ? inputMessage.substring(0, 27) + '...'
                        : inputMessage;

                    updatedSession.title = titleText;
                }

                // First update currentChatSession
                setCurrentChatSession(updatedSession);
                
                // Then update openTabs
                setOpenTabs(prev =>
                    prev.map(tab => tab.id === activeTabId ? updatedSession : tab)
                );
                
                // Save to storage
                updateChatSession(updatedSession)
                    .catch(err => console.error('Failed to update chat:', err));
            }
        }, 1500);
    };

    // Simulate bot responses
    const createBotResponse = (message: string, docs: Document[]): string => {
        if (docs.length > 0) {
            return `I've analyzed the ${docs.length} document(s) you provided. Here's what I found:\n\n${docs.map(doc => `In "${getOriginalName(doc.filename)}", I found relevant information about ${message.toLowerCase().includes('report') ? 'financial metrics and business performance' : 'the topics you requested'}. Would you like me to summarize specific sections?`).join('\n\n')}`;
        }

        if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
            return "Hello! I'm here to help you analyze your documents. Would you like to upload a file or reference documents from your library?";
        }

        if (message.toLowerCase().includes('document') || message.toLowerCase().includes('file')) {
            return "You can select documents from your library by clicking the document icon in the input field, or upload new files using the attachment button.";
        }

        return "I'll help you analyze that. Would you like to reference any specific documents from your library to inform my response?";
    };

    // Modify the existing handleFileUpload function:
    const handleFileUpload = () => {
        openUploadDialog();
    };

    // Update the handle document select function
    const handleDocumentSelect = (event: React.MouseEvent<HTMLElement>) => {
        // Always show the document menu, even when empty
        setDocumentsAnchorEl(event.currentTarget);
    };

    const handleCloseDocumentMenu = () => {
        setDocumentsAnchorEl(null);
    };

    const addDocumentReference = (doc: Document) => {
        // Limit to 3 documents maximum
        if (selectedDocuments.length >= 3) {
            // Show warning message
            setShowLimitWarning(true);
            handleCloseDocumentMenu();
            return;
        }

        if (!selectedDocuments.find(d => d.id === doc.id)) {
            setSelectedDocuments(prev => [...prev, doc]);
        }
        handleCloseDocumentMenu();
    };

    const removeDocumentReference = (docId: string) => {
        setSelectedDocuments(prev => prev.filter(doc => doc.id !== docId));
    };

    const handleCloseLimitWarning = () => {
        setShowLimitWarning(false);
    };

    // Add a handler to close the warning
    const handleCloseEmptyDocsWarning = () => {
        setShowEmptyDocsWarning(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Voice input functions
    const startVoiceInput = () => {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            if (!SpeechRecognition) {
                console.error('Speech Recognition is not supported in this browser');
                return;
            }

            // Create a variable to store all the accumulated final transcripts
            let accumulatedTranscript = '';

            const recognitionInstance = new SpeechRecognition();

            // Configure for better performance
            recognitionInstance.continuous = true;
            recognitionInstance.interimResults = true;
            recognitionInstance.maxAlternatives = 1; // Only need the best match
            recognitionInstance.lang = 'en-US';

            recognitionInstance.onstart = () => {
                console.log('Speech recognition started');
                // Preserve any existing text in the input field
                accumulatedTranscript = inputMessage;
                setIsRecording(true);
            };

            recognitionInstance.onresult = (event: any) => {
                // Get only the current interim transcript for this result batch
                let interimTranscript = '';

                // Process just the newest results
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;

                    if (event.results[i].isFinal) {
                        // Add space and append to our accumulating transcript
                        accumulatedTranscript += transcript + ' ';
                    } else {
                        // Just the current interim result
                        interimTranscript = transcript;
                    }
                }

                // Always show accumulated transcript plus any current interim text
                setInputMessage(accumulatedTranscript + interimTranscript);
            };

            recognitionInstance.onend = () => {
                console.log('Speech recognition ended');
                setIsRecording(false);
            };

            recognitionInstance.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsRecording(false);
            };

            recognitionInstance.start();
            setRecognition(recognitionInstance);
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            setIsRecording(false);
        }
    };

    const stopVoiceInput = (sendAfterStop: boolean = false) => {
        if (recognition) {
            recognition.stop();
            setRecognition(null);

            // Clear input if cancelling (X button clicked)
            if (!sendAfterStop) {
                setInputMessage('');
            }
            // No longer auto-sending the message when check button is clicked
            // This gives the user a chance to review what was transcribed before sending
        }

        setIsRecording(false);
    };

    const handleVoiceInputToggle = () => {
        if (isRecording) {
            // Voice input is already active, so do nothing
            // (Stopping is handled by separate buttons now)
            return;
        } else {
            startVoiceInput();
        }
    };

    // Animation for pulsing effect
    const pulseAnimation = {
        '@keyframes pulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)' },
            '70%': { boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' }
        }
    };

    // Modify the useEffect that handles recentlyUploadedDocuments
    useEffect(() => {
        // When we have new uploaded documents, refresh the entire document list first
        if (recentlyUploadedDocuments.length > 0) {
            // First reload all documents to get fresh data
            loadDocuments().then(() => {
                // After documents are loaded, find the newly uploaded ones by ID
                const uploadedDocs = documents.filter(doc => 
                    recentlyUploadedDocuments.includes(doc.id)
                );
                
                if (uploadedDocs.length > 0) {
                    // Add them as references to the current chat
                    setSelectedDocuments(prev => {
                        const newDocs = [...prev];
                        
                        // Add each document that isn't already selected (up to max limit)
                        uploadedDocs.forEach(doc => {
                            if (!newDocs.find(d => d.id === doc.id) && newDocs.length < 3) {
                                newDocs.push(doc);
                            }
                        });
                        
                        return newDocs;
                    });
                }
            });
        }
    }, [recentlyUploadedDocuments]); // Remove documents dependency to prevent race conditions

    // Add to the existing useEffect to check for documents in session storage:

    useEffect(() => {
        const checkForSharedDocuments = async () => {
            const storedDocIds = sessionStorage.getItem('chatDocuments');
            if (storedDocIds && documents.length > 0) {
                try {
                    const docIds = JSON.parse(storedDocIds);
                    const docsToAdd = documents.filter(doc => docIds.includes(doc.id));
                    
                    if (docsToAdd.length > 0) {
                        // Add documents as references (respecting the 3 document limit)
                        setSelectedDocuments(prev => {
                            const newDocs = [...prev];
                            
                            // Add documents up to the limit
                            docsToAdd.forEach(doc => {
                                if (!newDocs.find(d => d.id === doc.id) && newDocs.length < 3) {
                                    newDocs.push(doc);
                                }
                            });
                            
                            return newDocs;
                        });
                        
                        // Clear session storage
                        sessionStorage.removeItem('chatDocuments');
                    }
                } catch (error) {
                    console.error("Error processing shared documents:", error);
                    sessionStorage.removeItem('chatDocuments');
                }
            }
        };
        
        checkForSharedDocuments();
    }, [documents]);

    return (

        <>
            {/* Tab Bar */}
            <ChatTabBar
                tabs={openTabs}
                activeTabId={activeTabId || ''}
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
                onNewTab={handleNewTab}
                showCloseButtons={openTabs.length > 1}
            />
            {messages.length === 0 ? (
                // Initial empty state with centered input
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    width: '100%',
                    px: 3
                }}>
                    <Typography
                        variant="h4"
                        align="center"
                        gutterBottom
                        sx={{
                            mb: 4,
                            fontWeight: 500,
                            color: theme.palette.text.primary
                        }}
                    >
                        How can I assist you today?
                    </Typography>

                    {/* Centered input field */}
                    <Box sx={{ width: '100%', maxWidth: 650 }}>
                        <Paper
                            elevation={3}
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                p: 1,
                                borderRadius: 3,
                                backgroundColor: theme.palette.mode === 'dark'
                                    ? alpha(theme.palette.background.paper, 0.2)
                                    : alpha(theme.palette.background.paper, 0.7),
                                border: isRecording
                                    ? `1px solid ${theme.palette.error.main}`
                                    : `1px solid ${theme.palette.divider}`,
                                boxShadow: isRecording
                                    ? 'none'
                                    : theme.palette.mode === 'dark'
                                        ? '0 0 10px rgba(0,0,0,0.2)'
                                        : '0 2px 6px rgba(0,0,0,0.05)',
                                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                ...pulseAnimation
                            }}
                        >
                            {/* Document chips inside the input field */}
                            {selectedDocuments.length > 0 && (
                                <Box sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 0.5,
                                    px: 1,
                                    pt: 0.5,
                                    pb: 1
                                }}>
                                    {selectedDocuments.map(doc => (
                                        <Chip
                                            key={doc.id}
                                            size="small"
                                            icon={getDocumentIcon(getOriginalName(doc.filename))}
                                            variant='outlined'
                                            label={getOriginalName(doc.filename)}
                                            onDelete={() => removeDocumentReference(doc.id)}
                                            sx={{
                                                borderRadius: '6px',
                                                '& .MuiChip-icon': {
                                                    color: 'inherit'
                                                }
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {!isRecording ? (
                                    <>
                                        <Tooltip title="Reference documents">
                                            <IconButton
                                                onClick={handleDocumentSelect}
                                                color="primary"
                                                size="small"
                                                sx={{ mx: 0.5 }}
                                                disabled={isRecording}
                                            >
                                                <ArticleIcon fontSize="medium" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Upload file">
                                            <IconButton
                                                onClick={handleFileUpload}
                                                color="primary"
                                                size="small"
                                                sx={{ mx: 0.5 }}
                                                disabled={isRecording}
                                            >
                                                <CloudUploadIcon fontSize="medium" />
                                            </IconButton>
                                        </Tooltip>
                                    </>
                                ) : (
                                    <Box sx={{ display: 'flex', mx: 0.5, gap: 1 }}>
                                        <Tooltip title="Cancel voice input">
                                            <IconButton
                                                onClick={() => stopVoiceInput(false)}
                                                color="error"
                                                size="small"
                                            >
                                                <CloseIcon fontSize="medium" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Accept voice input">
                                            <IconButton
                                                onClick={() => stopVoiceInput(true)}
                                                color="success"
                                                size="small"
                                            >
                                                <CheckIcon fontSize="medium" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                )}

                                <TextField
                                    fullWidth
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask anything"
                                    multiline
                                    maxRows={5}
                                    variant="standard"
                                    InputProps={{
                                        disableUnderline: true,
                                    }}
                                    sx={{
                                        mx: 1,
                                        '& .MuiInputBase-root': {
                                            fontSize: '1rem',
                                            py: 1.5,
                                        },
                                    }}
                                    inputRef={inputFieldRef}
                                    disabled={isRecording}
                                />

                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Tooltip title={isRecording ? "Recording..." : "Voice input"}>
                                        <IconButton
                                            size="medium"
                                            sx={{
                                                mx: 0.5,
                                                color: isRecording ? theme.palette.error.main : 'inherit',
                                                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                                '@keyframes pulse': {
                                                    '0%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)' },
                                                    '70%': { boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)' },
                                                    '100%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' }
                                                }
                                            }}
                                            onClick={handleVoiceInputToggle}
                                        >
                                            <MicIcon fontSize="medium" />
                                        </IconButton>
                                    </Tooltip>

                                    <Tooltip title="Send message">
                                        <IconButton
                                            color="primary"
                                            onClick={handleSendMessage}
                                            sx={{
                                                mx: 0.5,
                                                bgcolor: inputMessage.trim() === '' ? 'transparent' : theme.palette.primary.main,
                                                color: inputMessage.trim() === '' ? theme.palette.text.disabled : '#fff',
                                                '&:hover': {
                                                    bgcolor: inputMessage.trim() === '' ? 'transparent' : theme.palette.primary.dark,
                                                },
                                                '&.Mui-disabled': {
                                                    bgcolor: 'transparent',
                                                }
                                            }}
                                            disabled={isRecording || inputMessage.trim() === ''}
                                        >
                                            <SendIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>

                            <Menu
                                anchorEl={documentsAnchorEl}
                                open={Boolean(documentsAnchorEl)}
                                onClose={handleCloseDocumentMenu}
                                PaperProps={{
                                    sx: {
                                        maxHeight: 300,
                                        width: '350px',
                                    }
                                }}
                            >
                                <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 600 }}>
                                    Select Documents
                                </Typography>
                                <Divider />
                                
                                {documents.length > 0 ? (
                                    documents.map((doc) => (
                                        <MenuItem
                                            key={doc.id}
                                            onClick={() => addDocumentReference(doc)}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            {getDocumentIcon(getOriginalName(doc.filename))}
                                            <Typography variant="body2" noWrap>{getOriginalName(doc.filename)}</Typography>
                                        </MenuItem>
                                    ))
                                ) : (
                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            No documents available. Please upload documents first.
                                        </Typography>
                                    </Box>
                                )}
                            </Menu>

                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                multiple
                            />
                        </Paper>

                        {/* Selected documents display (for initial centered input) - moved inside input field */}
                        {/* Already included inside the Paper component above */}
                    </Box>
                </Box>
            ) : (
                // Chat interface after messages exist
                <>
                    {/* Messages Area with improved styling - Now with proper height to account for fixed input */}
                    <Box sx={{
                        flexGrow: 1,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        pb: 12, // Added more padding at bottom to prevent content from being hidden behind fixed input
                        height: 'calc(100vh - 120px)', // Set a fixed height that accounts for the fixed input area
                        maxHeight: 'calc(100vh - 120px)',
                        width: '100%',
                        maxWidth: '100%'
                    }}>
                        {messages.map((message) => (
                            <Box
                                key={message.id}
                                sx={{
                                    py: 2,
                                    px: { xs: 2, sm: 4, md: 6, lg: 8 },
                                }}
                            >
                                <Container maxWidth="md">
                                    {message.sender === 'user' ? (
                                        // User message - right aligned with rounded card
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            mb: 1
                                        }}>
                                            <Box
                                                sx={{
                                                    maxWidth: editingMessageId === message.id ? '100%' : '75%',
                                                    width: editingMessageId === message.id ? '100%' : 'auto',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    '&:hover .user-actions': {
                                                        opacity: 1,
                                                        visibility: 'visible'
                                                    }
                                                }}
                                            >
                                                {/* Referenced documents for user messages - Now displayed vertically */}
                                                {message.references && message.references.length > 0 && (
                                                    <Box sx={{
                                                        mb: 1,
                                                        alignSelf: 'flex-end'
                                                    }}>
                                                        <Box sx={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 0.5,
                                                            alignItems: 'flex-end'
                                                        }}>
                                                            {message.references.map(doc => (
                                                                <Chip
                                                                    key={doc.id}
                                                                    size="small"
                                                                    icon={getDocumentIcon(getOriginalName(doc.filename))}
                                                                    label={getOriginalName(doc.filename)}
                                                                    variant="outlined"
                                                                    sx={{
                                                                        borderRadius: '6px',
                                                                        '& .MuiChip-icon': {
                                                                            color: 'inherit'
                                                                        }
                                                                    }}
                                                                />
                                                            ))}
                                                        </Box>
                                                    </Box>
                                                )}

                                                {/* User message content - show edit field if editing, otherwise show message */}
                                                {editingMessageId === message.id ? (
                                                    <Box sx={{
                                                        width: '100%',
                                                        maxWidth: '100%',
                                                        alignSelf: 'flex-end'
                                                    }}>
                                                        <TextField
                                                            fullWidth
                                                            multiline
                                                            inputRef={editFieldRef}
                                                            value={editedContent}
                                                            onChange={(e) => setEditedContent(e.target.value)}
                                                            variant="outlined"
                                                            sx={{
                                                                width: '100%',
                                                                '& .MuiOutlinedInput-root': {
                                                                    borderRadius: '12px',
                                                                    backgroundColor: theme.palette.background.paper,
                                                                },
                                                                mb: 1
                                                            }}
                                                        />
                                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                            <Button
                                                                size="small"
                                                                variant="outlined"
                                                                startIcon={<CloseIcon />}
                                                                onClick={handleEditCancel}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                color="primary"
                                                                startIcon={<SendIcon />}
                                                                onClick={() => handleEditSave(message.id)}
                                                            >
                                                                Send
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Paper
                                                        sx={{
                                                            justifyContent: 'center',
                                                            px: 2,
                                                            display: 'flex',
                                                            borderRadius: '25px 25px 25px 25px',
                                                            backgroundColor: theme.palette.mode === 'dark'
                                                                ? theme.palette.primary.dark
                                                                : theme.palette.primary.main,
                                                            color: '#fff',
                                                        }}
                                                    >
                                                        <Typography>
                                                            <MarkdownPreview content={message.content} />
                                                        </Typography>
                                                    </Paper>
                                                )}

                                                {/* Action buttons for user messages - visible only on hover - now BELOW message */}
                                                {editingMessageId !== message.id && (
                                                    <Box
                                                        className="user-actions"
                                                        sx={{
                                                            display: 'flex',
                                                            gap: 1,
                                                            mt: 1,
                                                            opacity: 0,
                                                            visibility: 'hidden',
                                                            transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out',
                                                            justifyContent: 'flex-end'
                                                        }}
                                                    >
                                                        <Tooltip title="Copy">
                                                            <IconButton size="small" onClick={() => handleCopy(message.id, message.content)}>
                                                                {copiedMessageId === message.id ? (
                                                                    <CheckIcon fontSize="small" color="success" />
                                                                ) : (
                                                                    <ContentCopyIcon fontSize="small" />
                                                                )}
                                                            </IconButton>
                                                        </Tooltip>

                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" onClick={() => handleEditStart(message.id, message.content)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    ) : (
                                        // Bot message - left aligned with full width
                                        <Box sx={{
                                            display: 'flex',
                                            mb: 1,
                                            width: '100%'
                                        }}>
                                            {/* Bot message content - full width */}
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    position: 'relative'
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        p: 2,
                                                        color: theme.palette.text.primary,
                                                        '&:hover .bot-actions': {
                                                            opacity: 1,
                                                            visibility: 'visible'
                                                        }
                                                    }}
                                                >
                                                    {/* Message content */}
                                                    <Typography>
                                                        <MarkdownPreview content={message.content} />
                                                    </Typography>

                                                    {/* Action buttons for bot messages - visible only on hover */}
                                                    <Box
                                                        className="bot-actions"
                                                        sx={{
                                                            display: 'flex',
                                                            gap: 1,
                                                            mt: 2,
                                                            opacity: 0,
                                                            visibility: 'hidden',
                                                            transition: 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out',
                                                        }}
                                                    >
                                                        <Tooltip title="Copy">
                                                            <IconButton size="small" onClick={() => handleCopy(message.id, message.content)}>
                                                                {copiedMessageId === message.id ? (
                                                                    <CheckIcon fontSize="small" color="success" />
                                                                ) : (
                                                                    <ContentCopyIcon fontSize="small" />
                                                                )}
                                                            </IconButton>
                                                        </Tooltip>

                                                        <Tooltip title="Like">
                                                            <IconButton size="small">
                                                                <ThumbUpAltOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>

                                                        <Tooltip title="Dislike">
                                                            <IconButton size="small">
                                                                <ThumbDownAltOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Box>
                                    )}
                                </Container>
                            </Box>
                        ))}

                        {/* Bot typing indicator */}
                        {isTyping && (
                            <Box sx={{ px: { xs: 2, sm: 4, md: 6, lg: 8 }, py: 2 }}>
                                <Container maxWidth="md">
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5 }}>
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    backgroundColor: theme.palette.text.secondary,
                                                    animation: 'pulse 1s infinite',
                                                    animationDelay: '0s',
                                                    '@keyframes pulse': {
                                                        '0%, 100%': {
                                                            opacity: 0.5,
                                                        },
                                                        '50%': {
                                                            opacity: 1,
                                                        },
                                                    },
                                                    mr: 0.5
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    backgroundColor: theme.palette.text.secondary,
                                                    animation: 'pulse 1s infinite',
                                                    animationDelay: '0.2s',
                                                    mr: 0.5
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: '50%',
                                                    backgroundColor: theme.palette.text.secondary,
                                                    animation: 'pulse 1s infinite',
                                                    animationDelay: '0.4s'
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                </Container>
                            </Box>
                        )}

                        <div ref={messagesEndRef} />
                    </Box>

                    {/* Fixed Input Area at the bottom of page - with width matching conversation area */}
                    <Box sx={{
                        position: 'fixed',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1100,
                        display: 'flex',
                        justifyContent: 'center',
                        width: '100%',
                        pl: { xs: 2, sm: 4, md: 6, lg: 9 },
                        mb: 2.5,
                    }}>
                        <Container maxWidth="md" sx={{
                            px: { xs: 2, sm: 4, md: 6, lg: 3.5 },
                            width: '100%'
                        }}>
                            {/* Selected documents display */}
                            {/* Documents are now displayed inside the input field, not here */}

                            {/* Rounded rectangle input field with no box around it */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    p: 1,
                                    borderRadius: 3,
                                    backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.2) : alpha(theme.palette.background.paper, 0.7),
                                    border: isRecording
                                        ? `1px solid ${theme.palette.error.main}`
                                        : `1px solid ${theme.palette.divider}`,
                                    width: '100%',
                                    animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                    ...pulseAnimation
                                }}
                            >
                                {/* Document chips inside the input field */}
                                {selectedDocuments.length > 0 && (
                                    <Box sx={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 0.5,
                                        px: 1,
                                        pt: 0.5,
                                        pb: 1
                                    }}>
                                        {selectedDocuments.map(doc => (
                                            <Chip
                                                key={doc.id}
                                                size="small"
                                                variant='outlined'
                                                icon={getDocumentIcon(getOriginalName(doc.filename))}
                                                label={getOriginalName(doc.filename)}
                                                onDelete={() => removeDocumentReference(doc.id)}
                                                sx={{
                                                    borderRadius: '6px',
                                                    '& .MuiChip-icon': {
                                                        color: 'inherit'
                                                    }
                                                }}
                                            />
                                        ))}
                                    </Box>
                                )}

                                {/* Document and file buttons at left of input */}
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    {!isRecording ? (
                                        <>
                                            <Tooltip title="Reference documents">
                                                <IconButton
                                                    onClick={handleDocumentSelect}
                                                    color="primary"
                                                    size="medium"
                                                    sx={{ mx: 0.5 }}
                                                    disabled={isRecording}
                                                >
                                                    <ArticleIcon fontSize="medium" />
                                                </IconButton>
                                            </Tooltip>

                                            <Tooltip title="Upload file">
                                                <IconButton
                                                    onClick={handleFileUpload}
                                                    color="primary"
                                                    size="medium"
                                                    sx={{ mx: 0.5 }}
                                                    disabled={isRecording}
                                                >
                                                    <CloudUploadIcon fontSize="medium" />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                    ) : (
                                        <Box sx={{ display: 'flex', mx: 0.5, gap: 1 }}>
                                            <Tooltip title="Cancel voice input">
                                                <IconButton
                                                    onClick={() => stopVoiceInput(false)}
                                                    color="error"
                                                    size="medium"
                                                >
                                                    <CloseIcon fontSize="medium" />
                                                </IconButton>
                                            </Tooltip>

                                            <Tooltip title="Accept voice input">
                                                <IconButton
                                                    onClick={() => stopVoiceInput(true)}
                                                    color="success"
                                                    size="medium"
                                                >
                                                    <CheckIcon fontSize="medium" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    )}

                                    <TextField
                                        fullWidth
                                        value={inputMessage}
                                        onChange={(e) => setInputMessage(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Ask anything"
                                        multiline
                                        maxRows={5}
                                        variant="standard"
                                        InputProps={{
                                            disableUnderline: true,
                                        }}
                                        sx={{
                                            mx: 1,
                                            '& .MuiInputBase-root': {
                                                fontSize: '1rem',
                                                py: 1.5,
                                            },
                                        }}
                                        inputRef={inputFieldRef}
                                        disabled={isRecording}
                                    />

                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Tooltip title={isRecording ? "Recording..." : "Voice input"}>
                                            <IconButton
                                                size="medium"
                                                sx={{
                                                    mx: 0.5,
                                                    color: isRecording ? theme.palette.error.main : 'inherit',
                                                    animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                                    '@keyframes pulse': {
                                                        '0%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)' },
                                                        '70%': { boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)' },
                                                        '100%': { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' }
                                                    }
                                                }}
                                                onClick={handleVoiceInputToggle}
                                            >
                                                <MicIcon fontSize="medium" />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Send message">
                                            <span>
                                                <IconButton
                                                    color="primary"
                                                    onClick={handleSendMessage}
                                                    disabled={isRecording || inputMessage.trim() === ''}
                                                    sx={{
                                                        mx: 0.5,
                                                        bgcolor: inputMessage.trim() === '' ? 'transparent' : theme.palette.primary.main,
                                                        color: inputMessage.trim() === '' ? theme.palette.text.disabled : '#fff',
                                                        '&:hover': {
                                                            bgcolor: inputMessage.trim() === '' ? 'transparent' : theme.palette.primary.dark,
                                                        },
                                                        '&.Mui-disabled': {
                                                            bgcolor: 'transparent',
                                                        }
                                                    }}
                                                >
                                                    <SendIcon fontSize="medium" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </Box>
                        </Container>
                    </Box>

                    {/* Document selection menu that works after sending messages */}
                    <Menu
                        anchorEl={documentsAnchorEl}
                        open={Boolean(documentsAnchorEl)}
                        onClose={handleCloseDocumentMenu}
                        PaperProps={{
                            sx: {
                                maxHeight: 300,
                                width: '350px',
                            }
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ px: 2, py: 1, fontWeight: 600 }}>
                            Select Documents
                        </Typography>
                        <Divider />
                        
                        {documents.length > 0 ? (
                            documents.map((doc) => (
                                <MenuItem
                                    key={doc.id}
                                    onClick={() => addDocumentReference(doc)}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    {getDocumentIcon(getOriginalName(doc.filename))}
                                    <Typography variant="body2" noWrap>{getOriginalName(doc.filename)}</Typography>
                                </MenuItem>
                            ))
                        ) : (
                            <Box sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No documents available. Please upload documents first.
                                </Typography>
                            </Box>
                        )}
                    </Menu>

                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        multiple
                    />
                </>
            )}

            {/* Document limit warning message */}
            <Snackbar
                open={showLimitWarning}
                autoHideDuration={6000}
                onClose={handleCloseLimitWarning}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert
                    elevation={6}
                    variant="filled"
                    severity="warning"
                    onClose={handleCloseLimitWarning}
                    sx={{
                        width: '100%',
                        fontSize: '0.95rem',
                        alignItems: 'center',
                        '& .MuiAlert-icon': {
                            fontSize: '1.5rem'
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Document Limit Reached
                        </Typography>
                        <Typography variant="body2">
                            You can select a maximum of 3 documents at a time for analysis.
                        </Typography>
                    </Box>
                </Alert>
            </Snackbar>
            <FloatingActionButtons
                onHistoryClick={handleHistoryClick}
                onShareClick={handleShareClick}
            />
            <Drawer
                anchor="right"
                open={historyDrawerOpen}
                onClose={() => setHistoryDrawerOpen(false)}
                sx={{
                    '& .MuiDrawer-paper': {
                        width: { xs: '100%', sm: 400 },
                        boxSizing: 'border-box'
                    }
                }}
            >
                <ChatHistoryDrawer
                    open={historyDrawerOpen}
                    onClose={() => setHistoryDrawerOpen(false)}
                    onSelectChat={handleSelectChat}
                    onNewChat={handleNewChat}
                    currentChatId={currentChatSession?.id}
                    onChatDeleted={handleChatDeleted}
                    onChatRenamed={handleChatRenamed}
                />
            </Drawer>

            {/* Share Dialog Placeholder */}
            <Dialog
                open={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Share Chat</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Share dialog will be implemented in a future step.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShareDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default QueryAgent;
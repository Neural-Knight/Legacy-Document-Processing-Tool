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
import { useNavigate } from 'react-router-dom';
import { getDocumentIcon, getOriginalName } from '../utils/documentHelpers';
import { Document, getAllDocuments} from '../services/documentService';

// Define speech recognition type
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Define message types
interface ChatMessage {
id: string;
content: string;
sender: 'user' | 'bot';
timestamp: Date;
references?: Document[];
attachments?: any[];
}

const QueryAgent: React.FC = () => {
const navigate = useNavigate();
const theme = useTheme();
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [documents, setDocuments] = useState<Document[]>([]);
const [inputMessage, setInputMessage] = useState('');
const [isTyping, setIsTyping] = useState(false);
const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
const [documentsAnchorEl, setDocumentsAnchorEl] = useState<null | HTMLElement>(null);
const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
const [editedContent, setEditedContent] = useState<string>('');
// Warning message state
const [showLimitWarning, setShowLimitWarning] = useState(false);

// Voice input state
const [isRecording, setIsRecording] = useState<boolean>(false);
const [recognition, setRecognition] = useState<any>(null);

const messagesEndRef = useRef<null | HTMLDivElement>(null);
const fileInputRef = useRef<HTMLInputElement | null>(null);
const inputFieldRef = useRef<HTMLInputElement | null>(null);
const editFieldRef = useRef<HTMLInputElement | null>(null);

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
      sender: "bot", // Using the literal type "bot"
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, botResponse]);
    setIsTyping(false);
  }, 1500);
};

const loadDocuments = async () => {
  try {
    const docs = await getAllDocuments();
    setDocuments(docs);
  } catch (err) {
    console.error(err);
  }
};
useEffect(() => {
  loadDocuments();
}, []);

// Auto-scroll to bottom on new messages
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

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

  setMessages(prev => [...prev, newUserMessage]);
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
    
    setMessages(prev => [...prev, botResponse]);
    setIsTyping(false);
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

const handleFileUpload = () => {
  navigate('/upload');
};

const handleDocumentSelect = (event: React.MouseEvent<HTMLElement>) => {
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

return (
  <>
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
              border: `1px solid ${theme.palette.divider}`,
              boxShadow: theme.palette.mode === 'dark'
                ? '0 0 10px rgba(0,0,0,0.2)'
                : '0 2px 6px rgba(0,0,0,0.05)',
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
              {documents.map((doc) => (
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
              ))}
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
                            justifyContent:'center',
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
                border: `1px solid ${theme.palette.divider}`,
                width: '100%',
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
          {documents.map((doc) => (
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
          ))}
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
  </>
);
};

export default QueryAgent;
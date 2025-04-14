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
  Container
} from '@mui/material';

// Icons
import SendIcon from '@mui/icons-material/Send';
import ArticleIcon from '@mui/icons-material/Article';
import MicIcon from '@mui/icons-material/Mic';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbDownAltOutlinedIcon from '@mui/icons-material/ThumbDownAltOutlined';
import MarkdownPreview from '../components/QueryAgent/MarkDownPreview';
import { useNavigate } from 'react-router-dom';

// Define message types
interface Document {
  id: string;
  title: string;
  content: string;
  type: 'pdf' | 'doc' | 'txt' | 'other';
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  references?: Document[];
  attachments?: any[];
}

// Sample documents for demo
const sampleDocuments: Document[] = [
  { id: '1', title: 'Annual Report 2024.pdf', content: 'Financial data...', type: 'pdf' },
  { id: '2', title: 'Project Plan.doc', content: 'Project timeline...', type: 'doc' },
  { id: '3', title: 'Research Notes.txt', content: 'Research findings...', type: 'txt' },
  { id: '4', title: 'Customer Feedback.doc', content: 'Survey results...', type: 'doc' },
  { id: '5', title: 'Policy Guidelines.pdf', content: 'Company policies...', type: 'pdf' },
];

const QueryAgent: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Document[]>([]);
  const [documentsAnchorEl, setDocumentsAnchorEl] = useState<null | HTMLElement>(null);
  
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      return `I've analyzed the ${docs.length} document(s) you provided. Here's what I found:\n\n${docs.map(doc => `In "${doc.title}", I found relevant information about ${message.toLowerCase().includes('report') ? 'financial metrics and business performance' : 'the topics you requested'}. Would you like me to summarize specific sections?`).join('\n\n')}`;
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
    if (!selectedDocuments.find(d => d.id === doc.id)) {
      setSelectedDocuments(prev => [...prev, doc]);
    }
    handleCloseDocumentMenu();
  };
  
  const removeDocumentReference = (docId: string) => {
    setSelectedDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const getFileIcon = (type: string) => {
    switch(type) {
      case 'pdf':
        return <PictureAsPdfIcon fontSize="small" color="error" />;
      case 'doc':
        return <ArticleIcon fontSize="small" color="primary" />;
      case 'txt':
        return <InsertDriveFileIcon fontSize="small" color="info" />;
      default:
        return <InsertDriveFileIcon fontSize="small" />;
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
                alignItems: 'center',
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
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title="Reference documents">
                  <IconButton 
                    onClick={handleDocumentSelect}
                    color="primary"
                    size="small"
                    sx={{ mx: 0.5 }}
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
                  >
                    <CloudUploadIcon fontSize="medium" />
                  </IconButton>
                </Tooltip>
              </Box>
              
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
              />
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title="Voice input">
                  <IconButton size="medium" sx={{ mx: 0.5 }}>
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
                  >
                    <SendIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
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
                {sampleDocuments.map((doc) => (
                  <MenuItem 
                    key={doc.id} 
                    onClick={() => addDocumentReference(doc)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    {getFileIcon(doc.type)}
                    <Typography variant="body2" noWrap>{doc.title}</Typography>
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
            
            {/* Selected documents display (for initial centered input) */}
            {selectedDocuments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                  Referenced Documents:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {selectedDocuments.map(doc => (
                    <Chip
                      key={doc.id}
                      size="small"
                      icon={getFileIcon(doc.type)}
                      label={doc.title}
                      onDelete={() => removeDocumentReference(doc.id)}
                      sx={{ borderRadius: '6px' }}
                    />
                  ))}
                </Box>
              </Box>
            )}
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
            height: 'calc(100vh - 100px)', // Set a fixed height that accounts for the fixed input area
            maxHeight: 'calc(100vh - 100px)',
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
                          maxWidth: '75%',
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
                                  icon={getFileIcon(doc.type)}
                                  label={doc.title}
                                  variant="outlined"
                                  sx={{ 
                                    borderRadius: '6px',
                                  }}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        
                        {/* User message content */}
                        <Paper
                          elevation={1}
                          sx={{
                            p: 1,
                            borderRadius: '16px 16px 4px 16px',
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
                        
                        {/* Action buttons for user messages - visible only on hover - now BELOW message */}
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
                            <IconButton size="small">
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="Edit">
                            <IconButton size="small">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
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
                              <IconButton size="small">
                                <ContentCopyIcon fontSize="small" />
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
            backdropFilter: 'blur(800px)',
            width: '100%',
            pl: { xs: 2, sm: 4, md: 6, lg: 9 },
            mb: 1,
            p:1,
          }}>
            <Container maxWidth="md" sx={{  
              px: { xs: 2, sm: 4, md: 6, lg: 3.5 },
              width: '100%'
            }}>
              {/* Selected documents display */}
              {selectedDocuments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    Referenced Documents:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                    {selectedDocuments.map(doc => (
                      <Chip
                        key={doc.id}
                        size="small"
                        icon={getFileIcon(doc.type)}
                        label={doc.title}
                        onDelete={() => removeDocumentReference(doc.id)}
                        sx={{ borderRadius: '6px' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Rounded rectangle input field with no box around it */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  borderRadius: 3,
                  backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.2) : alpha(theme.palette.background.paper, 0.7),
                  border: `1px solid ${theme.palette.divider}`,
                  width: '100%',
                }}
              >
                {/* Document and file buttons at left of input */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Reference documents">
                    <IconButton 
                      onClick={handleDocumentSelect}
                      color="primary"
                      size="medium"
                      sx={{ mx: 0.5 }}
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
                    >
                      <CloudUploadIcon fontSize="medium" />
                    </IconButton>
                  </Tooltip>
                </Box>
                
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
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Voice input">
                    <IconButton size="medium" sx={{ mx: 0.5 }}>
                      <MicIcon fontSize="medium" />
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title="Send message">
                    <span>
                      <IconButton 
                        color="primary"
                        onClick={handleSendMessage}
                        disabled={inputMessage.trim() === ''}
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
            {sampleDocuments.map((doc) => (
              <MenuItem 
                key={doc.id} 
                onClick={() => addDocumentReference(doc)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {getFileIcon(doc.type)}
                <Typography variant="body2" noWrap>{doc.title}</Typography>
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
    </>
  );
};

export default QueryAgent;
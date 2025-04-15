// src/components/QueryAgent/ChatHistoryDrawer.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    List,
    ListItemSecondaryAction,
    IconButton,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    Divider,
    CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ListItemButton from '@mui/material/ListItemButton';
import { getAllChatSessions, searchChatSessions, createChatSession, updateChatSession, deleteChatSession, getChatSession } from '../../services/chatStorageService';
import { ChatSession } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';

interface ChatHistoryDrawerProps {
    open: boolean;
    onClose: () => void;
    onSelectChat: (session: ChatSession) => void;
    onNewChat: () => void;
    currentChatId?: string;
    onChatDeleted?: (chatId: string) => void;
    onChatRenamed?: (session: ChatSession) => void;
}

const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
    open,
    onClose,
    onSelectChat,
    onNewChat,
    currentChatId,
    onChatDeleted,
    onChatRenamed
}) => {
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // For the context menu
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

    // For rename dialog
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    
    // Reference for the input field
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Load chat sessions when drawer opens
    useEffect(() => {
        if (open) {
            loadChatSessions();
        }
    }, [open]);

    // Handle focus when rename dialog opens
    useEffect(() => {
        if (renameDialogOpen) {
            const timeoutId = setTimeout(() => {
                if (renameInputRef.current) {
                    renameInputRef.current.focus();
                    renameInputRef.current.select();
                    console.log("Focus and select applied to rename input");
                }
            }, 200);
            
            return () => clearTimeout(timeoutId);
        }
    }, [renameDialogOpen]);

    // Filter sessions when search query changes
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredSessions(chatSessions);
        } else {
            const filtered = chatSessions.filter(session =>
                session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (session.previewText && session.previewText.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredSessions(filtered);
        }
    }, [searchQuery, chatSessions]);

    const loadChatSessions = async () => {
        setLoading(true);
        try {
            const sessions = await getAllChatSessions();
            setChatSessions(sessions);
            setFilteredSessions(sessions);
        } catch (error) {
            console.error('Failed to load chat sessions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNewChat = () => {
        onNewChat();
        onClose();
    };

    const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
    };

    const handleChatSelect = (session: ChatSession) => {
        onSelectChat(session);
        onClose();
    };

    // Menu handlers
    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, chatId: string) => {
        event.stopPropagation();
        setMenuAnchorEl(event.currentTarget);
        setSelectedChatId(chatId);
    };

    const handleMenuClose = () => {
        setMenuAnchorEl(null);
    };

    const handleRenameClick = () => {
        const session = chatSessions.find(s => s.id === selectedChatId);
        if (session) {
            console.log("Opening rename dialog for session:", session);
            setNewTitle(session.title);
            handleMenuClose(); // Close menu first
            
            // Open dialog after a small delay to ensure smooth transition
            setTimeout(() => {
                setRenameDialogOpen(true);
            }, 100);
        } else {
            console.warn("Failed to find session for rename with ID:", selectedChatId);
            handleMenuClose();
        }
    };

    // We'll use the direct implementation approach here
    const handleRenameSubmit = async () => {
        console.log("⭐ handleRenameSubmit called");
        
        if (!selectedChatId) {
            console.error("❌ No selectedChatId available");
            setRenameDialogOpen(false);
            return;
        }
        
        if (newTitle.trim() === '') {
            console.error("❌ Empty title provided");
            setRenameDialogOpen(false);
            return;
        }

        console.log("✅ Inputs validated - proceeding with rename");
        console.log("📝 Selected chat ID:", selectedChatId);
        console.log("📝 New title:", newTitle);
        
        try {
            // First get the current session from our local state to use as a fallback
            let sessionToUpdate = chatSessions.find(s => s.id === selectedChatId);
            
            if (!sessionToUpdate) {
                console.error("❌ Could not find session in local state, aborting");
                setRenameDialogOpen(false);
                return;
            }
            
            console.log("📝 Original session from state:", sessionToUpdate);
            
            // Create a minimal update object with just the title change
            const updatedSession = {
                ...sessionToUpdate,
                title: newTitle.trim(),
                lastUpdated: new Date()
            };
            
            console.log("📝 Updated session to save:", updatedSession);
            
            // Direct update approach
            await updateChatSession(updatedSession)
                .then(result => {
                    console.log("✅ Database update success:", result);
                    
                    // Immediately notify parent about the change
                    if (onChatRenamed) {
                        console.log("📣 Calling onChatRenamed callback");
                        onChatRenamed(updatedSession);
                    } else {
                        console.warn("⚠️ No onChatRenamed callback provided");
                    }
                    
                    // Refresh our local list
                    console.log("🔄 Refreshing chat sessions list");
                    loadChatSessions();
                })
                .catch(err => {
                    console.error("❌ Database update failed:", err);
                });
            
            console.log("✅ Rename operation complete");
        } catch (error) {
            console.error("❌ Error during rename operation:", error);
        }
        
        // Always close the dialog when done
        setRenameDialogOpen(false);
    };

    // Handle Enter key in rename dialog
    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        console.log("Key pressed in rename dialog:", e.key);
        if (e.key === 'Enter') {
            console.log("Enter key detected - triggering rename submit");
            e.preventDefault();
            handleRenameSubmit();
        }
    };

    const handleDeleteClick = async () => {
        if (selectedChatId) {
            try {
                await deleteChatSession(selectedChatId);
                
                // Notify parent component about deletion
                if (onChatDeleted) {
                    onChatDeleted(selectedChatId);
                }
                
                // Refresh the drawer list
                loadChatSessions();
            } catch (error) {
                console.error('Failed to delete chat:', error);
            }
        }
        handleMenuClose();
    };

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Chat History</Typography>
                <IconButton onClick={onClose} edge="end">
                    <CloseIcon />
                </IconButton>
            </Box>

            <Divider />

            {/* Search and New Chat buttons */}
            <Box sx={{ p: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search chats"
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={handleSearch}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ mb: 2 }}
                />

                <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleCreateNewChat}
                >
                    New Chat
                </Button>
            </Box>

            <Divider />

            {/* Chat list */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : filteredSessions.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography color="textSecondary">
                            {searchQuery.trim() !== '' ? 'No matches found' : 'No chat history yet'}
                        </Typography>
                    </Box>
                ) : (
                    <List>
                        {filteredSessions.map((session) => (
                            <ListItemButton
                                key={session.id}
                                onClick={() => handleChatSelect(session)}
                                selected={session.id === currentChatId}
                                sx={{
                                    borderLeft: session.id === currentChatId ? 3 : 0,
                                    borderColor: 'primary.main',
                                    pl: session.id === currentChatId ? 2 : 3,
                                    py: 1.5
                                }}
                            >
                                <Box sx={{ width: 'calc(100% - 48px)' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography 
                                            variant="subtitle2" 
                                            sx={{ 
                                                fontWeight: 'medium',
                                                maxWidth: '85%',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {session.title}
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary">
                                            {formatDistanceToNow(new Date(session.lastUpdated), { addSuffix: true })}
                                        </Typography>
                                    </Box>
                                    
                                    {/* Preview text with ellipsis */}
                                    <Typography 
                                        variant="body2" 
                                        color="textSecondary"
                                        sx={{ 
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            mt: 0.5
                                        }}
                                    >
                                        {session.previewText || 'Empty conversation'}
                                    </Typography>
                                </Box>
                                
                                <ListItemSecondaryAction>
                                    <IconButton
                                        edge="end"
                                        onClick={(e) => handleMenuOpen(e, session.id)}
                                        size="small"
                                    >
                                        <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                </ListItemSecondaryAction>
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </Box>

            {/* Context menu for chat actions */}
            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleRenameClick}>Rename</MenuItem>
                <MenuItem onClick={handleDeleteClick}>Delete</MenuItem>
            </Menu>

            {/* Rename dialog */}
            <Dialog 
                open={renameDialogOpen} 
                onClose={() => setRenameDialogOpen(false)}
                sx={{ zIndex: 1400 }}
            >
                <DialogTitle>Rename Chat</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus={true}
                        margin="dense"
                        label="Chat Name"
                        type="text"
                        fullWidth
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        inputRef={renameInputRef}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => {
                            console.log("Save button clicked");
                            handleRenameSubmit();
                        }} 
                        color="primary" 
                        variant="contained"
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ChatHistoryDrawer;
// src/components/QueryAgent/ChatHistoryDrawer.tsx
import React, { useState, useEffect } from 'react';
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
import { getAllChatSessions, searchChatSessions, createChatSession, updateChatSession, deleteChatSession } from '../../services/chatStorageService';
import { ChatSession } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';

interface ChatHistoryDrawerProps {
    open: boolean;
    onClose: () => void;
    onSelectChat: (session: ChatSession) => void;
    onNewChat: () => void;
    currentChatId?: string;
    onChatDeleted?: (chatId: string) => void; // New callback prop for deletion notification
}

const ChatHistoryDrawer: React.FC<ChatHistoryDrawerProps> = ({
    open,
    onClose,
    onSelectChat,
    onNewChat,
    currentChatId,
    onChatDeleted
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

    useEffect(() => {
        if (open) {
            loadChatSessions();
        }
    }, [open]);

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

    // Fix: Removed the creation of a new session here to avoid duplication
    const handleCreateNewChat = () => {
        // Just call the parent's handler which will create the session
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
        setSelectedChatId(null);
    };

    const handleRenameClick = () => {
        const session = chatSessions.find(s => s.id === selectedChatId);
        if (session) {
            setNewTitle(session.title);
            setRenameDialogOpen(true);
        }
        handleMenuClose();
    };

    const handleRenameSubmit = async () => {
        if (selectedChatId && newTitle.trim() !== '') {
            try {
                const session = chatSessions.find(s => s.id === selectedChatId);
                if (session) {
                    const updatedSession = { ...session, title: newTitle.trim() };
                    await updateChatSession(updatedSession);
                    loadChatSessions();
                }
            } catch (error) {
                console.error('Failed to rename chat:', error);
            }
        }
        setRenameDialogOpen(false);
    };

    const handleDeleteClick = async () => {
        if (selectedChatId) {
            try {
                await deleteChatSession(selectedChatId);
                
                // Notify parent component about deletion - let the parent component handle
                // both removing the tab and creating a new one if needed
                if (onChatDeleted) {
                    onChatDeleted(selectedChatId);
                }
                
                // Refresh the drawer list without creating a new chat
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
                                py: 1.5 // Reduce vertical padding
                            }}
                        >
                            <Box sx={{ width: 'calc(100% - 48px)' }}> {/* 48px accounts for the icon button width */}
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
            <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
                <DialogTitle>Rename Chat</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Chat Name"
                        type="text"
                        fullWidth
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleRenameSubmit} color="primary">Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ChatHistoryDrawer;
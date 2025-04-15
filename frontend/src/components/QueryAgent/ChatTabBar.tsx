import React from 'react';
import { 
  Box, 
  Tabs, 
  Tab, 
  IconButton, 
  useTheme,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { ChatSession } from '../../types/chat';

interface ChatTabBarProps {
  tabs: ChatSession[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  showCloseButtons?: boolean; // New prop to control close button visibility
}

const ChatTabBar: React.FC<ChatTabBarProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onNewTab,
  showCloseButtons = true // Default to true for backward compatibility
}) => {
  const theme = useTheme();
  
  // Handle tab change
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    onTabChange(newValue);
  };
  
  // Prevent event propagation when closing a tab
  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onTabClose(tabId);
  };
  
  return (
    <Box 
      sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: theme.palette.background.paper,
        display: 'flex',
        padding: 0,
        margin: 0,
        width: 'calc(100vw - 57px)', // Full width minus sidebar width (57px)
        height: 36, // Reduced height as requested
        position: 'fixed',
        top: 0,
        left: 57, // Start right after the sidebar
        right: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', // Add a subtle shadow for depth
        zIndex: 1100,
      }}
    >
      <Tabs 
        value={activeTabId}
        onChange={handleChange}
        variant="scrollable" 
        scrollButtons={false} 
        aria-label="chat tabs"
        sx={{ 
          minHeight: 36,
          maxHeight: 36,
          flex: '1 1 auto',
          maxWidth: `calc(100% - 40px)`, // Reserve space for add button
          '& .MuiTabs-scroller': {
            overflow: 'hidden !important' // Prevent scrolling behavior
          },
          '& .MuiTabs-flexContainer': {
            height: 36,
            display: 'flex',
            alignItems: 'center',
            width: '100%', // Ensure the flex container takes full width
          },
          '& .MuiTab-root': {
            minHeight: 36,
            height: 36,
            minWidth: '60px', // Minimum width tabs can shrink to
            maxWidth: '220px', // Maximum width tabs can expand to
            padding: '0 8px',
            textAlign: 'center', // Center text in tab
            alignItems: 'center', 
            justifyContent: 'center', // Center content horizontally
            textTransform: 'none',
            fontWeight: 'regular',
            fontSize: '0.875rem',
            marginRight: 0, // Remove margin between tabs
            position: 'relative',
            borderTopLeftRadius: 8, // Curved top edges like Chrome
            borderTopRightRadius: 8,
            flex: '1 1 auto', // Allow tabs to grow and shrink equally
            transition: 'all 0.2s', // Add transition for smooth resizing
            borderRight: `1px solid ${theme.palette.divider}`, // Clear divider between tabs
            
            '&.Mui-selected': {
              backgroundColor: theme.palette.mode === 'light' 
                ? theme.palette.grey[300]
                : theme.palette.grey[800],
              borderBottom: 'none',
              zIndex: 2, // Make selected tab appear above others
              marginBottom: -1, // Make the tab extend slightly below
              paddingBottom: 1, // Extra padding to create the extended effect
              position: 'relative',
              borderRight: 'none', // Remove right border for selected tab
              boxShadow: 'none',
              '&::before': {
                content: '""',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: 'inherit',
                borderBottomLeftRadius: 3,
                borderBottomRightRadius: 3,
              }
            },
            // Hover effect
            '&:hover': {
              backgroundColor: theme.palette.mode === 'light'
                ? theme.palette.grey[200]
                : theme.palette.grey[800],
            }
          }
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center', // Center content horizontally 
                width: '100%',
                position: 'relative', // For absolute positioning of close button
              }}>
                <Box sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 'calc(100% - 24px)', // More space for text
                  textAlign: 'center', // Center text
                  px: 1, // Add some padding on sides
                }}>
                  {tab.title}
                </Box>
                {/* Only render close button if showCloseButtons is true or we have multiple tabs */}
                {showCloseButtons && (
                  <IconButton
                    size="small"
                    onClick={(e) => handleCloseClick(e, tab.id)}
                    sx={{ 
                      position: 'absolute', // Position it absolutely
                      right: 2, // Position from right
                      top: '50%', // Center vertically
                      transform: 'translateY(-50%)', // Center vertically
                      p: 0.5, // Smaller padding for close button
                      fontSize: 14, // Reduced icon size
                      opacity: 0.7,
                      width: 18,
                      height: 18,
                      '&:hover': {
                        opacity: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                )}
              </Box>
            }
            sx={{
              '&.Mui-selected': {
                color: theme.palette.primary.main,
                fontWeight: 'medium',
              }
            }}
          />
        ))}
      </Tabs>
      {/* Separate Add button container */}
      <Box 
        sx={{ 
          position: 'sticky',
          right: 0,
          top: 0,
          height: 36,
          width: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.palette.background.paper,
          zIndex: 1,
          borderLeft: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Tooltip title="New chat">
          <IconButton 
            onClick={onNewTab}
            sx={{ 
              width: 32,
              height: 32,
              color: theme.palette.primary.main,
              padding: 0,
            }}
          >
            <AddIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default ChatTabBar;
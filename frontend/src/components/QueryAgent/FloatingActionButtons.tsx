import React from 'react';
import { Box, Tooltip, IconButton, useTheme } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ShareIcon from '@mui/icons-material/Share';

interface FloatingActionButtonsProps {
  onHistoryClick: () => void;
  onShareClick: () => void;
}

const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
  onHistoryClick,
  onShareClick
}) => {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 50,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        zIndex: 1000,
      }}
    >
      <Tooltip title="Chat History" placement="left">
        <IconButton
          onClick={onHistoryClick}
          sx={{
            backgroundColor: theme.palette.background.paper,
            boxShadow: 2,
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' 
                ? theme.palette.grey[800] 
                : theme.palette.grey[200],
            }
          }}
        >
          <HistoryIcon color="primary" />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Share Chat" placement="left">
        <IconButton
          onClick={onShareClick}
          sx={{
            backgroundColor: theme.palette.background.paper,
            boxShadow: 2,
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark' 
                ? theme.palette.grey[800] 
                : theme.palette.grey[200],
            }
          }}
        >
          <ShareIcon color="primary" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default FloatingActionButtons;
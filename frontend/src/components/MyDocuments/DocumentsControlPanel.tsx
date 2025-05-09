import React from 'react';
import { 
  Box, 
  Paper, 
  InputBase, 
  IconButton, 
  Tooltip, 
  Button, 
  alpha,
  ToggleButtonGroup,
  ToggleButton,
  Badge,
  useTheme
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';    
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import RefreshIcon from '@mui/icons-material/Refresh';  
import UploadFileIcon from '@mui/icons-material/UploadFile';

import { ViewMode, FilterProcessed } from '../../utils/myDocumentTypes';
import { useUpload } from '../../contexts/UploadContext';

interface DocumentsControlPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => void;
  filterProcessed: FilterProcessed;
  onFilterClick: (event: React.MouseEvent<HTMLElement>) => void;
  onSortClick: (event: React.MouseEvent<HTMLElement>) => void;
  refreshing: boolean;
  onRefresh: () => void;
  onUpload: () => void;
  children?: React.ReactNode;
}

const DocumentsControlPanel: React.FC<DocumentsControlPanelProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  filterProcessed,
  onFilterClick,
  onSortClick,
  refreshing,
  onRefresh,
  onUpload,
  children 
}) => {
  const theme = useTheme();
  const { openUploadDialog } = useUpload();

  const handleUploadClick = () => {
    openUploadDialog();
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 1, 
        mb: 3, 
        borderRadius: '12px',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1,
        background: theme.palette.mode === 'dark'
          ? alpha(theme.palette.background.paper, 0.8)
          : theme.palette.background.paper,
        backdropFilter: 'blur(10px)',
        boxShadow: theme.palette.mode === 'dark'
          ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
          : '0 8px 32px rgba(0, 105, 92, 0.08)'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        flex: 1,
        alignItems: 'center',
        p: 0.5,
        borderRadius: '8px',
        background: theme.palette.mode === 'dark' 
          ? alpha(theme.palette.background.default, 0.6)
          : alpha(theme.palette.background.default, 0.6)
      }}>
        <SearchIcon sx={{ color: 'text.secondary', ml: 1, mr: 1 }} />
        <InputBase
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ 
            flex: 1,
            '& input': {
              py: 1,
              transition: 'all 0.3s',
              fontSize: '0.95rem',
            }
          }}
        />
      </Box>
      
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        justifyContent: { xs: 'space-between', sm: 'flex-end' },
      }}>
        {/* View Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={onViewModeChange}
          aria-label="view mode"
          size="small"
          sx={{ 
            height: 40,
            backgroundColor: theme.palette.mode === 'dark' 
              ? alpha(theme.palette.background.default, 0.6)
              : alpha(theme.palette.background.default, 0.6),
            borderRadius: '8px',
            border: 'none',
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: '8px',
              mx: 0.5,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: theme.palette.primary.main,
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.2)
                  : alpha(theme.palette.primary.main, 0.1),
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.primary.main, 0.25)
                    : alpha(theme.palette.primary.main, 0.15),
                }
              },
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.05)
                  : alpha(theme.palette.common.black, 0.05),
              }
            }
          }}
        >
          <ToggleButton value="grid" aria-label="grid view">
            <Tooltip title="Grid View">
              <GridViewIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="list" aria-label="list view">
            <Tooltip title="List View">
              <ViewListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        
        {/* Filter Button */}
        <Tooltip title="Filter Documents">
          <IconButton 
            onClick={onFilterClick}
            size="small"
            sx={{ 
              height: 40, 
              width: 40, 
              backgroundColor: filterProcessed !== 'all' 
                ? alpha(theme.palette.primary.main, 0.1) 
                : theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.default, 0.6)
                  : alpha(theme.palette.background.default, 0.6),
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.default, 0.8)
                  : alpha(theme.palette.background.default, 0.8),
              },
              color: filterProcessed !== 'all' ? theme.palette.primary.main : 'text.secondary',
            }}
          >
            {filterProcessed !== 'all' ? (
              <Badge color="primary" variant="dot">
                <FilterListIcon fontSize="small" />
              </Badge>
            ) : (
              <FilterListIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        
        {/* Sort Button */}
        <Tooltip title="Sort Documents">
          <IconButton 
            onClick={onSortClick}
            size="small"
            sx={{ 
              height: 40, 
              width: 40, 
              backgroundColor: theme.palette.mode === 'dark' 
              ? alpha(theme.palette.background.default, 0.6)
              : alpha(theme.palette.background.default, 0.6),
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.default, 0.8)
                  : alpha(theme.palette.background.default, 0.8),
              }
            }}
          >
            <SortIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </IconButton>
        </Tooltip>
        
        {/* Refresh Button */}
        <Tooltip title="Refresh">
          <IconButton 
            onClick={onRefresh}
            disabled={refreshing}
            size="small"
            sx={{ 
              height: 40, 
              width: 40, 
              backgroundColor: theme.palette.mode === 'dark' 
              ? alpha(theme.palette.background.default, 0.6)
              : alpha(theme.palette.background.default, 0.6),
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.default, 0.8)
                  : alpha(theme.palette.background.default, 0.8),
              }
            }}
          >
            <RefreshIcon 
              fontSize="small" 
              sx={{ 
                color: 'text.secondary',
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': {
                    transform: 'rotate(0deg)',
                  },
                  '100%': {
                    transform: 'rotate(360deg)',
                  },
                },
              }} 
            />
          </IconButton>
        </Tooltip>
        
        {/* Render children before the Upload Button */}
        {children}
        
        {/* Upload Button */}
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          onClick={handleUploadClick}
          sx={{ 
            height: 40,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
            minWidth: { xs: '100%', sm: 'auto' }
          }}
        >
          Upload
        </Button>
      </Box>
    </Paper>
  );
};

export default DocumentsControlPanel;
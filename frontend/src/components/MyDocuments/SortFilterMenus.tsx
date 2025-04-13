import React from 'react';
import { Menu, MenuItem, alpha, useTheme } from '@mui/material';
import { SortBy, SortDirection, FilterProcessed } from '../../utils/myDocumentTypes';

interface SortMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  sortBy: SortBy;
  sortDirection: SortDirection;
  onSort: (sort: SortBy) => void;
}

export const SortMenu: React.FC<SortMenuProps> = ({
  anchorEl,
  open,
  onClose,
  sortBy,
  sortDirection,
  onSort
}) => {
  const theme = useTheme();
  
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          mt: 1.5,
          borderRadius: '12px',
          minWidth: 180,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.5)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
          '& .MuiMenuItem-root': {
            px: 2,
            py: 1.5,
            borderRadius: '8px',
            mx: 0.5,
            my: 0.5,
            display: 'flex',
            justifyContent: 'space-between',
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.1)
                : alpha(theme.palette.primary.main, 0.05),
            },
            '&.Mui-selected': {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.25)
                  : alpha(theme.palette.primary.main, 0.15),
              }
            }
          }
        }
      }}
    >
      <MenuItem onClick={() => onSort('date')} selected={sortBy === 'date'}>
        <span>Date {sortBy === 'date' && (sortDirection === 'asc' ? '(Oldest)' : '(Newest)')}</span>
      </MenuItem>
      <MenuItem onClick={() => onSort('name')} selected={sortBy === 'name'}>
        <span>Name {sortBy === 'name' && (sortDirection === 'asc' ? '(A-Z)' : '(Z-A)')}</span>
      </MenuItem>
      <MenuItem onClick={() => onSort('size')} selected={sortBy === 'size'}>
        <span>Size {sortBy === 'size' && (sortDirection === 'asc' ? '(Smallest)' : '(Largest)')}</span>
      </MenuItem>
    </Menu>
  );
};

interface FilterMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  filterProcessed: FilterProcessed;
  onFilterChange: (filter: FilterProcessed) => void;
}

export const FilterMenu: React.FC<FilterMenuProps> = ({
  anchorEl,
  open,
  onClose,
  filterProcessed,
  onFilterChange
}) => {
  const theme = useTheme();
  
  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          mt: 1.5,
          borderRadius: '12px',
          minWidth: 180,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.5)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
          '& .MuiMenuItem-root': {
            px: 2,
            py: 1.5,
            borderRadius: '8px',
            mx: 0.5,
            my: 0.5,
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.1)
                : alpha(theme.palette.primary.main, 0.05),
            },
            '&.Mui-selected': {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.1),
              '&:hover': {
                backgroundColor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.primary.main, 0.25)
                  : alpha(theme.palette.primary.main, 0.15),
              }
            }
          }
        }
      }}
    >
      <MenuItem 
        onClick={() => onFilterChange('all')} 
        selected={filterProcessed === 'all'}
      >
        All Documents
      </MenuItem>
      <MenuItem 
        onClick={() => onFilterChange('processed')} 
        selected={filterProcessed === 'processed'}
      >
        Processed
      </MenuItem>
      <MenuItem 
        onClick={() => onFilterChange('processing')} 
        selected={filterProcessed === 'processing'}
      >
        Processing
      </MenuItem>
    </Menu>
  );
};

interface ContextMenuProps {
  contextMenu: { mouseX: number; mouseY: number; documentId: string } | null;
  onClose: () => void;
  onDownload: () => void;
  onView: () => void;
  onDetails: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  isFavorite: boolean;
}

export const DocumentContextMenu: React.FC<ContextMenuProps> = ({
  contextMenu,
  onClose,
  onDownload,
  onView,
  onDetails,
  onToggleFavorite,
  onDelete,
  isFavorite
}) => {
  const theme = useTheme();
  
  return (
    <Menu
      open={contextMenu !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu !== null
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : undefined
      }
      PaperProps={{
        sx: {
          borderRadius: '12px',
          minWidth: 180,
          boxShadow: theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.5)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
          '& .MuiMenuItem-root': {
            px: 2,
            py: 1.5,
            borderRadius: '8px',
            mx: 0.5,
            my: 0.5,
            gap: 1.5,
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.primary.main, 0.1)
                : alpha(theme.palette.primary.main, 0.05),
            }
          }
        }
      }}
    >
      <MenuItem onClick={onDownload}>
        <CloudDownloadIcon fontSize="small" />
        Download
      </MenuItem>
      <MenuItem onClick={onView}>
        <TableChartIcon fontSize="small" />
        View Data
      </MenuItem>
      <MenuItem onClick={onDetails}>
        <InfoOutlinedIcon fontSize="small" />
        Details
      </MenuItem>
      <MenuItem onClick={onToggleFavorite}>
        {isFavorite ? (
          <>
            <StarIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
            Remove Favorite
          </>
        ) : (
          <>
            <StarBorderIcon fontSize="small" />
            Add to Favorites
          </>
        )}
      </MenuItem>
      <Divider sx={{ my: 1 }} />
      <MenuItem onClick={onDelete} sx={{ color: theme.palette.error.main }}>
        <DeleteIcon fontSize="small" color="error" />
        Delete
      </MenuItem>
    </Menu>
  );
};

import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TableChartIcon from '@mui/icons-material/TableChart';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DeleteIcon from '@mui/icons-material/Delete';

import { Divider } from '@mui/material';
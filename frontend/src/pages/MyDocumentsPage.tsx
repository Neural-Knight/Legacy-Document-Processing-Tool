import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Alert, 
  Snackbar, 
  Chip, 
  Typography, 
  Skeleton,
  alpha, 
  useTheme,
  Fade
} from '@mui/material';
import { AnimatePresence } from 'framer-motion';

// Components
import DocumentsHeader from '../components/MyDocuments/DocumentsHeader';
import DocumentsControlPanel from '../components/MyDocuments/DocumentsControlPanel';
import DocumentCard from '../components/MyDocuments/DocumentCard';
import DocumentListItem from '../components/MyDocuments/DocumentListItem';
import DocumentsEmptyState from '../components/MyDocuments/DocumentsEmptyState';
import DocumentDetailsDialog from '../components/MyDocuments/DocumentDetailsDialog';
import DeleteConfirmationDialog from '../components/MyDocuments/DeleteConfirmationDialog';
import { SortMenu, FilterMenu, DocumentContextMenu } from '../components/MyDocuments/SortFilterMenus';

// API & Types
import { Document, getAllDocuments, deleteDocument, downloadDocument } from '../services/documentService';
import { getFavoriteDocuments, toggleFavoriteDocument } from '../services/dashboardService';
import { 
  ViewMode, 
  SortBy, 
  SortDirection, 
  FilterProcessed, 
  ContextMenuState 
} from '../utils/myDocumentTypes';

// Helpers
import { isProcessed, getOriginalName } from '../utils/documentHelpers.tsx';

const MyDocumentsPage: React.FC = () => {
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterProcessed, setFilterProcessed] = useState<FilterProcessed>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [favoriteDocuments, setFavoriteDocuments] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string>('');
  const [documentNameToDelete, setDocumentNameToDelete] = useState<string>('');
  
  // State for context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // State for sort menu
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const sortMenuOpen = Boolean(sortAnchorEl);
  
  // State for filter menu
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const filterMenuOpen = Boolean(filterAnchorEl);
  
  const theme = useTheme();
  const navigate = useNavigate();

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
    loadFavorites(); // New function to load favorites from API
  }, []);

  const loadFavorites = async () => {
    try {
      const favoriteDocs = await getFavoriteDocuments();
      // Extract just the IDs from the documents
      setFavoriteDocuments(favoriteDocs.map(doc => doc.id));
    } catch (err) {
      console.error('Failed to load favorites:', err);
      setError('Failed to load favorite documents. Please try again.');
    }
  };
  

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const docs = await getAllDocuments();
      console.log('Documents from API:', docs);
      setDocuments(docs);
    } catch (err) {
      console.error(err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshDocuments = async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  };

  const handleDownload = async (doc: Document) => {
    try {
      console.log(doc);
      await downloadDocument(doc.id, doc.file_path, getOriginalName(doc.filename),doc.file_type);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download document. Please try again.');
    }
  };

  const showDeleteConfirmation = (docId: string) => {
    const documentToDelete = documents.find(doc => doc.id === docId);
    if (documentToDelete) {
      setDocumentToDelete(docId);
      setDocumentNameToDelete(getOriginalName(documentToDelete.filename));
      setDeleteDialogOpen(true);
    }
  };
  
  const handleDeleteConfirm = async () => {
    try {
      await deleteDocument(documentToDelete);
      // Update the documents list after successful deletion
      setDocuments(prevDocs => prevDocs.filter(d => d.id !== documentToDelete));
      // Remove from favorites if present
      if (favoriteDocuments.includes(documentToDelete)) {
        const newFavorites = favoriteDocuments.filter(id => id !== documentToDelete);
        setFavoriteDocuments(newFavorites);
        localStorage.setItem('favoriteDocuments', JSON.stringify(newFavorites));
      }
      // Show success message
      setSuccessMessage('Document successfully deleted');
      // Clear error if any
      setError(null);
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete document. Please try again.');
    } finally {
      setDeleteDialogOpen(false);
    }
  };
  
  const handleDelete = (docId: string) => {
    showDeleteConfirmation(docId);
  };

  const toggleFavorite = async (docId: string) => {
    setContextMenu(null);
    
    const isFavorite = favoriteDocuments.includes(docId);
    
    try {
      // Call the API to update favorite status
      const success = await toggleFavoriteDocument(docId, !isFavorite);
      
      if (success) {
        // Update local state to reflect the change
        const newFavorites = isFavorite
          ? favoriteDocuments.filter(id => id !== docId)
          : [...favoriteDocuments, docId];
        
        setFavoriteDocuments(newFavorites);
      }
    } catch (err) {
      console.error('Failed to update favorite status:', err);
      setError('Failed to update favorite status. Please try again.');
    }
  };

  // Handle context menu
  const handleContextMenu = (event: React.MouseEvent, documentId: string) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            documentId,
          }
        : null,
    );
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Open document details
  const openDetails = (doc: Document) => {
    setSelectedDocument(doc);
    setDetailsOpen(true);
  };

  // Close document details
  const closeDetails = () => {
    setDetailsOpen(false);
  };

  // Handle success message close
  const handleSuccessClose = () => {
    setSuccessMessage(null);
  };

  // Handle sort menu
  const handleSortClick = (event: React.MouseEvent<HTMLElement>) => {
    setSortAnchorEl(event.currentTarget);
  };

  const handleSortClose = () => {
    setSortAnchorEl(null);
  };

  const handleSort = (sort: SortBy) => {
    if (sortBy === sort) {
      // Toggle direction if same sort field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(sort);
      // Default to descending for date, ascending for name/size
      setSortDirection(sort === 'date' ? 'desc' : 'asc');
    }
    handleSortClose();
  };

  // Handle filter menu
  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleFilterChange = (filter: FilterProcessed) => {
    setFilterProcessed(filter);
    handleFilterClose();
  };

  // Handle view mode change
  const handleViewModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: ViewMode | null,
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Handle search query change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    return documents
      // Apply search filter
      .filter(doc => {
        const docName = getOriginalName(doc.filename).toLowerCase();
        return docName.includes(searchQuery.toLowerCase());
      })
      // Apply processed/processing filter
      .filter(doc => {
        if (filterProcessed === 'all') return true;
        const processed = isProcessed(doc);
        return filterProcessed === 'processed' ? processed : !processed;
      })
      // Sort documents
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'date':
            comparison = new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime();
            break;
          case 'name':
            comparison = getOriginalName(a.filename).localeCompare(getOriginalName(b.filename));
            break;
          case 'size':
            // Parse file sizes to numbers for comparison
            const sizeA = a.file_size ? parseInt(a.file_size) : 0;
            const sizeB = b.file_size ? parseInt(b.file_size) : 0;
            comparison = sizeA - sizeB;
            break;
        }
        
        // Apply sort direction
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [documents, searchQuery, sortBy, sortDirection, filterProcessed]);

  // Loading skeleton for grid view
  const renderGridSkeleton = () => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5 }}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <Box key={item} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%' }, p: 1.5 }}>
          <Skeleton variant="rounded" height={280} sx={{ borderRadius: '16px' }} />
        </Box>
      ))}
    </Box>
  );

  // Loading skeleton for list view
  const renderListSkeleton = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((item) => (
        <Skeleton key={item} variant="rounded" height={80} sx={{ borderRadius: '12px' }} />
      ))}
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ width: '100%', p: { xs: 1, sm: 2, md: 3 } }}>
        <DocumentsHeader />
        <Box sx={{ mb: 4 }}>
          <Skeleton variant="rounded" height={56} sx={{ borderRadius: '12px' }} />
        </Box>
        {viewMode === 'grid' ? renderGridSkeleton() : renderListSkeleton()}
      </Box>
    );
  }

  // Document operations props that get passed to document components
  const documentOperations = {
    onDownload: handleDownload,
    onDelete: handleDelete,
    onView: (docId: string) => navigate(`/documents/${docId}`),
    onDetails: openDetails,
    onToggleFavorite: toggleFavorite
  };

  return (
    <Box sx={{ width: '100%', p: { xs: 1, sm: 2, md: 3 } }}>
      <DocumentsHeader />

      {/* Error message */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3, 
            borderRadius: '12px',
            boxShadow: `0 4px 20px ${alpha(theme.palette.error.main, 0.15)}`
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Success message snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleSuccessClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={Fade}
      >
        <Alert 
          onClose={handleSuccessClose} 
          severity="success" 
          variant="filled"
          sx={{ 
            width: '100%',
            borderRadius: '8px',
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
          }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Document details dialog */}
      <DocumentDetailsDialog
        open={detailsOpen}
        document={selectedDocument}
        onClose={closeDetails}
        onDownload={handleDownload}
        onView={(docId) => navigate(`/documents/${docId}`)}
        onDelete={handleDelete}
      />
      
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        documentName={documentNameToDelete}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Control Panel */}
      <DocumentsControlPanel
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        filterProcessed={filterProcessed}
        onFilterClick={handleFilterClick}
        onSortClick={handleSortClick}
        refreshing={refreshing}
        onRefresh={refreshDocuments}
        onUpload={() => navigate('/upload')}
      />

      {/* Sort Menu */}
      <SortMenu
        anchorEl={sortAnchorEl}
        open={sortMenuOpen}
        onClose={handleSortClose}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
      />

      {/* Filter Menu */}
      <FilterMenu
        anchorEl={filterAnchorEl}
        open={filterMenuOpen}
        onClose={handleFilterClose}
        filterProcessed={filterProcessed}
        onFilterChange={handleFilterChange}
      />

      {/* Context Menu */}
      {contextMenu && (
        <DocumentContextMenu
          contextMenu={contextMenu}
          onClose={closeContextMenu}
          onDownload={() => {
            const doc = documents.find(d => d.id === contextMenu.documentId);
            if (doc) handleDownload(doc);
            closeContextMenu();
          }}
          onView={() => {
            navigate(`/documents/${contextMenu.documentId}`);
            closeContextMenu();
          }}
          onDetails={() => {
            const doc = documents.find(d => d.id === contextMenu.documentId);
            if (doc) openDetails(doc);
            closeContextMenu();
          }}
          onToggleFavorite={() => {
            toggleFavorite(contextMenu.documentId);
            closeContextMenu();
          }}
          onDelete={() => {
            closeContextMenu();
            handleDelete(contextMenu.documentId);
          }}
          isFavorite={favoriteDocuments.includes(contextMenu.documentId)}
        />
      )}

      {/* No documents state */}
      {filteredAndSortedDocuments.length === 0 ? (
        <DocumentsEmptyState 
          searchQuery={searchQuery} 
          onUpload={() => navigate('/upload')} 
        />
      ) : (
        <>
          {/* Display status pills if filtering */}
          {(searchQuery || filterProcessed !== 'all') && (
            <Box sx={{ 
              mb: 2,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1
            }}>
              {searchQuery && (
                <Chip
                  label={`Search: "${searchQuery}"`}
                  onDelete={() => setSearchQuery('')}
                  sx={{ 
                    borderRadius: '8px',
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      color: theme.palette.primary.main,
                    }
                  }}
                />
              )}
              
              {filterProcessed !== 'all' && (
                <Chip
                  label={`Status: ${filterProcessed === 'processed' ? 'Processed' : 'Processing'}`}
                  onDelete={() => setFilterProcessed('all')}
                  sx={{ 
                    borderRadius: '8px',
                    backgroundColor: alpha(
                      filterProcessed === 'processed' ? theme.palette.success.main : theme.palette.warning.main,
                      0.1
                    ),
                    color: filterProcessed === 'processed' ? theme.palette.success.main : theme.palette.warning.main,
                    fontWeight: 500,
                    '& .MuiChip-deleteIcon': {
                      color: filterProcessed === 'processed' ? theme.palette.success.main : theme.palette.warning.main,
                    }
                  }}
                />
              )}
              
              <Typography variant="body2" color="text.secondary" sx={{ 
                display: 'flex', 
                alignItems: 'center',
                ml: 1
              }}>
                Found {filteredAndSortedDocuments.length} document{filteredAndSortedDocuments.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
          
          {/* Documents List */}
          <AnimatePresence>
            {viewMode === 'grid' ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5 }}>
                {filteredAndSortedDocuments.map((doc) => (
                  <Box key={doc.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%' }, p: 1.5 }}>
                    <DocumentCard
                      document={doc}
                      isFavorite={favoriteDocuments.includes(doc.id)}
                      onContextMenu={(e) => handleContextMenu(e, doc.id)}
                      {...documentOperations}
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              // List View
              <Box>
                {filteredAndSortedDocuments.map((doc) => (
                  <DocumentListItem
                    key={doc.id}
                    document={doc}
                    isFavorite={favoriteDocuments.includes(doc.id)}
                    onContextMenu={(e) => handleContextMenu(e, doc.id)}
                    {...documentOperations}
                  />
                ))}
              </Box>
            )}
          </AnimatePresence>
        </>
      )}
    </Box>
  );
};

export default MyDocumentsPage;
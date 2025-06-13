import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  IconButton,
  Stack
} from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { getDocumentContent, getTableMarkdown } from '../../services/documentService';
import './DocumentContentViewer.css';
import MarkdownRenderer from './MarkdownRenderer';

interface DocumentContentViewerProps {
  documentId: string;
  selectedTab?: number;
  onTabChange?: (tab: number) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`content-tabpanel-${index}`}
      aria-labelledby={`content-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const DocumentContentViewer: React.FC<DocumentContentViewerProps> = ({
  documentId,
  selectedTab = 0,
  onTabChange
}) => {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(selectedTab);
  // Use page state for tables tab
  const [tablesPage, setTablesPage] = useState(1);
  const [tableMarkdowns, setTableMarkdowns] = useState<{[pageNumber: number]: string}>({});
  const theme = useTheme();

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch document content first
        const contentData = await getDocumentContent(documentId);
        setContent(contentData);
        
        // Then fetch table markdowns if any tables are present
        if (contentData && contentData.pages && 
            contentData.pages.some((page: any) => page.tables && page.tables.length > 0)) {
          try {
            const tableMarkdownData = await getTableMarkdown(documentId);
            if (tableMarkdownData && tableMarkdownData.pages) {
              setTableMarkdowns(tableMarkdownData.pages);
            }
          } catch (markdownErr) {
            console.error('Failed to load table markdown:', markdownErr);
            // Don't fail the entire component if markdown fails
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load document content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [documentId]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Reset page navigation state when changing tabs
    setTablesPage(1);
    if (onTabChange) {
      onTabChange(newValue);
    }
  };
  
  // Force re-render when page changes
  useEffect(() => {
    // This dependency array ensures we force a re-render when page values change
    console.log("Page changed", { tablesPage });
    // No additional code needed, this effect is just to trigger re-renders
  }, [tablesPage]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!content) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        No content available for this document.
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="document content tabs"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              minHeight: 48,
              px: 3
            }
          }}
        >
          <Tab label="Tables" />
          <Tab label="Preview" />
          <Tab label="Metadata" />
        </Tabs>
      </Box>

      {/* Preview Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ minHeight: '400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {content.file_path ? (
            <Box sx={{ width: '100%', height: '600px', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
              <iframe
                src={`/api/documents/${documentId}/download?filePath=${encodeURIComponent(content.file_path)}#toolbar=1`}
                width="100%"
                height="100%"
                style={{ 
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`
                }}
                title="Document Preview"
              />
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary">
              Document preview is not available.
            </Typography>
          )}
        </Box>
      </TabPanel>

      {/* Tables Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ minHeight: '400px' }}>
          {content.pages?.some((page: any) => page.tables && page.tables.length > 0) ? (
            (() => {
              // Get all pages with tables
              const pagesWithTables = content.pages
                .filter((page: any) => page.tables && page.tables.length > 0);
              
              // If no pages with tables, return early
              if (pagesWithTables.length === 0) {
                return (
                  <Typography variant="body1" color="text.secondary">
                    No tables found in this document.
                  </Typography>
                );
              }
              
              // Get the current page with tables (capped by available pages)
              const currentTablePage = Math.min(tablesPage, pagesWithTables.length);
              const page = pagesWithTables[currentTablePage - 1];
              
              return (
                <>
                  <Box sx={{ mb: 4 }} key={`table-page-${currentTablePage}-${tablesPage}`}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                      Page {page.page_number} Tables
                    </Typography>
                    {/* Render markdown content directly */}
                    <Box key={`table-markdown-${page.page_number}`} sx={{ mb: 4, overflowX: 'auto' }}>
                      <Box sx={{ 
                        p: 2, 
                        bgcolor: alpha(theme.palette.background.default, 0.6),
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        overflow: 'auto' // Allow scrolling for wide tables
                      }}>
                        {tableMarkdowns[page.page_number] ? (
                          <MarkdownRenderer markdown={tableMarkdowns[page.page_number]} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No markdown content available for this page's tables.
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                  
                  {/* Page navigation controls - only show if multiple pages with tables */}
                  {pagesWithTables.length > 1 && (
                    <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mt: 3 }}>
                      <IconButton 
                        onClick={() => {
                          setTablesPage((prev: number) => Math.max(1, prev - 1));
                        }}
                        disabled={tablesPage === 1}
                      >
                        <ArrowBackIosNewIcon />
                      </IconButton>
                      
                      <Typography variant="body1">
                        Page {tablesPage} of {pagesWithTables.length}
                      </Typography>
                      
                      <IconButton 
                        onClick={() => {
                          setTablesPage((prev: number) => Math.min(pagesWithTables.length, prev + 1));
                        }}
                        disabled={tablesPage === pagesWithTables.length}
                      >
                        <ArrowForwardIosIcon />
                      </IconButton>
                    </Stack>
                  )}
                </>
              );
            })()
          ) : (
            <Typography variant="body1" color="text.secondary">
              No tables found in this document.
            </Typography>
          )}
        </Box>
      </TabPanel>



      {/* Metadata Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ minHeight: '400px' }}>
          <Paper
            sx={{
              p: 3,
              bgcolor: alpha(theme.palette.background.default, 0.6),
              borderRadius: 2
            }}
          >
            <Typography variant="h6" sx={{ mb: 3, borderBottom: `1px solid ${theme.palette.divider}`, pb: 1 }}>
              Document Metadata
            </Typography>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2 }}>
              {content.title && (
                <>
                  <Typography variant="subtitle2" fontWeight={600}>Title</Typography>
                  <Typography variant="body1">{content.title}</Typography>
                </>
              )}
              
              {content.author && (
                <>
                  <Typography variant="subtitle2" fontWeight={600}>Author</Typography>
                  <Typography variant="body1">{content.author}</Typography>
                </>
              )}
              
              {content.document_type && (
                <>
                  <Typography variant="subtitle2" fontWeight={600}>Document Type</Typography>
                  <Typography variant="body1">{content.document_type}</Typography>
                </>
              )}
              
              {content.pages && (
                <>
                  <Typography variant="subtitle2" fontWeight={600}>Pages</Typography>
                  <Typography variant="body1">{content.pages.length}</Typography>
                </>
              )}
              
              {content.pages && content.pages.some((p: any) => p.isScanned) && (
                <>
                  <Typography variant="subtitle2" fontWeight={600}>Contains Scanned Pages</Typography>
                  <Typography variant="body1">Yes</Typography>
                </>
              )}
            </Box>
            
            {content.bookmarks && content.bookmarks.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, borderBottom: `1px solid ${theme.palette.divider}`, pb: 1 }}>
                  Bookmarks
                </Typography>
                {content.bookmarks.map((bookmark: any, idx: number) => (
                  <Box key={idx} sx={{ mb: 1, pl: bookmark.level * 2 }}>
                    <Typography variant="body2">
                      {bookmark.title} (Page {bookmark.page})
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Box>
      </TabPanel>
    </Paper>
  );
};

export default DocumentContentViewer;
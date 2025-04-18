import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  IconButton, 
  TextField, 
  Chip, 
  Tabs,
  Tab,
  List,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Avatar,
  Divider,
  Paper,
  useTheme,
  alpha,
  Drawer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Checkbox,
  ListItem as MuiListItem,
  Stack,
} from '@mui/material';
import { motion } from 'framer-motion';

// Icons
import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import TableChartIcon from '@mui/icons-material/TableChart';
import MapIcon from '@mui/icons-material/Map';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TableRowsIcon from '@mui/icons-material/TableRows';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import LayersIcon from '@mui/icons-material/Layers';
import DatabaseIcon from '@mui/icons-material/Storage';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import FileIcon from '@mui/icons-material/InsertDriveFile';
import GridViewIcon from '@mui/icons-material/GridView';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: 'spring', stiffness: 100 }
  }
};

// Types for documents and tables
interface TableData {
  id: string;
  name: string;
  rows: number;
  columns: number;
}

interface DocumentData {
  id: string;
  name: string;
  type: string;
  lastModified: string;
  tables: TableData[];
}

// Sample row data type
interface TableRowData {
  date: string;
  region: string;
  product: string;
  quantity: number;
  revenue: string;
}

// Preview table data type
interface PreviewTableData extends TableData {
  documentName: string;
  documentId: string;
  data?: TableRowData[];
}

// Template type
interface VisTemplate {
  id: number;
  name: string;
  icon: React.ReactNode;
  color: string;
}

// Saved visualization type
interface SavedVisualization {
  id: number;
  name: string;
  type: string;
  document: string;
  table: string;
  created: string;
}

// Sample document data with tables
const documents: DocumentData[] = [
  { 
    id: '1', 
    name: 'Q1 Financial Report.pdf', 
    type: 'pdf', 
    lastModified: '2023-03-15',
    tables: [
      { id: '1-1', name: 'Quarterly Revenue', rows: 15, columns: 5 },
      { id: '1-2', name: 'Expenses by Department', rows: 12, columns: 4 },
      { id: '1-3', name: 'Profit Margins', rows: 8, columns: 3 }
    ]
  },
  { 
    id: '2', 
    name: 'Sales Data 2023.xlsx', 
    type: 'excel', 
    lastModified: '2023-04-05',
    tables: [
      { id: '2-1', name: 'Monthly Sales', rows: 24, columns: 8 },
      { id: '2-2', name: 'Regional Performance', rows: 10, columns: 6 },
      { id: '2-3', name: 'Product Categories', rows: 18, columns: 4 }
    ]
  },
  { 
    id: '3', 
    name: 'Customer Survey Results.csv', 
    type: 'csv', 
    lastModified: '2023-02-20',
    tables: [
      { id: '3-1', name: 'Survey Responses', rows: 250, columns: 12 },
      { id: '3-2', name: 'Demographic Data', rows: 250, columns: 8 }
    ]
  },
  
];

// Sample visualization templates
const vizTemplates: VisTemplate[] = [
  { id: 1, name: 'Bar Chart', icon: <BarChartIcon />, color: '#4caf50' },
  { id: 2, name: 'Line Chart', icon: <TimelineIcon />, color: '#2196f3' },
  { id: 3, name: 'Pie Chart', icon: <PieChartIcon />, color: '#ff9800' },
  { id: 4, name: 'Table', icon: <TableChartIcon />, color: '#9c27b0' },
  { id: 5, name: 'Scatter Plot', icon: <ScatterPlotIcon />, color: '#e91e63' },
  { id: 6, name: 'Map', icon: <MapIcon />, color: '#607d8b' }
];

// Sample saved visualizations
const savedVisualizations: SavedVisualization[] = [
  { id: 1, name: 'Q1 Sales by Region', type: 'Bar Chart', document: 'Sales Data 2023.xlsx', table: 'Regional Performance', created: '2023-04-10' },
  { id: 2, name: 'Customer Satisfaction Trends', type: 'Line Chart', document: 'Customer Survey Results.csv', table: 'Survey Responses', created: '2023-03-05' },
  { id: 3, name: 'Revenue by Product Category', type: 'Pie Chart', document: 'Q1 Financial Report.pdf', table: 'Quarterly Revenue', created: '2023-03-22' }
];

// Chart preview component
const ChartPreview: React.FC<{ type: string; color: string }> = ({ type, color }) => {
  const theme = useTheme();
  
  const icon = useMemo(() => {
    switch(type) {
      case 'Bar Chart': return <BarChartIcon fontSize="inherit" />;
      case 'Line Chart': return <TimelineIcon fontSize="inherit" />;
      case 'Pie Chart': return <PieChartIcon fontSize="inherit" />;
      case 'Table': return <TableChartIcon fontSize="inherit" />;
      case 'Scatter Plot': return <ScatterPlotIcon fontSize="inherit" />;
      case 'Map': return <MapIcon fontSize="inherit" />;
      default: return <InsertChartIcon fontSize="inherit" />;
    }
  }, [type]);
  
  return (
    <Box 
      sx={{ 
        height: 180, 
        backgroundColor: alpha(color, 0.1),
        borderRadius: theme.shape.borderRadius * 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px dashed ${alpha(color, 0.5)}`
      }}
    >
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ fontSize: '3rem', color: color, mb: 1 }}>
          {icon}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {type} Preview
        </Typography>
      </Box>
    </Box>
  );
};

// New component for displaying selected tables in a collapsible, scrollable format
const SelectedTablesGrid: React.FC<{ 
  selectedTables: string[]; 
  getTableDetails: (tableId: string) => PreviewTableData | null;
  toggleTableSelection: (tableId: string) => void;
  openTablePreview: (tableId: string, docId: string) => void;
}> = ({ selectedTables, getTableDetails, toggleTableSelection, openTablePreview }) => {
  const theme = useTheme();
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  
  // Group tables by document
  const tablesByDocument: Record<string, Array<PreviewTableData>> = {};
  selectedTables.forEach(tableId => {
    const table = getTableDetails(tableId);
    if (table) {
      if (!tablesByDocument[table.documentId]) {
        tablesByDocument[table.documentId] = [];
      }
      tablesByDocument[table.documentId].push(table);
    }
  });

  // Toggle document expansion
  const toggleDocExpansion = (docId: string) => {
    setExpandedDocs(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };
  
  if (selectedTables.length === 0) {
    return null;
  }
  
  return (
    <Box sx={{ mb: 3 }}>
      {/* Fixed header section */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <LayersIcon sx={{ color: theme.palette.primary.main, mr: 1, fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ mr: 'auto' }}>
          Selected Tables ({selectedTables.length})
        </Typography>
        <Button 
          size="small" 
          onClick={() => selectedTables.forEach(id => toggleTableSelection(id))}
          sx={{ textTransform: 'none' }}
          color="primary"
        >
          Clear All
        </Button>
      </Box>
      
      {/* Scrollable content section */}
      <Box 
        sx={{ 
          maxHeight: '300px', 
          overflowY: 'auto',
          position: 'relative',
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.primary.main, 0.2),
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
            }
          },
          // Add subtle shadow indicators for scroll
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '20px',
            background: `linear-gradient(to top, ${theme.palette.background.paper}, transparent)`,
            pointerEvents: 'none',
            opacity: 0.7,
            zIndex: 1,
            display: 'block',
          }
        }}
      >
        {Object.entries(tablesByDocument).map(([docId, tables]) => {
          // Find document details
          const document = documents.find(doc => doc.id === docId);
          if (!document) return null;
          
          const isExpanded = !!expandedDocs[docId];
          
          return (
            <Paper 
              key={docId}
              elevation={0}
              sx={{ 
                mb: 2, 
                border: `1px solid ${theme.palette.divider}`,
                overflow: 'hidden'
              }}
            >
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  px: 2, 
                  py: 1.5,
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                  borderBottom: isExpanded ? `1px solid ${theme.palette.divider}` : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => toggleDocExpansion(docId)}
              >
                <Avatar 
                  variant="rounded"
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    mr: 1.5,
                    backgroundColor: document.type === 'excel' ? alpha('#4caf50', 0.1) : 
                                  document.type === 'csv' ? alpha('#2196f3', 0.1) : 
                                  alpha('#f44336', 0.1),
                    color: document.type === 'excel' ? '#4caf50' : 
                          document.type === 'csv' ? '#2196f3' : 
                          '#f44336'
                  }}
                >
                  {document.type === 'excel' && <InsertDriveFileIcon fontSize="small" />}
                  {document.type === 'csv' && <TableRowsIcon fontSize="small" />}
                  {document.type === 'pdf' && <DescriptionIcon fontSize="small" />}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={500}>
                    {document.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tables.length} table{tables.length !== 1 ? 's' : ''} selected
                  </Typography>
                </Box>
                {isExpanded ? 
                  <ExpandLessIcon fontSize="small" color="action" /> : 
                  <ExpandMoreIcon fontSize="small" color="action" />
                }
              </Box>
              
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1.5 }}>
                  {tables.map(table => (
                    <Box 
                      key={table.id} 
                      sx={{ 
                        width: { xs: '100%', sm: 'calc(50% - 4px)' },
                        flexGrow: 0,
                        flexShrink: 0
                      }}
                    >
                      <Card 
                        variant="outlined"
                        sx={{ 
                          p: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: theme.palette.background.paper,
                          transition: 'all 0.2s',
                          '&:hover': {
                            borderColor: theme.palette.primary.main,
                            boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                          <GridViewIcon 
                            sx={{ 
                              mr: 1.5, 
                              color: theme.palette.primary.main,
                              fontSize: 20
                            }} 
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography 
                              variant="body2" 
                              fontWeight={500} 
                              sx={{ 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis' 
                              }}
                            >
                              {table.name}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {table.rows} rows × {table.columns} columns
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', ml: 1 }}>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent document collapsing when clicking this button
                              openTablePreview(table.id, docId);
                            }}
                            sx={{ mr: 0.5 }}
                          >
                            <VisibilityIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent document collapsing when clicking this button
                              toggleTableSelection(table.id);
                            }}
                          >
                            <CloseIcon fontSize="small" sx={{ color: theme.palette.grey[500] }} />
                          </IconButton>
                        </Box>
                      </Card>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

// Visualization Page Component
const VisualizationPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState<string>('');
  const [expandedDocuments, setExpandedDocuments] = useState<Record<string, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewTable, setPreviewTable] = useState<PreviewTableData | null>(null);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  
  // Used for demo purposes - in a real app, this would come from API
  const hasDocuments = documents.length > 0;
  
  // Toggle document expansion to show tables
  const toggleDocumentExpansion = (docId: string): void => {
    setExpandedDocuments(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };
  
  // Handle table selection
  const toggleTableSelection = (tableId: string): void => {
    setSelectedTables(prev => 
      prev.includes(tableId)
        ? prev.filter(id => id !== tableId)
        : [...prev, tableId]
    );
  };

  // Toggle fullscreen mode
  const toggleFullScreen = (): void => {
    setIsFullScreen(prev => !prev);
  };
  
  // Get document icon based on type
  const getDocumentIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'excel':
        return <InsertDriveFileIcon sx={{ color: theme.palette.success.light }} />;
      case 'csv':
        return <TableRowsIcon sx={{ color: theme.palette.success.light }} />;
      case 'pdf':
        return <DescriptionIcon sx={{ color: theme.palette.error.light }} />;
      default:
        return <InsertDriveFileIcon />;
    }
  };
  
  // Find table details from tableId
  const getTableDetails = (tableId: string): (PreviewTableData | null) => {
    for (const doc of documents) {
      const table = doc.tables.find(t => t.id === tableId);
      if (table) {
        return { 
          ...table, 
          documentName: doc.name, 
          documentId: doc.id 
        };
      }
    }
    return null;
  };
  
  // Open table preview drawer
  const openTablePreview = (tableId: string, docId: string): void => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return; // Early return if doc is undefined
    const table = doc.tables.find(t => t.id === tableId);
    
    if (table) {
      setPreviewTable({
        ...table,
        documentName: doc.name,
        documentId: doc.id,
        // Sample data for preview
        data: [
          { date: 'Jan 2023', region: 'North', product: 'Widget A', quantity: 45, revenue: '$4,500' },
          { date: 'Jan 2023', region: 'South', product: 'Widget B', quantity: 62, revenue: '$6,820' },
          { date: 'Jan 2023', region: 'East', product: 'Widget A', quantity: 28, revenue: '$2,800' },
          { date: 'Feb 2023', region: 'North', product: 'Widget A', quantity: 52, revenue: '$5,200' },
          { date: 'Feb 2023', region: 'South', product: 'Widget B', quantity: 70, revenue: '$7,700' }
        ]
      });
      setPreviewOpen(true);
    }
  };
  
  // Close table preview drawer
  const closeTablePreview = (): void => {
    setPreviewOpen(false);
  };
  
  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue);
  };
  
  // Change view mode
  const handleViewModeChange = (mode: 'grid' | 'list'): void => {
    setViewMode(mode);
  };

  // Table Comparison Tools Component - moved from bottom to be included in the Natural Language Tab
  const TableComparisonTools = () => {
    if (selectedTables.length <= 1) return null;
    
    return (
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Table Comparison Tools
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          These tools help you analyze and visualize data across multiple tables.
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
          <Box sx={{ width: { xs: '100%', sm: '33.333%' }, p: 1 }}>
            <Card 
              sx={{ 
                borderRadius: '12px',
                border: `1px solid ${theme.palette.divider}`,
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <CardContent>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1.5,
                    color: theme.palette.primary.main
                  }}
                >
                  <BarChartIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Side-by-Side Comparison
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph sx={{ minHeight: 60 }}>
                  Compare similar data from different tables with bar or column charts.
                </Typography>
                <Button 
                  color="primary"
                  sx={{ 
                    textTransform: 'none',
                    fontWeight: 500
                  }}
                >
                  Create Comparison
                </Button>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ width: { xs: '100%', sm: '33.333%' }, p: 1 }}>
            <Card 
              sx={{ 
                borderRadius: '12px',
                border: `1px solid ${theme.palette.divider}`,
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <CardContent>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1.5,
                    color: theme.palette.primary.main
                  }}
                >
                  <TimelineIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Trend Analysis
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph sx={{ minHeight: 60 }}>
                  Analyze trends and patterns across multiple data sources.
                </Typography>
                <Button 
                  color="primary"
                  sx={{ 
                    textTransform: 'none',
                    fontWeight: 500
                  }}
                >
                  Analyze Trends
                </Button>
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ width: { xs: '100%', sm: '33.333%' }, p: 1 }}>
            <Card 
              sx={{ 
                borderRadius: '12px',
                border: `1px solid ${theme.palette.divider}`,
                transition: 'all 0.3s',
                height: '100%',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <CardContent>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 1.5,
                    color: theme.palette.primary.main
                  }}
                >
                  <DatabaseIcon fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Merged Dataset
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph sx={{ minHeight: 60 }}>
                  Create a single dataset by merging tables with common fields.
                </Typography>
                <Button 
                  color="primary"
                  sx={{ 
                    textTransform: 'none',
                    fontWeight: 500
                  }}
                >
                  Merge Data
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%',  // Changed from 100vh
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden' // Maintain overflow hidden
      // Removed position: fixed and top, left, right, bottom properties
    }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ 
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden' // Ensure no scrolling at this level
        }}
      >
        {/* Header section - hidden in fullscreen mode */}
        {!isFullScreen && (
          <Paper 
            elevation={0}
            component={motion.div}
            variants={itemVariants}
            sx={{ 
              p: 3, 
              mb: 4, 
              borderRadius: '16px',
              background: theme.palette.mode === 'light'
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)`
                : `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.4)} 0%, ${alpha(theme.palette.secondary.dark, 0.2)} 100%)`,
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.03), 0 2px 8px ${alpha(theme.palette.primary.main, 0.08)}`,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h4" component="h1" gutterBottom sx={{ 
                  fontWeight: 700,
                  color: theme.palette.text.primary
                }}>
                  Data Visualizations
                </Typography>
                <Typography variant="body1" sx={{ 
                  maxWidth: '800px', 
                  mb: 2,
                  color: theme.palette.text.secondary
                }}>
                  Create visualizations from tables in your documents. Select specific tables for comparison and analysis.
                </Typography>
              </Box>
            </Box>
          </Paper>
        )}
        
        {/* Main content - takes remaining height */}
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          flexGrow: 1,
          height: isFullScreen ? '100%' : 'auto', // Changed from fixed height
          overflow: 'hidden', // Prevent scrolling at the container level
          position: 'relative' // Ensure proper stacking context
        }}>
          {/* Left panel - Table selection (hidden in fullscreen mode) */}
          {!isFullScreen && (
            <Card 
              component={motion.div}
              variants={itemVariants}
              sx={{ 
                flex: '0 0 300px', 
                borderRadius: '16px',
                height: '560px', // Fixed height for the left panel
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <CardContent sx={{ 
                p: 0, 
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                '&.MuiCardContent-root': { // Override MUI's default padding
                  padding: 0
                }
              }}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Select Data Tables
                  </Typography>
                  
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search documents or tables"
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
                    }}
                    sx={{ mb: 2 }}
                  />
                </Box>
                
                <Divider />
                
                {hasDocuments ? (
                  <List 
                    sx={{ 
                      width: '100%', 
                      flexGrow: 1,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      p: 0,
                      maxHeight: 'calc(100% - 98px)', // Height minus the header section with search bar
                      '&::-webkit-scrollbar': {
                        width: '6px'
                      },
                      '&::-webkit-scrollbar-track': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                        borderRadius: '4px'
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.2),
                        borderRadius: '4px',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.3)
                        }
                      }
                    }}
                  >
                    {documents.map((doc) => (
                      <React.Fragment key={doc.id}>
                        <MuiListItem
                          onClick={() => toggleDocumentExpansion(doc.id)}
                          sx={{ px: 2, py: 1.5 }}
                        >
                          <ListItemAvatar sx={{ minWidth: 40 }}>
                            <Avatar 
                              variant="rounded" 
                              sx={{ 
                                bgcolor: 'transparent',
                                width: 32,
                                height: 32
                              }}
                            >
                              {getDocumentIcon(doc.type)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText 
                            primary={doc.name}
                            secondary={`${doc.tables.length} tables • Modified: ${doc.lastModified}`}
                            primaryTypographyProps={{ 
                              variant: 'body2', 
                              fontWeight: 500,
                              sx: { mb: 0 }
                            }}
                            secondaryTypographyProps={{ 
                              variant: 'caption',
                              sx: { mt: 0 }
                            }}
                          />
                          {expandedDocuments[doc.id] ? 
                            <ExpandLessIcon color="action" /> : 
                            <ExpandMoreIcon color="action" />
                          }
                        </MuiListItem>
                        
                        <Collapse in={expandedDocuments[doc.id]} timeout="auto" unmountOnExit>
                          <List 
                            component="div" 
                            disablePadding
                            sx={{ 
                              bgcolor: theme.palette.mode === 'light' ? 
                                alpha(theme.palette.primary.main, 0.03) : 
                                alpha(theme.palette.primary.dark, 0.1),
                              py: 1
                            }}
                          >
                            {doc.tables.map(table => (
                              <MuiListItem 
                                key={table.id}
                                sx={{ 
                                  pl: 6, 
                                  pr: 2,
                                  py: 0.5
                                }}
                                secondaryAction={
                                  <IconButton 
                                    edge="end" 
                                    size="small" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTablePreview(table.id, doc.id);
                                    }}
                                    sx={{ 
                                      color: theme.palette.primary.main,
                                      '&:hover': {
                                        bgcolor: alpha(theme.palette.primary.main, 0.1)
                                      }
                                    }}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                }
                              >
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                  <Checkbox
                                    edge="start"
                                    checked={selectedTables.includes(table.id)}
                                    tabIndex={-1}
                                    disableRipple
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTableSelection(table.id);
                                    }}
                                    sx={{ 
                                      color: theme.palette.primary.main,
                                      '&.Mui-checked': {
                                        color: theme.palette.primary.main,
                                      },
                                    }}
                                  />
                                </ListItemIcon>
                                <ListItemText
                                  primary={table.name}
                                  secondary={`${table.rows} rows × ${table.columns} columns`}
                                  primaryTypographyProps={{ 
                                    variant: 'body2',
                                    fontWeight: 500,
                                    sx: { mb: 0 }
                                  }}
                                  secondaryTypographyProps={{ 
                                    variant: 'caption',
                                    sx: { mt: 0 }
                                  }}
                                  sx={{ m: 0 }}
                                />
                              </MuiListItem>
                            ))}
                          </List>
                        </Collapse>
                        <Divider />
                      </React.Fragment>
                    ))}
                  </List>
                ) : (
                  // Empty state when no documents are available
                  <Box sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    p: 3,
                    flexGrow: 1
                  }}>
                    <CreateNewFolderIcon sx={{ 
                      fontSize: 60, 
                      color: alpha(theme.palette.primary.main, 0.3),
                      mb: 2 
                    }} />
                    <Typography variant="h6" gutterBottom>
                      No Documents Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Upload documents to extract tables and create visualizations.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      component="a"
                      href="/upload"
                      sx={{ borderRadius: theme.shape.borderRadius }}
                    >
                      Upload Documents
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Right panel - Main content */}
          <Box sx={{ 
            flex: 1,
            position: 'relative',
            width: isFullScreen ? '100%' : 'auto',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto', // Changed to auto to allow scrolling in this container
            maxHeight: '100%' // Ensure it doesn't exceed container height
          }}>
            
            {selectedTables.length === 0 ? (
              <Card
                component={motion.div}
                variants={itemVariants}
                sx={{ 
                  textAlign: 'center', 
                  p: 4, 
                  borderRadius: '16px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'auto'
                }}
              >
                <DatabaseIcon sx={{ fontSize: 64, color: theme.palette.grey[300], mb: 2 }} />
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Select tables to visualize
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mb: 3 }}>
                  Choose one or more tables from your documents to create visualizations, 
                  compare data, or generate insights.
                </Typography>
                <Button 
                  color="primary"
                  startIcon={<ArrowRightIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  Select tables from the sidebar
                </Button>
              </Card>
            ) : (
              <>
                {/* Visualization Tabs with Fullscreen Toggle */}
                <Card 
                  component={motion.div}
                  variants={itemVariants}
                  sx={{ 
                    borderRadius: '16px',
                    mb: 3,
                    overflow: 'hidden',
                    position: 'relative',
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Fullscreen toggle button - Only visible when tables are selected */}
                  <IconButton 
                    sx={{ 
                      position: 'absolute', 
                      top: 10, 
                      left: 10, // Changed from right to left
                      zIndex: 10,
                      bgcolor: alpha(theme.palette.background.paper, 0.8),
                      boxShadow: 1,
                      '&:hover': {
                        bgcolor: theme.palette.background.paper,
                      }
                    }}
                    onClick={toggleFullScreen}
                    size="small"
                  >
                    {isFullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                
                  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                      value={tabValue}
                      onChange={handleTabChange}
                      variant="fullWidth"
                      sx={{
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 500,
                          minHeight: 56
                        }
                      }}
                    >
                      <Tab 
                        icon={<SmartToyIcon />} 
                        iconPosition="start" 
                        label="Generate Visualization" 
                      />
                      <Tab 
                        icon={<InsertChartIcon />} 
                        iconPosition="start" 
                        label="Templates" 
                      />
                      <Tab 
                        icon={<BookmarkIcon />} 
                        iconPosition="start" 
                        label="Saved Visualizations" 
                      />
                    </Tabs>
                  </Box>
                  
                  {/* Natural Language Tab */}
                  {tabValue === 0 && (
                    <CardContent sx={{ 
                      p: 3, 
                      flexGrow: 1,
                      overflow: 'auto', // Allow content to scroll
                      height: '100%', // Full height
                      display: 'flex',
                      flexDirection: 'column',
                      '&.MuiCardContent-root': { 
                        padding: '24px' // Consistent padding
                      }
                    }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Generate Visualizations with Natural Language
                      </Typography>
                      
                      {/* Improved Selected Tables Display */}
                      <SelectedTablesGrid 
                        selectedTables={selectedTables}
                        getTableDetails={getTableDetails}
                        toggleTableSelection={toggleTableSelection}
                        openTablePreview={openTablePreview}
                      />
                      
                      {/* Table Comparison Tools - Moved here */}
                      <TableComparisonTools />
                      
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Describe the visualization you want to create from your selected tables.
                      </Typography>
                      
                      <Box sx={{ position: 'relative', mb: 3 }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          placeholder="Try: 'Compare monthly sales across regions using a bar chart' or 'Show me a trend line of customer satisfaction ratings'"
                          value={naturalLanguageQuery}
                          onChange={(e) => setNaturalLanguageQuery(e.target.value)}
                          sx={{ 
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '12px',
                              pr: 15
                            }
                          }}
                        />
                        <Button
                          variant="contained"
                          disabled={!naturalLanguageQuery}
                          sx={{ 
                            position: 'absolute', 
                            bottom: 8, 
                            right: 8,
                            borderRadius: theme.shape.borderRadius,
                          }}
                        >
                          Generate
                        </Button>
                      </Box>
                      
                      <Typography variant="subtitle2" gutterBottom>
                        Suggested Queries:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <Chip 
                          label="Compare data from all selected tables"
                          variant="outlined"
                          onClick={() => setNaturalLanguageQuery("Compare data from all selected tables")}
                          sx={{ borderRadius: theme.shape.borderRadius }}
                        />
                        <Chip 
                          label="Show trends over time"
                          variant="outlined"
                          onClick={() => setNaturalLanguageQuery("Show trends over time")}
                          sx={{ borderRadius: theme.shape.borderRadius }}
                        />
                        <Chip 
                          label="Create a dashboard with multiple charts"
                          variant="outlined"
                          onClick={() => setNaturalLanguageQuery("Create a dashboard with multiple charts")}
                          sx={{ borderRadius: theme.shape.borderRadius }}
                        />
                      </Box>
                      
                      {/* Result preview area - would show when a result is generated */}
                      {naturalLanguageQuery && (
                        <Box sx={{ mt: 4, p: 3, borderRadius: '12px', border: `1px dashed ${theme.palette.divider}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <AutoGraphIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                            <Typography variant="subtitle2">
                              Generated Visualization Preview
                            </Typography>
                          </Box>
                          <Box sx={{ 
                            height: 300, 
                            bgcolor: alpha(theme.palette.primary.main, 0.05), 
                            borderRadius: '12px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            <Typography color="text.secondary">
                              Visualization will appear here after generation
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  )}
                  
                  {/* Templates Tab */}
                  {tabValue === 1 && (
                    <CardContent sx={{ 
                      p: 3,
                      flexGrow: 1,
                      overflow: 'auto',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      '&.MuiCardContent-root': { 
                        padding: '24px' // Consistent padding
                      }
                    }}>
                      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                        Visualization Templates
                      </Typography>
                      
                      {/* Improved Selected Tables Display */}
                      <SelectedTablesGrid 
                        selectedTables={selectedTables}
                        getTableDetails={getTableDetails}
                        toggleTableSelection={toggleTableSelection}
                        openTablePreview={openTablePreview}
                      />
                      
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Select a visualization template to apply to your selected data tables.
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
                        {vizTemplates.map((template) => (
                          <Box key={template.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%' }, p: 1 }}>
                            <Card 
                              sx={{ 
                                cursor: 'pointer',
                                borderRadius: '12px',
                                transition: 'all 0.3s',
                                border: `1px solid ${alpha(template.color, 0.2)}`,
                                '&:hover': {
                                  transform: 'translateY(-4px)',
                                  boxShadow: `0 8px 16px ${alpha(template.color, 0.2)}`
                                }
                              }}
                            >
                              <CardContent>
                                <Box 
                                  sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    mb: 1.5,
                                    color: template.color
                                  }}
                                >
                                  <Box sx={{ mr: 1 }}>
                                    {template.icon}
                                  </Box>
                                  <Typography variant="subtitle2" fontWeight={600}>
                                    {template.name}
                                  </Typography>
                                </Box>
                                <Box 
                                  sx={{ 
                                    height: 100, 
                                    backgroundColor: alpha(template.color, 0.1),
                                    borderRadius: theme.shape.borderRadius,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 1.5
                                  }}
                                >
                                  <Box sx={{ fontSize: '2rem', color: template.color }}>
                                    {template.icon}
                                  </Box>
                                </Box>
                                <Button 
                                  fullWidth 
                                  variant="outlined" 
                                  size="small"
                                  sx={{ 
                                    borderRadius: theme.shape.borderRadius, 
                                    textTransform: 'none',
                                    borderColor: template.color,
                                    color: template.color,
                                    '&:hover': {
                                      borderColor: template.color,
                                      backgroundColor: alpha(template.color, 0.1)
                                    }
                                  }}
                                >
                                  Use Template
                                </Button>
                              </CardContent>
                            </Card>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  )}
                  
                  {/* Saved Visualizations Tab */}
                  {tabValue === 2 && (
                    <CardContent sx={{ 
                      p: 3,
                      flexGrow: 1,
                      overflow: 'auto'
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Your Saved Visualizations
                        </Typography>
                        <Box sx={{ 
                          display: 'flex', 
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: theme.shape.borderRadius,
                          overflow: 'hidden'
                        }}>
                          <IconButton 
                            size="small"
                            onClick={() => handleViewModeChange('list')}
                            color={viewMode === 'list' ? 'primary' : 'default'}
                          >
                            <ViewListIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small"
                            onClick={() => handleViewModeChange('grid')}
                            color={viewMode === 'grid' ? 'primary' : 'default'}
                          >
                            <ViewModuleIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      {/* Improved Selected Tables Display */}
                      <SelectedTablesGrid 
                        selectedTables={selectedTables}
                        getTableDetails={getTableDetails}
                        toggleTableSelection={toggleTableSelection}
                        openTablePreview={openTablePreview}
                      />
                    
                      {viewMode === 'list' ? (
                        <List sx={{ width: '100%' }}>
                          {savedVisualizations.map((viz) => (
                            <MuiListItem
                              key={viz.id}
                              secondaryAction={
                                <Box>
                                  <IconButton size="small">
                                    <ShareIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small">
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small">
                                    <MoreVertIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              }
                              sx={{ 
                                mb: 1, 
                                border: `1px solid ${theme.palette.divider}`, 
                                borderRadius: '12px',
                                '&:hover': {
                                  borderColor: theme.palette.primary.light,
                                  boxShadow: 1
                                },
                                transition: 'all 0.3s'
                              }}
                            >
                              <ListItemIcon>
                                {viz.type === 'Bar Chart' && <BarChartIcon color="primary" />}
                                {viz.type === 'Line Chart' && <TimelineIcon color="info" />}
                                {viz.type === 'Pie Chart' && <PieChartIcon color="warning" />}
                              </ListItemIcon>
                              <ListItemText
                                primary={viz.name}
                                secondary={`Table: ${viz.table} • Source: ${viz.document}`}
                              />
                            </MuiListItem>
                          ))}
                        </List>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1.5 }}>
                          {savedVisualizations.map((viz) => (
                            <Box key={viz.id} sx={{ width: { xs: '100%', sm: '50%', md: '33.333%' }, p: 1.5 }}>
                              <Card 
                                sx={{ 
                                  height: '100%',
                                  borderRadius: '12px',
                                  transition: 'all 0.3s',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    boxShadow: 3
                                  }
                                }}
                              >
                                <CardContent sx={{ p: 2 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="subtitle2" fontWeight={600}>
                                      {viz.name}
                                    </Typography>
                                    <IconButton size="small">
                                      <MoreVertIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                  
                                  <ChartPreview 
                                    type={viz.type} 
                                    color={
                                      viz.type === 'Bar Chart' ? '#4caf50' :
                                      viz.type === 'Line Chart' ? '#2196f3' :
                                      viz.type === 'Pie Chart' ? '#ff9800' : 
                                      '#757575'
                                    } 
                                  />
                                  
                                  <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      Table: {viz.table}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                      Source: {viz.document}
                                    </Typography>
                                  </Box>
                                  
                                  <Box sx={{ display: 'flex', mt: 2, gap: 1 }}>
                                    <Button 
                                      size="small" 
                                      variant="outlined"
                                      startIcon={<EditIcon />}
                                      sx={{ flex: 1, borderRadius: theme.shape.borderRadius, textTransform: 'none' }}
                                    >
                                      Use with Selected
                                    </Button>
                                    <IconButton size="small" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius }}>
                                      <ShareIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </CardContent>
                              </Card>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  )}
                </Card>
              </>
            )}
          </Box>
        </Box>
      </motion.div>
      
      {/* Table Preview Drawer */}
      <Drawer
        anchor="right"
        open={previewOpen}
        onClose={closeTablePreview}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '95%', sm: 450 },
            boxSizing: 'border-box',
            borderRadius: { xs: '16px 0 0 16px', sm: '16px 0 0 16px' },
            boxShadow: theme.shadows[8],
            border: `1px solid ${theme.palette.divider}`,
            marginTop: '64px',
            height: 'calc(100% - 64px)',
          },
        }}
      >
        {previewTable && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ 
              p: 2, 
              borderBottom: `1px solid ${theme.palette.divider}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {previewTable.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {previewTable.documentName} • {previewTable.rows} rows × {previewTable.columns} columns
                </Typography>
              </Box>
              <IconButton onClick={closeTablePreview}>
                <CloseIcon />
              </IconButton>
            </Box>
            
            <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  size="small"
                  variant={selectedTables.includes(previewTable.id) ? "contained" : "outlined"}
                  onClick={() => toggleTableSelection(previewTable.id)}
                  startIcon={selectedTables.includes(previewTable.id) ? <CheckBoxIcon fontSize="small" /> : null}
                  sx={{ 
                    borderRadius: theme.shape.borderRadius,
                    textTransform: 'none'
                  }}
                >
                  {selectedTables.includes(previewTable.id) 
                    ? "Selected for visualization" 
                    : "Select for visualization"}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  Showing first 5 of {previewTable.rows} rows
                </Typography>
              </Box>
              
              {/* Modified table container with perfect rectangle */}
              <TableContainer 
                component={Paper} 
                elevation={0} 
                sx={{ 
                  border: `1px solid ${theme.palette.divider}`, 
                  borderRadius: 0 // Changed to perfect rectangle
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                      {previewTable.data && Object.keys(previewTable.data[0]).map((column, index) => (
                        <TableCell key={index} sx={{ fontWeight: 600 }}>
                          {column.charAt(0).toUpperCase() + column.slice(1)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewTable.data && previewTable.data.map((row, rowIndex) => (
                      <TableRow key={rowIndex} sx={{ 
                        '&:nth-of-type(odd)': { 
                          bgcolor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)' 
                        }
                      }}>
                        {Object.values(row).map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'flex', mx: -1 }}>
                  <Box sx={{ width: '50%', p: 1 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<BarChartIcon />}
                      sx={{ 
                        borderRadius: theme.shape.borderRadius,
                        textTransform: 'none',
                        bgcolor: alpha(theme.palette.primary.main, 0.9),
                        '&:hover': {
                          bgcolor: theme.palette.primary.main
                        }
                      }}
                    >
                      Visualize This Table
                    </Button>
                  </Box>
                  <Box sx={{ width: '50%', p: 1 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      sx={{ 
                        borderRadius: theme.shape.borderRadius,
                        textTransform: 'none'
                      }}
                    >
                      Export Table Data
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default VisualizationPage;
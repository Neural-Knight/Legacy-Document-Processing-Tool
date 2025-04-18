import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  useTheme,
  alpha,
  Paper,
  Skeleton,
  CircularProgress,
  LinearProgress,
  Avatar,
  Tooltip,
  Stack,
  Tab,
  Tabs,
  CircularProgressProps,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// Icons
import UploadFileIcon from '@mui/icons-material/UploadFile';
import BarChartIcon from '@mui/icons-material/BarChart';
import StorageIcon from '@mui/icons-material/Storage';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FolderIcon from '@mui/icons-material/Folder';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ForumIcon from '@mui/icons-material/Forum';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';
import CancelIcon from '@mui/icons-material/Cancel';
import HistoryIcon from '@mui/icons-material/History';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';


// Services
import { getAllDocuments, Document } from '../services/documentService';
import { getAllChatSessions } from '../services/chatStorageService';

// Types
import { ChatSession } from '../types/chat';
// Helpers
import {
  getDocumentIcon,
  formatFileSize,
  getOriginalName,
  isProcessed,
  getStatusIcon
} from '../utils/documentHelpers';

// Contexts
import { useAuth } from '../context/AuthContext';

// New service functions (would typically be imported from services)
// For this implementation, we'll use mock services defined below
// import {
//   getStorageUsage,
//   getSystemStatus,
//   getDocumentProcessingHistory,
//   toggleFavoriteDocument,
//   getFavoriteDocuments,
//   getNotifications,
//   markNotificationAsRead,
//   dismissNotification,
//   getPerformanceMetrics
// } from '../services/dashboardService';

// Animation variants for framer-motion
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

// New types for added features
import {
  StorageInfo,
  type SystemStatus,
  ProcessingEvent,
  Notification,
  PerformanceMetric,
} from '../services/dashboardService';

// Types for stats data
interface StatsData {
  totalDocuments: number;
  processedDocuments: number;
  processingDocuments: number;
  errorDocuments: number;
  totalStorage: string;
  recentChats: number;
}

// Mock implementations of service functions (in a real implementation, these would be in separate service files)
// This is just a placeholder to simulate the service behavior
const mockServices = {
  getStorageUsage: async (): Promise<StorageInfo> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          used: 256 * 1024 * 1024, // 256 MB in bytes
          total: 1024 * 1024 * 1024, // 1 GB in bytes
          usedFormatted: '256 MB',
          totalFormatted: '1 GB',
          percentage: 25
        });
      }, 500);
    });
  },

  getSystemStatus: async (): Promise<SystemStatus> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          overall: 'healthy',
          apiLatency: 120, // ms
          queueStatus: {
            length: 3,
            processingRate: 1.5, // documents per minute
            estimatedTime: 2 // minutes
          },
          components: {
            api: 'operational',
            database: 'operational',
            storage: 'operational',
            processing: 'operational'
          }
        });
      }, 700);
    });
  },

  getDocumentProcessingHistory: async (): Promise<ProcessingEvent[]> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            documentId: '101',
            documentName: 'quarterly-report.pdf',
            status: 'processed',
            timestamp: new Date(Date.now() - 3600000), // 1 hour ago
            details: 'Successfully processed'
          },
          {
            id: '2',
            documentId: '102',
            documentName: 'financial-data.xlsx',
            status: 'processing',
            timestamp: new Date(Date.now() - 1800000) // 30 minutes ago
          },
          {
            id: '3',
            documentId: '103',
            documentName: 'project-plan.docx',
            status: 'uploaded',
            timestamp: new Date(Date.now() - 900000) // 15 minutes ago
          },
          {
            id: '4',
            documentId: '104',
            documentName: 'corrupted-file.pdf',
            status: 'error',
            timestamp: new Date(Date.now() - 7200000), // 2 hours ago
            details: 'File format error'
          }
        ]);
      }, 600);
    });
  },

  getFavoriteDocuments: async (): Promise<Document[]> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '101',
            filename: 'favorite-document-1.pdf',
            file_path: '/storage/documents/favorite-document-1.pdf',
            file_type: 'application/pdf',
            upload_date: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            processed: true,
            file_size: '1.5 MB',
            user_id: 1
          },
          {
            id: '102',
            filename: 'favorite-document-2.xlsx',
            file_path: '/storage/documents/favorite-document-2.xlsx',
            file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            upload_date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            processed: true,
            file_size: '2.3 MB',
            user_id: 1
          }
        ]);
      }, 550);
    });
  },

  toggleFavoriteDocument: async (documentId: string, isFavorite: boolean): Promise<boolean> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Toggle favorite for document ${documentId} to ${isFavorite}`);
        resolve(true);
      }, 300);
    });
  },

  getNotifications: async (): Promise<Notification[]> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: '1',
            type: 'success',
            title: 'Document Processed',
            message: 'quarterly-report.pdf has been processed successfully.',
            timestamp: new Date(Date.now() - 3600000), // 1 hour ago
            read: false,
            documentId: '101'
          },
          {
            id: '2',
            type: 'warning',
            title: 'Storage Space Low',
            message: 'You are approaching your storage limit. Consider upgrading your plan.',
            timestamp: new Date(Date.now() - 86400000), // 1 day ago
            read: true
          },
          {
            id: '3',
            type: 'error',
            title: 'Processing Error',
            message: 'Failed to process corrupted-file.pdf due to file format issues.',
            timestamp: new Date(Date.now() - 7200000), // 2 hours ago
            read: false,
            documentId: '104',
            actionRequired: true,
            actionText: 'View Details',
            actionLink: '/documents/104'
          }
        ]);
      }, 650);
    });
  },

  markNotificationAsRead: async (notificationId: string): Promise<boolean> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Mark notification ${notificationId} as read`);
        resolve(true);
      }, 200);
    });
  },

  dismissNotification: async (notificationId: string): Promise<boolean> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Dismiss notification ${notificationId}`);
        resolve(true);
      }, 200);
    });
  },

  getPerformanceMetrics: async (): Promise<PerformanceMetric[]> => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        const today = new Date();
        const metrics = Array.from({ length: 7 }).map((_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - 6 + i);
          return {
            date,
            documentsProcessed: Math.floor(Math.random() * 20) + 5,
            queriesExecuted: Math.floor(Math.random() * 50) + 10,
            avgQueryTime: Math.floor(Math.random() * 200) + 100, // ms
            avgProcessingTime: Math.floor(Math.random() * 60) + 30 // seconds
          };
        });
        resolve(metrics);
      }, 800);
    });
  }
};

// Component for animated counter
const AnimatedCounter: React.FC<{ value: number, duration?: number }> = ({ value, duration = 1 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Reset count when value changes
    setCount(0);

    if (value === 0) return;

    const steps = 20; // Number of steps to reach the final value
    const stepDuration = (duration * 1000) / steps;
    const increment = value / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep === steps) {
        setCount(value); // Ensure we end up with the exact value
        clearInterval(timer);
      } else {
        setCount(Math.floor(increment * currentStep));
      }
    }, stepDuration);

    return () => {
      clearInterval(timer);
    };
  }, [value, duration]);

  return <>{count}</>;
};

// StatCard component for the quick stats section
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  isLoading: boolean;
  animate?: boolean;
}> = ({ title, value, icon, color, isLoading, animate = true }) => {
  const theme = useTheme();

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
        boxShadow: `0 4px 20px 0 ${alpha(color, 0.15)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: `0 8px 25px 0 ${alpha(color, 0.3)}`,
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
            {title}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 45,
              height: 45,
              borderRadius: '12px',
              backgroundColor: alpha(color, 0.15),
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>

        {isLoading ? (
          <Skeleton variant="rectangular" width="60%" height={40} sx={{ mb: 1 }} />
        ) : (
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 0,
              color: theme.palette.text.primary
            }}
          >
            {typeof value === 'number' && animate ? (
              <AnimatedCounter value={value} />
            ) : (
              value
            )}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Activity item component for the recent activity section
const ActivityItem: React.FC<{
  primary: string;
  secondary: string;
  icon: React.ReactNode;
  timestamp: string;
  onClick?: () => void;
}> = ({ primary, secondary, icon, timestamp, onClick }) => {
  const theme = useTheme();

  return (
    <ListItem
      alignItems="flex-start"
      sx={{
        py: 1.5,
        px: 2,
        borderRadius: 2,
        mb: 1,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.05),
          transform: 'translateX(5px)'
        },
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
    >
      <ListItemIcon sx={{ minWidth: 40, color: theme.palette.primary.main }}>
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={<Typography variant="body1" sx={{ fontWeight: 500 }}>{primary}</Typography>}
        secondary={
          <React.Fragment>
            <Typography
              component="span"
              variant="body2"
              color="text.secondary"
              sx={{ display: 'inline' }}
            >
              {secondary}
            </Typography>
          </React.Fragment>
        }
      />
      <ListItemSecondaryAction>
        <Chip
          size="small"
          label={timestamp}
          sx={{
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.text.secondary,
            fontWeight: 500,
            fontSize: '0.7rem'
          }}
        />
      </ListItemSecondaryAction>
    </ListItem>
  );
};

// Action button component for the quick actions section
const ActionButton: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}> = ({ title, description, icon, color, onClick }) => {
  const theme = useTheme();

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        mb: 2,
        cursor: 'pointer',
        borderRadius: 3,
        transition: 'all 0.3s ease',
        borderLeft: `4px solid ${color}`,
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: `0 10px 20px ${alpha(color, 0.2)}`,
          '& .arrow-icon': {
            transform: 'translateX(5px)',
            color: color
          }
        }
      }}
      onClick={onClick}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '10px',
            backgroundColor: alpha(color, 0.15),
            color: color,
            mr: 2
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <IconButton className="arrow-icon" sx={{ transition: 'all 0.3s ease' }}>
          <ArrowForwardIcon />
        </IconButton>
      </CardContent>
    </Card>
  );
};

// Document card component for the document insights section
const DocumentCard: React.FC<{
  document: Document;
  onClick: () => void;
  onToggleFavorite?: (documentId: string, isFavorite: boolean) => void;
  isFavorite?: boolean;
}> = ({ document, onClick, onToggleFavorite, isFavorite = false }) => {
  const theme = useTheme();
  const originalName = getOriginalName(document.filename);
  const processed = isProcessed(document);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(document.id, !isFavorite);
    }
  };

  return (
    <Card
      sx={{
        mb: 1,
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateX(5px)',
          boxShadow: `0 5px 15px ${alpha(theme.palette.primary.main, 0.1)}`,
        }
      }}
      onClick={onClick}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
        <Avatar sx={{
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: theme.palette.primary.main,
          mr: 2,
          width: 40,
          height: 40
        }}>
          {getDocumentIcon(document.filename)}
        </Avatar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
            {originalName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              {formatFileSize(document.file_size || '0')}
            </Typography>
            <Chip
              size="small"
              icon={typeof getStatusIcon(document, theme) === 'object' ? getStatusIcon(document, theme) as React.ReactElement : undefined}
              label={processed ? 'Processed' : document.processing_error ? 'Error' : 'Processing'}
              sx={{
                height: 20,
                '& .MuiChip-label': { px: 1, fontSize: '0.65rem' },
                '& .MuiChip-icon': { ml: 0.5, fontSize: '0.8rem' },
                backgroundColor: processed
                  ? alpha(theme.palette.success.main, 0.1)
                  : document.processing_error
                    ? alpha(theme.palette.error.main, 0.1)
                    : alpha(theme.palette.warning.main, 0.1),
                color: processed
                  ? theme.palette.success.main
                  : document.processing_error
                    ? theme.palette.error.main
                    : theme.palette.warning.main,
              }}
            />
          </Box>
        </Box>
        <IconButton
          size="small"
          onClick={handleFavoriteClick}
          sx={{
            color: isFavorite ? theme.palette.warning.main : 'inherit',
            '&:hover': {
              color: theme.palette.warning.main
            }
          }}
        >
          {isFavorite ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      </CardContent>
    </Card>
  );
};

// Section header component
const SectionHeader: React.FC<{
  title: React.ReactNode; // Changed from string to ReactNode to support complex title content
  action?: React.ReactNode;
}> = ({ title, action }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2
      }}
    >
      <Typography
        variant="h6"
        component="div" // Changed from h2 to div since we might have complex ReactNode
        sx={{
          fontWeight: 600,
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: -5,
            left: 0,
            width: 40,
            height: 3,
            backgroundColor: theme.palette.primary.main,
            borderRadius: 1
          },
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {title}
      </Typography>
      {action}
    </Box>
  );
};

// Loading wrapper component
const LoadingWrapper: React.FC<{
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}> = ({ loading, error, children }) => {
  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={30} />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 40 }} />
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {error}
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
};

// CircularProgressWithLabel component for storage usage
const CircularProgressWithLabel: React.FC<CircularProgressProps & { value: number, label: string, warning?: boolean }> = (props) => {
  const { value, label, warning = false, ...other } = props;
  const theme = useTheme();

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        sx={{
          color: warning ? theme.palette.warning.main : theme.palette.primary.main,
          circle: {
            strokeLinecap: 'round'
          }
        }}
        size={80}
        thickness={5}
        {...other}
        value={value}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}
      >
        <Typography variant="h6" component="div" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.5 }}>
          {`${Math.round(value)}%`}
        </Typography>
        <Typography variant="caption" component="div" sx={{ lineHeight: 1 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
};

// Storage usage component (new feature)
const StorageUsage: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const theme = useTheme();
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStorageData = async () => {
      try {
        const data = await mockServices.getStorageUsage();
        setStorageInfo(data);
      } catch (err: any) {
        console.error('Error fetching storage data:', err);
        setError(err.message || 'Failed to load storage information');
      }
    };

    if (!isLoading) {
      fetchStorageData();
    }
  }, [isLoading]);

  const isNearCapacity = storageInfo ? storageInfo.percentage >= 80 : false;

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
        border: isNearCapacity
          ? `1px solid ${alpha(theme.palette.warning.main, 0.3)}`
          : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <SectionHeader title="Storage Usage" />

        <LoadingWrapper loading={isLoading} error={error}>
          {storageInfo && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgressWithLabel
                value={storageInfo.percentage}
                label="Used"
                warning={isNearCapacity}
              />

              <Box sx={{ mt: 2, width: '100%', textAlign: 'center' }}>
                <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
                  {storageInfo.usedFormatted} of {storageInfo.totalFormatted}
                </Typography>

                {isNearCapacity && (
                  <Alert
                    severity="warning"
                    icon={<WarningIcon fontSize="inherit" />}
                    sx={{
                      borderRadius: 2,
                      '& .MuiAlert-icon': { alignItems: 'center' }
                    }}
                  >
                    <AlertTitle>Storage Almost Full</AlertTitle>
                    Consider removing unused documents or upgrading your plan.
                  </Alert>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SettingsIcon />}
                  sx={{ mt: 2, borderRadius: 2 }}
                >
                  Manage Storage
                </Button>
              </Box>
            </Box>
          )}
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
};

// Document processing timeline component (new feature)
const DocumentTimeline: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [processingEvents, setProcessingEvents] = useState<ProcessingEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        const data = await mockServices.getDocumentProcessingHistory();
        setProcessingEvents(data);
      } catch (err: any) {
        console.error('Error fetching timeline data:', err);
        setError(err.message || 'Failed to load processing history');
      }
    };

    if (!isLoading) {
      fetchTimelineData();
    }
  }, [isLoading]);

  // Function to get dot color based on status
  const getStatusColor = (status: ProcessingEvent['status']): string => {
    switch (status) {
      case 'uploaded':
        return theme.palette.info.main;
      case 'processing':
        return theme.palette.warning.main;
      case 'processed':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  // Function to get icon based on status
  const getStatusTimelineIcon = (status: ProcessingEvent['status']) => {
    switch (status) {
      case 'uploaded':
        return <UploadFileIcon />;
      case 'processing':
        return <CloudSyncIcon />;
      case 'processed':
        return <CheckCircleIcon />;
      case 'error':
        return <ErrorOutlineIcon />;
      default:
        return <InfoOutlinedIcon />;
    }
  };

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <SectionHeader
          title="Processing Timeline"
          action={
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: 'none' }}
              onClick={() => navigate('/documents')}
            >
              View All
            </Button>
          }
        />

        <LoadingWrapper loading={isLoading} error={error}>
          {processingEvents.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <HistoryIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No processing history available
              </Typography>
            </Box>
          ) : (
            <Timeline
              position="alternate"
              sx={{
                p: 0,
                m: 0,
                [`& .MuiTimelineItem-root:before`]: {
                  flex: 0,
                  padding: 0
                }
              }}
            >
              {processingEvents.map((event) => (
                <TimelineItem key={event.id}>
                  <TimelineOppositeContent sx={{ flex: 0.3, minWidth: 80 }}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot sx={{ bgcolor: getStatusColor(event.status) }}>
                      {getStatusTimelineIcon(event.status)}
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Card
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        boxShadow: `0 2px 8px ${alpha(getStatusColor(event.status), 0.15)}`,
                        border: `1px solid ${alpha(getStatusColor(event.status), 0.2)}`,
                        mb: 1
                      }}
                    >
                      <Typography variant="body2" fontWeight={500}>
                        {event.documentName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Status: <span style={{ fontWeight: 500, color: getStatusColor(event.status) }}>{event.status}</span>
                      </Typography>
                      {event.details && (
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                          {event.details}
                        </Typography>
                      )}
                      <Button
                        size="small"
                        variant="text"
                        sx={{ fontSize: '0.75rem', mt: 0.5, p: 0, minWidth: 0 }}
                        onClick={() => navigate(`/documents/${event.documentId}`)}
                      >
                        View
                      </Button>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
};

// System status component (new feature)
const SystemStatus: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const theme = useTheme();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const data = await mockServices.getSystemStatus();
        setSystemStatus(data);
      } catch (err: any) {
        console.error('Error fetching system status:', err);
        setError(err.message || 'Failed to load system status');
      }
    };

    if (!isLoading) {
      fetchSystemStatus();
    }
  }, [isLoading]);

  // Function to get status color
  const getComponentStatusColor = (status: 'operational' | 'degraded' | 'down'): string => {
    switch (status) {
      case 'operational':
        return theme.palette.success.main;
      case 'degraded':
        return theme.palette.warning.main;
      case 'down':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  // Ensure icon is always a valid ReactElement for Chip component
  const getComponentStatusIcon = (status: 'operational' | 'degraded' | 'down'): React.ReactElement => {
    switch (status) {
      case 'operational':
        return <CheckCircleIcon fontSize="small" />;
      case 'degraded':
        return <WarningIcon fontSize="small" />;
      case 'down':
        return <ErrorOutlineIcon fontSize="small" />;
      default:
        return <InfoOutlinedIcon fontSize="small" />;
    }
  };

  // Function to get overall status details
  const getOverallStatusDetails = (status: SystemStatus['overall']) => {
    switch (status) {
      case 'healthy':
        return {
          color: theme.palette.success.main,
          text: 'All Systems Operational',
          icon: <CheckCircleIcon fontSize="small" />
        };
      case 'degraded':
        return {
          color: theme.palette.warning.main,
          text: 'Some Services Degraded',
          icon: <WarningIcon fontSize="small" />
        };
      case 'maintenance':
        return {
          color: theme.palette.info.main,
          text: 'Scheduled Maintenance',
          icon: <SettingsIcon fontSize="small" />
        };
      case 'down':
        return {
          color: theme.palette.error.main,
          text: 'System Outage',
          icon: <ErrorOutlineIcon fontSize="small" />
        };
      default:
        return {
          color: theme.palette.grey[500],
          text: 'Status Unknown',
          icon: <InfoOutlinedIcon fontSize="small" />
        };
    }
  };

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <SectionHeader title="System Status" />

        <LoadingWrapper loading={isLoading} error={error}>
          {systemStatus && (
            <>
              {/* Overall Status */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(getOverallStatusDetails(systemStatus.overall).color, 0.1),
                  mb: 2
                }}
              >
                <Box
                  sx={{
                    mr: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: alpha(getOverallStatusDetails(systemStatus.overall).color, 0.2),
                    color: getOverallStatusDetails(systemStatus.overall).color
                  }}
                >
                  {getOverallStatusDetails(systemStatus.overall).icon}
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {getOverallStatusDetails(systemStatus.overall).text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last checked: {new Date().toLocaleTimeString()}
                  </Typography>
                </Box>
              </Box>

              {/* Maintenance Notice */}
              {systemStatus.maintenanceNotice?.active && (
                <Alert
                  severity="info"
                  sx={{
                    mb: 2,
                    borderRadius: 2
                  }}
                >
                  <AlertTitle>Scheduled Maintenance</AlertTitle>
                  {systemStatus.maintenanceNotice.message}
                  {systemStatus.maintenanceNotice.endTime && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Expected completion: {new Date(systemStatus.maintenanceNotice.endTime).toLocaleString()}
                    </Typography>
                  )}
                </Alert>
              )}

              {/* Component Status */}
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Component Status
              </Typography>
              <Stack spacing={1} sx={{ mb: 2 }}>
                {Object.entries(systemStatus.components).map(([key, status]) => (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(getComponentStatusColor(status), 0.05),
                      border: `1px solid ${alpha(getComponentStatusColor(status), 0.1)}`
                    }}
                  >
                    <Typography variant="body2">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Typography>
                    <Chip
                      size="small"
                      label={status.charAt(0).toUpperCase() + status.slice(1)}
                      sx={{
                        bgcolor: alpha(getComponentStatusColor(status), 0.1),
                        color: getComponentStatusColor(status),
                        fontWeight: 500,
                        fontSize: '0.7rem'
                      }}
                    />
                  </Box>
                ))}
              </Stack>

              {/* API Response Time */}
              <Box sx={{ display: 'flex', mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    API Response Time
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {systemStatus.apiLatency}ms
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Processing Queue
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={600}>
                    {systemStatus.queueStatus.length} documents
                  </Typography>
                </Box>
              </Box>

              {/* Estimated Processing Time */}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Estimated processing time: {systemStatus.queueStatus.estimatedTime} {systemStatus.queueStatus.estimatedTime === 1 ? 'minute' : 'minutes'}
              </Typography>
            </>
          )}
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
};

// Favorite documents component (new feature)
const FavoriteDocuments: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [favoriteDocuments, setFavoriteDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const data = await mockServices.getFavoriteDocuments();
        setFavoriteDocuments(data);
      } catch (err: any) {
        console.error('Error fetching favorite documents:', err);
        setError(err.message || 'Failed to load favorite documents');
      }
    };

    if (!isLoading) {
      fetchFavorites();
    }
  }, [isLoading]);

  const handleToggleFavorite = async (documentId: string, isFavorite: boolean) => {
    setFavoriteLoading(true);
    try {
      await mockServices.toggleFavoriteDocument(documentId, isFavorite);

      // Update local state
      if (isFavorite) {
        // Add to favorites (in a real implementation, we would fetch the document details)
        // For the mock, we'll just leave it as is
      } else {
        // Remove from favorites
        setFavoriteDocuments(prevDocs => prevDocs.filter(doc => doc.id !== documentId));
      }
    } catch (err: any) {
      console.error('Error toggling favorite:', err);
      // Show error (would use a toast in a real implementation)
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <SectionHeader
          title="Favorite Documents"
          action={
            <Button
              size="small"
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: 'none' }}
              onClick={() => navigate('/documents?filter=favorites')}
            >
              View All
            </Button>
          }
        />

        <LoadingWrapper loading={isLoading || favoriteLoading} error={error}>
          {favoriteDocuments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <StarBorderIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No favorite documents yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                Mark documents as favorites for quick access
              </Typography>
              <Button
                variant="outlined"
                sx={{ mt: 1 }}
                onClick={() => navigate('/documents')}
              >
                Browse Documents
              </Button>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
              {favoriteDocuments.map(doc => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={true}
                />
              ))}
            </Box>
          )}
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
};

// Notification component (new feature)
const NotificationItem: React.FC<{
  notification: Notification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClick?: () => void;
}> = ({ notification, onRead, onDismiss, onClick }) => {
  const theme = useTheme();

  // Map notification type to color
  const getNotificationColor = (type: Notification['type']): string => {
    switch (type) {
      case 'success':
        return theme.palette.success.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.info.main;
    }
  };

  // Map notification type to icon
  const getNotificationIcon = (type: Notification['type']): React.ReactElement => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon fontSize="small" />;
      case 'warning':
        return <WarningIcon fontSize="small" />;
      case 'error':
        return <ErrorOutlineIcon fontSize="small" />;
      default:
        return <InfoOutlinedIcon fontSize="small" />;
    }
  };

  // Format the timestamp
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than a day
    if (diff < 24 * 60 * 60 * 1000) {
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Less than a week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return new Date(date).toLocaleDateString([], { weekday: 'short' });
    }

    // More than a week
    return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const handleClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    if (onClick) {
      onClick();
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss(notification.id);
  };

  return (
    <Card
      sx={{
        mb: 1,
        borderRadius: 2,
        transition: 'all 0.2s ease',
        bgcolor: notification.read ? 'transparent' : alpha(getNotificationColor(notification.type), 0.05),
        border: `1px solid ${alpha(getNotificationColor(notification.type), notification.read ? 0.1 : 0.2)}`,
        boxShadow: notification.read ? 'none' : `0 2px 8px ${alpha(getNotificationColor(notification.type), 0.15)}`,
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${alpha(getNotificationColor(notification.type), 0.2)}`,
        }
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex' }}>
          <Box
            sx={{
              mr: 1.5,
              mt: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: alpha(getNotificationColor(notification.type), 0.1),
              color: getNotificationColor(notification.type)
            }}
          >
            {getNotificationIcon(notification.type)}
          </Box>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {notification.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  {formatTimestamp(notification.timestamp)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleDismiss}
                  sx={{
                    width: 20,
                    height: 20,
                    '& .MuiSvgIcon-root': { fontSize: '0.875rem' }
                  }}
                >
                  <CancelIcon />
                </IconButton>
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {notification.message}
            </Typography>

            {notification.actionRequired && notification.actionText && (
              <Button
                size="small"
                sx={{ mt: 1, p: 0, minHeight: 0, minWidth: 0, textTransform: 'none' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClick) onClick();
                }}
              >
                {notification.actionText}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

// Notifications Center component (new feature)
const NotificationsCenter: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await mockServices.getNotifications();
        setNotifications(data);
      } catch (err: any) {
        console.error('Error fetching notifications:', err);
        setError(err.message || 'Failed to load notifications');
      }
    };

    if (!isLoading) {
      fetchNotifications();
    }
  }, [isLoading]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await mockServices.markNotificationAsRead(id);
      // Update the local state
      setNotifications(prevNotifications =>
        prevNotifications.map(notif =>
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleDismissNotification = async (id: string) => {
    try {
      await mockServices.dismissNotification(id);
      // Update the local state
      setNotifications(prevNotifications =>
        prevNotifications.filter(notif => notif.id !== id)
      );
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.documentId) {
      navigate(`/documents/${notification.documentId}`);
    } else if (notification.actionLink) {
      navigate(notification.actionLink);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <SectionHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography component="span">Notifications</Typography>
              {unreadCount > 0 && (
                <Chip
                  size="small"
                  label={unreadCount}
                  sx={{
                    ml: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                    height: 20,
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              )}
            </Box>
          }
          action={
            <Button
              size="small"
              onClick={() => {
                // Mark all as read
                const markAllAsRead = async () => {
                  for (const notification of notifications.filter(n => !n.read)) {
                    await mockServices.markNotificationAsRead(notification.id);
                  }
                  // Update the local state
                  setNotifications(prevNotifications =>
                    prevNotifications.map(notif => ({ ...notif, read: true }))
                  );
                };
                markAllAsRead();
              }}
              disabled={unreadCount === 0}
              sx={{ textTransform: 'none' }}
            >
              Mark All Read
            </Button>
          }
        />

        <LoadingWrapper loading={isLoading} error={error}>
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <DoNotDisturbIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 350, overflow: 'auto' }}>
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleMarkAsRead}
                  onDismiss={handleDismissNotification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </Box>
          )}
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
};

// Performance metrics component (new feature)
const PerformanceMetrics: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const theme = useTheme();
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await mockServices.getPerformanceMetrics();
        setMetrics(data);
      } catch (err: any) {
        console.error('Error fetching performance metrics:', err);
        setError(err.message || 'Failed to load performance metrics');
      }
    };

    if (!isLoading) {
      fetchMetrics();
    }
  }, [isLoading]);

  // Format data for charts
  const chartData = useMemo(() => {
    if (!metrics.length) return [];

    return metrics.map(metric => ({
      date: new Date(metric.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      documents: metric.documentsProcessed,
      queries: metric.queriesExecuted,
      queryTime: metric.avgQueryTime,
      processingTime: metric.avgProcessingTime
    }));
  }, [metrics]);

  // Calculate trends
  const trends = useMemo(() => {
    if (metrics.length < 2) return { documents: 0, queries: 0, queryTime: 0, processingTime: 0 };

    const latest = metrics[metrics.length - 1];
    const previous = metrics[metrics.length - 2];

    return {
      documents: ((latest.documentsProcessed - previous.documentsProcessed) / previous.documentsProcessed) * 100,
      queries: ((latest.queriesExecuted - previous.queriesExecuted) / previous.queriesExecuted) * 100,
      queryTime: ((latest.avgQueryTime - previous.avgQueryTime) / previous.avgQueryTime) * 100,
      processingTime: ((latest.avgProcessingTime - previous.avgProcessingTime) / previous.avgProcessingTime) * 100
    };
  }, [metrics]);

  // Trend indicator component
  const TrendIndicator: React.FC<{ value: number, inverse?: boolean }> = ({ value, inverse = false }) => {
    let color = theme.palette.grey[500];
    let icon = null;

    // For metrics where lower is better (like response times), invert the logic
    const adjustedValue = inverse ? -value : value;

    if (adjustedValue > 0) {
      color = theme.palette.success.main;
      icon = <TrendingUpIcon fontSize="small" />;
    } else if (adjustedValue < 0) {
      color = theme.palette.error.main;
      icon = <TrendingUpIcon fontSize="small" style={{ transform: 'rotate(180deg)' }} />;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          color
        }}
      >
        {icon}
        <Typography variant="caption" sx={{ ml: 0.5 }}>
          {Math.abs(value).toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  return (
    <Card
      component={motion.div}
      variants={itemVariants}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: `0 4px 20px rgba(0,0,0,0.05)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <SectionHeader
          title="Performance Metrics"
          action={
            <Tooltip title="View detailed analytics">
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                sx={{ textTransform: 'none' }}
                onClick={() => {/* Navigate to analytics page */ }}
              >
                Details
              </Button>
            </Tooltip>
          }
        />

        <LoadingWrapper loading={isLoading} error={error}>
          {metrics.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <BarChartIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                No performance data available yet
              </Typography>
            </Box>
          ) : (
            <>
              {/* Metric Cards */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Card sx={{
                  flex: '1 1 calc(50% - 8px)',
                  minWidth: { xs: '100%', sm: 'calc(50% - 8px)' },
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.05)
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="body2" color="text.secondary">Documents Processed</Typography>
                    <TrendIndicator value={trends.documents} />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                    {metrics[metrics.length - 1]?.documentsProcessed || 0}
                  </Typography>
                </Card>

                <Card sx={{
                  flex: '1 1 calc(50% - 8px)',
                  minWidth: { xs: '100%', sm: 'calc(50% - 8px)' },
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                  bgcolor: alpha(theme.palette.secondary.main, 0.05)
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="body2" color="text.secondary">Queries Executed</Typography>
                    <TrendIndicator value={trends.queries} />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                    {metrics[metrics.length - 1]?.queriesExecuted || 0}
                  </Typography>
                </Card>

                <Card sx={{
                  flex: '1 1 calc(50% - 8px)',
                  minWidth: { xs: '100%', sm: 'calc(50% - 8px)' },
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
                  bgcolor: alpha(theme.palette.info.main, 0.05)
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="body2" color="text.secondary">Avg Query Time</Typography>
                    <TrendIndicator value={trends.queryTime} inverse />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                    {metrics[metrics.length - 1]?.avgQueryTime || 0}ms
                  </Typography>
                </Card>

                <Card sx={{
                  flex: '1 1 calc(50% - 8px)',
                  minWidth: { xs: '100%', sm: 'calc(50% - 8px)' },
                  p: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
                  bgcolor: alpha(theme.palette.warning.main, 0.05)
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="body2" color="text.secondary">Avg Processing Time</Typography>
                    <TrendIndicator value={trends.processingTime} inverse />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                    {metrics[metrics.length - 1]?.avgProcessingTime || 0}s
                  </Typography>
                </Card>
              </Box>

              {/* Chart Tabs */}
              <Box sx={{ width: '100%', mt: 3 }}>
                <Tabs
                  value={activeTab}
                  onChange={(_, newValue) => setActiveTab(newValue)}
                  variant="fullWidth"
                  sx={{
                    mb: 2,
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontSize: '0.875rem',
                      minHeight: 36
                    }
                  }}
                >
                  <Tab label="Documents" />
                  <Tab label="Queries" />
                  <Tab label="Response Times" />
                </Tabs>

                {/* Chart data visualization would go here */}
                {/* In a real implementation, we would use Recharts to render line charts */}
                <Box sx={{
                  height: 150,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.divider, 0.05),
                  borderRadius: 2,
                  p: 2,
                  border: `1px dashed ${alpha(theme.palette.divider, 0.3)}`
                }}>
                  <Typography variant="body2" color="text.secondary">
                    {activeTab === 0 && 'Documents Processed Chart'}
                    {activeTab === 1 && 'Queries Executed Chart'}
                    {activeTab === 2 && 'Response Times Chart'}
                  </Typography>
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                  Data for the last 7 days
                </Typography>
              </Box>
            </>
          )}
        </LoadingWrapper>
      </CardContent>
    </Card>
  );
};

// Main HomePage component
const HomePage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDarkMode = theme.palette.mode === 'dark';

  // State for data
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [favoriteDocuments, setFavoriteDocuments] = useState<Set<string>>(new Set());

  // Calculate stats from the data
  const stats: StatsData = useMemo(() => {
    if (documents.length === 0) {
      return {
        totalDocuments: 0,
        processedDocuments: 0,
        processingDocuments: 0,
        errorDocuments: 0,
        totalStorage: '0 KB',
        recentChats: chatSessions.length
      };
    }

    const processed = documents.filter(doc => isProcessed(doc)).length;
    const processing = documents.filter(doc => !isProcessed(doc) && !doc.processing_error).length;
    const errors = documents.filter(doc => !!doc.processing_error).length;

    // Calculate total storage
    let totalBytes = 0;
    documents.forEach(doc => {
      if (doc.file_size) {
        const size = doc.file_size.toString();
        if (size.includes('KB')) {
          totalBytes += parseFloat(size.replace('KB', '').trim()) * 1024;
        } else if (size.includes('MB')) {
          totalBytes += parseFloat(size.replace('MB', '').trim()) * 1024 * 1024;
        } else {
          totalBytes += parseInt(size);
        }
      }
    });

    return {
      totalDocuments: documents.length,
      processedDocuments: processed,
      processingDocuments: processing,
      errorDocuments: errors,
      totalStorage: formatFileSize(totalBytes.toString()),
      recentChats: chatSessions.length
    };
  }, [documents, chatSessions]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch documents
        const docsData = await getAllDocuments();
        setDocuments(docsData);

        // Fetch chat sessions
        const chatsData = await getAllChatSessions();
        setChatSessions(chatsData);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshTrigger]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Handle toggling document favorite status
  const handleToggleFavorite = async (documentId: string, isFavorite: boolean) => {
    try {
      await mockServices.toggleFavoriteDocument(documentId, isFavorite);

      // Update local state
      if (isFavorite) {
        setFavoriteDocuments(prev => new Set([...prev, documentId]));
      } else {
        setFavoriteDocuments(prev => {
          const updated = new Set(prev);
          updated.delete(documentId);
          return updated;
        });
      }
    } catch (err) {
      console.error('Error toggling favorite status:', err);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Welcome header */}
        <Paper
          elevation={0}
          component={motion.div}
          variants={itemVariants}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: '16px',
            background: isDarkMode
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.4)} 0%, ${alpha(theme.palette.secondary.dark, 0.2)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.secondary.light, 0.05)} 100%)`,
            position: 'relative',
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.03), 0 2px 8px ${alpha(theme.palette.primary.main, 0.08)}`,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundImage: `radial-gradient(circle at 20% 30%, ${alpha(theme.palette.primary.light, 0.15)} 0%, rgba(255,255,255,0) 60%)`,
            }
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{
                fontWeight: 700,
                color: theme.palette.text.primary
              }}>
                Welcome back, {user?.first_name || 'User'}
              </Typography>
              <Typography variant="body1" sx={{
                maxWidth: '800px',
                mb: 2,
                color: theme.palette.text.secondary
              }}>
                Here's an overview of your document management activity and insights.
              </Typography>
            </Box>
            <Tooltip title="Refresh dashboard data">
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 500
                }}
              >
                Refresh
              </Button>
            </Tooltip>
          </Box>
        </Paper>

        {/* Stats section */}
        <Box component={motion.div} variants={itemVariants} sx={{ mb: 4 }}>
          <SectionHeader title="Quick Stats" />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            <Box sx={{ flex: '1 1 calc(25% - 24px)', minWidth: { xs: '100%', sm: 'calc(50% - 24px)', md: 'calc(25% - 24px)' } }}>
              <StatCard
                title="Total Documents"
                value={stats.totalDocuments}
                icon={<FolderIcon />}
                color={theme.palette.primary.main}
                isLoading={loading}
              />
            </Box>
            <Box sx={{ flex: '1 1 calc(25% - 24px)', minWidth: { xs: '100%', sm: 'calc(50% - 24px)', md: 'calc(25% - 24px)' } }}>
              <StatCard
                title="Processed"
                value={stats.processedDocuments}
                icon={<CheckCircleIcon />}
                color={theme.palette.success.main}
                isLoading={loading}
              />
            </Box>
            <Box sx={{ flex: '1 1 calc(25% - 24px)', minWidth: { xs: '100%', sm: 'calc(50% - 24px)', md: 'calc(25% - 24px)' } }}>
              <StatCard
                title="Storage Used"
                value={stats.totalStorage}
                icon={<StorageIcon />}
                color={theme.palette.info.main}
                isLoading={loading}
                animate={false}
              />
            </Box>
            <Box sx={{ flex: '1 1 calc(25% - 24px)', minWidth: { xs: '100%', sm: 'calc(50% - 24px)', md: 'calc(25% - 24px)' } }}>
              <StatCard
                title="Active Chats"
                value={stats.recentChats}
                icon={<ForumIcon />}
                color={theme.palette.secondary.main}
                isLoading={loading}
              />
            </Box>
          </Box>
        </Box>

        {/* New Features: Storage, Timeline, System Status */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
          <Box sx={{ flex: '1 1 calc(33.333% - 16px)', minWidth: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' } }}>
            <FavoriteDocuments isLoading={loading} />

          </Box>
          <Box sx={{ flex: '1 1 calc(33.333% - 16px)', minWidth: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' } }}>
            <NotificationsCenter isLoading={loading} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33.333% - 16px)', minWidth: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' } }}>
            <PerformanceMetrics isLoading={loading} />
          </Box>
        </Box>

        {/* Main Content Sections */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 4 }}>
          {/* Left Column: Recent Activity */}
          <Box sx={{ flex: 1 }}>
            <Paper
              component={motion.div}
              variants={itemVariants}
              sx={{
                p: 3,
                borderRadius: '16px',
                height: '100%',
                boxShadow: `0 4px 20px rgba(0,0,0,0.03), 0 2px 8px ${alpha(theme.palette.primary.main, 0.04)}`,
              }}
            >
              <SectionHeader
                title="Recent Activity"
                action={
                  <Button
                    size="small"
                    endIcon={<ArrowForwardIcon />}
                    sx={{ textTransform: 'none' }}
                  >
                    View All
                  </Button>
                }
              />

              <LoadingWrapper loading={loading} error={error}>
                {documents.length === 0 && chatSessions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <InfoOutlinedIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No recent activity to display
                    </Typography>
                    <Button
                      variant="outlined"
                      sx={{ mt: 2 }}
                      onClick={() => navigate('/upload')}
                    >
                      Upload Your First Document
                    </Button>
                  </Box>
                ) : (
                  <List sx={{ maxHeight: 350, overflow: 'auto' }}>
                    {/* Recent documents */}
                    {documents.slice(0, 3).map((doc) => (
                      <ActivityItem
                        key={doc.id}
                        primary={getOriginalName(doc.filename)}
                        secondary={`Uploaded ${isProcessed(doc) ? 'and processed' : 'and in processing'}`}
                        icon={getDocumentIcon(doc.filename)}
                        timestamp={new Date(doc.upload_date).toLocaleDateString()}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      />
                    ))}

                    {/* Recent chats */}
                    {chatSessions.slice(0, 3).map((chat) => (
                      <ActivityItem
                        key={chat.id}
                        primary={chat.title}
                        secondary={chat.previewText || 'Chat session'}
                        icon={<SmartToyIcon />}
                        timestamp={new Date(chat.lastUpdated).toLocaleDateString()}
                        onClick={() => navigate(`/query-agent/${chat.id}`)}
                      />
                    ))}
                  </List>
                )}
              </LoadingWrapper>
            </Paper>
          </Box>

          {/* Right Column: Quick Actions */}
          <Box sx={{ flex: 1 }}>
            <Paper
              component={motion.div}
              variants={itemVariants}
              sx={{
                p: 3,
                borderRadius: '16px',
                height: '100%',
                boxShadow: `0 4px 20px rgba(0,0,0,0.03), 0 2px 8px ${alpha(theme.palette.primary.main, 0.04)}`,
              }}
            >
              <SectionHeader title="Quick Actions" />

              <ActionButton
                title="Upload Document"
                description="Upload a new document for processing"
                icon={<UploadFileIcon />}
                color={theme.palette.primary.main}
                onClick={() => navigate('/upload')}
              />

              <ActionButton
                title="Start New Query"
                description="Ask questions about your documents"
                icon={<SmartToyIcon />}
                color={theme.palette.secondary.main}
                onClick={() => navigate('/query-agent')}
              />

              <ActionButton
                title="Create Visualization"
                description="Generate visual insights from your data"
                icon={<BarChartIcon />}
                color={theme.palette.info.main}
                onClick={() => navigate('/visualizations')}
              />

              <ActionButton
                title="Browse Documents"
                description="View and manage your document library"
                icon={<FolderIcon />}
                color={theme.palette.success.main}
                onClick={() => navigate('/documents')}
              />
            </Paper>
          </Box>
        </Stack>

        {/* New Features: Favorites, Notifications, Timeline */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
          <Box sx={{ flex: '1 1 calc(33.333% - 16px)', minWidth: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' } }}>
            <DocumentTimeline isLoading={loading} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33.333% - 16px)', minWidth: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' } }}>
            <StorageUsage isLoading={loading} />
          </Box>
          <Box sx={{ flex: '1 1 calc(33.333% - 16px)', minWidth: { xs: '100%', sm: 'calc(50% - 16px)', md: 'calc(33.333% - 16px)' } }}>
            <SystemStatus isLoading={loading} />
          </Box>
        </Box>

        {/* Document Insights */}
        <Paper
          component={motion.div}
          variants={itemVariants}
          sx={{
            p: 3,
            mt: 3,
            borderRadius: '16px',
            boxShadow: `0 4px 20px rgba(0,0,0,0.03), 0 2px 8px ${alpha(theme.palette.primary.main, 0.04)}`,
          }}
        >
          <SectionHeader
            title="Document Insights"
            action={
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                sx={{ textTransform: 'none' }}
                onClick={() => navigate('/documents')}
              >
                View All Documents
              </Button>
            }
          />

          <LoadingWrapper loading={loading} error={error}>
            {documents.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <InfoOutlinedIcon sx={{ fontSize: 40, color: theme.palette.text.secondary, mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No documents to display
                </Typography>
                <Button
                  variant="outlined"
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/upload')}
                >
                  Upload Your First Document
                </Button>
              </Box>
            ) : (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                {/* Processing Status */}
                <Box sx={{ flex: 1, width: { xs: '100%', md: '33.33%' } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Processing Status
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Processed
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {stats.processedDocuments} / {stats.totalDocuments}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(stats.processedDocuments / (stats.totalDocuments || 1)) * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: alpha(theme.palette.success.main, 0.2),
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: theme.palette.success.main
                        }
                      }}
                    />
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Processing
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {stats.processingDocuments} / {stats.totalDocuments}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(stats.processingDocuments / (stats.totalDocuments || 1)) * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: alpha(theme.palette.warning.main, 0.2),
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: theme.palette.warning.main
                        }
                      }}
                    />
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Errors
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {stats.errorDocuments} / {stats.totalDocuments}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(stats.errorDocuments / (stats.totalDocuments || 1)) * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: alpha(theme.palette.error.main, 0.2),
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: theme.palette.error.main
                        }
                      }}
                    />
                  </Box>
                </Box>

                {/* Recently Processed */}
                <Box sx={{ flex: 1, width: { xs: '100%', md: '33.33%' } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Recently Processed
                  </Typography>
                  {documents
                    .filter(doc => isProcessed(doc))
                    .slice(0, 4)
                    .map(doc => (
                      <DocumentCard
                        key={doc.id}
                        document={doc}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={favoriteDocuments.has(doc.id)}
                      />
                    ))}

                  {documents.filter(doc => isProcessed(doc)).length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <HourglassEmptyIcon sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No processed documents yet
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Documents with Issues */}
                <Box sx={{ flex: 1, width: { xs: '100%', md: '33.33%' } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Documents with Issues
                  </Typography>
                  {documents
                    .filter(doc => doc.processing_error)
                    .slice(0, 4)
                    .map(doc => (
                      <DocumentCard
                        key={doc.id}
                        document={doc}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={favoriteDocuments.has(doc.id)}
                      />
                    ))}

                  {documents.filter(doc => doc.processing_error).length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CheckCircleIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No documents with issues
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Stack>
            )}
          </LoadingWrapper>
        </Paper>
      </motion.div>
    </Box>
  );
};

export default HomePage;
import React, { ReactNode } from 'react';
import {
  Box,
  CssBaseline,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Toolbar,
  useTheme,
  useMediaQuery,
  Tooltip,
  Zoom,
  IconButton
} from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

// Icons
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import FolderIcon from '@mui/icons-material/Folder';
import UploadIcon from '@mui/icons-material/Upload';
import SmartToyIcon from '@mui/icons-material/SmartToy';
// Theme context
import { useThemeContext } from '../../theme/AppThemeProvider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

interface LayoutProps {
  children: ReactNode;
}

// Navigation items
const navItems = [
  { text: 'Home', path: '/', icon: <HomeIcon /> },
  { text: 'Upload', path: '/upload', icon: <UploadIcon /> },
  { text: 'My Documents', path: '/documents', icon: <FolderIcon /> },
  { text: 'Visualizations', path: '/visualizations', icon: <BarChartIcon /> },
  { text: 'Query Agent', path: '/query-tool', icon: <SmartToyIcon /> },
];

// Fixed drawer width - slightly more spacious
const drawerWidth = 57;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const { mode, toggleColorMode } = useThemeContext();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const drawer = (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <Divider sx={{ mb: 1 }} />
      <List sx={{ flexGrow: 1, px: 1 }}>
        {navItems.map((item) => {
          const isSelected = location.pathname === item.path;
          
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 2 }}>
              <Tooltip 
                title={item.text} 
                placement="right"
                TransitionComponent={Zoom}
                arrow
                enterDelay={200}
                leaveDelay={0}
              >
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={isSelected}
                  sx={{
                    position: 'relative',
                    // justifyContent: 'center',
                    p: 1.1,
                    borderRadius: '35%',
                    overflow: 'hidden',
                    minWidth: '40px',
                    maxWidth: '40px',
                    height: '42px',
                    mx: 'auto',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '4px',
                      height: '100%',
                      backgroundColor: 'transparent',
                      transition: theme.transitions.create('background-color', {
                        duration: theme.transitions.duration.shorter,
                      }),
                    },
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.mode === 'light' 
                        ? `${theme.palette.primary.light}30`
                        : `${theme.palette.primary.dark}30`,
                      '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main,
                      },
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.mode === 'light'
                        ? `rgba(0, 127, 255, 0.08)`
                        : `rgba(58, 142, 255, 0.15)`,
                      '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main,
                        transform: 'scale(1.2)',
                      },
                    },
                    transition: theme.transitions.create(
                      ['background-color', 'transform', 'box-shadow'], 
                      { duration: 250, easing: theme.transitions.easing.easeInOut }
                    ),
                  }}
                >
                  <ListItemIcon 
                    sx={{ 
                      minWidth: 50,
                      color: isSelected 
                        ? theme.palette.primary.main 
                        : theme.palette.text.secondary,
                      transition: theme.transitions.create(['color', 'transform'], {
                        duration: 250,
                        easing: theme.transitions.easing.easeInOut,
                      }),
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      '&:hover': {
                        transform: 'scale(1.1)',
                      }
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ mt: 1, mb: 1.5 }} />
      
      {/* Theme toggle button at the bottom of sidebar */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        mb: 1.5
      }}>
        <Tooltip 
          title={theme.palette.mode === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
          placement="right"
          arrow
          TransitionComponent={Zoom}
        >
          <IconButton 
            onClick={toggleColorMode}
            sx={{ 
              color: theme.palette.mode === 'light' ? theme.palette.grey[700] : theme.palette.grey[300],
              borderRadius: '50%',
              p: 1,
              transition: theme.transitions.create(['transform', 'color', 'filter'], {
                duration: 250,
                easing: theme.transitions.easing.easeInOut,
              }),
              '&:hover': {
                transform: 'scale(1.1)',
                color: theme.palette.primary.main,
                filter: `drop-shadow(0 0 2px ${theme.palette.primary.main}40)`,
              }
            }}
          >
            {theme.palette.mode === 'dark' ? 
              <Brightness7Icon sx={{ fontSize: '1.2rem' }} /> : 
              <Brightness4Icon sx={{ fontSize: '1.2rem' }} />
            }
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Permanent sidebar drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
            borderRight: `1px solid ${theme.palette.mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
            overflowX: 'hidden',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={isMobile}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box',
              width: drawerWidth,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3, md: 4 },
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.default,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        <Box sx={{ flexGrow: 1 }}>{children}</Box>
      </Box>
    </Box>
  );
};

export default Layout;
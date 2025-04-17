import React, { ReactNode, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  Box,
  CssBaseline,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tooltip,
  Zoom,
  IconButton,
  Avatar,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Paper,
  Switch, // Added Switch component for theme toggle
} from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

// Icons
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import FolderIcon from '@mui/icons-material/Folder';
import UploadIcon from '@mui/icons-material/Upload';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PersonIcon from '@mui/icons-material/Person';
import DashboardIcon from '@mui/icons-material/Dashboard';
// Theme context
import { useThemeContext } from '../../theme/AppThemeProvider';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

// Auth context
import { useAuth } from '../../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

// Navigation items
const navItems = [
  { text: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { text: 'Upload', path: '/upload', icon: <UploadIcon /> },
  { text: 'My Documents', path: '/documents', icon: <FolderIcon /> },
  { text: 'Visualizations', path: '/visualizations', icon: <BarChartIcon /> },
  { text: 'Query Agent', path: '/query-agent', icon: <SmartToyIcon /> },
];

// Fixed drawer width - slightly more spacious
const drawerWidth = 57;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const { mode, toggleColorMode } = useThemeContext();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout, isAuthenticated, updateProfile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // State for custom profile menu
  // Initialize profile menu as closed
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // For capturing position of the profile button
  const [profileButtonPosition, setProfileButtonPosition] = useState({ top: 0, left: 0 });

  // Update position when menu opens
  useEffect(() => {
    if (profileMenuOpen && profileButtonRef.current) {
      const rect = profileButtonRef.current.getBoundingClientRect();
      setProfileButtonPosition({
        top: rect.top,
        left: rect.left + rect.width
      });
    }
  }, [profileMenuOpen]);

  // State for dialogs
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Form state for profile dialog
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || ''
  });

  // Handle profile form changes
  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle profile form submission
  const handleProfileFormSubmit = async () => {
    if (user) {
      try {
        await updateProfile({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          email: profileForm.email
        });
        setProfileDialogOpen(false);
      } catch (error) {
        console.error('Failed to update profile:', error);
      }
    }
  };

  // Menu component for the portal
  const ProfileMenu = () => {
    if (!profileMenuOpen) return null;

    return (
      <Box
        id="profile-menu"
        role="menu"
        ref={menuRef}
        aria-labelledby="profile-button"
        data-testid="profile-menu"
        sx={{
          position: 'fixed', // Fixed positioning relative to viewport
          zIndex: 1400, // Higher z-index to appear above everything
          width: 220,
          left: `${profileButtonPosition.left - 45}px`, // Position based on button location
          top: `${profileButtonPosition.top - 120}px`,
          transform: 'translateX(10px) translateY(-50%)', // Adjust to center vertically
          boxShadow: theme.shadows[8],
          borderRadius: 2,
          overflow: 'visible',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Paper sx={{ width: '100%' }}>
          {user ? (
            <Box>
              {/* Profile header */}
              <Box
                sx={{
                  p: 2,
                  background: theme.palette.mode === 'light'
                    ? `linear-gradient(145deg, ${theme.palette.primary.light}40, ${theme.palette.primary.dark}20)`
                    : `linear-gradient(145deg, ${theme.palette.primary.dark}60, ${theme.palette.primary.dark}30)`,
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      width: 40,
                      height: 40,
                      bgcolor: theme.palette.primary.main,
                      boxShadow: `0 0 0 2px ${theme.palette.background.paper}`
                    }}
                  >
                    {user.first_name && user.last_name
                      ? `${user.first_name[0]}${user.last_name[0]}`
                      : user.username[0].toUpperCase()}
                  </Avatar>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0 }}>
                      {user.first_name && user.last_name
                        ? `${user.first_name} ${user.last_name}`
                        : user.username}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user.email}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              {/* Menu options */}
              <List sx={{ py: 0 }}>
                <ListItem disablePadding>
                  <ListItemButton onClick={handleProfile} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <AccountCircleIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2">My Profile</Typography>
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton onClick={handleSettings} sx={{ py: 1 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2">Settings</Typography>
                  </ListItemButton>
                </ListItem>

                <Divider />

                <ListItem disablePadding>
                  <ListItemButton onClick={handleLogout} sx={{ py: 1 }} disabled={isLoggingOut}>
                    <ListItemIcon sx={{ minWidth: 40, color: theme.palette.error.main }}>
                      {isLoggingOut ? (
                        <CircularProgress size={20} color="error" />
                      ) : (
                        <LogoutIcon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <Typography variant="body2" color="error">
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </Typography>
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {/* Theme toggle switch for non-logged in users */}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={toggleColorMode}
                  sx={{ py: 1, justifyContent: 'space-between' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {theme.palette.mode === 'dark' ?
                        <Brightness7Icon fontSize="small" /> :
                        <Brightness4Icon fontSize="small" />
                      }
                    </ListItemIcon>
                    <Typography variant="body2">Dark Mode</Typography>
                  </Box>
                  <Switch
                    checked={theme.palette.mode === 'dark'}
                    onClick={(e) => e.stopPropagation()}
                    onChange={toggleColorMode}
                    size="small"
                    color="primary"
                  />
                </ListItemButton>
              </ListItem>

              <Divider />

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    handleProfileClose();
                    navigate('/login');
                  }}
                  sx={{ py: 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <PersonIcon fontSize="small" />
                  </ListItemIcon>
                  <Typography variant="body2">Login</Typography>
                </ListItemButton>
              </ListItem>
            </List>
          )}
        </Paper>
      </Box>
    );
  };

  // Handle clicking outside to close menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuOpen &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(event.target as Node) &&
        !document.getElementById('profile-menu')?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    // Only add the event listener when the menu is open
    if (profileMenuOpen) {
      // Use setTimeout to avoid immediate trigger after click
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [profileMenuOpen, profileButtonRef]);

  const handleProfileClick = () => {
    setProfileMenuOpen(prevState => !prevState);
    console.log("Profile menu clicked, new state:", !profileMenuOpen); // Debug log
  };

  const handleProfileClose = () => {
    setProfileMenuOpen(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      await logout();
      handleProfileClose();
      setProfileDialogOpen(false);
      setSettingsDialogOpen(false);
      navigate('/landing', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Optionally show an error message to the user
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSettings = () => {
    handleProfileClose();
    setSettingsDialogOpen(true);
  };

  const handleProfile = () => {
    // Update form with current user data
    if (user) {
      setProfileForm({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email
      });
    }
    handleProfileClose();
    setProfileDialogOpen(true);
  };

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
      <List sx={{ flexGrow: 1, px: 1}}>
        {navItems.map((item) => {
          const isSelected = location.pathname === item.path;

          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 3 }}>
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
      {/* <Divider sx={{ mt: 1, mb: 1.5 }} /> */}

      {/* Bottom controls section */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        mb: 1.5,
        gap: 1
      }}>
        {/* Removed the theme toggle button from here */}

        {/* User profile button */}
        <Tooltip
          title={isAuthenticated ? "Your Profile" : "Login"}
          placement="right"
          arrow
          TransitionComponent={Zoom}
        >
          <Box>
            <IconButton
              ref={profileButtonRef}
              onClick={handleProfileClick}
              aria-describedby="profile-menu"
              aria-haspopup="true"
              aria-expanded={profileMenuOpen ? 'true' : 'false'}
              data-testid="profile-button"
              sx={{
                color: profileMenuOpen
                  ? theme.palette.primary.main
                  : theme.palette.mode === 'light' ? theme.palette.grey[700] : theme.palette.grey[300],
                borderRadius: '50%',
                p: 0.5,
                transition: theme.transitions.create(['transform', 'color', 'filter'], {
                  duration: 250,
                  easing: theme.transitions.easing.easeInOut,
                }),
                '&:hover': {
                  transform: 'scale(1.1)',
                  color: theme.palette.primary.main,
                  filter: `drop-shadow(0 0 2px ${theme.palette.primary.main}40)`,
                },
                ...(profileMenuOpen && {
                  transform: 'scale(1.1)',
                  color: theme.palette.primary.main,
                  filter: `drop-shadow(0 0 3px ${theme.palette.primary.main}50)`,
                }),
              }}
            >
              {user ? (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    fontSize: '0.9rem',
                    bgcolor: profileMenuOpen ? theme.palette.primary.main : theme.palette.primary.dark,
                    border: profileMenuOpen ? `2px solid ${theme.palette.primary.main}` : 'none',
                  }}
                >
                  {user.first_name && user.last_name
                    ? `${user.first_name[0]}${user.last_name[0]}`
                    : user.username[0].toUpperCase()}
                </Avatar>
              ) : (
                <PersonIcon sx={{ fontSize: '1.6rem' }} />
              )}
            </IconButton>
          </Box>
        </Tooltip>

        {/* Custom Profile Menu Popup - Using Portal */}
        {profileMenuOpen && document.body && ReactDOM.createPortal(
          <ProfileMenu />,
          document.body
        )}
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

      {/* Profile Dialog */}
      <Dialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          pb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light'
            ? `${theme.palette.primary.light}20`
            : `${theme.palette.primary.dark}20`,
        }}>
          My Profile
        </DialogTitle>
        <DialogContent sx={{ pt: 3, mt: 1 }}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              label="First Name"
              name="first_name"
              value={profileForm.first_name}
              onChange={handleProfileFormChange}
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Last Name"
              name="last_name"
              value={profileForm.last_name}
              onChange={handleProfileFormChange}
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              type="email"
              value={profileForm.email}
              onChange={handleProfileFormChange}
              variant="outlined"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setProfileDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleProfileFormSubmit}
            variant="contained"
            color="primary"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          pb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.mode === 'light'
            ? `${theme.palette.primary.light}20`
            : `${theme.palette.primary.dark}20`,
        }}>
          Settings
        </DialogTitle>
        <DialogContent sx={{ pt: 3, mt: 1 }}>
          <Typography variant="body1" gutterBottom>
            Application settings will appear here. This is a placeholder that you can customize with the actual settings options needed for your application.
          </Typography>
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom color="primary">
              Theme Settings
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ mr: 2 }}>
                Dark Mode:
              </Typography>
              <Switch
                checked={theme.palette.mode === 'dark'}
                onChange={toggleColorMode}
                color="primary"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setSettingsDialogOpen(false)}
            color="primary"
            variant="contained"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout;
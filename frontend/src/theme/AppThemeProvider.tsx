import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  responsiveFontSizes, 
  PaletteMode,
  alpha 
} from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';

interface ThemeContextType {
  mode: PaletteMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleColorMode: () => {}
});

export const useThemeContext = () => useContext(ThemeContext); 

const createGradient = (direction: string, color1: string, color2: string) => {
  return `linear-gradient(${direction}, ${color1}, ${color2})`;
};

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialMode = (): PaletteMode => {
    const savedMode = localStorage.getItem('themeMode');
    if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
      return savedMode;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  const toggleColorMode = () => {
    setMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  const theme = useMemo(() => {
    const baseTheme = createTheme({
      palette: {
        mode,
        primary: mode === 'light' 
          ? {
              main: '#00695c',
              light: '#439889',
              dark: '#004d40',
              contrastText: '#ffffff',
            }
          : {
              main: '#1ddef0',
              light: '#4ceffb',
              dark: '#17b8c7',
              contrastText: '#ffffff',
            },
        secondary: mode === 'light'
          ? {
              main: '#b9935a',
              light: '#deb974',
              dark: '#8a6e42',
              contrastText: '#ffffff',
            }
          : {
              main: '#7be854',
              light: '#a3f18d',
              dark: '#66c03e',
              contrastText: '#ffffff',
            },
        info: mode === 'light'
          ? {
              main: '#00838f',
              light: '#4fb3bf',
              dark: '#005662',
              contrastText: '#ffffff',
            }
          : {
              main: '#29b6f6',
              light: '#4fc3f7',
              dark: '#0288d1',
              contrastText: '#ffffff',
            },
        success: mode === 'light'
          ? {
              main: '#2e7d32',
              light: '#60ad5e',
              dark: '#005005',
              contrastText: '#ffffff',
            }
          : {
              main: '#66bb6a',
              light: '#81c784',
              dark: '#388e3c',
              contrastText: '#ffffff',
            },
        background: {
          default: mode === 'light' ? '#faf7f0' : '#121212', 
          paper: mode === 'light' ? '#fffef7' : '#1e1e1e',
        },
        text: {
          primary: mode === 'light' ? '#2d3748' : 'rgba(255, 255, 255, 0.87)',
          secondary: mode === 'light' ? '#4a5568' : 'rgba(255, 255, 255, 0.6)',
        },
        divider: mode === 'light' ? 'rgba(0, 0, 0, 0.09)' : 'rgba(255, 255, 255, 0.12)',
      },
      
      typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
          fontWeight: 600,
        },
        h2: {
          fontWeight: 600,
        },
        h3: {
          fontWeight: 600,
        },
        h4: {
          fontWeight: 600,
        },
        h5: {
          fontWeight: 600,
        },
        h6: {
          fontWeight: 600,
        },
        subtitle1: {
          fontWeight: 500,
        },
        button: {
          fontWeight: 500,
          textTransform: 'none',
        },
      },
      shape: {
        borderRadius: 8, 
      },
      shadows: [
        'none',
        '0px 2px 3px rgba(0,0,0,0.05)',
        '0px 3px 6px rgba(0,0,0,0.07)',
        '0px 4px 8px rgba(0,0,0,0.09)',
        '0px 6px 12px rgba(0,0,0,0.1)',
        '0px 8px 16px rgba(0,0,0,0.1)',
        '0px 10px 20px rgba(0,0,0,0.1)',
        '0px 12px 24px rgba(0,0,0,0.1)',
        '0px 14px 28px rgba(0,0,0,0.1)',
        '0px 16px 32px rgba(0,0,0,0.1)',
        '0px 18px 36px rgba(0,0,0,0.1)',
        '0px 20px 40px rgba(0,0,0,0.1)',
        '0px 22px 44px rgba(0,0,0,0.1)',
        '0px 24px 48px rgba(0,0,0,0.1)',
        '0px 26px 52px rgba(0,0,0,0.1)',
        '0px 28px 56px rgba(0,0,0,0.1)',
        '0px 30px 60px rgba(0,0,0,0.1)',
        '0px 32px 64px rgba(0,0,0,0.1)',
        '0px 34px 68px rgba(0,0,0,0.1)',
        '0px 36px 72px rgba(0,0,0,0.1)',
        '0px 38px 76px rgba(0,0,0,0.1)',
        '0px 40px 80px rgba(0,0,0,0.1)',
        '0px 42px 84px rgba(0,0,0,0.1)',
        '0px 44px 88px rgba(0,0,0,0.1)',
        '0px 46px 92px rgba(0,0,0,0.1)',
      ] as any,
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            '*': {
              boxSizing: 'border-box',
            },
            html: {
              margin: 0,
              padding: 0,
              width: '100%',
              height: '100%',
            },
            body: {
              margin: 0,
              padding: 0,
              width: '100%',
              height: '100%',
              overflowX: 'hidden',
              scrollBehavior: 'smooth',
            },
            '*::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '*::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '*::-webkit-scrollbar-thumb': {
              backgroundColor: mode === 'dark' ? '#6b6b6b' : '#b0b0b0',
              border: '2px solid transparent',
              backgroundClip: 'content-box',
            },
            '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
              backgroundColor: mode === 'dark' ? '#828282' : '#909090',
            },
            '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
              backgroundColor: mode === 'dark' ? '#828282' : '#909090',
            },
            '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
              backgroundColor: mode === 'dark' ? '#828282' : '#909090',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
              // Light mode button style
              ...(mode === 'light' && {
                '&.MuiButton-contained': {
                  boxShadow: '0 3px 8px rgba(0, 105, 92, 0.15)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 5px 12px rgba(0, 105, 92, 0.25)',
                  },
                },
                '&.MuiButton-containedPrimary': {
                  background: '#00695c',
                  '&:hover': {
                    backgroundColor: '#004d40',
                  },
                },
                '&.MuiButton-containedSecondary': {
                  background: '#b9935a',
                  '&:hover': {
                    backgroundColor: '#8a6e42',
                  },
                },
                '&::before': {
                  display: 'none',
                },
              }),
              ...(mode === 'dark' && {
                color: '#ffffff',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 70%)',
                  transition: 'all 0.5s ease',
                  transform: 'translateX(-100%)',
                },
                '&:hover::before': {
                  transform: 'translateX(100%)',
                },
                '&.MuiButton-containedPrimary': {
                  background: `linear-gradient(45deg, #0b9bb5, #5fae3b)`, 
                  backgroundSize: '200% auto',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundPosition: 'right center',
                  },
                },
                '&.MuiButton-containedSecondary': {
                  background: `linear-gradient(45deg, #0a869a, #509431)`,
                  backgroundSize: '200% auto',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundPosition: 'right center',
                  },
                },
              }),
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: '12px',
              transition: 'transform 0.3s, box-shadow 0.3s',
              ...(mode === 'light' && {
                boxShadow: '0 4px 12px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.04)',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.07)',
                },
              }),
              // Keep existing dark mode styles
              ...(mode === 'dark' && {
                boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.25)',
                '&:hover': {
                  boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.35)',
                },
              }),
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
            elevation1: {
              boxShadow: mode === 'light'
                ? '0px 4px 20px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0,0,0,0.02)'
                : '0px 4px 20px rgba(0, 0, 0, 0.4)',
            },
            elevation3: {
              boxShadow: mode === 'light'
                ? '0px 8px 30px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0,0,0,0.03)'
                : '0px 8px 30px rgba(0, 0, 0, 0.6)',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backdropFilter: 'blur(8px)',
              backgroundColor: mode === 'light'
                ? alpha('#fffef7', 0.92)
                : alpha('#1e1e1e', 0.9),
              backgroundImage: 'none',
              boxShadow: mode === 'light'
                ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.12)'
                : '0 2px 10px rgba(0,0,0,0.4)',
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundImage: 'none',
              backgroundColor: mode === 'light'
                ? alpha('#fffef7', 0.95)
                : alpha('#1e1e1e', 0.95),
              backdropFilter: 'blur(8px)',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              ...(mode === 'light' && {
                backgroundColor: '#f0f6f5', 
                fontWeight: 600,
                color: '#00695c', 
              }),
              ...(mode === 'dark' && {
                backgroundColor: alpha('#1976d2', 0.2),
                fontWeight: 600,
              }),
            },
            root: {
              borderRight: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.09)' : 'rgba(255, 255, 255, 0.12)'}`,
              borderBottom: `1px solid ${mode === 'light' ? 'rgba(0, 0, 0, 0.09)' : 'rgba(255, 255, 255, 0.12)'}`,
            },
          },
        },
        MuiTable: {
          styleOverrides: {
            root: {
              borderCollapse: 'separate',
              borderSpacing: 0,
            },
          },
        },
      },
    });

    const augmentedTheme = {
      ...baseTheme,
      gradients: {
        primary: createGradient('45deg', baseTheme.palette.primary.main, baseTheme.palette.primary.dark),
        secondary: createGradient('45deg', baseTheme.palette.secondary.main, baseTheme.palette.secondary.dark),
        info: createGradient('45deg', '#26c6da', '#00acc1'),
        success: createGradient('45deg', '#66bb6a', '#43a047'),
        warning: createGradient('45deg', '#ffa726', '#fb8c00'),
        error: createGradient('45deg', '#ef5350', '#e53935'),
      },
      customShadows: {
        primary: `0 8px 16px ${alpha(baseTheme.palette.primary.main, 0.24)}`,
        secondary: `0 8px 16px ${alpha(baseTheme.palette.secondary.main, 0.24)}`,
        info: `0 8px 16px ${alpha('#26c6da', 0.24)}`,
        success: `0 8px 16px ${alpha('#66bb6a', 0.24)}`,
        warning: `0 8px 16px ${alpha('#ffa726', 0.24)}`,
        error: `0 8px 16px ${alpha('#ef5350', 0.24)}`,
      },
      glass: {
        light: `rgba(255, 255, 255, 0.7)`,
        dark: `rgba(30, 30, 30, 0.7)`,
      }
    };

    return responsiveFontSizes(augmentedTheme as any);
  }, [mode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('themeMode')) {
        setMode(e.matches ? 'dark' : 'light');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const contextValue = useMemo(
    () => ({
      mode,
      toggleColorMode,
    }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export default AppThemeProvider; 
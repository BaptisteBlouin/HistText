import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { setCSSCustomProperties } from '../lib/theme-css-utils';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

interface CustomThemeProviderProps {
  children: React.ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
        light: darkMode ? '#bbdefb' : '#42a5f5',
        dark: darkMode ? '#64b5f6' : '#1565c0',
      },
      secondary: {
        main: darkMode ? '#f48fb1' : '#dc004e',
        light: darkMode ? '#ffc1e3' : '#ff5983',
        dark: darkMode ? '#c2185b' : '#ab003c',
      },
      background: {
        default: darkMode ? '#121212' : '#f5f7fa',
        paper: darkMode ? '#1e1e1e' : '#ffffff',
      },
      text: {
        primary: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
        secondary: darkMode ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)',
      },
      divider: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      action: {
        hover: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        selected: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: darkMode 
              ? 'linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(50, 50, 50, 0.8) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(250, 250, 250, 0.8) 100%)',
            backdropFilter: 'blur(10px)',
            border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            backgroundImage: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              backgroundColor: darkMode ? '#2d2d2d' : '#ffffff',
              '& fieldset': {
                borderColor: darkMode ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
              },
              '&:hover fieldset': {
                borderColor: darkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
              },
              '&.Mui-focused fieldset': {
                borderColor: darkMode ? '#90caf9' : '#1976d2',
              },
            },
            '& .MuiInputLabel-root': {
              color: darkMode ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)',
            },
            '& .MuiOutlinedInput-input': {
              color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? '#1e1e1e' : '#fafafa',
            backgroundImage: 'none',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
        },
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'} !important`,
            color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
            '& .MuiDataGrid-main': {
              backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
            },
            '& .MuiDataGrid-virtualScroller': {
              backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
            },
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'} !important`,
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
              backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: darkMode ? '#2d2d2d !important' : '#fafafa !important',
              borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'} !important`,
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
            },
            '& .MuiDataGrid-columnHeader': {
              backgroundColor: darkMode ? '#2d2d2d !important' : '#fafafa !important',
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
              fontWeight: 600,
            },
            '& .MuiDataGrid-row': {
              backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08) !important' : 'rgba(0, 0, 0, 0.04) !important',
              },
              '&.Mui-selected': {
                backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.16) !important' : 'rgba(25, 118, 210, 0.08) !important',
                '&:hover': {
                  backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.24) !important' : 'rgba(25, 118, 210, 0.12) !important',
                },
              },
              '&:nth-of-type(even)': {
                backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
              },
            },
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: darkMode ? '#2d2d2d !important' : '#fafafa !important',
              borderTop: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'} !important`,
            },
            '& .MuiTablePagination-root': {
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
            },
            '& .MuiIconButton-root': {
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.54) !important',
            },
            '& .MuiDataGrid-toolbarContainer': {
              backgroundColor: darkMode ? '#2d2d2d !important' : '#fafafa !important',
              borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'} !important`,
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
            },
            '& .MuiDataGrid-overlay': {
              backgroundColor: darkMode ? '#1e1e1e !important' : '#ffffff !important',
              color: darkMode ? '#ffffff !important' : 'rgba(0, 0, 0, 0.87) !important',
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            '&:hover': {
              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            },
          },
        },
      },
      MuiListItemText: {
        styleOverrides: {
          primary: {
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
          secondary: {
            color: darkMode ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)',
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.54)',
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
          option: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            '&:hover': {
              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            },
            '&[aria-selected="true"]': {
              backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.16)' : 'rgba(25, 118, 210, 0.08)',
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.24)' : 'rgba(25, 118, 210, 0.12)',
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            backgroundColor: darkMode ? '#2d2d2d' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            '&:hover': {
              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            },
            '&.Mui-selected': {
              backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.16)' : 'rgba(25, 118, 210, 0.08)',
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(144, 202, 249, 0.24)' : 'rgba(25, 118, 210, 0.12)',
              },
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            '& .MuiTab-root': {
              color: darkMode ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)',
              '&.Mui-selected': {
                color: darkMode ? '#90caf9' : '#1976d2',
              },
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: darkMode ? '#90caf9' : '#1976d2',
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            color: darkMode ? '#b0b0b0' : 'rgba(0, 0, 0, 0.6)',
            '&.Mui-selected': {
              color: darkMode ? '#90caf9' : '#1976d2',
            },
            '&:hover': {
              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
            },
          },
        },
      },
    },
    transitions: {
      duration: {
        shortest: 150,
        shorter: 200,
        short: 250,
        standard: 300,
        complex: 375,
        enteringScreen: 225,
        leavingScreen: 195,
      },
    },
  });

  // Set CSS custom properties and data attributes whenever theme changes
  useEffect(() => {
    setCSSCustomProperties(theme);
    // Set data attribute for CSS selectors
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    // Also set MUI's color scheme attribute
    document.documentElement.setAttribute('data-mui-color-scheme', darkMode ? 'dark' : 'light');
  }, [theme, darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
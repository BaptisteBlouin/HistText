import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

interface AdminThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined);

export const useAdminTheme = () => {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return context;
};

interface AdminThemeProviderProps {
  children: ReactNode;
}

export const AdminThemeProvider: React.FC<AdminThemeProviderProps> = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('adminDarkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('adminDarkMode', JSON.stringify(newMode));
  };

  const adminTheme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: darkMode ? '#90caf9' : '#1976d2',
        light: darkMode ? '#bbdefb' : '#42a5f5',
        dark: darkMode ? '#64b5f6' : '#1565c0',
      },
      secondary: {
        main: darkMode ? '#f48fb1' : '#dc004e',
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
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            backgroundImage: 'none',
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
      MuiDataGrid: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
            border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'}`,
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'}`,
              color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: darkMode ? '#2d2d2d' : '#fafafa',
              borderBottom: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'}`,
              color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
              fontWeight: 600,
            },
            '& .MuiDataGrid-row': {
              '&:hover': {
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              },
              '&.Mui-selected': {
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(25, 118, 210, 0.08)',
                '&:hover': {
                  backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(25, 118, 210, 0.12)',
                },
              },
            },
            '& .MuiDataGrid-footerContainer': {
              backgroundColor: darkMode ? '#2d2d2d' : '#fafafa',
              borderTop: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(224, 224, 224, 1)'}`,
            },
            '& .MuiTablePagination-root': {
              color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            },
            '& .MuiIconButton-root': {
              color: darkMode ? '#ffffff' : 'rgba(0, 0, 0, 0.54)',
            },
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
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            backgroundColor: darkMode ? '#2d2d2d' : undefined,
            color: darkMode ? '#ffffff' : undefined,
          },
        },
      },
    },
  });

  return (
    <AdminThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <ThemeProvider theme={adminTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AdminThemeContext.Provider>
  );
};
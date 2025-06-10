import { Theme } from '@mui/material/styles';

/**
 * Sets CSS custom properties on the document root based on the current Material-UI theme.
 * This allows legacy CSS files to use theme-aware colors.
 */
export const setCSSCustomProperties = (theme: Theme) => {
  const root = document.documentElement;
  
  // Text colors
  root.style.setProperty('--text-primary', theme.palette.text.primary);
  root.style.setProperty('--text-secondary', theme.palette.text.secondary);
  
  // Background colors
  root.style.setProperty('--background-default', theme.palette.background.default);
  root.style.setProperty('--background-paper', theme.palette.background.paper);
  
  // Primary colors
  root.style.setProperty('--primary-main', theme.palette.primary.main);
  root.style.setProperty('--primary-light', theme.palette.primary.light);
  root.style.setProperty('--primary-dark', theme.palette.primary.dark);
  
  // Border and divider colors
  root.style.setProperty('--border-color', theme.palette.divider);
  root.style.setProperty('--border-hover', theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : '#cbd5e0');
  
  // Action colors
  root.style.setProperty('--action-hover', theme.palette.action.hover);
  root.style.setProperty('--action-selected', theme.palette.action.selected);
  
  // Shadow colors
  root.style.setProperty('--shadow-color', theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)');
  
  // Primary glow effect for focus states
  root.style.setProperty('--primary-glow', theme.palette.mode === 'dark' 
    ? 'rgba(144, 202, 249, 0.5)' 
    : 'rgba(0, 123, 255, 0.5)'
  );
  
  // Error colors
  root.style.setProperty('--error-main', theme.palette.error.main);
  root.style.setProperty('--error-light', theme.palette.error.light);
  
  // Success colors
  root.style.setProperty('--success-main', theme.palette.success.main);
  root.style.setProperty('--success-light', theme.palette.success.light);
  
  // Warning colors
  root.style.setProperty('--warning-main', theme.palette.warning.main);
  root.style.setProperty('--warning-light', theme.palette.warning.light);
  
  // Info colors
  root.style.setProperty('--info-main', theme.palette.info.main);
  root.style.setProperty('--info-light', theme.palette.info.light);
};
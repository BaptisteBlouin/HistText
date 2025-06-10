import { useTheme, useMediaQuery } from '@mui/material';

/**
 * Custom hook for comprehensive responsive design
 * Provides multiple breakpoint checks for granular responsive control
 */
export const useResponsive = () => {
  const theme = useTheme();
  
  const isXs = useMediaQuery(theme.breakpoints.only('xs')); // 0-600px
  const isSm = useMediaQuery(theme.breakpoints.only('sm')); // 600-900px
  const isMd = useMediaQuery(theme.breakpoints.only('md')); // 900-1200px
  const isLg = useMediaQuery(theme.breakpoints.only('lg')); // 1200-1536px
  const isXl = useMediaQuery(theme.breakpoints.only('xl')); // 1536px+
  
  // Enhanced mobile detection for very small screens
  const isVerySmallMobile = useMediaQuery('(max-width:480px)'); // Very small phones
  const isSmallMobile = useMediaQuery('(max-width:600px)'); // Small phones
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // <600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // 600-900px
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // >900px
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >1200px
  
  // Legacy support for existing isMobile pattern
  const isMobileOld = useMediaQuery(theme.breakpoints.down('md')); // <900px (current pattern)
  
  return {
    // Specific breakpoints
    isXs,
    isSm, 
    isMd,
    isLg,
    isXl,
    
    // Enhanced mobile detection
    isVerySmallMobile,
    isSmallMobile,
    
    // Semantic breakpoints
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    
    // Legacy support
    isMobileOld,
    
    // Device orientation helpers
    isPortrait: useMediaQuery('(orientation: portrait)'),
    isLandscape: useMediaQuery('(orientation: landscape)'),
    
    // Utility functions
    getGridColumns: () => {
      if (isMobile) return 1;
      if (isTablet) return 2;
      if (isDesktop) return 3;
      return 4;
    },
    
    getSidebarWidth: () => {
      if (isVerySmallMobile) return '100%';
      if (isMobile) return '100%';
      if (isTablet) return '300px';
      return '350px';
    },
    
    getModalWidth: () => {
      if (isMobile) return '100%';
      if (isTablet) return '90%';
      return 'md';
    },
    
    getPaginationSize: () => {
      if (isMobile) return 25;
      if (isTablet) return 50;
      return 100;
    },
    
    getCardPadding: () => {
      if (isMobile) return 2;
      if (isTablet) return 3;
      return 4;
    }
  };
};

/**
 * Responsive spacing helper
 * Returns spacing values based on screen size
 */
export const getResponsiveSpacing = (mobile: number, tablet: number, desktop: number) => {
  const { isMobile, isTablet } = useResponsive();
  
  if (isMobile) return mobile;
  if (isTablet) return tablet;
  return desktop;
};

/**
 * Responsive font size helper
 */
export const getResponsiveFontSize = (base: string) => {
  const { isMobile } = useResponsive();
  const sizes: Record<string, string> = {
    '2.5rem': isMobile ? '2rem' : '2.5rem',
    '2rem': isMobile ? '1.75rem' : '2rem',
    '1.75rem': isMobile ? '1.5rem' : '1.75rem',
    '1.5rem': isMobile ? '1.25rem' : '1.5rem',
    '1.25rem': isMobile ? '1.125rem' : '1.25rem',
    '1.125rem': isMobile ? '1rem' : '1.125rem',
  };
  
  return sizes[base] || base;
};

/**
 * Responsive grid columns helper for Material-UI Grid
 */
export const getResponsiveGridProps = (
  xs: number = 12,
  sm: number = 6,
  md: number = 4,
  lg: number = 3,
  xl: number = 2
) => ({
  xs,
  sm,
  md,
  lg,
  xl,
});

/**
 * Common responsive breakpoint values
 */
export const RESPONSIVE_BREAKPOINTS = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
} as const;

/**
 * Common responsive component variants
 */
export const RESPONSIVE_VARIANTS = {
  sidebar: {
    mobile: { width: '100%', height: 'auto' },
    tablet: { width: '300px', height: '80vh' },
    desktop: { width: '350px', height: '80vh' },
  },
  modal: {
    mobile: { fullScreen: true, margin: 0 },
    tablet: { fullScreen: false, margin: 2, maxWidth: '90%' },
    desktop: { fullScreen: false, margin: 4, maxWidth: 'md' },
  },
  dataGrid: {
    mobile: { pageSize: 25, height: '50vh' },
    tablet: { pageSize: 50, height: '60vh' },
    desktop: { pageSize: 100, height: '70vh' },
  },
} as const;
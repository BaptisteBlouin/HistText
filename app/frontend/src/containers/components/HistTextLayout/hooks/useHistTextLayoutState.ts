import { useMemo } from 'react';

export const useHistTextLayoutState = (fullscreenState: any) => {
  const containerConfig = useMemo(() => ({
    maxWidth: fullscreenState.isAnyFullscreen ? false : "xl" as const,
    sx: {
      py: fullscreenState.isAnyFullscreen ? 1 : 3,
      height: fullscreenState.isAnyFullscreen ? '100vh' : 'auto',
      maxWidth: fullscreenState.isAnyFullscreen ? '100%' : undefined,
      px: fullscreenState.isAnyFullscreen ? 1 : 3,
      display: 'flex',
      flexDirection: 'column' as const
    }
  }), [fullscreenState.isAnyFullscreen]);

  const paperStyles = useMemo(() => {
    const baseStyles = {
      width: '100%',
      bgcolor: 'background.paper',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
    };

    switch (fullscreenState.isAnyFullscreen) {
      case true:
        if (fullscreenState.isBrowserFullscreen) {
          return {
            ...baseStyles,
            borderRadius: 0,
            boxShadow: 'none',
            height: '100vh',
            minHeight: '100vh',
          };
        } else {
          return {
            ...baseStyles,
            borderRadius: fullscreenState.isNativeFullscreen ? 0 : 3,
            boxShadow: fullscreenState.isNativeFullscreen ? 'none' : '0 4px 20px rgba(0,0,0,0.1)',
            height: fullscreenState.isNativeFullscreen ? '100vh' : 'auto',
            minHeight: fullscreenState.isNativeFullscreen ? '100vh' : '60vh',
          };
        }
      default:
        return {
          ...baseStyles,
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          minHeight: '60vh',
        };
    }
  }, [fullscreenState]);

  return {
    containerConfig,
    paperStyles
  };
};
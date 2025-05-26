import React from 'react';
import { Box, BoxProps } from '@mui/material';

export type FullscreenMode = 'normal' | 'browser' | 'native';

interface FullscreenContainerProps extends BoxProps {
  fullscreenMode: FullscreenMode;
  isNativeFullscreen?: boolean;
}

const FullscreenContainer: React.FC<FullscreenContainerProps> = ({
  fullscreenMode,
  isNativeFullscreen = false,
  children,
  sx,
  ...props
}) => {
  const getContainerStyles = () => {
    const baseStyles = {
      width: '100%',
      bgcolor: 'background.default',
      position: 'relative' as const,
    };

    switch (fullscreenMode) {
      case 'browser':
        return {
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'background.default',
          zIndex: 9998,
          overflow: 'auto',
        };
      case 'native':
        return {
          ...baseStyles,
          minHeight: '100vh',
          ...(isNativeFullscreen && {
            position: 'fixed' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            overflow: 'auto'
          })
        };
      default:
        return {
          ...baseStyles,
          minHeight: '100vh',
        };
    }
  };

  return (
    <Box
      {...props}
      sx={{
        ...getContainerStyles(),
        ...sx
      }}
    >
      {children}
    </Box>
  );
};

export default React.memo(FullscreenContainer);
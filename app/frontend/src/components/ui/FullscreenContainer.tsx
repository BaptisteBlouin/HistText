import React from "react";
import { Box, BoxProps } from "@mui/material";

/**
 * Fullscreen display mode types:
 * - 'normal': Standard in-page container.
 * - 'browser': Fills browser viewport using fixed positioning.
 * - 'native': Native fullscreen (via browser API, if available).
 */
export type FullscreenMode = "normal" | "browser" | "native";

/**
 * Props for FullscreenContainer.
 * - `fullscreenMode`: Controls the type of fullscreen effect.
 * - `isNativeFullscreen`: Indicates if the browser is currently in native fullscreen mode.
 * - All BoxProps supported.
 */
interface FullscreenContainerProps extends BoxProps {
  fullscreenMode: FullscreenMode;
  isNativeFullscreen?: boolean;
}

/**
 * A flexible container that adapts to fullscreen scenarios.
 * Supports "browser" (CSS fullscreen), "native" (browser API), and normal modes.
 */
const FullscreenContainer: React.FC<FullscreenContainerProps> = ({
  fullscreenMode,
  isNativeFullscreen = false,
  children,
  sx,
  ...props
}) => {
  /**
   * Returns the container styles depending on fullscreen mode and native fullscreen state.
   */
  const getContainerStyles = () => {
    const baseStyles = {
      width: "100%",
      bgcolor: "background.default",
      position: "relative" as const,
    };

    switch (fullscreenMode) {
      case "browser":
        return {
          position: "fixed" as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: "background.default",
          zIndex: 9998,
          overflow: "auto",
        };
      case "native":
        return {
          ...baseStyles,
          minHeight: "100vh",
          ...(isNativeFullscreen && {
            position: "fixed" as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            overflow: "auto",
          }),
        };
      default:
        return {
          ...baseStyles,
          minHeight: "100vh",
        };
    }
  };

  return (
    <Box
      {...props}
      sx={{
        ...getContainerStyles(),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default React.memo(FullscreenContainer);

import React from "react";
import { Paper, PaperProps, useTheme } from "@mui/material";

/**
 * Props for GradientPaper component.
 * - `gradient`: Name of the gradient background to use.
 * - `direction`: Angle (in degrees) for the gradient direction (defaults to 135).
 * - All MUI PaperProps supported.
 */
interface GradientPaperProps extends PaperProps {
  gradient?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  direction?: number;
}

/**
 * Creates theme-aware gradient backgrounds.
 */
const createGradients = (theme: any) => {
  const isDark = theme.palette.mode === 'dark';
  
  return {
    primary: isDark 
      ? "linear-gradient(135deg, #424242 0%, #303030 100%)"
      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    secondary: isDark 
      ? "linear-gradient(135deg, #4a4a4a 0%, #2d2d2d 100%)"
      : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    success: isDark 
      ? "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)"
      : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    warning: isDark 
      ? "linear-gradient(135deg, #f57c00 0%, #e65100 100%)"
      : "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    error: isDark 
      ? "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)"
      : "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    info: isDark 
      ? "linear-gradient(135deg, #0288d1 0%, #01579b 100%)"
      : "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  };
};

/**
 * A Paper component with an optional gradient background.
 * Use the `gradient` prop to select a predefined background gradient.
 */
const GradientPaper: React.FC<GradientPaperProps> = ({
  gradient,
  direction = 135,
  sx,
  ...props
}) => {
  const theme = useTheme();
  const gradients = createGradients(theme);
  
  const gradientStyle = gradient
    ? {
        background: gradients[gradient],
      }
    : {};

  return (
    <Paper
      {...props}
      sx={{
        ...gradientStyle,
        ...sx,
      }}
    />
  );
};

export default React.memo(GradientPaper);

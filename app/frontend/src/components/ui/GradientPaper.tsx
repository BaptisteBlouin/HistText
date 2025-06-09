import React from "react";
import { Paper, PaperProps, alpha } from "@mui/material";

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
 * Preset linear gradient backgrounds, keyed by theme color name.
 */
const GRADIENTS = {
  primary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  success: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  warning: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  error: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  info: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
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
  const gradientStyle = gradient
    ? {
        background: GRADIENTS[gradient],
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

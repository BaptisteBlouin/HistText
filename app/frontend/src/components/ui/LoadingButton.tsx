import React from "react";
import { Button, CircularProgress, ButtonProps } from "@mui/material";

/**
 * Props for LoadingButton component.
 * - `loading`: If true, shows loading spinner and disables button.
 * - `loadingText`: Text to display while loading (overrides children).
 * - All MUI ButtonProps supported.
 */
interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

/**
 * A Button that shows a spinner and optionally custom text when loading.
 * - Disables itself while loading.
 * - Shows a CircularProgress in the startIcon position.
 */
const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText,
  children,
  disabled,
  startIcon,
  ...props
}) => {
  return (
    <Button
      {...props}
      disabled={disabled || loading}
      startIcon={loading ? <CircularProgress size={16} /> : startIcon}
    >
      {loading && loadingText ? loadingText : children}
    </Button>
  );
};

export default React.memo(LoadingButton);

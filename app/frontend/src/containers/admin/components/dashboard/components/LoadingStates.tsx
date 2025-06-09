import React from "react";
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Button,
} from "@mui/material";

/**
 * Props for LoadingWrapper component.
 * - `loading`: If true, shows loading indicator.
 * - `error`: Error message to display, if any.
 * - `onRetry`: Callback to retry after error.
 * - `children`: Content to display when not loading or in error.
 */
interface LoadingProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}

/**
 * A wrapper that handles loading and error states.
 * - Shows a spinner while loading.
 * - Shows an error alert with retry on error.
 * - Shows children if neither loading nor error.
 */
export const LoadingWrapper: React.FC<LoadingProps> = ({
  loading,
  error,
  onRetry,
  children,
}) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          py: 8,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return <>{children}</>;
};

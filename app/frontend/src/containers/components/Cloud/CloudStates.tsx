import React from "react";
import { Box, Typography, LinearProgress } from "@mui/material";
import {
  CloudQueue,
  AutorenewRounded,
  Cloud as CloudIcon,
} from "@mui/icons-material";

/**
 * Props for the CloudLoadingState component.
 */
interface CloudLoadingStateProps {
  /** Progress value (0-100) for the loading bar. */
  progress: number;
}

/**
 * Displays a loading state with animated icon and a progress bar.
 *
 * @param props - CloudLoadingStateProps
 * @returns Loading UI element for word cloud generation.
 */
export const CloudLoadingState: React.FC<CloudLoadingStateProps> = ({
  progress,
}) => {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <AutorenewRounded sx={{ animation: "spin 2s linear infinite" }} />
        <Typography variant="h6">Generating Word Cloud...</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          mb: 2,
          height: 8,
          borderRadius: 4,
          "& .MuiLinearProgress-bar": {
            background: "linear-gradient(90deg, #667eea, #764ba2)",
          },
        }}
      />
      <Typography variant="body2" color="text.secondary">
        {progress.toFixed(0)}% complete • Processing text data
      </Typography>
    </Box>
  );
};

/**
 * Displays an empty state message and icon when there is no word cloud data.
 *
 * @returns Empty state UI element for word cloud visualizations.
 */
export const CloudEmptyState: React.FC = () => {
  return (
    <Box sx={{ textAlign: "center", py: 8 }}>
      <CloudQueue
        sx={{ fontSize: 80, color: "text.secondary", mb: 2, opacity: 0.5 }}
      />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No Word Cloud Data
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Execute a query with text data to generate a word cloud visualization
      </Typography>
    </Box>
  );
};

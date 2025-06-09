import React from "react";
import { Box, Typography, IconButton, Tooltip, Badge } from "@mui/material";
import {
  CloudQueue,
  Animation,
  Search,
  Palette,
  Fullscreen,
  Tune,
} from "@mui/icons-material";
import { Zoom } from "@mui/material";

/**
 * Props for the CloudHeader component.
 */
interface CloudHeaderProps {
  /** Is the cloud currently animating (for animated icon)? */
  isAnimating: boolean;
  /** Word cloud stats object (see useCloudData stats) */
  stats: any;
  /** Current search term for highlighting/search badge */
  searchTerm: string;
  /** Whether controls are visible */
  showControls: boolean;
  /** Handler to toggle search/controls */
  onToggleControls: () => void;
  /** Handler to shuffle color scheme */
  onShuffleColors: () => void;
  /** Handler to toggle fullscreen mode */
  onToggleFullscreen: () => void;
  /** Handler to open settings */
  onToggleSettings: () => void;
}

/**
 * CloudHeader displays the main title, animated state, summary statistics,
 * and action buttons for searching, color shuffle, fullscreen, and settings.
 *
 * @param props - CloudHeaderProps
 * @returns Header element for the word cloud interface.
 */
const CloudHeader: React.FC<CloudHeaderProps> = ({
  isAnimating,
  stats,
  searchTerm,
  showControls,
  onToggleControls,
  onShuffleColors,
  onToggleFullscreen,
  onToggleSettings,
}) => {
  return (
    <Box
      sx={{
        mb: 3,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      <Box>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CloudQueue />
          Interactive Word Cloud
          {isAnimating && (
            <Zoom in={isAnimating}>
              <Animation color="primary" />
            </Zoom>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {stats && (
            <>
              {stats.totalWords} words
              {stats.chineseWords > 0 &&
                ` (${stats.chineseWords} Chinese, ${stats.englishWords} English)`}
              • Max: {stats.maxFrequency} • Avg: {stats.avgFrequency}
              {stats.searchResults && ` • Found: ${stats.searchResults}`}
            </>
          )}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Tooltip title="Search Words">
          <IconButton onClick={onToggleControls}>
            <Badge badgeContent={searchTerm ? "!" : 0} color="primary">
              <Search />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title="Shuffle Colors">
          <IconButton onClick={onShuffleColors} color="primary">
            <Palette />
          </IconButton>
        </Tooltip>

        <Tooltip title="Toggle Fullscreen">
          <IconButton onClick={onToggleFullscreen}>
            <Fullscreen />
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton onClick={onToggleSettings}>
            <Tune />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default React.memo(CloudHeader);

import React, { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Tooltip,
  Chip,
} from "@mui/material";
import {
  MoreVert,
  Refresh,
  Schedule,
  Pause,
  PlayArrow,
  Settings,
  Speed,
} from "@mui/icons-material";

/**
 * Props for RefreshController component.
 * - `onRefreshAll`: Handler to trigger refresh of all dashboard data.
 * - `autoRefresh`: Current auto-refresh state.
 * - `onAutoRefreshToggle`: Handler for toggling auto-refresh.
 * - `refreshInterval`: Auto-refresh interval (ms).
 * - `onRefreshIntervalChange`: Handler to change interval (ms).
 * - `isRefreshing`: True if currently refreshing.
 */
interface RefreshControllerProps {
  onRefreshAll: () => void;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  isRefreshing: boolean;
}

/**
 * Controls manual and auto-refresh of dashboard data.
 * Offers a menu to toggle auto-refresh and adjust the interval.
 * Shows visual status and handles all refresh actions.
 */
export const RefreshController: React.FC<RefreshControllerProps> = ({
  onRefreshAll,
  autoRefresh,
  onAutoRefreshToggle,
  refreshInterval,
  onRefreshIntervalChange,
  isRefreshing,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [intervalSlider, setIntervalSlider] = useState(refreshInterval / 1000);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * Updates the refresh interval slider and triggers parent callback.
   */
  const handleIntervalChange = (value: number | number[]) => {
    const newInterval = Array.isArray(value) ? value[0] : value;
    setIntervalSlider(newInterval);
    onRefreshIntervalChange(newInterval * 1000);
  };

  /**
   * Formats seconds into a human-readable string.
   */
  const formatInterval = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {/* Auto-refresh status */}
      {autoRefresh && (
        <Chip
          icon={<Schedule />}
          label={`Auto: ${formatInterval(refreshInterval / 1000)}`}
          color="success"
          size="small"
          variant="outlined"
        />
      )}

      {/* Manual refresh button */}
      <Tooltip title="Refresh All Data">
        <IconButton
          onClick={onRefreshAll}
          color="primary"
          disabled={isRefreshing}
        >
          <Refresh
            sx={{
              animation: isRefreshing ? "spin 1s linear infinite" : "none",
              "@keyframes spin": {
                "0%": { transform: "rotate(0deg)" },
                "100%": { transform: "rotate(360deg)" },
              },
            }}
          />
        </IconButton>
      </Tooltip>

      {/* Settings menu */}
      <IconButton onClick={handleMenuOpen} size="small">
        <MoreVert />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { minWidth: 280 },
        }}
      >
        <MenuItem>
          <ListItemIcon>{autoRefresh ? <Pause /> : <PlayArrow />}</ListItemIcon>
          <ListItemText>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={onAutoRefreshToggle}
                  size="small"
                />
              }
              label="Auto Refresh"
            />
          </ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem disabled={!autoRefresh}>
          <ListItemIcon>
            <Speed />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" gutterBottom>
              Refresh Interval: {formatInterval(intervalSlider)}
            </Typography>
            <Slider
              value={intervalSlider}
              onChange={(_, value) => handleIntervalChange(value)}
              min={10}
              max={300}
              step={10}
              marks={[
                { value: 10, label: "10s" },
                { value: 30, label: "30s" },
                { value: 60, label: "1m" },
                { value: 180, label: "3m" },
                { value: 300, label: "5m" },
              ]}
              disabled={!autoRefresh}
              sx={{ mt: 1 }}
            />
          </ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

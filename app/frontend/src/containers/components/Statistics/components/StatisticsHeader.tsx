import React from "react";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
  Stack,
  FormControlLabel,
  Switch,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  KeyboardArrowLeft,
  KeyboardArrowRight,
  GetApp,
  Download,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { getStatDisplayName } from "../utils/chartUtils";

interface StatisticsHeaderProps {
  selectedStat: string;
  rowDataLength: number;
  navigationInfo: {
    currentIndex: number;
    isFirst: boolean;
    isLast: boolean;
    total: number;
    hasNavigation: boolean;
  };
  shouldDisplayChart: boolean;
  showChart: boolean;
  onNavigate: (direction: "next" | "prev") => void;
  onDownloadCsv: () => void;
  onDownloadChart: () => void;
  onToggleChart: (show: boolean) => void;
}

const StatisticsHeader: React.FC<StatisticsHeaderProps> = ({
  selectedStat,
  rowDataLength,
  navigationInfo,
  shouldDisplayChart,
  showChart,
  onNavigate,
  onDownloadCsv,
  onDownloadChart,
  onToggleChart,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 600, color: "primary.main" }}
            >
              {getStatDisplayName(selectedStat)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {rowDataLength} data points available
              {navigationInfo.hasNavigation && (
                <>
                  {" "}
                  • {navigationInfo.currentIndex + 1} of {navigationInfo.total}
                </>
              )}
            </Typography>
          </Box>

          {/* Navigation Controls */}
          {navigationInfo.hasNavigation && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip title="Previous statistic (←)">
                <IconButton
                  onClick={() => onNavigate("prev")}
                  disabled={navigationInfo.isFirst}
                  size="small"
                  sx={{
                    bgcolor: "primary.light",
                    color: "white",
                    "&:hover": { bgcolor: "primary.main" },
                    "&:disabled": { bgcolor: "grey.300", color: "grey.500" },
                  }}
                >
                  <KeyboardArrowLeft />
                </IconButton>
              </Tooltip>

              <Typography
                variant="caption"
                sx={{ px: 1, color: "text.secondary" }}
              >
                {navigationInfo.currentIndex + 1}/{navigationInfo.total}
              </Typography>

              <Tooltip title="Next statistic (→)">
                <IconButton
                  onClick={() => onNavigate("next")}
                  disabled={navigationInfo.isLast}
                  size="small"
                  sx={{
                    bgcolor: "primary.light",
                    color: "white",
                    "&:hover": { bgcolor: "primary.main" },
                    "&:disabled": { bgcolor: "grey.300", color: "grey.500" },
                  }}
                >
                  <KeyboardArrowRight />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          {shouldDisplayChart && (
            <FormControlLabel
              control={
                <Switch
                  checked={showChart}
                  onChange={(e) => onToggleChart(e.target.checked)}
                  icon={<VisibilityOff />}
                  checkedIcon={<Visibility />}
                />
              }
              label="Chart View"
            />
          )}
          <ButtonGroup variant="outlined" size="small">
            <Tooltip title="Download Data">
              <Button onClick={onDownloadCsv} startIcon={<GetApp />}>
                CSV
              </Button>
            </Tooltip>
            {shouldDisplayChart && showChart && (
              <Tooltip title="Download Chart">
                <Button onClick={onDownloadChart} startIcon={<Download />}>
                  PNG
                </Button>
              </Tooltip>
            )}
          </ButtonGroup>
        </Stack>
      </Box>

      {/* Keyboard Navigation Hint */}
      {navigationInfo.hasNavigation && !isMobile && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: "info.light",
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="caption" color="info.contrastText">
            💡 Use arrow keys (← →) to navigate between statistics
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default React.memo(StatisticsHeader);

import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  FormControlLabel,
  Switch,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Box,
  Chip,
  Alert,
  Divider,
} from "@mui/material";
import { 
  Settings, 
  Psychology, 
  Download, 
  Analytics, 
  InfoOutlined,
  ExpandMore,
  ExpandLess 
} from "@mui/icons-material";
import config from "../../../../../config.json";

/**
 * Stats level type, defined by config.
 */
type StatsLevel = (typeof config.statsLevelOptions)[number];
/**
 * Document level type, defined by config.
 */
type DocLevel = (typeof config.docLevelOptions)[number];

/**
 * Props for the QueryOptions component.
 *
 * @property getNER - Whether to enable named entity recognition.
 * @property setGetNER - Setter for NER switch.
 * @property downloadOnly - Whether to enable download-only mode.
 * @property setDownloadOnly - Setter for download-only switch.
 * @property statsOnly - Whether to compute only statistics without fetching documents.
 * @property setStatsOnly - Setter for stats-only switch.
 * @property statsLevel - Current selected statistics level.
 * @property setStatsLevel - Setter for statistics level.
 * @property docLevel - Current selected document limit.
 * @property setDocLevel - Setter for document limit.
 * @property showAdvanced - Whether advanced options are shown.
 * @property setShowAdvanced - Setter for advanced options visibility.
 * @property showNER - Whether to show the NER option (based on collection availability).
 */
interface QueryOptionsProps {
  getNER: boolean;
  setGetNER: (value: boolean) => void;
  downloadOnly: boolean;
  setDownloadOnly: (value: boolean) => void;
  statsOnly: boolean;
  setStatsOnly: (value: boolean) => void;
  statsLevel: StatsLevel;
  setStatsLevel: (value: StatsLevel) => void;
  docLevel: DocLevel;
  setDocLevel: (value: DocLevel) => void;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
  showNER?: boolean;
}

/**
 * Renders query options including toggles for NER, download-only mode, stats-only mode,
 * and (optionally) advanced controls for statistics/document levels.
 */
const QueryOptions: React.FC<QueryOptionsProps> = ({
  getNER,
  setGetNER,
  downloadOnly,
  setDownloadOnly,
  statsOnly,
  setStatsOnly,
  statsLevel,
  setStatsLevel,
  docLevel,
  setDocLevel,
  showAdvanced,
  setShowAdvanced,
  showNER = true,
}) => {
  return (
    <Card variant="outlined" sx={{ mb: 3, overflow: "visible" }}>
      <CardContent sx={{ pb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.main" }}>
            Query Options
          </Typography>
          <Button
            startIcon={<Settings />}
            endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
            onClick={() => setShowAdvanced(!showAdvanced)}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Advanced
          </Button>
        </Box>

        {/* Main Options */}
        <Grid container spacing={3}>
          {showNER && (
            <Grid item xs={12} sm={6} md={4}>
              <Box 
                onClick={() => !statsOnly && setGetNER(!getNER)}
                sx={{ 
                  p: 2, 
                  border: 1, 
                  borderColor: "divider", 
                  borderRadius: 2,
                  bgcolor: (theme) => getNER ? 
                    (theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.50') : 
                    (theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50'),
                  transition: "all 0.2s ease-in-out",
                  cursor: statsOnly ? "not-allowed" : "pointer",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.50',
                    transform: !statsOnly ? "translateY(-2px)" : "none",
                    boxShadow: !statsOnly ? 2 : "none"
                  }
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <Psychology sx={{ color: "primary.main", mr: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Named Entity Recognition
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                  Extract Named Entities
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={getNER}
                      onChange={(e) => setGetNER(e.target.checked)}
                      color="primary"
                      disabled={statsOnly}
                      size="small"
                    />
                  }
                  label={getNER ? "Enabled" : "Disabled"}
                  sx={{ 
                    m: 0,
                    pointerEvents: "none" // Prevent double-clicking on the switch itself
                  }}
                />
              </Box>
            </Grid>
          )}
          
          {!showNER && (
            <Grid item xs={12}>
              <Alert 
                severity="info" 
                icon={<InfoOutlined />}
                sx={{ 
                  borderRadius: 2,
                  "& .MuiAlert-message": {
                    display: "flex",
                    alignItems: "center",
                    gap: 1
                  }
                }}
              >
                <Psychology sx={{ fontSize: 18 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Named Entity Recognition unavailable
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    No precomputed NER data found for this collection
                  </Typography>
                </Box>
              </Alert>
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={showNER ? 4 : 6}>
            <Box 
              onClick={() => !statsOnly && setDownloadOnly(!downloadOnly)}
              sx={{ 
                p: 2, 
                border: 1, 
                borderColor: "divider", 
                borderRadius: 2,
                bgcolor: (theme) => downloadOnly ? 
                  (theme.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.50') : 
                  (theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50'),
                transition: "all 0.2s ease-in-out",
                cursor: statsOnly ? "not-allowed" : "pointer",
                "&:hover": {
                  borderColor: "secondary.main",
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.50',
                  transform: !statsOnly ? "translateY(-2px)" : "none",
                  boxShadow: !statsOnly ? 2 : "none"
                }
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Download sx={{ color: "secondary.main", mr: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Download Only
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Skip search interface, generate CSV directly
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={downloadOnly}
                    onChange={(e) => setDownloadOnly(e.target.checked)}
                    color="secondary"
                    disabled={statsOnly}
                    size="small"
                  />
                }
                label={downloadOnly ? "Enabled" : "Disabled"}
                sx={{ 
                  m: 0,
                  pointerEvents: "none" // Prevent double-clicking on the switch itself
                }}
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={showNER ? 4 : 6}>
            <Box 
              onClick={() => setStatsOnly(!statsOnly)}
              sx={{ 
                p: 2, 
                border: 1, 
                borderColor: "divider", 
                borderRadius: 2,
                bgcolor: (theme) => statsOnly ? 
                  (theme.palette.mode === 'dark' ? 'info.dark' : 'info.50') : 
                  (theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50'),
                transition: "all 0.2s ease-in-out",
                cursor: "pointer",
                "&:hover": {
                  borderColor: "info.main",
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'info.dark' : 'info.50',
                  transform: "translateY(-2px)",
                  boxShadow: 2
                }
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <Analytics sx={{ color: "info.main", mr: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Statistics Only
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                Generate statistics without document results
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={statsOnly}
                    onChange={(e) => setStatsOnly(e.target.checked)}
                    color="info"
                    size="small"
                  />
                }
                label={statsOnly ? "Enabled" : "Disabled"}
                sx={{ 
                  m: 0,
                  pointerEvents: "none" // Prevent double-clicking on the switch itself
                }}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Advanced Options - Always Visible */}
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }}>
            <Chip label="Advanced Settings" size="small" />
          </Divider>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Statistics Level</InputLabel>
                <Select
                  value={statsLevel}
                  label="Statistics Level"
                  onChange={(e) =>
                    setStatsLevel(e.target.value as StatsLevel)
                  }
                  sx={{ borderRadius: 2 }}
                >
                  {config.statsLevelOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Document Limit</InputLabel>
                <Select
                  value={docLevel}
                  label="Document Limit"
                  onChange={(e) => setDocLevel(e.target.value as DocLevel)}
                  sx={{ borderRadius: 2 }}
                >
                  {config.docLevelOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(QueryOptions);

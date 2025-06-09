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
} from "@mui/material";
import { Settings } from "@mui/icons-material";
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
}) => {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="subtitle2">Query Options</Typography>
          <Button
            startIcon={<Settings />}
            onClick={() => setShowAdvanced(!showAdvanced)}
            size="small"
          >
            {showAdvanced ? "Hide" : "Show"} Advanced
          </Button>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={getNER}
                  onChange={(e) => setGetNER(e.target.checked)}
                  color="primary"
                  disabled={statsOnly}
                />
              }
              label="Named Entity Recognition"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={downloadOnly}
                  onChange={(e) => setDownloadOnly(e.target.checked)}
                  color="secondary"
                  disabled={statsOnly}
                />
              }
              label="Download Only"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={statsOnly}
                  onChange={(e) => setStatsOnly(e.target.checked)}
                  color="info"
                />
              }
              label="Statistics Only"
            />
          </Grid>

          <Collapse in={showAdvanced} sx={{ width: "100%" }}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Statistics Level</InputLabel>
                  <Select
                    value={statsLevel}
                    label="Statistics Level"
                    onChange={(e) =>
                      setStatsLevel(e.target.value as StatsLevel)
                    }
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
          </Collapse>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default React.memo(QueryOptions);

import React from 'react';
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
  Box
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import config from '../../../../../config.json';

type StatsLevel = (typeof config.statsLevelOptions)[number];
type DocLevel = (typeof config.docLevelOptions)[number];

interface QueryOptionsProps {
  getNER: boolean;
  setGetNER: (value: boolean) => void;
  downloadOnly: boolean;
  setDownloadOnly: (value: boolean) => void;
  statsLevel: StatsLevel;
  setStatsLevel: (value: StatsLevel) => void;
  docLevel: DocLevel;
  setDocLevel: (value: DocLevel) => void;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
}

const QueryOptions: React.FC<QueryOptionsProps> = ({
  getNER,
  setGetNER,
  downloadOnly,
  setDownloadOnly,
  statsLevel,
  setStatsLevel,
  docLevel,
  setDocLevel,
  showAdvanced,
  setShowAdvanced
}) => {
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2">
            Query Options
          </Typography>
          <Button
            startIcon={<Settings />}
            onClick={() => setShowAdvanced(!showAdvanced)}
            size="small"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch 
                  checked={getNER} 
                  onChange={e => setGetNER(e.target.checked)}
                  color="primary"
                />
              }
              label="Named Entity Recognition"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={downloadOnly}
                  onChange={e => setDownloadOnly(e.target.checked)}
                  color="secondary"
                />
              }
              label="Download Only"
            />
          </Grid>

          <Collapse in={showAdvanced} sx={{ width: '100%' }}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Statistics Level</InputLabel>
                  <Select
                    value={statsLevel}
                    label="Statistics Level"
                    onChange={(e) => setStatsLevel(e.target.value as StatsLevel)}
                  >
                    {config.statsLevelOptions.map(option => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
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
                    {config.docLevelOptions.map(option => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
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
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
  Slider,
  Box,
  Stack,
  ButtonGroup,
  Collapse,
  Fade
} from '@mui/material';
import { Settings, Download, Share, Refresh } from '@mui/icons-material';
import { SearchField } from '../../../components/ui';
import CloudSearchResults from './CloudSearchResults';

const COLOR_SCHEMES = {
  default: { name: 'Default', colors: ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0097a7'] },
  warm: { name: 'Warm Sunset', colors: ['#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#cddc39', '#8bc34a'] },
  cool: { name: 'Ocean Breeze', colors: ['#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a'] },
  purple: { name: 'Purple Haze', colors: ['#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4'] },
  forest: { name: 'Forest', colors: ['#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784'] },
  sunset: { name: 'Sunset', colors: ['#d32f2f', '#f44336', '#ff5722', '#ff9800', '#ffc107', '#ffeb3b'] },
  monochrome: { name: 'Monochrome', colors: ['#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0'] }
};

const SHAPE_PATTERNS = {
  default: { name: 'Default', spiral: 'archimedean' },
  rectangular: { name: 'Square', spiral: 'rectangular' },
  heart: { name: 'Heart', spiral: 'archimedean', shape: 'heart' },
  circle: { name: 'Circle', spiral: 'archimedean', shape: 'circle' }
};

interface CloudControlsProps {
  showControls: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  processedData: any[];
  onWordHighlight: (word: string | null) => void;
  highlightedWord: string | null;
  colorScheme: string;
  onColorSchemeChange: (scheme: string) => void;
  shapePattern: string;
  onShapePatternChange: (pattern: string) => void;
  minFontSize: number;
  onMinFontSizeChange: (size: number) => void;
  maxFontSize: number;
  onMaxFontSizeChange: (size: number) => void;
  rotation: boolean;
  onRotationChange: (rotation: boolean) => void;
  autoRotate: boolean;
  onAutoRotateChange: (autoRotate: boolean) => void;
  maxWords: number;
  onMaxWordsChange: (maxWords: number) => void;
  filterMinFreq: number;
  onFilterMinFreqChange: (freq: number) => void;
  onDownloadPng: () => void;
  onDownloadSvg: () => void;
  onShare: () => void;
  onShuffle: () => void;
}

const CloudControls: React.FC<CloudControlsProps> = ({
  showControls,
  searchTerm,
  onSearchChange,
  processedData,
  onWordHighlight,
  highlightedWord,
  colorScheme,
  onColorSchemeChange,
  shapePattern,
  onShapePatternChange,
  minFontSize,
  onMinFontSizeChange,
  maxFontSize,
  onMaxFontSizeChange,
  rotation,
  onRotationChange,
  autoRotate,
  onAutoRotateChange,
  maxWords,
  onMaxWordsChange,
  filterMinFreq,
  onFilterMinFreqChange,
  onDownloadPng,
  onDownloadSvg,
  onShare,
  onShuffle
}) => {
  return (
    <>
      {/* Search Bar */}
      <Fade in={showControls || !!searchTerm}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <SearchField
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Search for specific words..."
              size="small"
              fullWidth
              sx={{ mb: searchTerm ? 2 : 0 }}
            />
            
            <CloudSearchResults
              searchTerm={searchTerm}
              processedData={processedData}
              highlightedWord={highlightedWord}
              onWordHighlight={onWordHighlight}
            />
          </CardContent>
        </Card>
      </Fade>

      {/* Enhanced Controls */}
      <Collapse in={showControls}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Settings />
              Customization Controls
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" gutterBottom>Appearance</Typography>
                <Stack spacing={2}>
                  <FormControl size="small">
                    <InputLabel>Color Theme</InputLabel>
                    <Select value={colorScheme} onChange={(e) => onColorSchemeChange(e.target.value)}>
                      {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
                        <MenuItem key={key} value={key}>{scheme.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl size="small">
                    <InputLabel>Shape Pattern</InputLabel>
                    <Select value={shapePattern} onChange={(e) => onShapePatternChange(e.target.value)}>
                      {Object.entries(SHAPE_PATTERNS).map(([key, pattern]) => (
                        <MenuItem key={key} value={key}>{pattern.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" gutterBottom>Font Settings</Typography>
                <Box sx={{ px: 1 }}>
                  <Typography variant="caption">Size: {minFontSize}px - {maxFontSize}px</Typography>
                  <Slider
                    value={[minFontSize, maxFontSize]}
                    onChange={(_, value) => {
                      onMinFontSizeChange(value[0]);
                      onMaxFontSizeChange(value[1]);
                    }}
                    min={8}
                    max={100}
                    size="small"
                    valueLabelDisplay="auto"
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" gutterBottom>Layout Options</Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={<Switch checked={rotation} onChange={(e) => onRotationChange(e.target.checked)} />}
                    label="Word Rotation"
                  />
                  <FormControlLabel
                    control={<Switch checked={autoRotate} onChange={(e) => onAutoRotateChange(e.target.checked)} />}
                    label="Auto Animation"
                  />
                </Stack>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" gutterBottom>Filtering</Typography>
                <Box sx={{ px: 1 }}>
                  <Typography variant="caption">Max Words: {maxWords}</Typography>
                  <Slider
                    value={maxWords}
                    onChange={(_, value) => onMaxWordsChange(value as number)}
                    min={25}
                    max={200}
                    step={25}
                    size="small"
                  />
                  <Typography variant="caption">Min Frequency: {filterMinFreq}</Typography>
                  <Slider
                    value={filterMinFreq}
                    onChange={(_, value) => onFilterMinFreqChange(value as number)}
                    min={1}
                    max={10}
                    size="small"
                  />
                </Box>
              </Grid>
            </Grid>
            
            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<Download />} onClick={onDownloadPng}>
                PNG
              </Button>
              <Button variant="outlined" startIcon={<Download />} onClick={onDownloadSvg}>
                SVG
              </Button>
              <Button variant="outlined" startIcon={<Share />} onClick={onShare}>
                Share
              </Button>
              <Button variant="outlined" startIcon={<Refresh />} onClick={onShuffle}>
                Randomize
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Collapse>
    </>
  );
};

export default React.memo(CloudControls);
import React, { useMemo, useState, useEffect } from 'react';
import WordCloud from 'react-d3-cloud';
import { scaleLinear } from 'd3-scale';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Slider,
  FormControlLabel,
  Switch,
  ButtonGroup,
  Button,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  CloudQueue,
  Palette,
  Settings,
  ZoomIn,
  ZoomOut,
  Refresh,
  Download,
  Fullscreen
} from '@mui/icons-material';

interface CloudProps {
  wordFrequency: { text: string; value: number }[];
}

const Cloud: React.FC<CloudProps> = ({ wordFrequency }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [minFontSize, setMinFontSize] = useState(12);
  const [maxFontSize, setMaxFontSize] = useState(60);
  const [colorScheme, setColorScheme] = useState('default');
  const [showControls, setShowControls] = useState(false);
  const [rotation, setRotation] = useState(true);
  const [spiral, setSpiral] = useState('archimedean');
  const [padding, setPadding] = useState(2);
  const [maxWords, setMaxWords] = useState(100);

  const cloudWidth = isMobile ? 350 : 800;
  const cloudHeight = isMobile ? 300 : 500;

  const colorSchemes = {
    default: ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0097a7'],
    warm: ['#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#cddc39', '#8bc34a'],
    cool: ['#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a'],
    purple: ['#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4'],
    monochrome: ['#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0']
  };

  const processedData = useMemo(() => {
    if (!wordFrequency || wordFrequency.length === 0) return [];
    
    const sortedData = [...wordFrequency]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxWords);
    
    if (sortedData.length === 0) return [];
    
    const values = sortedData.map(w => Math.log2(w.value + 1));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    const scale = scaleLinear()
      .domain([minVal, maxVal])
      .range([minFontSize, maxFontSize]);
    
    return sortedData.map(item => ({
      text: item.text,
      value: item.value,
      size: scale(Math.log2(item.value + 1))
    }));
  }, [wordFrequency, minFontSize, maxFontSize, maxWords]);

  const getWordColor = (word: any, index: number) => {
    const colors = colorSchemes[colorScheme];
    return colors[index % colors.length];
  };

  const downloadWordCloud = () => {
    const svg = document.querySelector('#word-cloud-container svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      canvas.width = cloudWidth;
      canvas.height = cloudHeight;
      
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const link = document.createElement('a');
        link.download = `wordcloud-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  const renderControls = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings />
          Customization Controls
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>Font Size Range</Typography>
            <Box sx={{ px: 2 }}>
              <Typography variant="caption">Min: {minFontSize}px</Typography>
              <Slider
                value={minFontSize}
                onChange={(_, value) => setMinFontSize(value as number)}
                min={8}
                max={30}
                valueLabelDisplay="auto"
                size="small"
              />
              <Typography variant="caption">Max: {maxFontSize}px</Typography>
              <Slider
                value={maxFontSize}
                onChange={(_, value) => setMaxFontSize(value as number)}
                min={30}
                max={100}
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>Color Scheme</Typography>
            <ButtonGroup orientation="vertical" size="small" fullWidth>
              {Object.keys(colorSchemes).map((scheme) => (
                <Button
                  key={scheme}
                  variant={colorScheme === scheme ? "contained" : "outlined"}
                  onClick={() => setColorScheme(scheme)}
                  sx={{ textTransform: 'capitalize' }}
                >
                  {scheme}
                </Button>
              ))}
            </ButtonGroup>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>Layout Options</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={rotation}
                    onChange={(e) => setRotation(e.target.checked)}
                  />
                }
                label="Word Rotation"
              />
              <Typography variant="caption">Max Words: {maxWords}</Typography>
              <Slider
                value={maxWords}
                onChange={(_, value) => setMaxWords(value as number)}
                min={50}
                max={200}
                valueLabelDisplay="auto"
                size="small"
              />
              <Typography variant="caption">Padding: {padding}px</Typography>
              <Slider
                value={padding}
                onChange={(_, value) => setPadding(value as number)}
                min={1}
                max={10}
                valueLabelDisplay="auto"
                size="small"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="subtitle2" gutterBottom>Actions</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button variant="outlined" startIcon={<Download />} onClick={downloadWordCloud}>
                Download PNG
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderStats = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{wordFrequency.length}</Typography>
            <Typography variant="body2">Total Terms</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{processedData.length}</Typography>
            <Typography variant="body2">Displayed</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">
              {processedData.length > 0 ? Math.max(...processedData.map(d => d.value)) : 0}
            </Typography>
            <Typography variant="body2">Max Frequency</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Card sx={{ textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="h6">{colorScheme}</Typography>
            <Typography variant="body2">Color Theme</Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderTopTerms = () => {
    const topTerms = processedData.slice(0, 10);
    
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Top Terms</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {topTerms.map((term, index) => (
              <Chip
                key={term.text}
                label={`${term.text} (${term.value})`}
                size="small"
                sx={{
                  bgcolor: getWordColor(term, index),
                  color: 'white',
                  fontWeight: 600
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  if (!wordFrequency || wordFrequency.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CloudQueue sx={{ fontSize: 80, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Word Cloud Data
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Execute a query with text data to generate a word cloud visualization
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudQueue />
            Word Cloud Visualization
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Interactive word frequency visualization with customization options
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Toggle Controls">
            <IconButton onClick={() => setShowControls(!showControls)}>
              <Settings />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download">
            <IconButton onClick={downloadWordCloud}>
              <Download />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {showControls && renderControls()}
      {renderStats()}
      {renderTopTerms()}

      <Paper 
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          minHeight: cloudHeight + 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          position: 'relative'
        }}
      >
        <Box id="word-cloud-container" sx={{ width: cloudWidth, height: cloudHeight }}>
          {processedData.length > 0 ? (
            <WordCloud
              data={processedData}
              fontSize={(word) => word.size}
              fill={(word, index) => getWordColor(word, index)}
              padding={padding}
              rotate={rotation ? () => (Math.random() - 0.5) * 60 : () => 0}
              spiral={spiral}
              width={cloudWidth}
              height={cloudHeight}
              fontWeight="600"
              fontFamily="Inter, Arial, sans-serif"
            />
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                Generating word cloud...
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default Cloud;
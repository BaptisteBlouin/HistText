import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  useMediaQuery,
  LinearProgress,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Fade,
  Zoom,
  Badge
} from '@mui/material';
import {
  CloudQueue,
  Palette,
  Settings,
  Download,
  Refresh,
  ExpandMore,
  Search,
  Fullscreen,
  Share,
  Animation,
  AutorenewRounded,
  FilterList,
  Tune,
  Info,
  Close
} from '@mui/icons-material';

interface CloudProps {
  wordFrequency: { text: string; value: number }[];
  isLoading?: boolean;
  progress?: number;
}

const COLOR_SCHEMES = {
  default: { name: 'Default', colors: ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0097a7'] },
  warm: { name: 'Warm Sunset', colors: ['#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#cddc39', '#8bc34a'] },
  cool: { name: 'Ocean Breeze', colors: ['#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a'] },
  purple: { name: 'Purple Haze', colors: ['#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4'] },
  forest: { name: 'Forest', colors: ['#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784'] },
  sunset: { name: 'Sunset', colors: ['#d32f2f', '#f44336', '#ff5722', '#ff9800', '#ffc107', '#ffeb3b'] },
  monochrome: { name: 'Monochrome', colors: ['#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0'] }
};

// Fun shape patterns for word arrangement
const SHAPE_PATTERNS = {
  default: { name: 'Default', spiral: 'archimedean' },
  rectangular: { name: 'Square', spiral: 'rectangular' },
  heart: { name: 'Heart', spiral: 'archimedean', shape: 'heart' },
  circle: { name: 'Circle', spiral: 'archimedean', shape: 'circle' }
};

const Cloud: React.FC<CloudProps> = ({ wordFrequency, isLoading = false, progress = 0 }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const cloudRef = useRef<HTMLDivElement>(null);
  
  // Enhanced state
  const [minFontSize, setMinFontSize] = useState(12);
  const [maxFontSize, setMaxFontSize] = useState(60);
  const [colorScheme, setColorScheme] = useState('default');
  const [showControls, setShowControls] = useState(false);
  const [rotation, setRotation] = useState(true);
  const [padding, setPadding] = useState(2);
  const [maxWords, setMaxWords] = useState(100);
  const [filterMinFreq, setFilterMinFreq] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedWord, setHighlightedWord] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shapePattern, setShapePattern] = useState('default');
  const [autoRotate, setAutoRotate] = useState(false);
  const [showWordInfo, setShowWordInfo] = useState(false);
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Auto-rotation effect
  useEffect(() => {
    if (!autoRotate) return;
    
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 800);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [autoRotate]);

  const cloudDimensions = useMemo(() => {
    const baseWidth = fullscreen ? window.innerWidth - 100 : (isMobile ? 350 : 800);
    const baseHeight = fullscreen ? window.innerHeight - 200 : (isMobile ? 300 : 500);
    
    return { width: baseWidth, height: baseHeight };
  }, [isMobile, fullscreen]);

  // Enhanced data processing with search highlighting
  const processedData = useMemo(() => {
    if (!wordFrequency || wordFrequency.length === 0) return [];
    
    let filtered = wordFrequency
      .filter(item => item.value >= filterMinFreq)
      .filter(item => {
        const word = item.text.toLowerCase();
        if (word.length < 3 || word.length > 25) return false;
        
        const stopWords = new Set([
          'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
        ]);
        
        return !stopWords.has(word);
      });

    // Search filtering
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const sortedData = filtered
      .sort((a, b) => b.value - a.value)
      .slice(0, maxWords);
    
    if (sortedData.length === 0) return [];
    
    const values = sortedData.map(w => Math.log2(w.value + 1));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    const scale = scaleLinear()
      .domain([minVal, maxVal])
      .range([minFontSize, maxFontSize]);
    
    return sortedData.map((item, index) => ({
      text: item.text,
      value: item.value,
      size: scale(Math.log2(item.value + 1)),
      rank: index + 1,
      isHighlighted: highlightedWord === item.text
    }));
  }, [wordFrequency, minFontSize, maxFontSize, maxWords, filterMinFreq, searchTerm, highlightedWord]);

  // Enhanced color function with highlighting
  const getWordColor = useCallback((word: any, index: number) => {
    if (word.isHighlighted) {
      return '#ff1744'; // Bright red for highlighted words
    }
    
    const colors = COLOR_SCHEMES[colorScheme].colors;
    return colors[index % colors.length];
  }, [colorScheme]);

  // Word click handler
  const handleWordClick = useCallback((word: any) => {
    setSelectedWord(word);
    setShowWordInfo(true);
  }, []);

  // Enhanced download with options
  const downloadWordCloud = useCallback((format: 'png' | 'svg' = 'png') => {
    const svg = cloudRef.current?.querySelector('svg');
    if (!svg) return;
    
    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = `wordcloud-${new Date().toISOString().split('T')[0]}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = cloudDimensions.width * 2;
      canvas.height = cloudDimensions.height * 2;
      
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const link = document.createElement('a');
        link.download = `wordcloud-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svg));
    }
  }, [cloudDimensions]);

  // Share functionality
  const shareWordCloud = useCallback(() => {
    const config = {
      colorScheme,
      maxWords,
      filterMinFreq,
      minFontSize,
      maxFontSize,
      rotation,
      padding,
      shapePattern
    };
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?cloudConfig=${encodeURIComponent(JSON.stringify(config))}`;
    navigator.clipboard.writeText(shareUrl);
    setShareDialogOpen(false);
  }, [colorScheme, maxWords, filterMinFreq, minFontSize, maxFontSize, rotation, padding, shapePattern]);

  // Shuffle colors for fun
  const shuffleColors = useCallback(() => {
    const schemes = Object.keys(COLOR_SCHEMES);
    const currentIndex = schemes.indexOf(colorScheme);
    const nextIndex = (currentIndex + 1) % schemes.length;
    setColorScheme(schemes[nextIndex]);
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 600);
  }, [colorScheme]);

  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const searchResults = searchTerm ? processedData.length : null;
    
    return {
      totalWords: processedData.length,
      maxFrequency: Math.max(...processedData.map(w => w.value)),
      avgFrequency: Math.round(processedData.reduce((sum, w) => sum + w.value, 0) / processedData.length),
      searchResults,
      uniqueLetters: new Set(processedData.map(w => w.text).join('').toLowerCase()).size
    };
  }, [processedData, searchTerm]);

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

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <AutorenewRounded sx={{ animation: 'spin 2s linear infinite' }} />
          <Typography variant="h6">
            Generating Word Cloud...
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            mb: 2, 
            height: 8, 
            borderRadius: 4,
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #667eea, #764ba2)'
            }
          }} 
        />
        <Typography variant="body2" color="text.secondary">
          {progress.toFixed(0)}% complete • Processing text data
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      {/* Enhanced Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
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
                {stats.totalWords} words • Max: {stats.maxFrequency} • Avg: {stats.avgFrequency}
                {stats.searchResults && ` • Found: ${stats.searchResults}`}
              </>
            )}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Search Words">
            <IconButton onClick={() => setShowControls(!showControls)}>
              <Badge badgeContent={searchTerm ? '!' : 0} color="primary">
                <Search />
              </Badge>
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Shuffle Colors">
            <IconButton onClick={shuffleColors} color="primary">
              <Palette />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Toggle Fullscreen">
            <IconButton onClick={() => setFullscreen(!fullscreen)}>
              <Fullscreen />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Settings">
            <IconButton onClick={() => setShowControls(!showControls)}>
              <Tune />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search Bar */}
      <Fade in={showControls || !!searchTerm}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              size="small"
              placeholder="Search for specific words..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: searchTerm && (
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <Close />
                  </IconButton>
                )
              }}
              sx={{ mb: searchTerm ? 2 : 0 }}
            />
            
            {searchTerm && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {processedData.slice(0, 10).map((word) => (
                  <Chip
                    key={word.text}
                    label={`${word.text} (${word.value})`}
                    size="small"
                    clickable
                    onClick={() => setHighlightedWord(word.text === highlightedWord ? null : word.text)}
                    color={highlightedWord === word.text ? "primary" : "default"}
                  />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>

      {/* Quick stats with enhanced info */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Card sx={{ textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <CardContent sx={{ py: 1 }}>
                <Typography variant="h6">{stats.totalWords}</Typography>
                <Typography variant="caption">Words Shown</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
              <CardContent sx={{ py: 1 }}>
                <Typography variant="h6">{stats.maxFrequency}</Typography>
                <Typography variant="caption">Top Frequency</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
              <CardContent sx={{ py: 1 }}>
                <Typography variant="h6">{stats.avgFrequency}</Typography>
                <Typography variant="caption">Avg Frequency</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Card sx={{ textAlign: 'center', bgcolor: 'info.light', color: 'info.contrastText' }}>
              <CardContent sx={{ py: 1 }}>
                <Typography variant="h6">{stats.uniqueLetters}</Typography>
                <Typography variant="caption">Unique Letters</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

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
                    <Select value={colorScheme} onChange={(e) => setColorScheme(e.target.value)}>
                      {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
                        <MenuItem key={key} value={key}>{scheme.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl size="small">
                    <InputLabel>Shape Pattern</InputLabel>
                    <Select value={shapePattern} onChange={(e) => setShapePattern(e.target.value)}>
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
                      setMinFontSize(value[0]);
                      setMaxFontSize(value[1]);
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
                    control={<Switch checked={rotation} onChange={(e) => setRotation(e.target.checked)} />}
                    label="Word Rotation"
                  />
                  <FormControlLabel
                    control={<Switch checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} />}
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
                    onChange={(_, value) => setMaxWords(value as number)}
                    min={25}
                    max={200}
                    step={25}
                    size="small"
                  />
                  <Typography variant="caption">Min Frequency: {filterMinFreq}</Typography>
                  <Slider
                    value={filterMinFreq}
                    onChange={(_, value) => setFilterMinFreq(value as number)}
                    min={1}
                    max={10}
                    size="small"
                  />
                </Box>
              </Grid>
            </Grid>
            
            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" startIcon={<Download />} onClick={() => downloadWordCloud('png')}>
                PNG
              </Button>
              <Button variant="outlined" startIcon={<Download />} onClick={() => downloadWordCloud('svg')}>
                SVG
              </Button>
              <Button variant="outlined" startIcon={<Share />} onClick={() => setShareDialogOpen(true)}>
                Share
              </Button>
              <Button variant="outlined" startIcon={<Refresh />} onClick={shuffleColors}>
                Randomize
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Collapse>

      {/* Enhanced Word Cloud */}
      <Paper 
        sx={{ 
          p: 3, 
          borderRadius: 3, 
          minHeight: cloudDimensions.height + 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: fullscreen 
            ? 'linear-gradient(45deg, #000 0%, #1a1a1a 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          position: fullscreen ? 'fixed' : 'relative',
          top: fullscreen ? 0 : 'auto',
          left: fullscreen ? 0 : 'auto',
          right: fullscreen ? 0 : 'auto',
          bottom: fullscreen ? 0 : 'auto',
          zIndex: fullscreen ? 9999 : 'auto',
          transition: 'all 0.3s ease'
        }}
      >
        {fullscreen && (
          <IconButton
            onClick={() => setFullscreen(false)}
            sx={{ 
              position: 'absolute', 
              top: 16, 
              right: 16, 
              bgcolor: 'rgba(255,255,255,0.9)',
              '&:hover': { bgcolor: 'white' }
            }}
          >
            <Close />
          </IconButton>
        )}
        
        <Box 
          ref={cloudRef} 
          sx={{ 
            width: cloudDimensions.width, 
            height: cloudDimensions.height,
            transition: isAnimating ? 'transform 0.6s ease-in-out' : 'none',
            transform: isAnimating ? 'scale(1.02)' : 'scale(1)'
          }}
        >
          {processedData.length > 0 ? (
            <WordCloud
              data={processedData}
              fontSize={(word) => word.size}
              fill={(word, index) => getWordColor(word, index)}
              padding={padding}
              rotate={rotation ? () => (Math.random() - 0.5) * 60 : () => 0}
              spiral={SHAPE_PATTERNS[shapePattern].spiral}
              width={cloudDimensions.width}
              height={cloudDimensions.height}
              fontWeight="600"
              fontFamily="Inter, Arial, sans-serif"
              onWordClick={handleWordClick}
            />
          ) : (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {searchTerm ? 'No words found matching your search' : 'No words match current filters'}
              </Typography>
              {searchTerm && (
                <Button onClick={() => setSearchTerm('')} sx={{ mt: 1 }}>
                  Clear Search
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Word Info Dialog */}
      <Dialog open={showWordInfo} onClose={() => setShowWordInfo(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Info />
          Word Information
        </DialogTitle>
        <DialogContent>
          {selectedWord && (
            <Box>
              <Typography variant="h4" gutterBottom color="primary">
                {selectedWord.text}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Frequency</Typography>
                  <Typography variant="h6">{selectedWord.value}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Rank</Typography>
                  <Typography variant="h6">#{selectedWord.rank}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Length</Typography>
                  <Typography variant="h6">{selectedWord.text.length} chars</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Font Size</Typography>
                  <Typography variant="h6">{Math.round(selectedWord.size)}px</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHighlightedWord(selectedWord?.text)} color="primary">
            Highlight
          </Button>
          <Button onClick={() => setShowWordInfo(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Share Word Cloud Configuration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Share your current word cloud settings with others!
          </Typography>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Theme: {COLOR_SCHEMES[colorScheme].name} • 
              Words: {maxWords} • 
              Min Freq: {filterMinFreq}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button onClick={shareWordCloud} variant="contained">Copy Link</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Cloud;
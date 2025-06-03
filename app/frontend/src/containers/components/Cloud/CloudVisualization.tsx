import React, { useCallback, forwardRef } from 'react';
import WordCloud from 'react-d3-cloud';
import { Paper, Box, IconButton, Typography, Button } from '@mui/material';
import { Close } from '@mui/icons-material';

/**
 * Supported color schemes for the word cloud visualization.
 */
const COLOR_SCHEMES = {
  default: { name: 'Default', colors: ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#0097a7'] },
  warm: { name: 'Warm Sunset', colors: ['#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#cddc39', '#8bc34a'] },
  cool: { name: 'Ocean Breeze', colors: ['#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a'] },
  purple: { name: 'Purple Haze', colors: ['#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4'] },
  forest: { name: 'Forest', colors: ['#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784'] },
  sunset: { name: 'Sunset', colors: ['#d32f2f', '#f44336', '#ff5722', '#ff9800', '#ffc107', '#ffeb3b'] },
  monochrome: { name: 'Monochrome', colors: ['#424242', '#616161', '#757575', '#9e9e9e', '#bdbdbd', '#e0e0e0'] }
};

/**
 * Supported shape/spiral patterns for the word cloud.
 */
const SHAPE_PATTERNS = {
  default: { name: 'Default', spiral: 'archimedean' },
  rectangular: { name: 'Square', spiral: 'rectangular' },
  heart: { name: 'Heart', spiral: 'archimedean', shape: 'heart' },
  circle: { name: 'Circle', spiral: 'archimedean', shape: 'circle' }
};

/**
 * Props for the CloudVisualization component.
 */
interface CloudVisualizationProps {
  /** Array of processed words (from useCloudData) */
  processedData: any[];
  /** Width and height for the SVG/canvas */
  cloudDimensions: { width: number; height: number };
  /** Color scheme name */
  colorScheme: string;
  /** Whether word rotation is enabled */
  rotation: boolean;
  /** Padding between words */
  padding: number;
  /** Shape pattern key (from SHAPE_PATTERNS) */
  shapePattern: string;
  /** Is cloud currently animating (for scaling effect)? */
  isAnimating: boolean;
  /** Whether the visualization is fullscreen */
  fullscreen: boolean;
  /** Handler to exit fullscreen */
  onFullscreenExit: () => void;
  /** Handler for clicking a word */
  onWordClick: (word: any) => void;
  /** Current search term (for empty state message) */
  searchTerm: string;
}

/**
 * Renders the main word cloud visualization using react-d3-cloud.
 * Supports color schemes, spiral/shape patterns, fullscreen, click/highlight,
 * and animated scaling. Handles empty/filter/search states.
 *
 * @param props - CloudVisualizationProps
 * @param ref - Ref to the container element (for exporting/PNG, etc)
 * @returns Word cloud visualization or an empty state message.
 */
const CloudVisualization = forwardRef<HTMLDivElement, CloudVisualizationProps>(({
  processedData,
  cloudDimensions,
  colorScheme,
  rotation,
  padding,
  shapePattern,
  isAnimating,
  fullscreen,
  onFullscreenExit,
  onWordClick,
  searchTerm
}, ref) => {
  // Returns the color for a word, depending on scheme and highlight state.
  const getWordColor = useCallback((word: any, index: number) => {
    if (word.isHighlighted) {
      return '#ff1744'; // Highlighted color
    }
    const scheme = COLOR_SCHEMES[colorScheme as keyof typeof COLOR_SCHEMES];
    const colors = scheme ? scheme.colors : COLOR_SCHEMES.default.colors;
    return colors[index % colors.length];
  }, [colorScheme]);

  // Returns the spiral type for react-d3-cloud.
  const getSpiral = (): "archimedean" | "rectangular" => {
    const shape = SHAPE_PATTERNS[shapePattern as keyof typeof SHAPE_PATTERNS];
    const spiral = shape ? shape.spiral : SHAPE_PATTERNS.default.spiral;
    return spiral as "archimedean" | "rectangular";
  };

  return (
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
          onClick={onFullscreenExit}
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
        ref={ref} 
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
            fontSize={(word: any) => word.size}
            fill={(word: any, index: number) => getWordColor(word, index)}
            padding={padding}
            rotate={rotation ? () => (Math.random() - 0.5) * 60 : () => 0}
            spiral={getSpiral()}
            width={cloudDimensions.width}
            height={cloudDimensions.height}
            font="Inter, Arial, sans-serif"
            onWordClick={onWordClick}
          />
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {searchTerm ? 'No words found matching your search' : 'No words match current filters'}
            </Typography>
            {searchTerm && (
              <Button onClick={() => {}} sx={{ mt: 1 }}>
                Clear Search
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
});

CloudVisualization.displayName = 'CloudVisualization';

export default React.memo(CloudVisualization);
import React, { useState, useRef, useMemo } from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import CloudHeader from './CloudHeader';
import CloudControls from './CloudControls';
import CloudVisualization from './CloudVisualization';
import CloudStats from './CloudStats';
import CloudDialogs from './CloudDialogs';
import { useCloudState } from './hooks/useCloudState';
import { useCloudData } from './hooks/useCloudData';
import { CloudEmptyState, CloudLoadingState } from './CloudStates';

/**
 * Props for CloudContainer component.
 */
interface CloudContainerProps {
  /** Array of words and their frequencies to visualize */
  wordFrequency: { text: string; value: number }[];
  /** Show loading state if true */
  isLoading?: boolean;
  /** Loading progress (0-100), used when isLoading is true */
  progress?: number;
}

/**
 * Main container component for the interactive word cloud feature.
 * Integrates header, controls, visualization, stats, and sharing dialogs.
 * Handles all state and download/export logic.
 *
 * @param wordFrequency - Array of word objects for cloud
 * @param isLoading - Whether to show a loading state
 * @param progress - Optional loading progress (if loading)
 */
const CloudContainer: React.FC<CloudContainerProps> = ({
  wordFrequency,
  isLoading = false,
  progress = 0
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const cloudRef = useRef<HTMLDivElement>(null);

  // State management for all cloud UI and options
  const {
    minFontSize,
    setMinFontSize,
    maxFontSize,
    setMaxFontSize,
    colorScheme,
    setColorScheme,
    showControls,
    setShowControls,
    rotation,
    setRotation,
    padding,
    setPadding,
    maxWords,
    setMaxWords,
    filterMinFreq,
    setFilterMinFreq,
    searchTerm,
    setSearchTerm,
    highlightedWord,
    setHighlightedWord,
    isAnimating,
    setIsAnimating,
    shapePattern,
    setShapePattern,
    autoRotate,
    setAutoRotate,
    showWordInfo,
    setShowWordInfo,
    selectedWord,
    setSelectedWord,
    shareDialogOpen,
    setShareDialogOpen,
    fullscreen,
    setFullscreen
  } = useCloudState();

  // Data processing for the cloud, using current filters and settings
  const { processedData, stats, cloudDimensions } = useCloudData({
    wordFrequency,
    filterMinFreq,
    searchTerm,
    maxWords,
    highlightedWord,
    fullscreen,
    isMobile
  });

  // Show loading UI
  if (isLoading) {
    return <CloudLoadingState progress={progress} />;
  }

  // Show empty UI if no data
  if (!wordFrequency || wordFrequency.length === 0) {
    return <CloudEmptyState />;
  }

  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <CloudHeader
        isAnimating={isAnimating}
        stats={stats}
        searchTerm={searchTerm}
        showControls={showControls}
        onToggleControls={() => setShowControls(!showControls)}
        onShuffleColors={() => {
          const schemes = ['default', 'warm', 'cool', 'purple', 'forest', 'sunset', 'monochrome'];
          const currentIndex = schemes.indexOf(colorScheme);
          const nextIndex = (currentIndex + 1) % schemes.length;
          setColorScheme(schemes[nextIndex]);
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 600);
        }}
        onToggleFullscreen={() => setFullscreen(!fullscreen)}
        onToggleSettings={() => setShowControls(!showControls)}
      />

      <CloudControls
        showControls={showControls}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        processedData={processedData}
        onWordHighlight={setHighlightedWord}
        highlightedWord={highlightedWord}
        colorScheme={colorScheme}
        onColorSchemeChange={setColorScheme}
        shapePattern={shapePattern}
        onShapePatternChange={setShapePattern}
        minFontSize={minFontSize}
        onMinFontSizeChange={setMinFontSize}
        maxFontSize={maxFontSize}
        onMaxFontSizeChange={setMaxFontSize}
        rotation={rotation}
        onRotationChange={setRotation}
        autoRotate={autoRotate}
        onAutoRotateChange={setAutoRotate}
        maxWords={maxWords}
        onMaxWordsChange={setMaxWords}
        filterMinFreq={filterMinFreq}
        onFilterMinFreqChange={setFilterMinFreq}
        onDownloadPng={() => downloadWordCloud('png')}
        onDownloadSvg={() => downloadWordCloud('svg')}
        onShare={() => setShareDialogOpen(true)}
        onShuffle={() => {
          const schemes = ['default', 'warm', 'cool', 'purple', 'forest', 'sunset', 'monochrome'];
          const currentIndex = schemes.indexOf(colorScheme);
          const nextIndex = (currentIndex + 1) % schemes.length;
          setColorScheme(schemes[nextIndex]);
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 600);
        }}
      />

      <CloudStats stats={stats} />

      <CloudVisualization
        ref={cloudRef}
        processedData={processedData}
        cloudDimensions={cloudDimensions}
        colorScheme={colorScheme}
        rotation={rotation}
        padding={padding}
        shapePattern={shapePattern}
        isAnimating={isAnimating}
        fullscreen={fullscreen}
        onFullscreenExit={() => setFullscreen(false)}
        onWordClick={(word) => {
          setSelectedWord(word);
          setShowWordInfo(true);
        }}
        searchTerm={searchTerm}
      />

      <CloudDialogs
        showWordInfo={showWordInfo}
        selectedWord={selectedWord}
        shareDialogOpen={shareDialogOpen}
        colorScheme={colorScheme}
        maxWords={maxWords}
        filterMinFreq={filterMinFreq}
        onCloseWordInfo={() => setShowWordInfo(false)}
        onCloseShare={() => setShareDialogOpen(false)}
        onHighlightWord={(word) => setHighlightedWord(word === highlightedWord ? null : word)}
        onShare={() => {
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
        }}
      />
    </Box>
  );

  /**
   * Export the current word cloud visualization as a PNG or SVG file.
   *
   * @param format - Output file format: 'png' (default) or 'svg'
   */
  function downloadWordCloud(format: 'png' | 'svg' = 'png') {
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
  }
};

export default React.memo(CloudContainer);
import { useState, useEffect } from 'react';

/**
 * React hook to manage interactive state for a word cloud component.
 * 
 * Provides setters and state for font size, color scheme, controls visibility,
 * rotation, word filtering, highlighting, animation, sharing dialog,
 * fullscreen, and other word cloud UI behaviors.
 * 
 * @returns Object containing all word cloud state variables and their setters.
 */
export const useCloudState = () => {
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

  /**
   * If auto-rotation is enabled, periodically trigger an animation.
   * Animation state is set true for 800ms every 3 seconds while autoRotate is active.
   */
  useEffect(() => {
    if (!autoRotate) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 800);
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRotate]);

  return {
    /** Minimum font size for words in the cloud */
    minFontSize,
    setMinFontSize,
    /** Maximum font size for words in the cloud */
    maxFontSize,
    setMaxFontSize,
    /** Color scheme identifier for word colors */
    colorScheme,
    setColorScheme,
    /** Whether to show extra UI controls */
    showControls,
    setShowControls,
    /** Enable or disable word rotation effect */
    rotation,
    setRotation,
    /** Padding between words in the cloud */
    padding,
    setPadding,
    /** Maximum number of words to display */
    maxWords,
    setMaxWords,
    /** Minimum frequency for a word to be included */
    filterMinFreq,
    setFilterMinFreq,
    /** Search/filter term for words */
    searchTerm,
    setSearchTerm,
    /** Highlighted word (string or null) */
    highlightedWord,
    setHighlightedWord,
    /** Is the cloud currently animating? */
    isAnimating,
    setIsAnimating,
    /** Shape pattern for the word cloud layout */
    shapePattern,
    setShapePattern,
    /** Enable or disable auto-rotation animation */
    autoRotate,
    setAutoRotate,
    /** Show/hide details for a selected word */
    showWordInfo,
    setShowWordInfo,
    /** Selected word object (type depends on consumer) */
    selectedWord,
    setSelectedWord,
    /** Show/hide the sharing dialog */
    shareDialogOpen,
    setShareDialogOpen,
    /** Fullscreen mode state */
    fullscreen,
    setFullscreen
  };
};

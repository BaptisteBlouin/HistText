import { useState, useEffect } from 'react';

export const useCloudState = () => {
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

  return {
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
  };
};
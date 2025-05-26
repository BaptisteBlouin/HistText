import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';

// Helper function to detect Chinese characters
const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fff]/.test(text);
};

interface UseCloudDataProps {
  wordFrequency: { text: string; value: number }[];
  filterMinFreq: number;
  searchTerm: string;
  maxWords: number;
  highlightedWord: string | null;
  fullscreen: boolean;
  isMobile: boolean;
}

export const useCloudData = ({
  wordFrequency,
  filterMinFreq,
  searchTerm,
  maxWords,
  highlightedWord,
  fullscreen,
  isMobile
}: UseCloudDataProps) => {
  const cloudDimensions = useMemo(() => {
    const baseWidth = fullscreen ? window.innerWidth - 100 : (isMobile ? 350 : 800);
    const baseHeight = fullscreen ? window.innerHeight - 200 : (isMobile ? 300 : 500);
    
    return { width: baseWidth, height: baseHeight };
  }, [isMobile, fullscreen]);

  // FIXED: Enhanced data processing with proper Chinese support
  const processedData = useMemo(() => {
    if (!wordFrequency || wordFrequency.length === 0) return [];
    
    console.log('Cloud component received word frequency data:', wordFrequency.slice(0, 20));
    
    let filtered = wordFrequency
      .filter(item => item.value >= filterMinFreq)
      .filter(item => {
        const word = item.text.toLowerCase();
        const isChinese = containsChinese(item.text);
        
        // FIXED: Different length requirements for Chinese vs non-Chinese
        if (isChinese) {
          // For Chinese: accept 1-4 character words
          if (item.text.length < 1 || item.text.length > 4) return false;
        } else {
          // For non-Chinese: require 2-25 characters
          if (word.length < 2 || word.length > 25) return false;
        }
        
        // FIXED: Only apply English stop words to non-Chinese text
        if (!isChinese) {
          const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'
          ]);
          
          return !stopWords.has(word);
        }
        
        return true; // Accept all Chinese characters
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
    
    console.log('Cloud processed data (first 20):', sortedData.slice(0, 20));
    
    const values = sortedData.map(w => Math.log2(w.value + 1));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    const scale = scaleLinear()
      .domain([minVal, maxVal])
      .range([12, 60]);
    
    return sortedData.map((item, index) => ({
      text: item.text,
      value: item.value,
      size: scale(Math.log2(item.value + 1)),
      rank: index + 1,
      isHighlighted: highlightedWord === item.text,
      isChinese: containsChinese(item.text)
    }));
  }, [wordFrequency, filterMinFreq, searchTerm, maxWords, highlightedWord]);

  const stats = useMemo(() => {
    if (processedData.length === 0) return null;
    
    const searchResults = searchTerm ? processedData.length : null;
    const chineseWords = processedData.filter(w => w.isChinese).length;
    const englishWords = processedData.filter(w => !w.isChinese).length;
    
    return {
      totalWords: processedData.length,
      maxFrequency: Math.max(...processedData.map(w => w.value)),
      avgFrequency: Math.round(processedData.reduce((sum, w) => sum + w.value, 0) / processedData.length),
      searchResults,
      chineseWords,
      englishWords,
      uniqueLetters: new Set(processedData.map(w => w.text).join('').toLowerCase()).size
    };
  }, [processedData, searchTerm]);

  return {
    processedData,
    stats,
    cloudDimensions
  };
};
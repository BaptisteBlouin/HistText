import { useEffect, useCallback, useRef } from 'react';

interface UseWordCloudProcessorProps {
  allResults: any[];
  authAxios: any;
  setWordFrequency: (frequency: any[]) => void;
  setIsCloudLoading: (loading: boolean) => void;
  setCloudProgress: (progress: number) => void;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

// Simple but effective text processing
const processText = (text: string): string[] => {
  if (!text || typeof text !== 'string') return [];
  
  // Basic cleaning
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  const words = cleaned.split(' ').filter(word => {
    if (word.length < 3 || word.length > 25) return false;
    
    // Enhanced stop words list
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 
      'how', 'man', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 
      'its', 'let', 'put', 'say', 'she', 'too', 'use', 'way', 'may', 'come',
      'could', 'than', 'been', 'call', 'find', 'long', 'down', 'side', 'been',
      'now', 'find', 'head', 'came', 'made', 'over', 'move', 'much', 'where',
      'right', 'think', 'take', 'just', 'into', 'year', 'your', 'good', 'some',
      'time', 'very', 'when', 'much', 'know', 'would', 'there', 'each', 'which',
      'more', 'like', 'other', 'after', 'first', 'well', 'water', 'little'
    ]);
    
    return !stopWords.has(word) && !/^\d+$/.test(word);
  });
  
  return words;
};

// Find the best text column automatically
const findContentColumn = (results: any[]): string | null => {
  if (results.length === 0) return null;
  
  const sample = results.slice(0, 10);
  let bestColumn = '';
  let maxScore = 0;
  
  Object.keys(sample[0]).forEach(key => {
    let score = 0;
    sample.forEach(row => {
      const value = row[key];
      if (typeof value === 'string' && value.length > 50) {
        score += value.length;
      }
    });
    
    if (score > maxScore) {
      maxScore = score;
      bestColumn = key;
    }
  });
  
  return bestColumn || null;
};

export const useWordCloudProcessor = ({
  allResults,
  authAxios,
  setWordFrequency,
  setIsCloudLoading,
  setCloudProgress,
  showNotification
}: UseWordCloudProcessorProps) => {
  const isProcessingRef = useRef(false);
  const lastProcessedRef = useRef<string>('');

  const computeCloudOptimized = useCallback(async () => {
    if (isProcessingRef.current) return;

    if (!allResults || allResults.length === 0) {
      setWordFrequency([]);
      return;
    }

    // Simple deduplication
    const currentHash = `${allResults.length}-${Object.keys(allResults[0] || {}).join(',')}`;
    if (lastProcessedRef.current === currentHash) return;

    isProcessingRef.current = true;
    lastProcessedRef.current = currentHash;

    setIsCloudLoading(true);
    setCloudProgress(0);

    try {
      // Find best text column
      const contentColumn = findContentColumn(allResults);
      if (!contentColumn) {
        throw new Error('No suitable text column found');
      }

      setCloudProgress(20);

      // Process in batches to avoid blocking
      const batchSize = 50;
      const wordCounts = new Map<string, number>();
      
      for (let i = 0; i < allResults.length; i += batchSize) {
        const batch = allResults.slice(i, i + batchSize);
        
        // Process batch
        batch.forEach(row => {
          const text = row[contentColumn];
          if (text) {
            const words = processText(text.toString().slice(0, 3000)); // Limit text length
            words.forEach(word => {
              wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            });
          }
        });

        // Update progress
        const progress = 20 + ((i + batchSize) / allResults.length) * 70;
        setCloudProgress(Math.min(progress, 90));
        
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      setCloudProgress(95);

      // Convert to array and sort
      const wordFrequencyData = Array.from(wordCounts.entries())
        .map(([text, value]) => ({ text, value }))
        .filter(item => item.value > 1) // Filter rare words
        .sort((a, b) => b.value - a.value)
        .slice(0, 150); // Limit results

      setWordFrequency(wordFrequencyData);
      setCloudProgress(100);

      showNotification(`Generated word cloud with ${wordFrequencyData.length} terms`, 'success');

    } catch (error) {
      console.error('Error in word cloud computation:', error);
      setWordFrequency([]);
      showNotification('Failed to generate word cloud', 'error');
    } finally {
      setIsCloudLoading(false);
      setTimeout(() => setCloudProgress(0), 1000);
      isProcessingRef.current = false;
    }
  }, [allResults, authAxios, setWordFrequency, setIsCloudLoading, setCloudProgress, showNotification]);

  // Debounced effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      computeCloudOptimized();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [allResults?.length, computeCloudOptimized]);
};
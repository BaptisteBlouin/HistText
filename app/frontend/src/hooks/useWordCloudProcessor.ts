import { useEffect, useCallback, useRef } from 'react';

interface UseWordCloudProcessorProps {
  allResults: any[];
  authAxios: any;
  setWordFrequency: (frequency: any[]) => void;
  setIsCloudLoading: (loading: boolean) => void;
  setCloudProgress: (progress: number) => void;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

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

      setCloudProgress(25);

      // Prepare texts for batch processing
      const maxTextLength = 5000;
      const maxTexts = Math.min(allResults.length, 2000);
      
      const texts = allResults
        .slice(0, maxTexts)
        .map(result => {
          const text = result[contentColumn]?.toString();
          if (!text) return '';
          return text.length > maxTextLength ? text.substring(0, maxTextLength) : text;
        })
        .filter(text => text.length > 10);

      if (texts.length === 0) {
        setWordFrequency([]);
        setIsCloudLoading(false);
        return;
      }

      setCloudProgress(50);

      // Process in batches using the tokenize API (handles Chinese properly)
      const batchSize = 100;
      const wordMap = new Map<string, number>();
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        try {
          const { data } = await authAxios.post('/api/tokenize/batch', {
            texts: batch,
            cloud: true,
            max_tokens_per_text: 200,
          });

          // Process the tokenized results
          data.results.forEach((result: any) => {
            if (result.words && Array.isArray(result.words)) {
              result.words.forEach((word: string) => {
                if (word && typeof word === 'string') {
                  const normalizedWord = word.toLowerCase().trim();
                  // More flexible length check for different languages
                  if (normalizedWord.length >= 1 && normalizedWord.length <= 25) {
                    wordMap.set(normalizedWord, (wordMap.get(normalizedWord) || 0) + 1);
                  }
                }
              });
            }
          });

          const progressPercent = 50 + ((i + batch.length) / texts.length) * 40;
          setCloudProgress(Math.min(progressPercent, 90));

        } catch (err) {
          console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, err);
          // Fallback to basic processing for this batch if API fails
          batch.forEach(text => {
            if (text && typeof text === 'string') {
              // Basic fallback tokenization
              const words = text
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Unicode-aware: keep letters, numbers, spaces
                .split(/\s+/)
                .filter(word => word.length >= 2 && word.length <= 25);
              
              words.forEach(word => {
                wordMap.set(word, (wordMap.get(word) || 0) + 1);
              });
            }
          });
        }
      }

      setCloudProgress(95);

      // Convert to array and sort
      const wordFrequencyData = Array.from(wordMap.entries())
        .map(([text, value]) => ({ text, value }))
        .filter(item => item.value > 1) // Filter rare words
        .sort((a, b) => b.value - a.value)
        .slice(0, 150);

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
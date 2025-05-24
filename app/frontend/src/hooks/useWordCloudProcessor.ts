import { useEffect, useCallback, useRef } from 'react';

interface UseWordCloudProcessorProps {
  allResults: any[];
  authAxios: any;
  setWordFrequency: (frequency: any[]) => void;
  setIsCloudLoading: (loading: boolean) => void;
  setCloudProgress: (progress: number) => void;
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

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
    // Prevent multiple simultaneous processing
    if (isProcessingRef.current) {
      return;
    }

    if (!allResults || allResults.length === 0) {
      setWordFrequency([]);
      return;
    }

    // Create a hash of the current results to avoid reprocessing the same data
    const currentHash = `${allResults.length}-${JSON.stringify(Object.keys(allResults[0] || {})).slice(0, 50)}`;
    if (lastProcessedRef.current === currentHash) {
      return;
    }

    isProcessingRef.current = true;
    lastProcessedRef.current = currentHash;

    setIsCloudLoading(true);
    setCloudProgress(0);

    try {
      const sampleSize = Math.min(allResults.length, 10);
      const columnContentLengths = Object.keys(allResults[0]).map(key => ({
        key,
        length: allResults.slice(0, sampleSize).reduce(
          (acc, curr) => acc + (curr[key]?.toString().length || 0), 0
        ),
      }));
      
      const contentColumn = columnContentLengths.reduce((prev, current) =>
        current.length > prev.length ? current : prev,
      ).key;

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
        return;
      }

      setCloudProgress(25);

      const batchSize = 100;
      const wordMap: Record<string, number> = {};
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        try {
          const { data } = await authAxios.post('/api/tokenize/batch', {
            texts: batch,
            cloud: true,
            max_tokens_per_text: 200,
          });

          data.results.forEach((result: any) => {
            result.words.forEach((word: string) => {
              const normalizedWord = word.toLowerCase().trim();
              if (normalizedWord.length > 2 && normalizedWord.length < 25) {
                wordMap[normalizedWord] = (wordMap[normalizedWord] || 0) + 1;
              }
            });
          });

          const progressPercent = 25 + ((i + batch.length) / texts.length) * 65;
          setCloudProgress(Math.min(progressPercent, 90));

        } catch (err) {
          console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, err);
        }
      }

      setCloudProgress(95);

      const wordFrequencyData = Object.entries(wordMap)
        .map(([text, value]) => ({ text, value }))
        .filter(item => item.value > 1)
        .sort((a, b) => b.value - a.value)
        .slice(0, 150);

      setWordFrequency(wordFrequencyData);
      setCloudProgress(100);

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

  useEffect(() => {
    // Add a small delay to debounce rapid changes
    const timeoutId = setTimeout(() => {
      computeCloudOptimized();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [allResults?.length]); // Only depend on the length, not the entire array
};
import { useMemo } from "react";
import { scaleLinear } from "d3-scale";

/**
 * Detect if a string contains at least one Chinese character.
 * @param text - The input string.
 * @returns True if the string contains any Chinese character, false otherwise.
 */
const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fff]/.test(text);
};

/**
 * Props for useCloudData custom hook.
 */
interface UseCloudDataProps {
  wordFrequency: { text: string; value: number }[];
  filterMinFreq: number;
  searchTerm: string;
  maxWords: number;
  highlightedWord: string | null;
  fullscreen: boolean;
  isMobile: boolean;
}

/**
 * Custom React hook to prepare word cloud data, supporting both Chinese and English words.
 * Handles frequency filtering, word filtering, responsive cloud dimensions, highlighting,
 * and basic statistics computation.
 *
 * @param props - UseCloudDataProps object
 * @returns Object containing processedData, stats, and cloudDimensions
 *
 * - processedData: Array of processed word objects for cloud rendering
 * - stats: Summary statistics about the current filtered/processed word data
 * - cloudDimensions: Recommended width/height for the cloud, responsive to fullscreen/mobile
 */
export const useCloudData = ({
  wordFrequency,
  filterMinFreq,
  searchTerm,
  maxWords,
  highlightedWord,
  fullscreen,
  isMobile,
}: UseCloudDataProps) => {
  /**
   * Calculates responsive cloud dimensions based on fullscreen and device type.
   */
  const cloudDimensions = useMemo(() => {
    const baseWidth = fullscreen
      ? window.innerWidth - 100
      : isMobile
        ? 350
        : 800;
    const baseHeight = fullscreen
      ? window.innerHeight - 200
      : isMobile
        ? 300
        : 500;
    return { width: baseWidth, height: baseHeight };
  }, [isMobile, fullscreen]);

  /**
   * Processes the input word frequency data for use in the word cloud.
   * Applies:
   * - Frequency filtering (minimum threshold)
   * - Character length and language (Chinese/English) filters
   * - Stop words for English
   * - Search term filtering
   * - Sorting by frequency and slicing by maxWords
   * - Scaling for font size
   * - Highlighted word marking
   * Returns a list of processed words with additional info for rendering.
   */
  const processedData = useMemo(() => {
    if (!wordFrequency || wordFrequency.length === 0) return [];

    let filtered = wordFrequency
      .filter((item) => item.value >= filterMinFreq)
      .filter((item) => {
        const word = item.text.toLowerCase();
        const isChinese = containsChinese(item.text);

        // Filter by length: Chinese (1-4 chars), English (2-25 chars)
        if (isChinese) {
          if (item.text.length < 1 || item.text.length > 4) return false;
        } else {
          if (word.length < 2 || word.length > 25) return false;
        }

        // Only apply English stop words to non-Chinese text
        if (!isChinese) {
          const stopWords = new Set([
            "the",
            "and",
            "for",
            "are",
            "but",
            "not",
            "you",
            "all",
            "can",
            "had",
            "her",
            "was",
            "one",
            "our",
            "out",
            "day",
            "get",
            "has",
            "him",
            "his",
            "how",
            "man",
            "new",
            "now",
            "old",
            "see",
            "two",
            "who",
            "boy",
            "did",
            "its",
            "let",
            "put",
            "say",
            "she",
            "too",
            "use",
          ]);
          return !stopWords.has(word);
        }

        return true; // Accept all Chinese characters
      });

    // Apply search term if any
    if (searchTerm) {
      filtered = filtered.filter((item) =>
        item.text.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    const sortedData = filtered
      .sort((a, b) => b.value - a.value)
      .slice(0, maxWords);

    if (sortedData.length === 0) return [];

    const values = sortedData.map((w) => Math.log2(w.value + 1));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    // Linear scaling for word font size
    const scale = scaleLinear().domain([minVal, maxVal]).range([12, 60]);

    return sortedData.map((item, index) => ({
      text: item.text,
      value: item.value,
      size: scale(Math.log2(item.value + 1)),
      rank: index + 1,
      isHighlighted: highlightedWord === item.text,
      isChinese: containsChinese(item.text),
    }));
  }, [wordFrequency, filterMinFreq, searchTerm, maxWords, highlightedWord]);

  /**
   * Computes summary statistics about the processedData:
   * - totalWords: Count of filtered/processed words
   * - maxFrequency: Highest occurrence count in processedData
   * - avgFrequency: Average occurrence in processedData
   * - searchResults: Count of search-filtered words (if searchTerm)
   * - chineseWords: Count of Chinese words
   * - englishWords: Count of non-Chinese words
   * - uniqueLetters: Unique character count across all processed words
   */
  const stats = useMemo(() => {
    if (processedData.length === 0) return null;

    const searchResults = searchTerm ? processedData.length : null;
    const chineseWords = processedData.filter((w) => w.isChinese).length;
    const englishWords = processedData.filter((w) => !w.isChinese).length;

    return {
      totalWords: processedData.length,
      maxFrequency: Math.max(...processedData.map((w) => w.value)),
      avgFrequency: Math.round(
        processedData.reduce((sum, w) => sum + w.value, 0) /
          processedData.length,
      ),
      searchResults,
      chineseWords,
      englishWords,
      uniqueLetters: new Set(
        processedData
          .map((w) => w.text)
          .join("")
          .toLowerCase(),
      ).size,
    };
  }, [processedData, searchTerm]);

  return {
    processedData,
    stats,
    cloudDimensions,
  };
};

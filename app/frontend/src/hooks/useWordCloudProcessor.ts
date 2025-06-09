import { useEffect, useCallback, useRef } from "react";

interface UseWordCloudProcessorProps {
  allResults: any[];
  authAxios: any;
  setWordFrequency: (frequency: any[]) => void;
  setIsCloudLoading: (loading: boolean) => void;
  setCloudProgress: (progress: number) => void;
  showNotification: (
    message: string,
    severity?: "success" | "error" | "warning" | "info",
  ) => void;
}

// Find the best text column automatically
const findContentColumn = (results: any[]): string | null => {
  if (results.length === 0) return null;

  const sample = results.slice(0, 10);
  let bestColumn = "";
  let maxScore = 0;

  Object.keys(sample[0]).forEach((key) => {
    let score = 0;
    sample.forEach((row) => {
      const value = row[key];
      if (typeof value === "string" && value.length > 50) {
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

// Enhanced function to detect if text contains Chinese characters
const containsChinese = (text: string): boolean => {
  return /[\u4e00-\u9fff]/.test(text);
};

// Check if a word is meaningful - FIXED for Chinese
const isMeaningfulWord = (word: string, isChinese: boolean): boolean => {
  if (!word || typeof word !== "string") return false;

  const trimmed = word.trim();
  if (!trimmed) return false;

  if (isChinese) {
    // For Chinese: accept ANY Chinese character(s), even single characters
    return (
      /[\u4e00-\u9fff]/.test(trimmed) &&
      trimmed.length >= 1 &&
      trimmed.length <= 4
    );
  } else {
    // For non-Chinese: require at least 2 characters
    return (
      trimmed.length >= 2 && trimmed.length <= 25 && /[a-zA-Z]/.test(trimmed)
    );
  }
};

// Fallback tokenizer that properly handles Chinese
const fallbackTokenize = (text: string): string[] => {
  console.log("Using fallback tokenizer for:", text.substring(0, 100) + "...");

  const hasChinese = containsChinese(text);

  if (hasChinese) {
    const words: string[] = [];

    // Extract Chinese characters/words
    const chineseRegex = /[\u4e00-\u9fff]+/g;
    let match;

    while ((match = chineseRegex.exec(text)) !== null) {
      const segment = match[0];

      // Add individual Chinese characters
      for (let i = 0; i < segment.length; i++) {
        words.push(segment[i]);
      }

      // Add 2-character combinations for better context
      for (let i = 0; i < segment.length - 1; i++) {
        words.push(segment.substring(i, i + 2));
      }

      // If segment is 3-4 characters, also add as whole word
      if (segment.length >= 3 && segment.length <= 4) {
        words.push(segment);
      }
    }

    // Also extract English words from mixed text
    const englishWords = text
      .replace(/[\u4e00-\u9fff]/g, " ")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && word.length <= 25);

    console.log(
      "Fallback extracted Chinese words (first 10):",
      words.slice(0, 10),
    );
    return [...words, ...englishWords];
  } else {
    // Standard English tokenization
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && word.length <= 25);
  }
};

export const useWordCloudProcessor = ({
  allResults,
  authAxios,
  setWordFrequency,
  setIsCloudLoading,
  setCloudProgress,
  showNotification,
}: UseWordCloudProcessorProps) => {
  const isProcessingRef = useRef(false);
  const lastProcessedRef = useRef<string>("");

  const computeCloudOptimized = useCallback(async () => {
    if (isProcessingRef.current) return;

    if (!allResults || allResults.length === 0) {
      setWordFrequency([]);
      return;
    }

    // Simple deduplication
    const currentHash = `${allResults.length}-${Object.keys(allResults[0] || {}).join(",")}`;
    if (lastProcessedRef.current === currentHash) return;

    isProcessingRef.current = true;
    lastProcessedRef.current = currentHash;

    setIsCloudLoading(true);
    setCloudProgress(0);

    try {
      // Find best text column
      const contentColumn = findContentColumn(allResults);
      if (!contentColumn) {
        showNotification(
          "No suitable text content found for word cloud generation",
          "info",
        );
        setWordFrequency([]);
        return;
      }

      console.log("Using content column:", contentColumn);
      setCloudProgress(25);

      // Prepare texts for batch processing
      const maxTextLength = 5000;
      const maxTexts = Math.min(allResults.length, 2000);

      const texts = allResults
        .slice(0, maxTexts)
        .map((result) => {
          const text = result[contentColumn]?.toString();
          if (!text) return "";
          return text.length > maxTextLength
            ? text.substring(0, maxTextLength)
            : text;
        })
        .filter((text) => text.length > 10);

      if (texts.length === 0) {
        setWordFrequency([]);
        setIsCloudLoading(false);
        return;
      }

      console.log("Processing", texts.length, "texts");
      setCloudProgress(50);

      // Check if any text contains Chinese to determine processing strategy
      const hasChineseContent = texts.some((text) => containsChinese(text));
      console.log("Detected Chinese content:", hasChineseContent);
      console.log("Sample text:", texts[0].substring(0, 200));

      // Process in batches using the tokenize API (handles Chinese properly)
      const batchSize = hasChineseContent ? 50 : 100;
      const wordMap = new Map<string, number>();
      let apiSuccessCount = 0;
      let apiFailureCount = 0;

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        console.log(
          `Attempting API call for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`,
        );

        try {
          console.log("Making API request to /api/tokenize/batch...");

          const { data } = await authAxios.post("/api/tokenize/batch", {
            texts: batch,
            cloud: true,
            max_tokens_per_text: hasChineseContent ? 300 : 200,
          });

          console.log("API response received:", data);

          // Process the tokenized results
          if (data.results && Array.isArray(data.results)) {
            console.log("Processing", data.results.length, "results from API");

            data.results.forEach((result: any, idx: number) => {
              if (result.words && Array.isArray(result.words)) {
                console.log(
                  `Result ${idx} has ${result.words.length} words:`,
                  result.words.slice(0, 10),
                );

                result.words.forEach((word: string) => {
                  if (word && typeof word === "string") {
                    const normalizedWord = word.trim();
                    // FIXED: Accept single Chinese characters
                    if (hasChineseContent) {
                      // For Chinese content: accept any Chinese character(s)
                      if (
                        /[\u4e00-\u9fff]/.test(normalizedWord) &&
                        normalizedWord.length >= 1 &&
                        normalizedWord.length <= 4
                      ) {
                        wordMap.set(
                          normalizedWord,
                          (wordMap.get(normalizedWord) || 0) + 1,
                        );
                      }
                      // Also accept English words in mixed content
                      else if (
                        /[a-zA-Z]/.test(normalizedWord) &&
                        normalizedWord.length >= 2 &&
                        normalizedWord.length <= 25
                      ) {
                        wordMap.set(
                          normalizedWord.toLowerCase(),
                          (wordMap.get(normalizedWord.toLowerCase()) || 0) + 1,
                        );
                      }
                    } else {
                      // For non-Chinese content: require at least 2 characters
                      if (
                        normalizedWord.length >= 2 &&
                        normalizedWord.length <= 25
                      ) {
                        wordMap.set(
                          normalizedWord.toLowerCase(),
                          (wordMap.get(normalizedWord.toLowerCase()) || 0) + 1,
                        );
                      }
                    }
                  }
                });
              } else {
                console.log(`Result ${idx} has no words:`, result);
              }
            });
            apiSuccessCount++;
            console.log("API call successful. Word map size:", wordMap.size);
          } else {
            console.log("API response missing results:", data);
          }

          const progressPercent = 50 + ((i + batch.length) / texts.length) * 40;
          setCloudProgress(Math.min(progressPercent, 90));
        } catch (err) {
          apiFailureCount++;
          console.error(
            `API call failed for batch ${Math.floor(i / batchSize) + 1}:`,
            err,
          );
          console.error("Error details:", {
            message: err.message,
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
          });

          // Enhanced fallback processing for this batch
          console.log("Using fallback processing for batch");
          batch.forEach((text) => {
            if (text && typeof text === "string") {
              const words = fallbackTokenize(text);
              words.forEach((word) => {
                if (isMeaningfulWord(word, hasChineseContent)) {
                  const key = hasChineseContent ? word : word.toLowerCase();
                  wordMap.set(key, (wordMap.get(key) || 0) + 1);
                }
              });
            }
          });
        }
      }

      console.log(
        `API processing complete. Successes: ${apiSuccessCount}, Failures: ${apiFailureCount}`,
      );
      console.log("Final word map size:", wordMap.size);

      setCloudProgress(95);

      // FIXED: More lenient filtering for Chinese
      const minFrequency = hasChineseContent ? 1 : 2; // Allow frequency of 1 for Chinese

      // Convert to array and sort
      const wordFrequencyData = Array.from(wordMap.entries())
        .map(([text, value]) => ({ text, value }))
        .filter((item) => item.value >= minFrequency)
        .sort((a, b) => b.value - a.value)
        .slice(0, 150);

      console.log(
        "Final word frequency data (first 20):",
        wordFrequencyData.slice(0, 20),
      );

      setWordFrequency(wordFrequencyData);
      setCloudProgress(100);

      const apiStatus =
        apiSuccessCount > 0
          ? "with API processing"
          : "with fallback processing only";
      const message = hasChineseContent
        ? `Generated word cloud with ${wordFrequencyData.length} terms (Chinese content ${apiStatus})`
        : `Generated word cloud with ${wordFrequencyData.length} terms (${apiStatus})`;

      showNotification(message, apiSuccessCount > 0 ? "success" : "warning");
    } catch (error) {
      console.error("Error in word cloud computation:", error);
      setWordFrequency([]);
      showNotification(
        "Word cloud generation failed, but your data is still available",
        "warning",
      );
    } finally {
      setIsCloudLoading(false);
      setTimeout(() => setCloudProgress(0), 1000);
      isProcessingRef.current = false;
    }
  }, [
    allResults,
    authAxios,
    setWordFrequency,
    setIsCloudLoading,
    setCloudProgress,
    showNotification,
  ]);
  // Debounced effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      computeCloudOptimized();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [allResults?.length, computeCloudOptimized]);
};

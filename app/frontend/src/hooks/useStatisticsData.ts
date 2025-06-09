import { useMemo, useCallback } from "react";

interface StatItem {
  metric?: string;
  value?: string;
  length?: number;
  count?: number;
  language?: string;
  punct?: string;
  field?: string;
  percentage?: string;
  ngram?: string;
  key?: string;
}

// Memoized format value function
export const formatValue = (value: any): string => {
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    } else {
      return value.toFixed(2);
    }
  }
  return String(value);
};

export const useStatisticsData = (stats: any, selectedStat: string) => {
  const transformData = useCallback(
    (stats: any, selectedStat: string): StatItem[] => {
      if (!stats || !selectedStat) return [];

      try {
        switch (selectedStat) {
          case "corpus_overview":
            if (!stats.corpus_overview) return [];
            return Object.entries(stats.corpus_overview).map(
              ([key, value]) => ({
                metric: key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase()),
                value: formatValue(value),
              }),
            );

          case "document_length_stats":
            if (!stats.document_length_stats) return [];
            return Object.entries(stats.document_length_stats).map(
              ([key, value]) => ({
                metric: key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase()),
                value: formatValue(value),
              }),
            );

          case "word_length_distribution":
            if (!Array.isArray(stats.word_length_distribution)) return [];
            return stats.word_length_distribution.map(
              ([length, count]: [number, number]) => ({
                length: length,
                count: count,
              }),
            );

          case "languages_detected":
            if (!stats.languages_detected) return [];
            return Object.entries(stats.languages_detected).map(
              ([lang, count]) => ({
                language: lang.toUpperCase(),
                count: Number(formatValue(count)),
              }),
            );

          case "most_common_punctuation":
            if (!Array.isArray(stats.most_common_punctuation)) return [];
            return stats.most_common_punctuation.map(
              ([punct, count]: [string, number]) => ({
                punct: punct,
                count: count,
              }),
            );

          case "field_completeness_percentage":
            if (!stats.field_completeness_percentage) return [];
            return Object.entries(stats.field_completeness_percentage)
              .map(([field, percentage]) => ({
                field: field.replace(/_/g, " "),
                percentage: `${Number(percentage).toFixed(1)}%`,
              }))
              .sort(
                (a, b) => parseFloat(b.percentage) - parseFloat(a.percentage),
              );

          case "most_frequent_words":
          case "most_frequent_bigrams":
          case "most_frequent_trigrams":
            if (!Array.isArray(stats[selectedStat])) return [];
            return stats[selectedStat].map(
              ([ngram, count]: [string, number]) => ({
                ngram: ngram,
                count: count,
              }),
            );

          default:
            if (selectedStat.startsWith("distribution_over_")) {
              if (
                !stats[selectedStat] ||
                typeof stats[selectedStat] !== "object"
              )
                return [];
              return Object.entries(stats[selectedStat])
                .map(([key, value]) => ({
                  key: String(key),
                  value: String(key),
                  count: Number(value) || 0,
                }))
                .sort((a, b) => {
                  if (
                    selectedStat === "distribution_over_time" ||
                    selectedStat === "distribution_over_decades"
                  ) {
                    return a.key.localeCompare(b.key);
                  }
                  return b.count - a.count;
                });
            }

            if (!stats[selectedStat] || typeof stats[selectedStat] !== "object")
              return [];
            return Object.entries(stats[selectedStat])
              .map(([key, value]) => ({
                key: String(key),
                value: String(key),
                count: Number(value) || 0,
              }))
              .sort((a, b) => b.count - a.count);
        }
      } catch (error) {
        console.error("Error in transformData:", error);
        return [];
      }
    },
    [],
  );

  const rowData = useMemo(
    () => transformData(stats, selectedStat),
    [stats, selectedStat, transformData],
  );

  return { rowData, transformData };
};

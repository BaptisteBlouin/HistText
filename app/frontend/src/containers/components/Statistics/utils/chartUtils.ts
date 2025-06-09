// Memoized chart color generator
export const generateChartColors = (dataLength: number): string[] => {
  const baseColors = [
    "rgba(25, 118, 210, 0.8)",
    "rgba(56, 142, 60, 0.8)",
    "rgba(245, 124, 0, 0.8)",
    "rgba(123, 31, 162, 0.8)",
    "rgba(211, 47, 47, 0.8)",
    "rgba(69, 90, 100, 0.8)",
    "rgba(0, 150, 136, 0.8)",
    "rgba(255, 152, 0, 0.8)",
  ];

  if (dataLength <= baseColors.length) {
    return baseColors.slice(0, dataLength);
  }

  const colors = [];
  for (let i = 0; i < dataLength; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
};

// Memoized recommended chart type function
export const getRecommendedChartType = (
  selectedStat: string,
): "bar" | "pie" | "line" => {
  if (
    selectedStat === "distribution_over_time" ||
    selectedStat === "distribution_over_decades" ||
    selectedStat === "word_length_distribution"
  ) {
    return "line";
  }

  if (
    selectedStat === "languages_detected" ||
    selectedStat === "most_common_punctuation"
  ) {
    return "pie";
  }

  return "bar";
};

export const getStatDisplayName = (stat: string): string => {
  const displayNames: { [key: string]: string } = {
    corpus_overview: "Corpus Overview",
    document_length_stats: "Document Length Stats",
    word_length_distribution: "Word Length Distribution",
    languages_detected: "Languages Detected",
    most_common_punctuation: "Punctuation Analysis",
    field_completeness_percentage: "Field Completeness",
    distribution_over_time: "Timeline Distribution",
    distribution_over_decades: "Decade Distribution",
    most_frequent_words: "Frequent Words",
    most_frequent_bigrams: "Frequent Bigrams",
    most_frequent_trigrams: "Frequent Trigrams",
  };

  return (
    displayNames[stat] ||
    stat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

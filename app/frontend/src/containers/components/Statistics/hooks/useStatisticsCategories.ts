import { useMemo } from "react";
import {
  Assessment,
  InsertChart,
  DataUsage,
  Analytics,
  Timeline,
  TrendingUp,
} from "@mui/icons-material";

export const useStatisticsCategories = (stats: any) => {
  return useMemo(() => {
    const categories = {
      overview: {
        title: "Overview",
        icon: Assessment,
        color: "#1976d2",
        stats: ["corpus_overview", "document_length_stats"],
      },
      content: {
        title: "Content Analysis",
        icon: InsertChart,
        color: "#388e3c",
        stats: [
          "most_frequent_words",
          "most_frequent_bigrams",
          "most_frequent_trigrams",
          "word_length_distribution",
        ],
      },
      language: {
        title: "Language & Style",
        icon: DataUsage,
        color: "#f57c00",
        stats: ["languages_detected", "most_common_punctuation"],
      },
      metadata: {
        title: "Metadata & Fields",
        icon: Analytics,
        color: "#7b1fa2",
        stats: ["field_completeness_percentage"],
      },
      temporal: {
        title: "Time Analysis",
        icon: Timeline,
        color: "#d32f2f",
        stats: ["distribution_over_time", "distribution_over_decades"],
      },
      distributions: {
        title: "Other Distributions",
        icon: TrendingUp,
        color: "#455a64",
        stats: Object.keys(stats).filter(
          (key) =>
            key.startsWith("distribution_over_") &&
            !["distribution_over_time", "distribution_over_decades"].includes(
              key,
            ),
        ),
      },
    };

    return Object.fromEntries(
      Object.entries(categories).filter(([, category]) =>
        category.stats.some((stat) => stats[stat]),
      ),
    );
  }, [stats]);
};

import { useMemo } from "react";
import { generateChartColors } from "../utils/chartUtils";

export const useChartData = (
  stats: any,
  selectedStat: string,
  rowData: any[],
  currentChartType: "bar" | "pie" | "line",
) => {
  return useMemo(() => {
    if (!stats[selectedStat] || rowData.length === 0) {
      return { chartData: null, chartOptions: null };
    }

    const shouldShowChart =
      selectedStat.startsWith("distribution_over_") ||
      selectedStat === "word_length_distribution" ||
      selectedStat === "languages_detected" ||
      selectedStat === "most_common_punctuation" ||
      selectedStat === "field_completeness_percentage" ||
      selectedStat === "most_frequent_words" ||
      selectedStat === "most_frequent_bigrams" ||
      selectedStat === "most_frequent_trigrams";

    if (!shouldShowChart) {
      return { chartData: null, chartOptions: null };
    }

    let labels: string[] = [];
    let data: number[] = [];
    let chartTitle = selectedStat
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    if (selectedStat === "word_length_distribution") {
      if (Array.isArray(stats[selectedStat])) {
        const sortedData = stats[selectedStat].sort(
          (a: any, b: any) => a[0] - b[0],
        );
        labels = sortedData.map(
          (item: any) => `${item[0]} char${item[0] === 1 ? "" : "s"}`,
        );
        data = sortedData.map((item: any) => item[1]);
      }
    } else if (selectedStat === "field_completeness_percentage") {
      if (stats[selectedStat]) {
        const entries = Object.entries(stats[selectedStat]).sort(
          ([, a], [, b]) => (b as number) - (a as number),
        );
        labels = entries.map(([field]) => field.replace(/_/g, " "));
        data = entries.map(([, percentage]) => Number(percentage));
      }
    } else if (
      selectedStat === "languages_detected" ||
      selectedStat === "most_common_punctuation"
    ) {
      if (stats[selectedStat]) {
        if (selectedStat === "languages_detected") {
          const entries = Object.entries(stats[selectedStat]);
          labels = entries.map(([lang]) => lang.toUpperCase());
          data = entries.map(([, count]) => Number(count));
        } else {
          const punctData = stats[selectedStat].slice(0, 10);
          labels = punctData.map((item: any) => `"${item[0]}"`);
          data = punctData.map((item: any) => item[1]);
        }
      }
    } else if (selectedStat.startsWith("most_frequent_")) {
      if (Array.isArray(stats[selectedStat])) {
        const topItems = stats[selectedStat].slice(0, 20);
        labels = topItems.map((item: any) => item[0]);
        data = topItems.map((item: any) => item[1]);
      }
    } else if (selectedStat.startsWith("distribution_over_")) {
      if (typeof stats[selectedStat] === "object") {
        const entries = Object.entries(stats[selectedStat]);

        if (
          selectedStat === "distribution_over_time" ||
          selectedStat === "distribution_over_decades"
        ) {
          entries.sort(([a], [b]) => a.localeCompare(b));
        } else {
          entries.sort(([, a], [, b]) => (b as number) - (a as number));
        }

        labels = entries.map(([key]) => String(key));
        data = entries.map(([, value]) => Number(value));
      }
    }

    if (labels.length === 0 || data.length === 0) {
      return { chartData: null, chartOptions: null };
    }

    const colors = generateChartColors(data.length);

    const chartData = {
      labels,
      datasets: [
        {
          label: chartTitle,
          data,
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace("0.8", "1")),
          borderWidth: 2,
          tension: currentChartType === "line" ? 0.4 : 0,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: chartTitle,
          font: {
            size: 16,
            weight: "bold",
          },
        },
        legend: {
          display: currentChartType === "pie",
          position:
            currentChartType === "pie" ? ("right" as const) : ("top" as const),
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          titleColor: "white",
          bodyColor: "white",
          borderColor: "rgba(255, 255, 255, 0.2)",
          borderWidth: 1,
        },
      },
      scales:
        currentChartType !== "pie"
          ? {
              y: {
                beginAtZero: true,
                grid: {
                  color: "rgba(0, 0, 0, 0.1)",
                },
              },
              x: {
                grid: {
                  color: "rgba(0, 0, 0, 0.1)",
                },
              },
            }
          : undefined,
    };

    return { chartData, chartOptions };
  }, [selectedStat, stats, rowData, currentChartType]);
};

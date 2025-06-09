import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js/auto";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import { useStatisticsData } from "../../hooks/useStatisticsData";
import { useChartData } from "./Statistics/hooks/useChartData";
import { useStatisticsCategories } from "./Statistics/hooks/useStatisticsCategories";
import { useStatisticsNavigation } from "./Statistics/hooks/useStatisticsNavigation";
import { getRecommendedChartType } from "./Statistics/utils/chartUtils";
import StatisticsSidebar from "./Statistics/components/StatisticsSidebar";
import StatisticsMainContent from "./Statistics/components/StatisticsMainContent";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
);

interface StatisticsDisplayProps {
  stats: any;
  selectedStat: string;
  onStatChange: (stat: string) => void;
}

const StatisticsDisplay: React.FC<StatisticsDisplayProps> = React.memo(
  ({ stats, selectedStat, onStatChange }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const [gridApi, setGridApi] = useState<any>(null);
    const chartRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Local state
    const [manualChartType, setManualChartType] = useState<
      "bar" | "pie" | "line" | null
    >(null);
    const [activeCategory, setActiveCategory] = useState<string>("overview");
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
      new Set(["overview"]),
    );
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [showChart, setShowChart] = useState<boolean>(true);

    // Custom hooks
    const { rowData } = useStatisticsData(stats, selectedStat);
    const statCategories = useStatisticsCategories(stats);
    const { navigationInfo, navigateToStat } = useStatisticsNavigation(
      statCategories,
      stats,
      selectedStat,
      onStatChange,
    );

    // Get current chart type (auto or manual)
    const currentChartType = useMemo(() => {
      return manualChartType || getRecommendedChartType(selectedStat);
    }, [manualChartType, selectedStat]);

    // Chart data
    const { chartData, chartOptions } = useChartData(
      stats,
      selectedStat,
      rowData,
      currentChartType,
    );

    // Reset manual chart type when stat changes
    useEffect(() => {
      setManualChartType(null);
    }, [selectedStat]);

    // Update active category when selectedStat changes
    useEffect(() => {
      if (!selectedStat || selectedStat === "Select Statistics") {
        onStatChange("corpus_overview");
        setActiveCategory("overview");
        return;
      }

      for (const [categoryKey, category] of Object.entries(statCategories)) {
        if ((category as any).stats.includes(selectedStat)) {
          setActiveCategory(categoryKey);
          break;
        }
      }
    }, [selectedStat, statCategories, onStatChange]);

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          navigateToStat("prev");
        } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          navigateToStat("next");
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [navigateToStat]);

    // Memoized filtered categories
    const filteredCategories = useMemo(() => {
      if (!searchTerm) return statCategories;

      const filtered: any = {};
      Object.entries(statCategories).forEach(
        ([categoryKey, category]: [string, any]) => {
          const matchingStats = category.stats.filter((stat: string) => {
            const displayName = stat
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase());
            return displayName.toLowerCase().includes(searchTerm.toLowerCase());
          });
          if (matchingStats.length > 0) {
            filtered[categoryKey] = { ...category, stats: matchingStats };
          }
        },
      );
      return filtered;
    }, [statCategories, searchTerm]);

    // Handlers
    const toggleCategoryExpansion = useCallback((categoryKey: string) => {
      setExpandedCategories((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(categoryKey)) {
          newExpanded.delete(categoryKey);
        } else {
          newExpanded.add(categoryKey);
        }
        return newExpanded;
      });
    }, []);

    const onGridReady = useCallback((params: any) => {
      setGridApi(params.api);
      params.api.sizeColumnsToFit();
    }, []);

    const downloadCsv = useCallback(() => {
      if (gridApi) {
        gridApi.exportDataAsCsv({
          fileName: `${selectedStat}_data_${new Date().toISOString().split("T")[0]}.csv`,
        });
      }
    }, [gridApi, selectedStat]);

    const downloadChart = useCallback(() => {
      if (chartRef.current) {
        const url = chartRef.current.toBase64Image();
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selectedStat}_chart_${new Date().toISOString().split("T")[0]}.png`;
        link.click();
      }
    }, [selectedStat]);

    const shouldDisplayChart = chartData !== null;

    return (
      <Box
        ref={containerRef}
        tabIndex={0}
        sx={{
          display: "flex",
          height: "100%",
          bgcolor: "background.default",
          flexDirection: isMobile ? "column" : "row",
          gap: 3,
          p: 3,
          outline: "none",
        }}
      >
        <StatisticsSidebar
          statCategories={statCategories}
          stats={stats}
          selectedStat={selectedStat}
          activeCategory={activeCategory}
          expandedCategories={expandedCategories}
          searchTerm={searchTerm}
          filteredCategories={filteredCategories}
          onStatChange={onStatChange}
          onCategoryToggle={toggleCategoryExpansion}
          onSearchChange={setSearchTerm}
        />

        <StatisticsMainContent
          stats={stats}
          selectedStat={selectedStat}
          chartData={chartData}
          chartOptions={chartOptions}
          currentChartType={currentChartType}
          rowData={rowData}
          navigationInfo={navigationInfo}
          shouldDisplayChart={shouldDisplayChart}
          showChart={showChart}
          isMobile={isMobile}
          onNavigate={navigateToStat}
          onDownloadCsv={downloadCsv}
          onDownloadChart={downloadChart}
          onToggleChart={setShowChart}
          onChartTypeChange={setManualChartType}
          onGridReady={onGridReady}
        />
      </Box>
    );
  },
);

StatisticsDisplay.displayName = "StatisticsDisplay";

export default StatisticsDisplay;

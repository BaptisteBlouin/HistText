import React, { useRef, useCallback } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Card,
  CardContent,
  Box,
  Typography,
  IconButton,
  ButtonGroup,
  Tooltip as MUITooltip,
} from "@mui/material";
import { BarChart, PieChart, ShowChart } from "@mui/icons-material";
import { getRecommendedChartType } from "../utils/chartUtils";

interface StatisticsChartProps {
  chartData: any;
  chartOptions: any;
  currentChartType: "bar" | "pie" | "line";
  selectedStat: string;
  onChartTypeChange: (type: "bar" | "pie" | "line") => void;
}

const StatisticsChart: React.FC<StatisticsChartProps> = ({
  chartData,
  chartOptions,
  currentChartType,
  selectedStat,
  onChartTypeChange,
}) => {
  const chartRef = useRef<any>(null);
  const chartInstanceRef = useRef<any>(null);

  if (!chartData) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <ShowChart
          sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.5 }}
        />
        <Typography variant="h6" color="text.secondary">
          No chart data available
        </Typography>
      </Box>
    );
  }

  const ChartComponent =
    currentChartType === "pie" ? Pie : currentChartType === "line" ? Line : Bar;
  const recommendedType = getRecommendedChartType(selectedStat);

  return (
    <Card sx={{ height: "60vh", p: 2 }}>
      <CardContent sx={{ height: "100%", position: "relative" }}>
        <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
          <ButtonGroup size="small" variant="outlined">
            <MUITooltip
              title={`Bar Chart${recommendedType === "bar" ? " (Recommended)" : ""}`}
            >
              <IconButton
                onClick={() => onChartTypeChange("bar")}
                color={currentChartType === "bar" ? "primary" : "default"}
              >
                <BarChart />
              </IconButton>
            </MUITooltip>
            <MUITooltip
              title={`Line Chart${recommendedType === "line" ? " (Recommended)" : ""}`}
            >
              <IconButton
                onClick={() => onChartTypeChange("line")}
                color={currentChartType === "line" ? "primary" : "default"}
              >
                <ShowChart />
              </IconButton>
            </MUITooltip>
            <MUITooltip
              title={`Pie Chart${recommendedType === "pie" ? " (Recommended)" : ""}`}
            >
              <IconButton
                onClick={() => onChartTypeChange("pie")}
                color={currentChartType === "pie" ? "primary" : "default"}
              >
                <PieChart />
              </IconButton>
            </MUITooltip>
          </ButtonGroup>
        </Box>
        <Box sx={{ height: "100%", pt: 4 }}>
          <ChartComponent
            ref={(ref) => {
              chartRef.current = ref;
              if (ref) {
                chartInstanceRef.current = ref;
              }
            }}
            data={chartData}
            options={chartOptions}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(StatisticsChart);

import React from 'react';
import { Box, Typography, Slide, Fade } from '@mui/material';
import { Analytics } from '@mui/icons-material';
import StatisticsHeader from './StatisticsHeader';
import StatisticsChart from './StatisticsChart';
import StatisticsGrid from './StatisticsGrid';

interface StatisticsMainContentProps {
  stats: any;
  selectedStat: string;
  chartData: any;
  chartOptions: any;
  currentChartType: 'bar' | 'pie' | 'line';
  rowData: any[];
  navigationInfo: any;
  shouldDisplayChart: boolean;
  showChart: boolean;
  isMobile: boolean;
  onNavigate: (direction: 'next' | 'prev') => void;
  onDownloadCsv: () => void;
  onDownloadChart: () => void;
  onToggleChart: (show: boolean) => void;
  onChartTypeChange: (type: 'bar' | 'pie' | 'line') => void;
  onGridReady: (params: any) => void;
}

const StatisticsMainContent: React.FC<StatisticsMainContentProps> = ({
  stats,
  selectedStat,
  chartData,
  chartOptions,
  currentChartType,
  rowData,
  navigationInfo,
  shouldDisplayChart,
  showChart,
  isMobile,
  onNavigate,
  onDownloadCsv,
  onDownloadChart,
  onToggleChart,
  onChartTypeChange,
  onGridReady,
}) => {
  if (!stats || !selectedStat) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Analytics sx={{ fontSize: 80, color: 'text.secondary', mb: 3, opacity: 0.5 }} />
        <Typography variant="h5" color="text.secondary" gutterBottom>
          No Statistics Available
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Execute a query to generate statistical analysis
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <StatisticsHeader
        selectedStat={selectedStat}
        rowDataLength={rowData.length}
        navigationInfo={navigationInfo}
        shouldDisplayChart={shouldDisplayChart}
        showChart={showChart}
        onNavigate={onNavigate}
        onDownloadCsv={onDownloadCsv}
        onDownloadChart={onDownloadChart}
        onToggleChart={onToggleChart}
      />
      
      {shouldDisplayChart && showChart ? (
        <Slide direction="up" in={showChart} mountOnEnter unmountOnExit>
          <Box>
            <StatisticsChart
              chartData={chartData}
              chartOptions={chartOptions}
              currentChartType={currentChartType}
              selectedStat={selectedStat}
              onChartTypeChange={onChartTypeChange}
            />
          </Box>
        </Slide>
      ) : (
        <Fade in={!showChart || !shouldDisplayChart}>
          <Box>
            <StatisticsGrid
              rowData={rowData}
              selectedStat={selectedStat}
              isMobile={isMobile}
              onGridReady={onGridReady}
            />
          </Box>
        </Fade>
      )}
    </Box>
  );
};

export default React.memo(StatisticsMainContent);
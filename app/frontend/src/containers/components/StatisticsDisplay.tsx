import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js/auto';

// Register required components for the chart
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StatisticsDisplayProps {
  stats: any;
  selectedStat: string;
  onStatChange: (stat: string) => void;
}

const StatisticsDisplay: React.FC<StatisticsDisplayProps> = React.memo(
  ({ stats, selectedStat, onStatChange }) => {
    const [gridApi, setGridApi] = useState<any>(null);
    const chartRef = useRef<any>(null);
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Set default to "overview" if no stat is selected
    useEffect(() => {
      if (selectedStat === 'Select Statistics' || !selectedStat) {
        onStatChange('overview');
      }
    }, [selectedStat, onStatChange]);

    // Memoized column definitions to prevent unnecessary re-renders
    const columnDefs = useMemo(
      () => ({
        ngram: [
          { headerName: 'N-gram', field: 'ngram', sortable: true },
          { headerName: 'Count', field: 'count', sortable: true },
        ],
        otherStats: [
          { headerName: 'Key', field: 'key', sortable: true },
          { headerName: 'Value', field: 'value', sortable: true },
          { headerName: 'Quantity', field: 'quantity', sortable: true },
        ],
        overview: [
          { headerName: 'Statistic', field: 'stat', sortable: true },
          { headerName: 'Value', field: 'value', sortable: true },
        ],
      }),
      [],
    );

    const extractQuantityAndTrimValue = (valueStr: string) => {
      const parts = valueStr.split(',');
      if (parts.length > 1) {
        const quantity = parts.pop()?.trim() || '0';
        const trimmedValue = parts.join(',').trim();
        return {
          value: trimmedValue,
          quantity: /^\d+$/.test(quantity) ? quantity : '0',
        };
      }
      return {
        value: valueStr,
        quantity: '0',
      };
    };
    // Optimized data transformation functions
    const transformData = useCallback(
      (stats: any, selectedStat: string) => {
        // Early return if stats or selectedStat is invalid
        if (!stats || !selectedStat) return [];

        try {
          switch (selectedStat) {
            case 'ngram_counts':
              // Robust handling of ngram_counts
              if (!stats[selectedStat] || typeof stats[selectedStat] !== 'object') return [];
              return Object.entries(stats[selectedStat])
                .filter(([ngram, count]) => ngram && count !== undefined)
                .map(([ngram, count]) => ({
                  ngram: String(ngram),
                  count: Number(count) || 0,
                }))
                .sort((a, b) => b.count - a.count); // Sort by count descending

            case 'overview':
              return Object.keys(stats)
                .filter(key => {
                  const value = stats[key];
                  return (
                    value !== null &&
                    value !== undefined &&
                    typeof value !== 'object' &&
                    value !== ''
                  );
                })
                .map(key => ({
                  stat: key.replace(/_/g, ' '),
                  value: String(stats[key]).trim(),
                }))
                .sort((a, b) => a.stat.localeCompare(b.stat)); // Alphabetical sorting

            default:
              // Handle other complex stat types
              if (!stats[selectedStat] || typeof stats[selectedStat] !== 'object') return [];

              return Object.entries(stats[selectedStat])
                .filter(([key, value]) => key && value !== undefined)
                .map(([key, originalValue]) => {
                  const valueStr = String(originalValue);
                  const { value, quantity } = extractQuantityAndTrimValue(valueStr);
                  return {
                    key: String(key),
                    value,
                    quantity,
                  };
                })
                .sort((a, b) => Number(b.quantity) - Number(a.quantity)); // Sort by quantity descending
          }
        } catch (error) {
          console.error('Error in transformData:', error);
          return [];
        }
      },
      [extractQuantityAndTrimValue],
    );

    // Memoized row data
    const rowData = useMemo(
      () => transformData(stats, selectedStat),
      [stats, selectedStat, transformData],
    );

    // Complex stats list memoized with overview included
    const allStats = useMemo(() => {
      // Include "overview" in the navigation list
      return ['overview', ...Object.keys(stats).filter(key => typeof stats[key] === 'object')];
    }, [stats]);

    // Optimized chart data preparation
    useEffect(() => {
      if (
        selectedStat.startsWith('distribution_over_') &&
        typeof stats[selectedStat] === 'object'
      ) {
        const sortedData = Object.entries(stats[selectedStat])
          .sort(([a], [b]) => a.localeCompare(b))
          .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

        const labels = Object.keys(sortedData);
        const data = labels.map(label => sortedData[label]);

        setChartData({
          labels,
          datasets: [
            {
              label: selectedStat.replace(/_/g, ' '),
              data,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
            },
          ],
        });
        setLoading(false);
      } else {
        setChartData(null);
        setLoading(true);
      }
    }, [selectedStat, stats]);

    // Grid API setup
    const onGridReady = useCallback(params => {
      setGridApi(params.api);
      params.api.sizeColumnsToFit();
    }, []);

    // Download functions
    const downloadCsv = useCallback(() => {
      if (gridApi) {
        gridApi.exportDataAsCsv();
      }
    }, [gridApi]);

    const downloadChart = useCallback(() => {
      if (chartRef.current) {
        const url = chartRef.current.toBase64Image();
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedStat}_chart.png`;
        link.click();
      }
    }, [chartRef, selectedStat]);

    // Navigation handlers with "overview" support
    const handleNavigation = useCallback(
      (direction: 'prev' | 'next') => {
        const currentIndex = allStats.indexOf(selectedStat);
        if (direction === 'prev' && currentIndex > 0) {
          onStatChange(allStats[currentIndex - 1]);
        } else if (direction === 'next' && currentIndex < allStats.length - 1) {
          onStatChange(allStats[currentIndex + 1]);
        }
      },
      [allStats, selectedStat, onStatChange],
    );

    // Render function for different stat types
    const renderStats = useCallback(() => {
      if (!stats || !selectedStat) return null;

      const getGridComponent = () => (
        <div>
          <div
            className="ag-theme-alpine"
            style={{
              height: '70vh',
              width: '100%', // Added full width
            }}
          >
            <AgGridReact
              columnDefs={
                selectedStat === 'words_by_length'
                  ? columnDefs.otherStats
                  : selectedStat === 'field_completeness'
                    ? columnDefs.overview
                    : selectedStat === 'vocabulary_growth'
                      ? columnDefs.overview
                      : selectedStat === 'ngram_counts'
                        ? columnDefs.ngram
                        : selectedStat === 'overview'
                          ? columnDefs.overview
                          : columnDefs.otherStats
              }
              rowData={rowData}
              pagination={true}
              paginationPageSize={50}
              onGridReady={onGridReady}
            />
          </div>
          <button onClick={downloadCsv} className="base-button" style={{ marginTop: '10px' }}>
            Download CSV
          </button>
        </div>
      );

      if (selectedStat === 'overview') return getGridComponent();

      if (selectedStat.startsWith('distribution_over_') && chartData) {
        return loading ? (
          <div>Loading...</div>
        ) : (
          <div style={{ height: '70vh', width: '100%' }}>
            <Bar
              data={chartData}
              ref={chartRef}
              options={{
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  title: {
                    display: true,
                    text: selectedStat.replace(/_/g, ' '),
                  },
                },
              }}
            />
            <button onClick={downloadChart} className="base-button" style={{ marginTop: '10px' }}>
              Download Chart
            </button>
          </div>
        );
      }

      if (selectedStat === 'ngram_counts' || typeof stats[selectedStat] === 'object') {
        return getGridComponent();
      }

      return null;
    }, [
      stats,
      selectedStat,
      columnDefs,
      rowData,
      onGridReady,
      downloadCsv,
      chartData,
      loading,
      downloadChart,
    ]);

    return (
      <div
        className="stats-container"
        id="stat-select"
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '0vh',
        }}
      >
        <button
          onClick={() => handleNavigation('prev')}
          disabled={allStats.indexOf(selectedStat) <= 0}
          style={{ width: '3%' }}
        >
          {'<'}
        </button>
        <select
          value={selectedStat}
          onChange={e => onStatChange(e.target.value)}
          style={{
            width: '50%',
            textAlign: 'center',
            margin: '0 10px',
          }}
        >
          <option>Select Statistics</option>
          <option value="overview">Overview</option>
          {Object.keys(stats)
            .filter(key => typeof stats[key] === 'object')
            .map(key => (
              <option key={key} value={key}>
                {key.replace(/_/g, ' ')}
              </option>
            ))}
        </select>
        <button
          onClick={() => handleNavigation('next')}
          disabled={allStats.indexOf(selectedStat) >= allStats.length - 1}
          style={{ width: '3%' }}
        >
          {'>'}
        </button>
        {renderStats()}
      </div>
    );
  },
);

export default StatisticsDisplay;

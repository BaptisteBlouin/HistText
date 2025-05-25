import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Bar, Pie, Line } from 'react-chartjs-2';
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
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js/auto';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip as MUITooltip,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  useTheme,
  useMediaQuery,
  Fade,
  Slide,
  Stack
} from '@mui/material';
import {
  Analytics,
  BarChart,
  PieChart,
  ShowChart,
  GetApp,
  Refresh,
  Settings,
  Search,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  Assessment,
  InsertChart,
  DataUsage,
  Timeline,
  Download,
  Visibility,
  VisibilityOff,
  NavigateBefore,
  NavigateNext,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';

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

// Memoized chart color generator
const generateChartColors = (dataLength: number) => {
  const baseColors = [
    'rgba(25, 118, 210, 0.8)',
    'rgba(56, 142, 60, 0.8)',
    'rgba(245, 124, 0, 0.8)',
    'rgba(123, 31, 162, 0.8)',
    'rgba(211, 47, 47, 0.8)',
    'rgba(69, 90, 100, 0.8)',
    'rgba(0, 150, 136, 0.8)',
    'rgba(255, 152, 0, 0.8)',
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

// Memoized format value function
const formatValue = (value: any): string => {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    } else {
      return value.toFixed(2);
    }
  }
  return String(value);
};

// Memoized recommended chart type function
const getRecommendedChartType = (selectedStat: string): 'bar' | 'pie' | 'line' => {
  // Line charts for time-based data
  if (selectedStat === 'distribution_over_time' || 
      selectedStat === 'distribution_over_decades' ||
      selectedStat === 'word_length_distribution') {
    return 'line';
  }
  
  // Pie charts for categorical distributions with limited categories
  if (selectedStat === 'languages_detected' || 
      selectedStat === 'most_common_punctuation') {
    return 'pie';
  }
  
  // Bar charts for everything else (frequencies, counts, etc.)
  return 'bar';
};

// Memoized column definitions
const COLUMN_DEFS = {
  ngram: [
    { headerName: 'Term/Phrase', field: 'ngram', sortable: true, filter: true, width: 300, pinned: 'left' },
    { headerName: 'Frequency', field: 'count', sortable: true, filter: true, width: 150, type: 'numericColumn' },
  ],
  wordLength: [
    { headerName: 'Length (chars)', field: 'length', sortable: true, width: 200, type: 'numericColumn' },
    { headerName: 'Word Count', field: 'count', sortable: true, width: 150, type: 'numericColumn' },
  ],
  languages: [
    { headerName: 'Language', field: 'language', sortable: true, width: 150, pinned: 'left' },
    { headerName: 'Documents', field: 'count', sortable: true, width: 150, type: 'numericColumn' },
  ],
  punctuation: [
    { headerName: 'Punctuation', field: 'punct', sortable: true, width: 200, pinned: 'left' },
    { headerName: 'Frequency', field: 'count', sortable: true, width: 150, type: 'numericColumn' },
  ],
  completeness: [
    { headerName: 'Field Name', field: 'field', sortable: true, filter: true, width: 300, pinned: 'left' },
    { headerName: 'Completeness', field: 'percentage', sortable: true, width: 150 },
  ],
  overview: [
    { headerName: 'Metric', field: 'metric', sortable: true, filter: true, width: 300, pinned: 'left' },
    { headerName: 'Value', field: 'value', sortable: true, filter: true, width: 200 },
  ],
  otherStats: [
    { headerName: 'Item', field: 'key', sortable: true, filter: true, width: 250, pinned: 'left' },
    { headerName: 'Value', field: 'value', sortable: true, filter: true, width: 200 },
    { headerName: 'Count', field: 'count', sortable: true, filter: true, width: 150, type: 'numericColumn' },
  ],
};

const StatisticsDisplay: React.FC<StatisticsDisplayProps> = React.memo(
  ({ stats, selectedStat, onStatChange }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [gridApi, setGridApi] = useState<any>(null);
    const chartRef = useRef<any>(null);
    const [manualChartType, setManualChartType] = useState<'bar' | 'pie' | 'line' | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('overview');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['overview']));
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showChart, setShowChart] = useState<boolean>(true);
    
    // Ref to store the chart instance for cleanup
    const chartInstanceRef = useRef<any>(null);
    
    // Ref for keyboard navigation
    const containerRef = useRef<HTMLDivElement>(null);

    // Memoized stat categories
    const statCategories = useMemo(() => {
      const categories = {
        overview: {
          title: 'Overview',
          icon: <Assessment />,
          color: '#1976d2',
          stats: ['corpus_overview', 'document_length_stats'],
        },
        content: {
          title: 'Content Analysis',
          icon: <InsertChart />,
          color: '#388e3c',
          stats: ['most_frequent_words', 'most_frequent_bigrams', 'most_frequent_trigrams', 'word_length_distribution'],
        },
        language: {
          title: 'Language & Style',
          icon: <DataUsage />,
          color: '#f57c00',
          stats: ['languages_detected', 'most_common_punctuation'],
        },
        metadata: {
          title: 'Metadata & Fields',
          icon: <Analytics />,
          color: '#7b1fa2',
          stats: ['field_completeness_percentage'],
        },
        temporal: {
          title: 'Time Analysis',
          icon: <Timeline />,
          color: '#d32f2f',
          stats: ['distribution_over_time', 'distribution_over_decades'],
        },
        distributions: {
          title: 'Other Distributions',
          icon: <TrendingUp />,
          color: '#455a64',
          stats: Object.keys(stats).filter(key => 
            key.startsWith('distribution_over_') && 
            !['distribution_over_time', 'distribution_over_decades'].includes(key)
          ),
        },
      };

      return Object.fromEntries(
        Object.entries(categories).filter(([, category]) => 
          category.stats.some(stat => stats[stat])
        )
      );
    }, [stats]);

    // Memoized list of all available stats (for navigation)
    const allAvailableStats = useMemo(() => {
      const statsArray: string[] = [];
      Object.values(statCategories).forEach(category => {
        category.stats.forEach(stat => {
          if (stats[stat]) {
            statsArray.push(stat);
          }
        });
      });
      return statsArray;
    }, [statCategories, stats]);

    // Get current chart type (auto or manual)
    const currentChartType = useMemo(() => {
      return manualChartType || getRecommendedChartType(selectedStat);
    }, [manualChartType, selectedStat]);

    // Reset manual chart type when stat changes to use auto-selection
    useEffect(() => {
      setManualChartType(null);
    }, [selectedStat]);

    // Navigation functions
    const navigateToStat = useCallback((direction: 'next' | 'prev') => {
      const currentIndex = allAvailableStats.indexOf(selectedStat);
      if (currentIndex === -1) return;

      let newIndex;
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % allAvailableStats.length;
      } else {
        newIndex = currentIndex === 0 ? allAvailableStats.length - 1 : currentIndex - 1;
      }

      onStatChange(allAvailableStats[newIndex]);
    }, [allAvailableStats, selectedStat, onStatChange]);

    // Keyboard navigation
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Only handle keyboard navigation when the container has focus or no input is focused
        if (document.activeElement?.tagName === 'INPUT' || 
            document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          navigateToStat('prev');
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          navigateToStat('next');
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [navigateToStat]);

    // Memoized data transformation
    const transformData = useCallback(
      (stats: any, selectedStat: string) => {
        if (!stats || !selectedStat) return [];

        try {
          switch (selectedStat) {
            case 'corpus_overview':
              if (!stats.corpus_overview) return [];
              return Object.entries(stats.corpus_overview).map(([key, value]) => ({
                metric: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: formatValue(value),
              }));

            case 'document_length_stats':
              if (!stats.document_length_stats) return [];
              return Object.entries(stats.document_length_stats).map(([key, value]) => ({
                metric: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: formatValue(value),
              }));

            case 'word_length_distribution':
              if (!Array.isArray(stats.word_length_distribution)) return [];
              return stats.word_length_distribution.map(([length, count]: [number, number]) => ({
                length: length,
                count: count,
              }));

            case 'languages_detected':
              if (!stats.languages_detected) return [];
              return Object.entries(stats.languages_detected).map(([lang, count]) => ({
                language: lang.toUpperCase(),
                count: formatValue(count),
              }));

            case 'most_common_punctuation':
              if (!Array.isArray(stats.most_common_punctuation)) return [];
              return stats.most_common_punctuation.map(([punct, count]: [string, number]) => ({
                punct: punct,
                count: count,
              }));

            case 'field_completeness_percentage':
              if (!stats.field_completeness_percentage) return [];
              return Object.entries(stats.field_completeness_percentage)
                .map(([field, percentage]) => ({
                  field: field.replace(/_/g, ' '),
                  percentage: `${Number(percentage).toFixed(1)}%`,
                }))
                .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

            case 'most_frequent_words':
            case 'most_frequent_bigrams':
            case 'most_frequent_trigrams':
              if (!Array.isArray(stats[selectedStat])) return [];
              return stats[selectedStat].map(([ngram, count]: [string, number]) => ({
                ngram: ngram,
                count: count,
              }));

            default:
              if (selectedStat.startsWith('distribution_over_')) {
                if (!stats[selectedStat] || typeof stats[selectedStat] !== 'object') return [];
                return Object.entries(stats[selectedStat])
                  .map(([key, value]) => ({
                    key: String(key),
                    value: String(key),
                    count: Number(value) || 0,
                  }))
                  .sort((a, b) => {
                    // For time-based distributions, sort chronologically
                    if (selectedStat === 'distribution_over_time' || selectedStat === 'distribution_over_decades') {
                      return a.key.localeCompare(b.key);
                    }
                    // For other distributions, sort by count
                    return b.count - a.count;
                  });
              }

              if (!stats[selectedStat] || typeof stats[selectedStat] !== 'object') return [];
              return Object.entries(stats[selectedStat])
                .map(([key, value]) => ({
                  key: String(key),
                  value: String(key),
                  count: Number(value) || 0,
                }))
                .sort((a, b) => b.count - a.count);
          }
        } catch (error) {
          console.error('Error in transformData:', error);
          return [];
        }
      },
      [],
    );

    // Memoized row data
    const rowData = useMemo(
      () => transformData(stats, selectedStat),
      [stats, selectedStat, transformData],
    );

    // Memoized chart data and options
    const { chartData, chartOptions } = useMemo(() => {
      if (!stats[selectedStat] || rowData.length === 0) {
        return { chartData: null, chartOptions: null };
      }

      const shouldShowChart = 
        selectedStat.startsWith('distribution_over_') ||
        selectedStat === 'word_length_distribution' ||
        selectedStat === 'languages_detected' ||
        selectedStat === 'most_common_punctuation' ||
        selectedStat === 'field_completeness_percentage' ||
        selectedStat === 'most_frequent_words' ||
        selectedStat === 'most_frequent_bigrams' ||
        selectedStat === 'most_frequent_trigrams';

      if (!shouldShowChart) {
        return { chartData: null, chartOptions: null };
      }

      let labels: string[] = [];
      let data: number[] = [];
      let chartTitle = selectedStat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      if (selectedStat === 'word_length_distribution') {
        if (Array.isArray(stats[selectedStat])) {
          const sortedData = stats[selectedStat].sort((a: any, b: any) => a[0] - b[0]);
          labels = sortedData.map((item: any) => `${item[0]} char${item[0] === 1 ? '' : 's'}`);
          data = sortedData.map((item: any) => item[1]);
        }
      } else if (selectedStat === 'field_completeness_percentage') {
        if (stats[selectedStat]) {
          const entries = Object.entries(stats[selectedStat])
            .sort(([,a], [,b]) => (b as number) - (a as number));
          labels = entries.map(([field]) => field.replace(/_/g, ' '));
          data = entries.map(([, percentage]) => Number(percentage));
        }
      } else if (selectedStat === 'languages_detected' || selectedStat === 'most_common_punctuation') {
        if (stats[selectedStat]) {
          if (selectedStat === 'languages_detected') {
            const entries = Object.entries(stats[selectedStat]);
            labels = entries.map(([lang]) => lang.toUpperCase());
            data = entries.map(([, count]) => Number(count));
          } else {
            const punctData = stats[selectedStat].slice(0, 10);
            labels = punctData.map((item: any) => `"${item[0]}"`);
            data = punctData.map((item: any) => item[1]);
          }
        }
      } else if (selectedStat.startsWith('most_frequent_')) {
        if (Array.isArray(stats[selectedStat])) {
          const topItems = stats[selectedStat].slice(0, 20);
          labels = topItems.map((item: any) => item[0]);
          data = topItems.map((item: any) => item[1]);
        }
      } else if (selectedStat.startsWith('distribution_over_')) {
        if (typeof stats[selectedStat] === 'object') {
          const entries = Object.entries(stats[selectedStat]);
          
          // Sort chronologically for time-based data
          if (selectedStat === 'distribution_over_time' || selectedStat === 'distribution_over_decades') {
            entries.sort(([a], [b]) => a.localeCompare(b));
          } else {
            entries.sort(([,a], [,b]) => (b as number) - (a as number));
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
            borderColor: colors.map(color => color.replace('0.8', '1')),
            borderWidth: 2,
            tension: currentChartType === 'line' ? 0.4 : 0,
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
              weight: 'bold'
            }
          },
          legend: {
            display: currentChartType === 'pie',
            position: currentChartType === 'pie' ? 'right' as const : 'top' as const,
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'white',
            bodyColor: 'white',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1
          }
        },
        scales: currentChartType !== 'pie' ? {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          }
        } : undefined,
      };

      return { chartData, chartOptions };
    }, [selectedStat, stats, rowData, currentChartType]);

    // Update active category when selectedStat changes
    useEffect(() => {
      if (!selectedStat || selectedStat === 'Select Statistics') {
        onStatChange('corpus_overview');
        setActiveCategory('overview');
        return;
      }

      for (const [categoryKey, category] of Object.entries(statCategories)) {
        if (category.stats.includes(selectedStat)) {
          setActiveCategory(categoryKey);
          break;
        }
      }
    }, [selectedStat, statCategories, onStatChange]);

    // Cleanup chart instance on unmount
    useEffect(() => {
      return () => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
        }
      };
    }, []);

    // Memoized grid ready handler
    const onGridReady = useCallback(params => {
      setGridApi(params.api);
      params.api.sizeColumnsToFit();
    }, []);

    // Memoized download handlers
    const downloadCsv = useCallback(() => {
      if (gridApi) {
        gridApi.exportDataAsCsv({
          fileName: `${selectedStat}_data_${new Date().toISOString().split('T')[0]}.csv`,
        });
      }
    }, [gridApi, selectedStat]);

    const downloadChart = useCallback(() => {
      if (chartRef.current) {
        const url = chartRef.current.toBase64Image();
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedStat}_chart_${new Date().toISOString().split('T')[0]}.png`;
        link.click();
      }
    }, [selectedStat]);

    // Memoized column definition getter
    const getColumnDef = useCallback(() => {
      switch (selectedStat) {
        case 'corpus_overview':
        case 'document_length_stats':
          return COLUMN_DEFS.overview;
        case 'word_length_distribution':
          return COLUMN_DEFS.wordLength;
        case 'languages_detected':
          return COLUMN_DEFS.languages;
        case 'most_common_punctuation':
          return COLUMN_DEFS.punctuation;
        case 'field_completeness_percentage':
          return COLUMN_DEFS.completeness;
        case 'most_frequent_words':
        case 'most_frequent_bigrams':
        case 'most_frequent_trigrams':
          return COLUMN_DEFS.ngram;
        default:
          return COLUMN_DEFS.otherStats;
      }
    }, [selectedStat]);

    // Memoized chart component renderer
    const renderChart = useCallback(() => {
      if (!chartData) {
        return (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <ShowChart sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary">
              No chart data available
            </Typography>
          </Box>
        );
      }

      const ChartComponent = currentChartType === 'pie' ? Pie : currentChartType === 'line' ? Line : Bar;
      const recommendedType = getRecommendedChartType(selectedStat);

      return (
        <Card sx={{ height: '60vh', p: 2 }}>
          <CardContent sx={{ height: '100%', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
              <ButtonGroup size="small" variant="outlined">
                <MUITooltip title={`Bar Chart${recommendedType === 'bar' ? ' (Recommended)' : ''}`}>
                  <IconButton 
                    onClick={() => setManualChartType('bar')} 
                    color={currentChartType === 'bar' ? 'primary' : 'default'}
                  >
                    <BarChart />
                  </IconButton>
                </MUITooltip>
                <MUITooltip title={`Line Chart${recommendedType === 'line' ? ' (Recommended)' : ''}`}>
                  <IconButton 
                    onClick={() => setManualChartType('line')} 
                    color={currentChartType === 'line' ? 'primary' : 'default'}
                  >
                    <ShowChart />
                  </IconButton>
                </MUITooltip>
                <MUITooltip title={`Pie Chart${recommendedType === 'pie' ? ' (Recommended)' : ''}`}>
                  <IconButton 
                    onClick={() => setManualChartType('pie')} 
                    color={currentChartType === 'pie' ? 'primary' : 'default'}
                  >
                    <PieChart />
                  </IconButton>
                </MUITooltip>
              </ButtonGroup>
            </Box>
            <Box sx={{ height: '100%', pt: 4 }}>
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
    }, [chartData, chartOptions, currentChartType, selectedStat]);

    // Memoized grid renderer
    const renderGrid = useCallback(() => {
      // Special handling for overview statistics that need more height and better formatting
      const isOverviewStat = selectedStat === 'corpus_overview' || selectedStat === 'document_length_stats';
      const gridHeight = isOverviewStat ? (isMobile ? '50vh' : '70vh') : '60vh';
      
      return (
        <Card sx={{ height: gridHeight }}>
          <CardContent sx={{ height: '100%', p: 0 }}>
            <Box className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
              <AgGridReact
                columnDefs={getColumnDef()}
                rowData={rowData}
                pagination={true}
                paginationPageSize={isOverviewStat ? (isMobile ? 10 : 15) : (isMobile ? 25 : 50)}
                paginationPageSizeSelector={isOverviewStat ? [10, 15, 25] : [25, 50, 100, 200]}
                onGridReady={onGridReady}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  ...(isOverviewStat && {
                    minWidth: isMobile ? 120 : 150,
                    flex: 1
                  })
                }}
                animateRows={true}
                enableRangeSelection={true}
                rowSelection="multiple"
                suppressRowClickSelection={true}
                rowHeight={isOverviewStat ? 60 : undefined}
              />
            </Box>
          </CardContent>
        </Card>
      );
    }, [getColumnDef, rowData, isMobile, onGridReady, selectedStat]);

    // Memoized category toggle handler
    const toggleCategoryExpansion = useCallback((categoryKey: string) => {
      setExpandedCategories(prev => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(categoryKey)) {
          newExpanded.delete(categoryKey);
        } else {
          newExpanded.add(categoryKey);
        }
        return newExpanded;
      });
    }, []);

    // Memoized stat display name getter
    const getStatDisplayName = useCallback((stat: string) => {
      const displayNames: { [key: string]: string } = {
        corpus_overview: 'Corpus Overview',
        document_length_stats: 'Document Length Stats',
        word_length_distribution: 'Word Length Distribution',
        languages_detected: 'Languages Detected',
        most_common_punctuation: 'Punctuation Analysis',
        field_completeness_percentage: 'Field Completeness',
        distribution_over_time: 'Timeline Distribution',
        distribution_over_decades: 'Decade Distribution',
        most_frequent_words: 'Frequent Words',
        most_frequent_bigrams: 'Frequent Bigrams',
        most_frequent_trigrams: 'Frequent Trigrams',
      };
      
      return displayNames[stat] || stat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }, []);

    // Memoized filtered categories
    const filteredCategories = useMemo(() => {
      if (!searchTerm) return statCategories;
      
      const filtered = {};
      Object.entries(statCategories).forEach(([categoryKey, category]) => {
        const matchingStats = category.stats.filter(stat => 
          getStatDisplayName(stat).toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (matchingStats.length > 0) {
          filtered[categoryKey] = { ...category, stats: matchingStats };
        }
      });
      return filtered;
    }, [statCategories, searchTerm, getStatDisplayName]);

    // Memoized navigation info
    const navigationInfo = useMemo(() => {
      const currentIndex = allAvailableStats.indexOf(selectedStat);
      const isFirst = currentIndex === 0;
      const isLast = currentIndex === allAvailableStats.length - 1;
      const total = allAvailableStats.length;
      
      return {
        currentIndex,
        isFirst,
        isLast,
        total,
        hasNavigation: total > 1
      };
    }, [allAvailableStats, selectedStat]);

    // Memoized sidebar renderer
    const renderSidebar = useCallback(() => (
      <Paper 
        sx={{ 
          width: isMobile ? '100%' : '350px', 
          height: isMobile ? 'auto' : '80vh',
          overflowY: 'auto',
          borderRadius: 3,
          background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'primary.main', color: 'white', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Analytics />
            Statistics Explorer
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
           Explore your data insights
         </Typography>
       </Box>
       
       <Box sx={{ p: 2 }}>
         <TextField
           fullWidth
           size="small"
           placeholder="Search statistics..."
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           InputProps={{
             startAdornment: (
               <InputAdornment position="start">
                 <Search />
               </InputAdornment>
             ),
           }}
           sx={{ mb: 2 }}
         />
       </Box>
       
       <List sx={{ p: 0 }}>
         {Object.entries(filteredCategories).map(([categoryKey, category]) => (
           <Box key={categoryKey}>
             <ListItemButton
               onClick={() => {
                 toggleCategoryExpansion(categoryKey);
                 setActiveCategory(categoryKey);
                 const firstStat = category.stats.find(stat => stats[stat]);
                 if (firstStat) onStatChange(firstStat);
               }}
               sx={{
                 py: 2,
                 px: 3,
                 borderLeft: '4px solid',
                 borderLeftColor: activeCategory === categoryKey ? category.color : 'transparent',
                 backgroundColor: activeCategory === categoryKey ? `${category.color}15` : 'transparent',
                 '&:hover': {
                   backgroundColor: `${category.color}10`,
                 }
               }}
             >
               <ListItemIcon sx={{ color: category.color, minWidth: 40 }}>
                 {category.icon}
               </ListItemIcon>
               <ListItemText 
                 primary={
                   <Typography variant="subtitle1" sx={{ fontWeight: 600, color: activeCategory === categoryKey ? category.color : 'text.primary' }}>
                     {category.title}
                   </Typography>
                 }
               />
               <Chip 
                 size="small" 
                 label={category.stats.filter(stat => stats[stat]).length}
                 sx={{ bgcolor: category.color, color: 'white', fontWeight: 600 }}
               />
               {expandedCategories.has(categoryKey) ? <ExpandLess /> : <ExpandMore />}
             </ListItemButton>
             
             <Collapse in={expandedCategories.has(categoryKey)} timeout="auto" unmountOnExit>
               <List sx={{ pl: 2, bgcolor: 'grey.50' }}>
                 {category.stats
                   .filter(stat => stats[stat])
                   .map(stat => (
                     <Fade in={expandedCategories.has(categoryKey)} key={stat}>
                       <ListItemButton
                         onClick={() => onStatChange(stat)}
                         sx={{
                           py: 1.5,
                           px: 3,
                           borderRadius: 2,
                           mx: 1,
                           mb: 0.5,
                           backgroundColor: selectedStat === stat ? category.color : 'transparent',
                           color: selectedStat === stat ? 'white' : 'text.primary',
                           '&:hover': {
                             backgroundColor: selectedStat === stat ? category.color : `${category.color}20`,
                           },
                         }}
                       >
                         <ListItemText 
                           primary={
                             <Typography variant="body2" sx={{ fontWeight: selectedStat === stat ? 600 : 400 }}>
                               {getStatDisplayName(stat)}
                             </Typography>
                           }
                         />
                         {selectedStat === stat && (
                           <Chip size="small" label="Active" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                         )}
                       </ListItemButton>
                     </Fade>
                   ))}
               </List>
             </Collapse>
           </Box>
         ))}
       </List>
     </Paper>
   ), [isMobile, searchTerm, filteredCategories, activeCategory, expandedCategories, stats, selectedStat, toggleCategoryExpansion, onStatChange, getStatDisplayName]);

   // Memoized main content renderer
   const renderMainContent = useCallback(() => {
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

     const shouldDisplayChart = chartData !== null;

     return (
       <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
         <Paper sx={{ p: 3, borderRadius: 3 }}>
           <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
               <Box>
                 <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                   {getStatDisplayName(selectedStat)}
                 </Typography>
                 <Typography variant="body2" color="text.secondary">
                   {rowData.length} data points available
                   {navigationInfo.hasNavigation && (
                     <> • {navigationInfo.currentIndex + 1} of {navigationInfo.total}</>
                   )}
                 </Typography>
               </Box>

               {/* Navigation Controls */}
               {navigationInfo.hasNavigation && (
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                   <MUITooltip title="Previous statistic (←)">
                     <IconButton 
                       onClick={() => navigateToStat('prev')}
                       disabled={navigationInfo.isFirst}
                       size="small"
                       sx={{ 
                         bgcolor: 'primary.light',
                         color: 'white',
                         '&:hover': { bgcolor: 'primary.main' },
                         '&:disabled': { bgcolor: 'grey.300', color: 'grey.500' }
                       }}
                     >
                       <KeyboardArrowLeft />
                     </IconButton>
                   </MUITooltip>
                   
                   <Typography variant="caption" sx={{ px: 1, color: 'text.secondary' }}>
                     {navigationInfo.currentIndex + 1}/{navigationInfo.total}
                   </Typography>
                   
                   <MUITooltip title="Next statistic (→)">
                     <IconButton 
                       onClick={() => navigateToStat('next')}
                       disabled={navigationInfo.isLast}
                       size="small"
                       sx={{ 
                         bgcolor: 'primary.light',
                         color: 'white',
                         '&:hover': { bgcolor: 'primary.main' },
                         '&:disabled': { bgcolor: 'grey.300', color: 'grey.500' }
                       }}
                     >
                       <KeyboardArrowRight />
                     </IconButton>
                   </MUITooltip>
                 </Box>
               )}
             </Box>
             
             <Stack direction="row" spacing={1}>
               {shouldDisplayChart && (
                 <FormControlLabel
                   control={
                     <Switch
                       checked={showChart}
                       onChange={(e) => setShowChart(e.target.checked)}
                       icon={<VisibilityOff />}
                       checkedIcon={<Visibility />}
                     />
                   }
                   label="Chart View"
                 />
               )}
               <ButtonGroup variant="outlined" size="small">
                 <MUITooltip title="Download Data">
                   <Button onClick={downloadCsv} startIcon={<GetApp />}>
                     CSV
                   </Button>
                 </MUITooltip>
                 {shouldDisplayChart && showChart && (
                   <MUITooltip title="Download Chart">
                     <Button onClick={downloadChart} startIcon={<Download />}>
                       PNG
                     </Button>
                   </MUITooltip>
                 )}
               </ButtonGroup>
             </Stack>
           </Box>

           {/* Keyboard Navigation Hint */}
           {navigationInfo.hasNavigation && !isMobile && (
             <Box sx={{ 
               mt: 2, 
               p: 2, 
               bgcolor: 'info.light', 
               borderRadius: 2,
               display: 'flex',
               alignItems: 'center',
               gap: 1
             }}>
               <Typography variant="caption" color="info.contrastText">
                 💡 Use arrow keys (← →) to navigate between statistics
               </Typography>
             </Box>
           )}
         </Paper>
         
         {shouldDisplayChart && showChart ? (
           <Slide direction="up" in={showChart} mountOnEnter unmountOnExit>
             <Box>{renderChart()}</Box>
           </Slide>
         ) : (
           <Fade in={!showChart || !shouldDisplayChart}>
             <Box>{renderGrid()}</Box>
           </Fade>
         )}
       </Box>
     );
   }, [stats, selectedStat, chartData, rowData.length, getStatDisplayName, navigationInfo, navigateToStat, isMobile, showChart, downloadCsv, downloadChart, renderChart, renderGrid]);

   return (
     <Box 
       ref={containerRef}
       tabIndex={0} // Make focusable for keyboard navigation
       sx={{ 
         display: 'flex', 
         height: '100%', 
         bgcolor: 'background.default',
         flexDirection: isMobile ? 'column' : 'row',
         gap: 3,
         p: 3,
         outline: 'none' // Remove focus outline
       }}
     >
       {renderSidebar()}
       {renderMainContent()}
     </Box>
   );
 },
);

StatisticsDisplay.displayName = 'StatisticsDisplay';

export default StatisticsDisplay;
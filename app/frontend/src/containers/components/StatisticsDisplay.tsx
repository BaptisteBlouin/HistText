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
    const [gridApi, setGridApi] = useState<any>(null);
    const chartRef = useRef<any>(null);
    const [chartData, setChartData] = useState<any>(null);
    const [chartType, setChartType] = useState<'bar' | 'pie' | 'line'>('bar');
    const [loading, setLoading] = useState<boolean>(true);
    const [activeCategory, setActiveCategory] = useState<string>('overview');

    useEffect(() => {
      if (selectedStat === 'Select Statistics' || !selectedStat) {
        onStatChange('corpus_overview');
        setActiveCategory('overview');
      }
    }, [selectedStat, onStatChange]);

    // Organize statistics into categories
    const statCategories = useMemo(() => {
      const categories = {
        overview: {
          title: 'Overview',
          icon: '📊',
          stats: ['corpus_overview', 'document_length_stats'],
        },
        content: {
          title: 'Content Analysis',
          icon: '📝',
          stats: ['most_frequent_words', 'most_frequent_bigrams', 'most_frequent_trigrams', 'word_length_distribution'],
        },
        language: {
          title: 'Language & Style',
          icon: '🌐',
          stats: ['languages_detected', 'most_common_punctuation'],
        },
        metadata: {
          title: 'Metadata & Fields',
          icon: '🏷️',
          stats: ['field_completeness_percentage'],
        },
        temporal: {
          title: 'Time Analysis',
          icon: '📅',
          stats: ['distribution_over_time', 'distribution_over_decades'],
        },
        distributions: {
          title: 'Other Distributions',
          icon: '📈',
          stats: Object.keys(stats).filter(key => 
            key.startsWith('distribution_over_') && 
            !['distribution_over_time', 'distribution_over_decades'].includes(key)
          ),
        },
      };

      // Filter out categories with no available stats
      return Object.fromEntries(
        Object.entries(categories).filter(([, category]) => 
          category.stats.some(stat => stats[stat])
        )
      );
    }, [stats]);

    // Get current category based on selected stat
    useEffect(() => {
      for (const [categoryKey, category] of Object.entries(statCategories)) {
        if (category.stats.includes(selectedStat)) {
          setActiveCategory(categoryKey);
          break;
        }
      }
    }, [selectedStat, statCategories]);

    const columnDefs = useMemo(
      () => ({
        ngram: [
          { headerName: 'Term/Phrase', field: 'ngram', sortable: true, filter: true, width: 300 },
          { headerName: 'Frequency', field: 'count', sortable: true, filter: true, width: 150 },
        ],
        wordLength: [
          { headerName: 'Length (characters)', field: 'length', sortable: true, width: 200 },
          { headerName: 'Word Count', field: 'count', sortable: true, width: 150 },
        ],
        languages: [
          { headerName: 'Language Code', field: 'language', sortable: true, width: 150 },
          { headerName: 'Documents', field: 'count', sortable: true, width: 150 },
        ],
        punctuation: [
          { headerName: 'Punctuation Mark', field: 'punct', sortable: true, width: 200 },
          { headerName: 'Frequency', field: 'count', sortable: true, width: 150 },
        ],
        completeness: [
          { headerName: 'Field Name', field: 'field', sortable: true, filter: true, width: 300 },
          { headerName: 'Completeness', field: 'percentage', sortable: true, width: 150 },
        ],
        overview: [
          { headerName: 'Metric', field: 'metric', sortable: true, filter: true, width: 300 },
          { headerName: 'Value', field: 'value', sortable: true, filter: true, width: 200 },
        ],
        otherStats: [
          { headerName: 'Item', field: 'key', sortable: true, filter: true, width: 250 },
          { headerName: 'Value', field: 'value', sortable: true, filter: true, width: 200 },
          { headerName: 'Count', field: 'count', sortable: true, filter: true, width: 150 },
        ],
      }),
      [],
    );

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
                  .sort((a, b) => b.count - a.count);
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

    const rowData = useMemo(
      () => transformData(stats, selectedStat),
      [stats, selectedStat, transformData],
    );

    const getChartColors = (dataLength: number) => {
      const colors = [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(153, 102, 255, 0.6)',
        'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)',
        'rgba(83, 102, 255, 0.6)',
      ];
      
      if (dataLength <= colors.length) {
        return colors.slice(0, dataLength);
      }
      
      const repeatedColors = [];
      for (let i = 0; i < dataLength; i++) {
        repeatedColors.push(colors[i % colors.length]);
      }
      return repeatedColors;
    };

    useEffect(() => {
      if (!stats[selectedStat]) {
        setChartData(null);
        setLoading(true);
        return;
      }

      const shouldShowChart = 
        selectedStat.startsWith('distribution_over_') ||
        selectedStat === 'word_length_distribution' ||
        selectedStat === 'languages_detected' ||
        selectedStat === 'most_common_punctuation' ||
        selectedStat === 'field_completeness_percentage';

      if (shouldShowChart) {
        let labels: string[] = [];
        let data: number[] = [];
        let chartTitle = selectedStat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        if (selectedStat === 'word_length_distribution') {
          if (Array.isArray(stats[selectedStat])) {
            const sortedData = stats[selectedStat].sort((a: any, b: any) => a[0] - b[0]);
            labels = sortedData.map((item: any) => `${item[0]} char${item[0] === 1 ? '' : 's'}`);
            data = sortedData.map((item: any) => item[1]);
            setChartType('line');
          }
        } else if (selectedStat === 'field_completeness_percentage') {
          if (stats[selectedStat]) {
            const entries = Object.entries(stats[selectedStat])
              .sort(([,a], [,b]) => (b as number) - (a as number));
            labels = entries.map(([field]) => field.replace(/_/g, ' '));
            data = entries.map(([, percentage]) => Number(percentage));
            setChartType('bar');
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
            setChartType('pie');
          }
        } else if (selectedStat.startsWith('distribution_over_')) {
          if (typeof stats[selectedStat] === 'object') {
            const entries = Object.entries(stats[selectedStat])
              .sort(([a], [b]) => {
                if (selectedStat === 'distribution_over_time' || selectedStat === 'distribution_over_decades') {
                  return a.localeCompare(b);
                }
                return (b as number) - (a as number);
              });
            
            labels = entries.map(([key]) => String(key));
            data = entries.map(([, value]) => Number(value));
            
            if (selectedStat === 'distribution_over_time' || selectedStat === 'distribution_over_decades') {
              setChartType('line');
            } else {
              setChartType('bar');
            }
          }
        }

        if (labels.length > 0 && data.length > 0) {
          const colors = getChartColors(data.length);
          
          setChartData({
            labels,
            datasets: [
              {
                label: chartTitle,
                data,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('0.6', '1')),
                borderWidth: 1,
              },
            ],
          });
          setLoading(false);
        } else {
          setChartData(null);
          setLoading(true);
        }
      } else {
        setChartData(null);
        setLoading(true);
      }
    }, [selectedStat, stats]);

    const onGridReady = useCallback(params => {
      setGridApi(params.api);
      params.api.sizeColumnsToFit();
    }, []);

    const downloadCsv = useCallback(() => {
      if (gridApi) {
        gridApi.exportDataAsCsv({
          fileName: `${selectedStat}_data.csv`,
        });
      }
    }, [gridApi, selectedStat]);

    const downloadChart = useCallback(() => {
      if (chartRef.current) {
        const url = chartRef.current.toBase64Image();
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedStat}_chart.png`;
        link.click();
      }
    }, [chartRef, selectedStat]);

    const getColumnDef = () => {
      switch (selectedStat) {
        case 'corpus_overview':
        case 'document_length_stats':
          return columnDefs.overview;
        case 'word_length_distribution':
          return columnDefs.wordLength;
        case 'languages_detected':
          return columnDefs.languages;
        case 'most_common_punctuation':
          return columnDefs.punctuation;
        case 'field_completeness_percentage':
          return columnDefs.completeness;
        case 'most_frequent_words':
        case 'most_frequent_bigrams':
        case 'most_frequent_trigrams':
          return columnDefs.ngram;
        default:
          return columnDefs.otherStats;
      }
    };

    const renderChart = () => {
      if (!chartData || loading) return <div>Loading chart...</div>;

      const chartOptions = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: selectedStat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          },
          legend: {
            display: chartType === 'pie',
            position: chartType === 'pie' ? 'right' as const : 'top' as const,
          },
        },
        scales: chartType !== 'pie' ? {
          y: {
            beginAtZero: true,
          },
        } : undefined,
      };

      const ChartComponent = chartType === 'pie' ? Pie : chartType === 'line' ? Line : Bar;

      return (
        <div style={{ height: '60vh', width: '100%' }}>
          <ChartComponent ref={chartRef} data={chartData} options={chartOptions} />
        </div>
      );
    };

    const renderGrid = () => (
      <div className="ag-theme-alpine" style={{ height: '60vh', width: '100%' }}>
        <AgGridReact
          columnDefs={getColumnDef()}
          rowData={rowData}
          pagination={true}
          paginationPageSize={50}
          onGridReady={onGridReady}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
        />
      </div>
    );

    const renderStats = useCallback(() => {
      if (!stats || !selectedStat) return null;

      const shouldShowChart = 
        selectedStat.startsWith('distribution_over_') ||
        selectedStat === 'word_length_distribution' ||
        selectedStat === 'languages_detected' ||
        selectedStat === 'most_common_punctuation' ||
        selectedStat === 'field_completeness_percentage';

      return (
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#333' }}>
              {selectedStat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <button 
              onClick={shouldShowChart && chartData ? downloadChart : downloadCsv} 
              className="base-button"
              style={{ 
                padding: '5px 15px',
                fontSize: '14px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              📥 Download {shouldShowChart && chartData ? 'Chart' : 'CSV'}
            </button>
          </div>
          
          {shouldShowChart && chartData ? renderChart() : renderGrid()}
        </div>
      );
    }, [stats, selectedStat, chartData, renderChart, renderGrid, downloadChart, downloadCsv]);

    const getStatDisplayName = (stat: string) => {
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
    };

    return (
      <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f5f5f5' }}>
        {/* Left Sidebar Navigation */}
        <div style={{ 
          width: '300px', 
          backgroundColor: 'white', 
          borderRight: '1px solid #e0e0e0',
          overflowY: 'auto',
          boxShadow: '2px 0 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
            <h2 style={{ margin: 0, color: '#333', fontSize: '18px' }}>📊 Statistics</h2>
          </div>
          
          {Object.entries(statCategories).map(([categoryKey, category]) => (
            <div key={categoryKey} style={{ marginBottom: '10px' }}>
              <div 
                style={{ 
                  padding: '12px 20px', 
                  backgroundColor: activeCategory === categoryKey ? '#e3f2fd' : 'transparent',
                  borderLeft: activeCategory === categoryKey ? '4px solid #2196F3' : '4px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  setActiveCategory(categoryKey);
                  const firstStat = category.stats.find(stat => stats[stat]);
                  if (firstStat) onStatChange(firstStat);
                }}
              >
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: activeCategory === categoryKey ? '#1976D2' : '#666',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{category.icon}</span>
                  {category.title}
                </div>
              </div>
              
              {activeCategory === categoryKey && (
                <div style={{ paddingLeft: '40px', paddingRight: '20px' }}>
                  {category.stats
                    .filter(stat => stats[stat])
                    .map(stat => (
                      <div
                        key={stat}
                        onClick={() => onStatChange(stat)}
                        style={{
                          padding: '8px 12px',
                          margin: '2px 0',
                          backgroundColor: selectedStat === stat ? '#1976D2' : 'transparent',
                          color: selectedStat === stat ? 'white' : '#666',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (selectedStat !== stat) {
                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedStat !== stat) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        {getStatDisplayName(stat)}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderStats()}
        </div>
      </div>
    );
  },
);

export default StatisticsDisplay;
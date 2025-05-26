import React, { useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Card, CardContent, Box } from '@mui/material';
import { COLUMN_DEFS } from '../constants/columnDefs';

interface StatisticsGridProps {
  rowData: any[];
  selectedStat: string;
  isMobile: boolean;
  onGridReady: (params: any) => void;
}

const StatisticsGrid: React.FC<StatisticsGridProps> = ({
  rowData,
  selectedStat,
  isMobile,
  onGridReady
}) => {
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
};

export default React.memo(StatisticsGrid);
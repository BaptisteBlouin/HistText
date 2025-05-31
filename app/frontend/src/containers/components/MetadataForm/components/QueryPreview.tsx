// app/frontend/src/containers/components/MetadataForm/components/QueryPreview.tsx
import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Alert
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  ContentCopy,
  CheckCircle,
  Warning,
  Error as ErrorIcon
} from '@mui/icons-material';
import { buildQueryString } from '../../buildQueryString';

interface QueryPreviewProps {
  formData: any;
  dateRange: any;
  rawQuery: string;
  queryMode: 'simple' | 'advanced' | 'raw';
  expanded: boolean;
  onToggle: () => void;
  validation: any;
}

const QueryPreview: React.FC<QueryPreviewProps> = ({
  formData,
  dateRange,
  rawQuery,
  queryMode,
  expanded,
  onToggle,
  validation
}) => {
  // Clean function to decode URL-encoded values for display
  const cleanQueryForDisplay = (query: string): string => {
    return decodeURIComponent(query)
      .replace(/%22/g, '"')
      .replace(/\+/g, ' ');
  };

  const generatedQuery = queryMode === 'raw' 
    ? rawQuery 
    : buildQueryString(formData, dateRange, { mode: queryMode });
  
  const displayQuery = cleanQueryForDisplay(generatedQuery);
  
  const handleCopyQuery = () => {
    navigator.clipboard.writeText(displayQuery);
  };

  const getValidationIcon = () => {
    switch (validation.overallStatus) {
      case 'ready':
        return <CheckCircle color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const getValidationColor = () => {
    switch (validation.overallStatus) {
      case 'ready':
        return 'success.light';
      case 'error':
        return 'error.light';
      default:
        return 'warning.light';
    }
  };

  return (
    <Paper sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'grey.50' }
        }}
        onClick={onToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getValidationIcon()}
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Query Preview
          </Typography>
          <Chip 
            label={queryMode.toUpperCase()} 
            size="small" 
            color={queryMode === 'raw' ? 'warning' : queryMode === 'advanced' ? 'secondary' : 'primary'}
            variant="outlined"
          />
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {displayQuery && (
            <Tooltip title="Copy query to clipboard">
              <IconButton 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyQuery();
                }}
              >
                <ContentCopy />
              </IconButton>
            </Tooltip>
          )}
          <IconButton size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: getValidationColor() }}>
          {displayQuery ? (
            <>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Generated Solr Query:
              </Typography>
              <Paper 
                sx={{ 
                  p: 2, 
                  bgcolor: 'grey.900', 
                  color: 'white',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  borderRadius: 1,
                  overflow: 'auto'
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {displayQuery}
                </pre>
              </Paper>
              
              {/* Query Analysis */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Query Analysis:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  {displayQuery.includes('AND') && (
                    <Chip label="Uses AND logic" size="small" color="success" variant="outlined" />
                  )}
                  {displayQuery.includes('OR') && (
                    <Chip label="Uses OR logic" size="small" color="info" variant="outlined" />
                  )}
                  {displayQuery.includes('NOT') && (
                    <Chip label="Uses NOT logic" size="small" color="error" variant="outlined" />
                  )}
                  {(displayQuery.match(/\(/g) || []).length > 0 && (
                    <Chip label="Complex grouping" size="small" color="secondary" variant="outlined" />
                  )}
                  {displayQuery.includes('[') && displayQuery.includes('TO') && (
                    <Chip label="Date range" size="small" color="primary" variant="outlined" />
                  )}
                  {queryMode === 'raw' && (
                    <Chip label="Raw query mode" size="small" color="warning" variant="filled" />
                  )}
                </Box>
              </Box>
            </>
          ) : (
            <Alert severity="info">
              <Typography variant="body2">
                Enter search terms to see the generated query
              </Typography>
            </Alert>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default React.memo(QueryPreview);
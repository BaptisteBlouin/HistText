// app/frontend/src/containers/components/MetadataForm/components/SimpleFormField.tsx
import React from 'react';
import {
  Paper,
  Typography,
  TextField,
  Autocomplete,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Box,
  Alert,
  Collapse
} from '@mui/material';
import { 
  Star, 
  CheckCircle, 
  Warning, 
  Error as ErrorIcon,
  Info,
  Lightbulb
} from '@mui/icons-material';
import ContextHelp from '../../../../components/ui/ContextHelp';
import { useSmartValidation } from '../../../../hooks/useSmartValidation';

interface SimpleFormFieldProps {
  field: any;
  formData: any;
  collectionInfo: any;
  hasEmbeddings: boolean;
  neighbors: { [key: string]: string[] };
  loadingNeighbors: { [key: string]: boolean };
  metadata: any[];
  onFormChange: (event: any, fieldName: string, index: number) => void;
  onSelectChange: (fieldName: string, newValue: string | null, index: number) => void;
  onFetchNeighbors: (inputValue: string, fieldName: string) => void;
  onRemoveNeighborDropdown: (fieldName: string) => void;
}

const SimpleFormField: React.FC<SimpleFormFieldProps> = ({
  field,
  formData,
  collectionInfo,
  hasEmbeddings,
  neighbors,
  loadingNeighbors,
  metadata,
  onFormChange,
  onSelectChange,
  onFetchNeighbors,
  onRemoveNeighborDropdown
}) => {
  const { validateField } = useSmartValidation(formData, metadata, collectionInfo);
  const isTextField = collectionInfo?.text_field === field.name;
  
  // Get validation for this field
  const validation = validateField(field.name, formData[field.name] || []);

  // Get appropriate help topic based on field type
  const getFieldHelpTopic = () => {
    if (field.name.toLowerCase().includes('date')) return 'date_range';
    if (field.possible_values?.length > 0) return 'field_selection';
    return 'search_terms';
  };

  // Helper function to get validation icon and color
  const getValidationIcon = () => {
    switch (validation.status) {
      case 'valid':
        return { icon: <CheckCircle />, color: 'success.main' };
      case 'warning':
        return { icon: <Warning />, color: 'warning.main' };
      case 'error':
        return { icon: <ErrorIcon />, color: 'error.main' };
      default:
        return null;
    }
  };

  // Helper function to get border styles based on validation
  const getInputStyles = (entry: any) => {
    let borderColor = 'inherit';
    let backgroundColor = 'transparent';

    // Primary text field gets special treatment
    if (isTextField) {
      borderColor = 'primary.main';
      backgroundColor = 'rgba(102, 126, 234, 0.05)';
    }

    // Apply validation styling
    if (validation.status === 'error') {
      borderColor = 'error.main';
      backgroundColor = 'rgba(244, 67, 54, 0.08)';
    } else if (validation.status === 'valid' && validation.hasValue) {
      borderColor = 'success.light';
    }

    return {
      '& .MuiOutlinedInput-root': {
        borderColor,
        backgroundColor,
        fontWeight: isTextField ? 600 : 'inherit',
        transition: 'all 0.2s ease',
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor,
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor,
          boxShadow: `0 0 0 2px ${borderColor === 'error.main' ? 'rgba(244, 67, 54, 0.2)' : 
                                    borderColor === 'success.main' ? 'rgba(76, 175, 80, 0.2)' : 
                                    'rgba(102, 126, 234, 0.2)'}`,
        }
      }
    };
  };

  const validationIcon = getValidationIcon();
  const currentEntry = formData[field.name]?.[0] || { value: '', operator: '', not: false };

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        height: '100%',
        border: isTextField ? '2px solid' : '1px solid',
        borderColor: isTextField ? 'primary.main' : 
                     validation.status === 'error' ? 'error.main' :
                     validation.status === 'warning' ? 'warning.main' :
                     validation.status === 'valid' ? 'success.light' : 'divider',
        position: 'relative',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Field Header with Help */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {field.name}
          </Typography>
          <ContextHelp topic={getFieldHelpTopic()} size="small" />
          {validationIcon && (
            <Box sx={{ color: validationIcon.color, display: 'flex', alignItems: 'center' }}>
              {validationIcon.icon}
            </Box>
          )}
        </Box>
        
        {/* Field Status Indicators */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isTextField && (
            <Chip 
              label="Primary" 
              size="small" 
              color="primary" 
              variant="outlined"
            />
          )}
          {hasEmbeddings && isTextField && (
            <Tooltip title="AI-powered suggestions available">
              <Chip 
                label="AI" 
                size="small" 
                color="secondary" 
                variant="outlined"
                icon={<Star />}
              />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Validation Message */}
      <Collapse in={validation.status !== 'empty' && validation.status !== 'valid'}>
        <Alert 
          severity={validation.status as any} 
          sx={{ mb: 2, fontSize: '0.875rem' }}
          icon={false}
        >
          {validation.message}
        </Alert>
      </Collapse>

      {/* Suggestions */}
      <Collapse in={validation.suggestions && validation.suggestions.length > 0}>
        <Box sx={{ mb: 2 }}>
          {validation.suggestions?.map((suggestion, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Lightbulb sx={{ fontSize: 16, color: 'info.main' }} />
              <Typography variant="caption" color="info.main">
                {suggestion}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Form Field */}
      {field.possible_values?.length > 0 ? (
        <Autocomplete
          options={field.possible_values}
          value={currentEntry.value || null}
          onChange={(_, newValue) => onSelectChange(field.name, newValue, 0)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={`Select ${field.name}...`}
              sx={getInputStyles(currentEntry)}
            />
          )}
        />
      ) : (
        <Box>
          <TextField
            name={field.name}
            value={currentEntry.value}
            onChange={e => onFormChange(e, field.name, 0)}
            size="small"
            fullWidth
            placeholder={`Enter ${field.name}...`}
            InputProps={{
              endAdornment: hasEmbeddings && isTextField && (
                <Tooltip title="Find similar words using AI embeddings">
                  <IconButton
                    onClick={() => onFetchNeighbors(currentEntry.value, field.name)}
                    disabled={loadingNeighbors[field.name] || !currentEntry.value}
                    size="small"
                    color="primary"
                    sx={{
                      '&:hover': {
                        bgcolor: 'primary.light',
                        color: 'white'
                      }
                    }}
                  >
                    {loadingNeighbors[field.name] ? (
                      <CircularProgress size={16} />
                    ) : (
                      <Star />
                    )}
                  </IconButton>
                </Tooltip>
              ),
            }}
            sx={getInputStyles(currentEntry)}
          />

          {neighbors[field.name] && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Star sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  AI Suggestions:
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {neighbors[field.name].map((neighbor: string, index: number) => (
                  <Chip
                    key={index}
                    label={neighbor}
                    size="small"
                    clickable
                    onClick={() => onSelectChange(field.name, neighbor, 0)}
                    sx={{ 
                      fontSize: '0.75rem',
                      '&:hover': {
                        bgcolor: 'primary.light',
                        color: 'white',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  />
                ))}
              </Box>
              <Box 
                component="button"
                type="button"
                onClick={() => onRemoveNeighborDropdown(field.name)}
                sx={{
                  fontSize: '0.75rem',
                  background: 'none',
                  border: 'none',
                  color: 'text.secondary',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Hide suggestions
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default React.memo(SimpleFormField);
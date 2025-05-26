import React from 'react';
import {
  Paper,
  Typography,
  TextField,
  Autocomplete,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Box
} from '@mui/material';
import { Star, Remove, Add } from '@mui/icons-material';

interface FormFieldProps {
  field: any;
  formData: any;
  collectionInfo: any;
  hasEmbeddings: boolean;
  neighbors: { [key: string]: string[] };
  loadingNeighbors: { [key: string]: boolean };
  onFormChange: (event: any, index: number) => void;
  onSelectChange: (fieldName: string, newValue: string | null, index: number) => void;
  onToggleNot: (name: string, index: number) => void;
  onAddBooleanField: (name: string, operator: string) => void;
  onRemoveBooleanField: (name: string, index: number) => void;
  onFetchNeighbors: (inputValue: string, fieldName: string) => void;
  onRemoveNeighborDropdown: (fieldName: string) => void;
}

const FormField: React.FC<FormFieldProps> = ({
  field,
  formData,
  collectionInfo,
  hasEmbeddings,
  neighbors,
  loadingNeighbors,
  onFormChange,
  onSelectChange,
  onToggleNot,
  onAddBooleanField,
  onRemoveBooleanField,
  onFetchNeighbors,
  onRemoveNeighborDropdown
}) => {
  const isTextField = collectionInfo?.text_field === field.name;

  // Helper function to get border styles based on operator and not condition
  const getInputStyles = (entry: any) => {
    let borderColor = 'inherit';
    let borderWidth = 1;

    if (entry.not) {
      borderColor = 'error.main';
      borderWidth = 2;
    } else if (entry.operator === 'AND') {
      borderColor = 'success.main';
      borderWidth = 2;
    } else if (entry.operator === 'OR') {
      borderColor = 'info.main';
      borderWidth = 2;
    }

    return {
      '& .MuiOutlinedInput-root': {
        borderColor,
        borderWidth,
        fontWeight: isTextField ? 600 : 'inherit',
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor,
          borderWidth,
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor,
          borderWidth: borderWidth + 1,
        }
      }
    };
  };

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        height: '100%',
        border: isTextField ? '2px solid' : '1px solid',
        borderColor: isTextField ? 'primary.main' : 'divider',
        position: 'relative'
      }}
    >
      {isTextField && (
        <Chip 
          label="Primary Text Field" 
          size="small" 
          color="primary" 
          sx={{ position: 'absolute', top: -10, left: 8, bgcolor: 'background.paper' }}
        />
      )}
      
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
        {field.name}
      </Typography>

      {field.possible_values?.length > 0 ? (
        <Box>
          {formData[field.name]?.map((entry: any, idx: number) => (
            <Box key={`${field.name}-${idx}`} sx={{ mb: idx < formData[field.name].length - 1 ? 2 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Tooltip title={entry.not ? "Exclude this value" : "Include this value"}>
                  <Button
                    variant={entry.not ? "contained" : "outlined"}
                    color={entry.not ? "error" : "inherit"}
                    size="small"
                    onClick={() => onToggleNot(field.name, idx)}
                    sx={{ 
                      minWidth: 60,
                      fontWeight: 600,
                      boxShadow: entry.not ? 2 : 0
                    }}
                  >
                    NOT
                  </Button>
                </Tooltip>
                
                <Box sx={{ flexGrow: 1 }}>
                  <Autocomplete
                    options={field.possible_values}
                    value={entry.value || null}
                    onChange={(_, newValue) => onSelectChange(field.name, newValue, idx)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder={`Select ${field.name}...`}
                        sx={getInputStyles(entry)}
                      />
                    )}
                  />
                </Box>

                {idx > 0 && (
                  <IconButton 
                    onClick={() => onRemoveBooleanField(field.name, idx)}
                    size="small"
                    color="error"
                    sx={{ 
                      bgcolor: 'error.light',
                      '&:hover': { bgcolor: 'error.main', color: 'white' }
                    }}
                  >
                    <Remove />
                  </IconButton>
                )}
              </Box>

              {idx === formData[field.name].length - 1 && (
                <ButtonGroup size="small" variant="outlined" sx={{ mt: 1 }}>
                  <Button
                    onClick={() => onAddBooleanField(field.name, 'AND')}
                    color="success"
                    startIcon={<Add />}
                    sx={{ 
                      fontWeight: 600,
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    AND
                  </Button>
                  <Button
                    onClick={() => onAddBooleanField(field.name, 'OR')}
                    color="info"
                    startIcon={<Add />}
                    sx={{ 
                      fontWeight: 600,
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    OR
                  </Button>
                </ButtonGroup>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Box>
          {formData[field.name]?.map((entry: any, idx: number) => (
            <Box key={`${field.name}-${idx}`} sx={{ mb: idx < formData[field.name].length - 1 ? 2 : 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Tooltip title={entry.not ? "Exclude this value" : "Include this value"}>
                  <Button
                    variant={entry.not ? "contained" : "outlined"}
                    color={entry.not ? "error" : "inherit"}
                    size="small"
                    onClick={() => onToggleNot(field.name, idx)}
                    sx={{ 
                      minWidth: 60,
                      fontWeight: 600,
                      boxShadow: entry.not ? 2 : 0
                    }}
                  >
                    NOT
                  </Button>
                </Tooltip>
                
                <Box sx={{ flexGrow: 1 }}>
                  <TextField
                    name={field.name}
                    value={entry.value}
                    onChange={e => onFormChange(e, idx)}
                    size="small"
                    fullWidth
                    placeholder={`Enter ${field.name}...`}
                    InputProps={{
                      endAdornment: idx === 0 && hasEmbeddings && (
                        <Tooltip title="Find similar words using AI embeddings">
                          <IconButton
                            onClick={() => onFetchNeighbors(entry.value, field.name)}
                            disabled={loadingNeighbors[field.name] || !entry.value}
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
                    sx={getInputStyles(entry)}
                  />
                </Box>

                {idx > 0 && (
                  <IconButton 
                    onClick={() => onRemoveBooleanField(field.name, idx)}
                    size="small"
                    color="error"
                    sx={{ 
                      bgcolor: 'error.light',
                      '&:hover': { bgcolor: 'error.main', color: 'white' }
                    }}
                  >
                    <Remove />
                  </IconButton>
                )}
              </Box>

              {neighbors[field.name] && idx === 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                    Similar words:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {neighbors[field.name].map((neighbor: string, index: number) => (
                      <Chip
                        key={index}
                        label={neighbor}
                        size="small"
                        clickable
                        onClick={() => onSelectChange(field.name, neighbor)}
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
                  <Button 
                    size="small" 
                    variant="text"
                    onClick={() => onRemoveNeighborDropdown(field.name)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Hide suggestions
                  </Button>
                </Box>
              )}

              {idx === formData[field.name].length - 1 && (
                <ButtonGroup size="small" variant="outlined" sx={{ mt: 1 }}>
                  <Button
                    onClick={() => onAddBooleanField(field.name, 'AND')}
                    color="success"
                    startIcon={<Add />}
                    sx={{ 
                      fontWeight: 600,
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    AND
                  </Button>
                  <Button
                    onClick={() => onAddBooleanField(field.name, 'OR')}
                    color="info"
                    startIcon={<Add />}
                    sx={{ 
                      fontWeight: 600,
                      '&:hover': {
                        boxShadow: 2,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    OR
                  </Button>
                </ButtonGroup>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
};

export default React.memo(FormField);
// app/frontend/src/containers/components/MetadataForm/components/RawQueryEditor.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Collapse
} from '@mui/material';
import {
  Code,
  Help,
  AutoFixHigh,
  CheckCircle,
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess,
  ContentCopy
} from '@mui/icons-material';
import { parseQueryToFormData } from '../utils/queryParser';

interface RawQueryEditorProps {
  query: string;
  onQueryChange: (query: string) => void;
  metadata: any[];
  collectionInfo: any;
  onApplyToForm: (formData: any) => void;
}

const RawQueryEditor: React.FC<RawQueryEditorProps> = ({
  query,
  onQueryChange,
  metadata,
  collectionInfo,
  onApplyToForm
}) => {
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [syntaxValid, setSyntaxValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);

  // Sync with prop changes
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Validate query syntax
  const validateQuery = useCallback((queryString: string) => {
    try {
      // Basic validation checks
      if (!queryString.trim()) {
        setSyntaxValid(true);
        setValidationMessage('');
        return;
      }

      // Check for balanced parentheses
      let balance = 0;
      for (const char of queryString) {
        if (char === '(') balance++;
        if (char === ')') balance--;
        if (balance < 0) {
          setSyntaxValid(false);
          setValidationMessage('Unmatched closing parenthesis');
          return;
        }
      }
      if (balance !== 0) {
        setSyntaxValid(false);
        setValidationMessage('Unmatched opening parenthesis');
        return;
      }

      // Check for valid field names
      const availableFields = metadata.map(f => f.name);
      const fieldPattern = /(\w+):/g;
      let match;
      while ((match = fieldPattern.exec(queryString)) !== null) {
        const fieldName = match[1];
        if (!availableFields.includes(fieldName)) {
          setSyntaxValid(false);
          setValidationMessage(`Unknown field: "${fieldName}"`);
          return;
        }
      }

      setSyntaxValid(true);
      setValidationMessage('Query syntax is valid');
    } catch (error) {
      setSyntaxValid(false);
      setValidationMessage('Invalid query syntax');
    }
  }, [metadata]);

  // Handle query change with validation
  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newQuery = event.target.value;
    setLocalQuery(newQuery);
    onQueryChange(newQuery);
    validateQuery(newQuery);
  }, [onQueryChange, validateQuery]);

  // Convert raw query back to form data
  const handleApplyToForm = useCallback(() => {
    try {
      const formData = parseQueryToFormData(localQuery, metadata);
      onApplyToForm(formData);
    } catch (error) {
      console.error('Error parsing query to form data:', error);
    }
  }, [localQuery, metadata, onApplyToForm]);

  // Clean URL-encoded values for display
  const getDisplayQuery = (rawQuery: string): string => {
    return decodeURIComponent(rawQuery)
      .replace(/%22/g, '"')
      .replace(/\+/g, ' ');
  };

  // Example queries
  const exampleQueries = [
    {
      name: 'Simple search',
      query: 'title:"climate change"',
      description: 'Search for exact phrase in title field'
    },
    {
      name: 'Boolean AND',
      query: 'title:"climate change" AND content:"global warming"',
      description: 'Both terms must be present'
    },
    {
      name: 'Boolean OR',
      query: 'title:"climate" OR title:"environment"',
      description: 'Either term can be present'
    },
    {
      name: 'NOT condition',
      query: 'content:"climate" AND NOT content:"skeptic"',
      description: 'Include climate but exclude skeptic'
    },
    {
      name: 'Complex grouping',
      query: '(title:"climate" OR title:"environment") AND (content:"research" OR content:"study")',
      description: 'Complex Boolean logic with grouping'
    },
    {
      name: 'Date range',
      query: 'content:"climate" AND date:[2020-01-01T00:00:00Z TO 2023-12-31T23:59:59Z]',
      description: 'Search with date range filter'
    }
  ];

  return (
    <Box>
      {/* Info Panel */}
      <Box sx={{ 
        mb: 3, 
        p: 2, 
        borderRadius: 2, 
        bgcolor: 'warning.light', 
        border: 1, 
        borderColor: 'warning.main' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Code color="warning" />
            <Typography variant="subtitle2" color="warning.dark" sx={{ fontWeight: 600 }}>
              Raw Query Mode
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Show examples">
              <IconButton 
                size="small" 
                onClick={() => setShowExamples(!showExamples)}
                color="warning"
              >
                {showExamples ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Query syntax help">
              <IconButton 
                size="small" 
                onClick={() => setHelpDialogOpen(true)}
                color="warning"
              >
                <Help />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="body2" color="warning.dark">
          Write Solr queries directly. Use field:value syntax with Boolean operators (AND, OR, NOT) 
          and parentheses for grouping. Advanced users only.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Chip label="Boolean operators" size="small" color="warning" variant="outlined" />
          <Chip label="Parentheses grouping" size="small" color="warning" variant="outlined" />
          <Chip label="Field:value syntax" size="small" color="warning" variant="outlined" />
        </Box>
      </Box>

      {/* Examples */}
      <Collapse in={showExamples}>
        <Paper sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Query Examples
          </Typography>
          <List dense>
            {exampleQueries.map((example, index) => (
              <ListItem 
                key={index}
                sx={{ 
                  flexDirection: 'column', 
                  alignItems: 'flex-start',
                  p: 1,
                  '&:hover': { bgcolor: 'grey.100' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {example.name}:
                  </Typography>
                  <Tooltip title="Copy to editor">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        setLocalQuery(example.query);
                        onQueryChange(example.query);
                      }}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontFamily: 'monospace',
                    bgcolor: 'white',
                    p: 1,
                    borderRadius: 1,
                    width: '100%',
                    fontSize: '0.875rem'
                  }}
                >
                  {example.query}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {example.description}
                </Typography>
              </ListItem>
            ))}
          </List>
        </Paper>
      </Collapse>

      {/* Query Editor */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Query Editor
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={6}
            value={getDisplayQuery(localQuery)}
            onChange={handleQueryChange}
            placeholder="Enter your Solr query here..."
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }
            }}
          />
          
          {/* Validation Status */}
          {validationMessage && (
            <Alert 
              severity={syntaxValid ? 'success' : 'error'} 
              sx={{ mt: 2 }}
              icon={syntaxValid ? <CheckCircle /> : <ErrorIcon />}
            >
              {validationMessage}
            </Alert>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AutoFixHigh />}
              onClick={handleApplyToForm}
              disabled={!syntaxValid || !localQuery.trim()}
            >
              Convert to Form
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Help Dialog */}
      <Dialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Solr Query Syntax Help</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>Basic Syntax</Typography>
            <List>
              <ListItem>
                <ListItemText 
                  primary="field:value" 
                  secondary="Search for 'value' in specific field"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary='field:"exact phrase"' 
                  secondary="Search for exact phrase (quotes required)"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="field:value*" 
                  secondary="Wildcard search (starts with 'value')"
                />
              </ListItem>
            </List>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>Boolean Operators</Typography>
            <List>
              <ListItem>
                <ListItemText
                    primary="term1 AND term2" 
                    secondary="Both terms must be present"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="term1 OR term2" 
                    secondary="Either term can be present"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="NOT term" 
                    secondary="Exclude documents containing term"
                  />
                </ListItem>
              </List>
            </Box>
   
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>Grouping</Typography>
              <List>
                <ListItem>
                  <ListItemText 
                    primary="(term1 OR term2) AND term3" 
                    secondary="Use parentheses to control logic precedence"
                  />
                </ListItem>
              </List>
            </Box>
   
            <Box>
              <Typography variant="h6" gutterBottom>Available Fields</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {metadata.map(field => (
                  <Chip 
                    key={field.name}
                    label={field.name}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const newQuery = localQuery + (localQuery ? ' AND ' : '') + `${field.name}:""`;
                      setLocalQuery(newQuery);
                      onQueryChange(newQuery);
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
   };
   
   export default React.memo(RawQueryEditor);
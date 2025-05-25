import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  IconButton,
  Paper,
  Box,
  Chip,
  Card,
  CardContent,
  Grid,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Stack,
  useTheme,
  useMediaQuery,
  Fade,
  Slide,
  AppBar,
  Toolbar
} from '@mui/material';
import { 
  Close, 
  Description, 
  ExpandMore, 
  ContentCopy, 
  Launch, 
  Download,
  Search,
  Visibility,
  VisibilityOff,
  Info,
  Article,
  DataObject,
  Label as LabelIcon
} from '@mui/icons-material';
import config from '../../../config.json';

const DocumentDetailsModal = ({
  open,
  onClose,
  documentId,
  collectionName,
  solrDatabaseId,
  authAxios,
  nerData,
  viewNER = false,
}) => {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showNER, setShowNER] = useState(viewNER);
  const [expandedFields, setExpandedFields] = useState(new Set(['content']));
  const [copiedField, setCopiedField] = useState(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
  const NERLABELS2FULL = config.NERLABELS2FULL;
  const viewNERFields = config.viewNERFields;

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      if (!open || !documentId || !collectionName || !solrDatabaseId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await authAxios.get(
          `/api/solr/query?collection=${encodeURIComponent(collectionName)}&query=id:${encodeURIComponent(documentId)}&start=0&rows=1&solr_database_id=${solrDatabaseId}`,
        );

        if (response.data?.solr_response?.response?.docs?.length > 0) {
          setDocument(response.data.solr_response.response.docs[0]);
        } else {
          setError('Document not found');
        }
      } catch (err) {
        console.error('Error fetching document details:', err);
        setError('Failed to fetch document details');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentDetails();
  }, [open, documentId, collectionName, solrDatabaseId, authAxios]);

  const handleCopyField = async (fieldName, content) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  const toggleField = (fieldName) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
  };

  const renderFieldContent = (fieldName, content) => {
    if (!content) return null;

    const hasNER = showNER &&
      viewNERFields.some(field => fieldName === field || fieldName.includes(field)) &&
      nerData &&
      nerData[documentId] &&
      Array.isArray(nerData[documentId].t);

    if (hasNER) {
      const annotations = nerData[documentId].t.map((text, index) => ({
        t: text,
        l: nerData[documentId].l[index],
        s: nerData[documentId].s[index],
        e: nerData[documentId].e[index],
        c: nerData[documentId].c[index],
      }));

      const sortedAnnotations = annotations.sort((a, b) => {
        if (a.s !== b.s) {
          return a.s - b.s;
        }
        return b.e - b.s - (a.e - a.s);
      });

      const elements = [];
      let lastIndex = 0;

      sortedAnnotations.forEach(({ s, e, l, c }) => {
        if (s > lastIndex) {
          elements.push(
            <span key={`text-${lastIndex}-${s}`}>
              {content.slice(lastIndex, s)}
            </span>
          );
        }
        const label = l[0];
        const color = NER_LABELS_COLORS[label] || '#gray';
        const confidence = (c * 100).toFixed(1);
        
        elements.push(
          <Tooltip
            key={`${s}-${e}`}
            title={`${NERLABELS2FULL[label] || label} (${confidence}% confidence)`}
            arrow
          >
            <Chip
              label={content.slice(s, e)}
              size="small"
              sx={{
                backgroundColor: color,
                color: 'white',
                margin: '2px 1px',
                fontWeight: 500,
                fontSize: '0.875rem',
                height: 'auto',
                '& .MuiChip-label': {
                  padding: '4px 8px'
                }
              }}
            />
          </Tooltip>
        );
        lastIndex = e;
      });

      if (lastIndex < content.length) {
        elements.push(
          <span key={`text-${lastIndex}-end`}>
            {content.slice(lastIndex)}
          </span>
        );
      }

      return (
        <Box sx={{ 
          lineHeight: 1.8, 
          fontSize: '0.95rem',
          '& span': { 
            wordBreak: 'break-word' 
          }
        }}>
          {elements}
        </Box>
      );
    }

    return (
      <Typography 
        variant="body2" 
        sx={{ 
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          lineHeight: 1.6,
          fontSize: '0.95rem'
        }}
      >
        {content}
      </Typography>
    );
  };

  const getFieldIcon = (fieldName) => {
    const name = fieldName.toLowerCase();
    if (name.includes('title') || name.includes('name')) return <Article />;
    if (name.includes('content') || name.includes('text') || name.includes('body')) return <Description />;
    if (name.includes('date') || name.includes('time')) return <Info />;
    if (name.includes('id')) return <DataObject />;
    return <LabelIcon />;
  };

  const getFieldPriority = (fieldName) => {
    const name = fieldName.toLowerCase();
    if (name.includes('title')) return 1;
    if (name.includes('content') || name.includes('text') || name.includes('body')) return 2;
    if (name.includes('date')) return 3;
    if (name.includes('id')) return 10;
    return 5;
  };

  const isLongContent = (content) => {
    return typeof content === 'string' && content.length > 200;
  };

  if (!open) return null;

  const documentFields = document ? Object.entries(document)
    .filter(([key]) => !(key.startsWith('_') && key.endsWith('_')))
    .filter(([key]) => !key.startsWith('score'))
    .sort(([a], [b]) => getFieldPriority(a) - getFieldPriority(b)) : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          maxHeight: isMobile ? '100vh' : '90vh',
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden'
        },
      }}
      TransitionComponent={isMobile ? Slide : Fade}
      TransitionProps={isMobile ? { direction: 'up' } : {}}
    >
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        <Toolbar>
          <Description sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Document Details
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {documentId ? `ID: ${documentId}` : 'Loading...'}
            </Typography>
          </Box>
          
          {nerData && nerData[documentId] && (
            <Tooltip title={showNER ? 'Hide entity highlighting' : 'Show entity highlighting'}>
              <IconButton 
                color="inherit" 
                onClick={() => setShowNER(!showNER)}
                sx={{ mr: 1 }}
              >
                {showNER ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Tooltip>
          )}
          
          <IconButton color="inherit" onClick={onClose}>
            <Close />
          </IconButton>
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ p: 0, bgcolor: 'grey.50' }}>
        {loading ? (
          <Box 
            display="flex" 
            flexDirection="column"
            justifyContent="center" 
            alignItems="center" 
            minHeight="400px"
            gap={2}
          >
            <CircularProgress size={48} />
            <Typography variant="h6" color="text.secondary">
              Loading document...
            </Typography>
          </Box>
        ) : error ? (
          <Box 
            display="flex" 
            flexDirection="column"
            justifyContent="center" 
            alignItems="center" 
            minHeight="400px"
            gap={2}
          >
            <Description sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
            <Typography variant="h6" color="error" align="center">
              {error}
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              The document could not be loaded. Please try again.
            </Typography>
          </Box>
        ) : document ? (
          <Box sx={{ p: 3 }}>
            {showNER && nerData && nerData[documentId] && (
              <Card sx={{ mb: 3, border: '1px solid', borderColor: 'primary.light' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <LabelIcon color="primary" />
                    <Typography variant="h6" color="primary">
                      Entity Highlighting Active
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Named entities are highlighted with colored chips. Hover over them to see confidence scores.
                  </Typography>
                </CardContent>
              </Card>
            )}

            <Grid container spacing={3}>
              {documentFields.map(([key, value]) => {
                const isExpanded = expandedFields.has(key);
                const isLong = isLongContent(value);
                const shouldCollapse = isLong && !isExpanded;

                return (
                  <Grid item xs={12} key={key}>
                    <Card 
                      elevation={2}
                      sx={{ 
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          boxShadow: theme.shadows[4],
                          transform: 'translateY(-1px)'
                        }
                      }}
                    >
                      <CardContent>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          mb: 2 
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getFieldIcon(key)}
                            <Typography 
                              variant="h6" 
                              sx={{ 
                                fontWeight: 600,
                                color: 'primary.main',
                                fontSize: '1.1rem'
                              }}
                            >
                              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                            {isLong && (
                              <Chip 
                                label={`${value.length} chars`} 
                                size="small" 
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            )}
                          </Box>
                          
                          <Stack direction="row" spacing={1}>
                            <Tooltip title={copiedField === key ? 'Copied!' : 'Copy content'}>
                              <IconButton 
                                size="small"
                                onClick={() => handleCopyField(key, value)}
                                color={copiedField === key ? 'success' : 'default'}
                              >
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            {isLong && (
                              <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
                                <IconButton 
                                  size="small"
                                  onClick={() => toggleField(key)}
                                >
                                  <ExpandMore 
                                    sx={{ 
                                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s ease'
                                    }} 
                                  />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </Box>
                        
                        <Box sx={{ 
                          maxHeight: shouldCollapse ? '120px' : 'none',
                          overflow: shouldCollapse ? 'hidden' : 'visible',
                          position: 'relative'
                        }}>
                          {renderFieldContent(key, value)}
                          
                          {shouldCollapse && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '40px',
                                background: 'linear-gradient(transparent, white)',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                pb: 1
                              }}
                            >
                              <Button
                                size="small"
                                onClick={() => toggleField(key)}
                                endIcon={<ExpandMore />}
                              >
                                Show More
                              </Button>
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ) : (
          <Box 
            display="flex" 
            flexDirection="column"
            justifyContent="center" 
            alignItems="center" 
            minHeight="400px"
          >
            <Description sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
            <Typography variant="h6" color="text.secondary" align="center">
              No document information available
            </Typography>
          </Box>
        )}
      </DialogContent>

      {!isMobile && (
        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default DocumentDetailsModal;
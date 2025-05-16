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
} from '@mui/material';
import { X } from 'lucide-react';
import config from '../../../config.json';

// Component for displaying detailed document info in a modal popup
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

  const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
  const NERLABELS2FULL = config.NERLABELS2FULL;
  const viewNERFields = config.viewNERFields;

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      if (!open || !documentId || !collectionName || !solrDatabaseId) return;

      setLoading(true);
      setError(null);

      try {
        // Query for a single document by ID
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

  // Helper to render field content with NER highlighting if needed
  const renderFieldContent = (fieldName, content) => {
    if (!content) return null;

    // If NER view is enabled and we have NER data for this document
    if (
      viewNER &&
      viewNERFields.some(field => fieldName === field || fieldName.includes(field)) &&
      nerData &&
      nerData[documentId] &&
      Array.isArray(nerData[documentId].t)
    ) {
      const annotations = nerData[documentId].t.map((text, index) => ({
        t: text,
        l: nerData[documentId].l[index],
        s: nerData[documentId].s[index],
        e: nerData[documentId].e[index],
        c: nerData[documentId].c[index],
      }));

      // Sort annotations by start position
      const sortedAnnotations = annotations.sort((a, b) => {
        if (a.s !== b.s) {
          return a.s - b.s;
        }
        return b.e - b.s - (a.e - a.s);
      });

      // Apply NER highlighting
      const elements = [];
      let lastIndex = 0;

      sortedAnnotations.forEach(({ s, e, l }) => {
        if (s > lastIndex) {
          elements.push(content.slice(lastIndex, s));
        }
        const label = l[0];
        const color = NER_LABELS_COLORS[label] || 'lightgray';
        elements.push(
          <span
            key={`${s}-${e}`}
            style={{
              backgroundColor: color,
              padding: '2px',
              borderRadius: '3px',
              display: 'inline-block',
              margin: '0 2px',
            }}
          >
            <span>{content.slice(s, e)}</span>
            <span
              style={{
                marginLeft: '3px',
                fontSize: '0.8em',
                fontWeight: 'bold',
              }}
            >
              {NERLABELS2FULL[label]}
            </span>
          </span>,
        );
        lastIndex = e;
      });

      if (lastIndex < content.length) {
        elements.push(content.slice(lastIndex));
      }

      return <div>{elements}</div>;
    }

    // If no NER processing needed
    return <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
          borderRadius: '8px',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6">Document Details</Typography>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center">
            {error}
          </Typography>
        ) : document ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Object.entries(document)
              .filter(([key]) => !(key.startsWith('_') && key.endsWith('_')))
              .filter(([key]) => !key.startsWith('score'))
              .map(([key, value]) => (
                <Paper key={key} elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                    {key}
                  </Typography>
                  {renderFieldContent(key, value)}
                </Paper>
              ))}
          </Box>
        ) : (
          <Typography align="center">No document information available</Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentDetailsModal;

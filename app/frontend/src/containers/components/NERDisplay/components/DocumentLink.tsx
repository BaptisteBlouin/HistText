import React from 'react';
import { Box } from '@mui/material';

interface DocumentLinkProps {
  /** The unique identifier of the document to link to */
  documentId: string;
  /** Child elements or text to display as the clickable link */
  children: React.ReactNode;
  /** Callback invoked when the document link is clicked */
  onDocumentClick: (documentId: string) => void;
}

/**
 * DocumentLink component renders a clickable styled span that
 * triggers a callback with the document ID when clicked.
 */
const DocumentLink: React.FC<DocumentLinkProps> = ({ 
  documentId, 
  children,
  onDocumentClick 
}) => (
  <Box
    component="span"
    onClick={() => onDocumentClick(documentId)}
    sx={{
      cursor: 'pointer',
      color: 'primary.main',
      textDecoration: 'underline',
      fontWeight: 'bold',
      '&:hover': {
        backgroundColor: 'primary.light',
        color: 'primary.contrastText',
        borderRadius: 1,
        padding: '2px 4px'
      }
    }}
  >
    {children}
  </Box>
);

export default React.memo(DocumentLink);
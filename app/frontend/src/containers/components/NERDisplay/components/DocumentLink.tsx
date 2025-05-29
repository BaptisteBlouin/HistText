// app/frontend/src/containers/components/NERDisplay/components/DocumentLink.tsx
import React from 'react';
import { Box } from '@mui/material';

interface DocumentLinkProps {
  documentId: string;
  children: React.ReactNode;
  onDocumentClick: (documentId: string) => void;
}

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
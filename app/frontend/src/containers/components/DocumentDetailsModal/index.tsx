import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery,
  Fade,
  Slide
} from '@mui/material';
import { useDocumentDetailsState } from './hooks/useDocumentDetailsState';
import { useDocumentFetch } from './hooks/useDocumentFetch';
import ModalHeader from './components/ModalHeader';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import DocumentContent from './components/DocumentContent';
import EmptyState from './components/EmptyState';

interface DocumentDetailsModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  collectionName: string;
  solrDatabaseId: number | null;
  authAxios: any;
  nerData?: any;
  viewNER?: boolean;
}

const DocumentDetailsModal: React.FC<DocumentDetailsModalProps> = React.memo(({
  open,
  onClose,
  documentId,
  collectionName,
  solrDatabaseId,
  authAxios,
  nerData,
  viewNER = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    document,
    setDocument,
    loading,
    setLoading,
    error,
    setError,
    showNER,
    setShowNER,
    expandedFields,
    copiedField,
    toggleField,
    handleCopyField,
    resetState
  } = useDocumentDetailsState();

  // Initialize showNER with viewNER prop
  useEffect(() => {
    setShowNER(viewNER);
  }, [viewNER, setShowNER]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  // Fetch document data
  useDocumentFetch(
    open,
    documentId,
    collectionName,
    solrDatabaseId,
    authAxios,
    setDocument,
    setLoading,
    setError
  );

  const hasNERData = nerData && nerData[documentId];

  const renderContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState error={error} />;
    }

    if (!document) {
      return <EmptyState />;
    }

    return (
      <DocumentContent
        document={document}
        showNER={showNER}
        nerData={nerData}
        documentId={documentId}
        expandedFields={expandedFields}
        copiedField={copiedField}
        onToggleField={toggleField}
        onCopyField={handleCopyField}
      />
    );
  };

  if (!open) return null;

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
      <ModalHeader
        documentId={documentId}
        hasNER={hasNERData}
        showNER={showNER}
        onToggleNER={() => setShowNER(!showNER)}
        onClose={onClose}
      />

      <DialogContent sx={{ p: 0, bgcolor: 'grey.50' }}>
        {renderContent()}
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
});

DocumentDetailsModal.displayName = 'DocumentDetailsModal';

export default DocumentDetailsModal;
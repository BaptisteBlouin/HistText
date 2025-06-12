import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Alert,
  Chip,
  IconButton,
  Slide,
  SlideProps,
} from '@mui/material';
import {
  Warning,
  Error,
  Info,
  CheckCircle,
  Close,
} from '@mui/icons-material';

interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error' | 'info' | 'success';
  destructive?: boolean;
  details?: string;
  impact?: {
    count?: number;
    type?: string;
    description?: string;
  };
  loading?: boolean;
}

const Transition = React.forwardRef(function Transition(
  props: SlideProps & { children: React.ReactElement<any, any> },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const getSeverityConfig = (severity: ConfirmationDialogProps['severity']) => {
  switch (severity) {
    case 'error':
      return {
        icon: <Error />,
        color: 'error.main' as const,
        alertSeverity: 'error' as const,
      };
    case 'warning':
      return {
        icon: <Warning />,
        color: 'warning.main' as const,
        alertSeverity: 'warning' as const,
      };
    case 'success':
      return {
        icon: <CheckCircle />,
        color: 'success.main' as const,
        alertSeverity: 'success' as const,
      };
    default:
      return {
        icon: <Info />,
        color: 'info.main' as const,
        alertSeverity: 'info' as const,
      };
  }
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  content,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  destructive = false,
  details,
  impact,
  loading = false,
}) => {
  const config = getSeverityConfig(severity);
  const isDestructive = destructive || severity === 'error';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
    >
      <DialogTitle
        id="confirmation-dialog-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 1,
        }}
      >
        <Box sx={{ color: config.color }}>
          {config.icon}
        </Box>
        {title}
        <Box sx={{ flexGrow: 1 }} />
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          disabled={loading}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent id="confirmation-dialog-description">
        <Typography variant="body1" sx={{ mb: 2 }}>
          {content}
        </Typography>

        {impact && (
          <Alert severity={config.alertSeverity} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Impact:</strong> {impact.description}
            </Typography>
            {impact.count && impact.type && (
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={`${impact.count} ${impact.type}${impact.count > 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  color={config.alertSeverity}
                />
              </Box>
            )}
          </Alert>
        )}

        {details && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {details}
          </Typography>
        )}

        {isDestructive && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This action cannot be undone.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={loading}
          sx={{ mr: 1 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={isDestructive ? 'error' : 'primary'}
          disabled={loading}
          autoFocus={!isDestructive}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
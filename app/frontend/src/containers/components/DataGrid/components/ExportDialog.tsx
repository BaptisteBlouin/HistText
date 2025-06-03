import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';

/**
 * Props for the ExportDialog component.
 */
interface ExportDialogProps {
  open: boolean;
  exportFormat: string;
  onClose: () => void;
  onFormatChange: (format: string) => void;
  onExport: () => void;
}

/**
 * Dialog for choosing data export format (CSV or JSON).
 * Handles confirmation/cancel and invokes export actions.
 *
 * @param props - ExportDialogProps
 * @returns Dialog UI for export options.
 */
const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  exportFormat,
  onClose,
  onFormatChange,
  onExport
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Export Data</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Format</InputLabel>
          <Select
            value={exportFormat}
            label="Format"
            onChange={(e) => onFormatChange(e.target.value)}
          >
            <MenuItem value="csv">CSV</MenuItem>
            <MenuItem value="json">JSON</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onExport} variant="contained">Export</Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(ExportDialog);
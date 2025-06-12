import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  FileDownload,
  FileUpload,
  Download,
  Upload,
  Dashboard,
  Analytics,
  People,
  Search,
  Storage,
  Settings,
  Close,
  CheckCircle,
  Warning,
} from '@mui/icons-material';

interface ExportImportControlsProps {
  onExportAll: () => Promise<any>;
  onExportTab: (tabName: string) => Promise<any>;
  onImport: (data: any) => Promise<void>;
  availableTabs: Array<{
    name: string;
    label: string;
    icon: React.ReactNode;
  }>;
}

const ExportImportControls: React.FC<ExportImportControlsProps> = ({
  onExportAll,
  onExportTab,
  onImport,
  availableTabs,
}) => {
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState('');
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | 'warning' | null;
    message: string;
  }>({ type: null, message: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    handleExportClose();
    
    try {
      const data = await onExportAll();
      downloadFile(data, `dashboard-export-${new Date().toISOString().split('T')[0]}.json`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTab = async (tabName: string) => {
    setIsExporting(true);
    handleExportClose();
    
    try {
      const data = await onExportTab(tabName);
      downloadFile(data, `${tabName}-export-${new Date().toISOString().split('T')[0]}.json`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (data: any, filename: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportDialogOpen = () => {
    setImportDialogOpen(true);
    setImportData('');
    setImportStatus({ type: null, message: '' });
  };

  const handleImportDialogClose = () => {
    setImportDialogOpen(false);
    setImportData('');
    setImportStatus({ type: null, message: '' });
  };

  const validateImportData = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      
      // Basic validation
      if (!data || typeof data !== 'object') {
        return { valid: false, message: 'Invalid JSON format' };
      }

      // Check for dashboard data structure
      const hasValidStructure = 
        data.exportType || 
        data.analytics || 
        data.userBehavior || 
        data.queryAnalytics || 
        data.collectionIntelligence ||
        data.timestamp;

      if (!hasValidStructure) {
        return { 
          valid: false, 
          message: 'This does not appear to be a valid dashboard export file' 
        };
      }

      return { valid: true, message: 'Valid dashboard data detected' };
    } catch (error) {
      return { valid: false, message: 'Invalid JSON format' };
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      setImportStatus({ type: 'error', message: 'Please paste some JSON data to import' });
      return;
    }

    const validation = validateImportData(importData);
    if (!validation.valid) {
      setImportStatus({ type: 'error', message: validation.message });
      return;
    }

    setIsImporting(true);
    setImportStatus({ type: null, message: '' });

    try {
      const data = JSON.parse(importData);
      await onImport(data);
      setImportStatus({ 
        type: 'success', 
        message: 'Dashboard data imported successfully! The dashboard will refresh shortly.' 
      });
      
      // Close dialog after success
      setTimeout(() => {
        handleImportDialogClose();
      }, 2000);
    } catch (error) {
      setImportStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Import failed' 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {/* Export Button */}
      <Tooltip title="Export Dashboard Data">
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          onClick={handleExportClick}
          disabled={isExporting}
          size="small"
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </Tooltip>

      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={handleExportClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={handleExportAll}>
          <ListItemIcon>
            <Dashboard fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Export All Dashboard Data"
            secondary="Complete dashboard export"
          />
        </MenuItem>
        
        {availableTabs.map((tab) => (
          <MenuItem key={tab.name} onClick={() => handleExportTab(tab.name)}>
            <ListItemIcon>
              {tab.icon}
            </ListItemIcon>
            <ListItemText
              primary={`Export ${tab.label}`}
              secondary={`${tab.name} data only`}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Import Button */}
      <Tooltip title="Import Dashboard Data">
        <Button
          variant="outlined"
          startIcon={<FileUpload />}
          onClick={handleImportDialogOpen}
          disabled={isImporting}
          size="small"
          color="secondary"
        >
          Import
        </Button>
      </Tooltip>

      {/* Import Dialog */}
      <Dialog 
        open={importDialogOpen} 
        onClose={handleImportDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Import Dashboard Data</Typography>
          <IconButton onClick={handleImportDialogClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3}>
            <Alert severity="info">
              You can import dashboard data from a previously exported JSON file. 
              This will restore analytics data and settings.
            </Alert>

            {/* File Upload */}
            <Paper sx={{ p: 2, border: '2px dashed', borderColor: 'divider' }}>
              <Stack spacing={2} alignItems="center">
                <Upload sx={{ fontSize: 40, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Upload a JSON file or paste JSON data below
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<Upload />}
                  size="small"
                >
                  Choose File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    hidden
                  />
                </Button>
              </Stack>
            </Paper>

            {/* JSON Input */}
            <TextField
              label="JSON Data"
              placeholder="Paste exported JSON data here..."
              multiline
              rows={8}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              variant="outlined"
              fullWidth
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }
              }}
            />

            {/* Validation Status */}
            {importData && (
              <Box>
                {(() => {
                  const validation = validateImportData(importData);
                  return (
                    <Alert severity={validation.valid ? 'success' : 'error'}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {validation.valid ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                        {validation.message}
                      </Box>
                    </Alert>
                  );
                })()}
              </Box>
            )}

            {/* Import Status */}
            {importStatus.type && (
              <Alert severity={importStatus.type}>
                {importStatus.message}
              </Alert>
            )}

            {/* Progress */}
            {isImporting && (
              <Box>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Importing dashboard data...
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleImportDialogClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!importData.trim() || isImporting}
            startIcon={<Upload />}
          >
            {isImporting ? 'Importing...' : 'Import Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExportImportControls;
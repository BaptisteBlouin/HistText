import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Snackbar,
  Paper,
  Tabs,
  Tab,
  Grid,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

interface Configuration {
  id: number;
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json' | 'csv';
  category: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface ConfigurationsByCategory {
  [category: string]: Configuration[];
}

interface ConfigurationFormData {
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json' | 'csv';
  category: string;
  description: string;
  is_system: boolean;
}

/**
 * Returns an Axios instance with Bearer token from context.
 */
const useAuthAxios = () => {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${accessToken}`;
      }
      return config;
    }, Promise.reject);
    return instance;
  }, [accessToken]);
};

const SystemConfiguration: React.FC = () => {
  const authAxios = useAuthAxios();
  const [configurations, setConfigurations] = useState<ConfigurationsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('frontend');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);
  const [formData, setFormData] = useState<ConfigurationFormData>({
    config_key: '',
    config_value: '',
    config_type: 'string',
    category: 'frontend',
    description: '',
    is_system: false,
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  const categories = ['frontend', 'backend', 'limits', 'display', 'system'];
  const configTypes = ['string', 'number', 'boolean', 'json', 'csv'];

  // Fetch configurations
  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      console.log('Fetching configurations...');
      const response = await authAxios.get('/api/configurations');
      console.log('Configurations response:', response.status, response.data);
      
      if (response.data.success) {
        setConfigurations(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch configurations');
      }
    } catch (err: any) {
      console.error('Fetch configurations error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Unknown error occurred';
      setError(errorMessage);
      showSnackbar('Failed to load configurations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigurations();
  }, [authAxios]);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Handle edit configuration
  const handleEditConfig = (config: Configuration) => {
    setSelectedConfig(config);
    setFormData({
      config_key: config.config_key,
      config_value: config.config_value,
      config_type: config.config_type,
      category: config.category,
      description: config.description || '',
      is_system: config.is_system,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedConfig) return;

    try {
      console.log('Updating configuration:', selectedConfig.config_key, 'with value:', formData.config_value);
      const response = await authAxios.put(`/api/configurations/${selectedConfig.config_key}`, {
        config_value: formData.config_value,
      });
      console.log('Update response:', response.status, response.data);

      if (response.data.success) {
        showSnackbar('Configuration updated successfully', 'success');
        setEditDialogOpen(false);
        fetchConfigurations();
      } else {
        throw new Error(response.data.message || 'Failed to update configuration');
      }
    } catch (err: any) {
      console.error('Update configuration error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update configuration';
      showSnackbar(errorMessage, 'error');
    }
  };

  // Delete functionality removed for security - configurations should not be deleted

  // Handle create configuration
  const handleCreateConfig = () => {
    setFormData({
      config_key: '',
      config_value: '',
      config_type: 'string',
      category: selectedCategory,
      description: '',
      is_system: false,
    });
    setCreateDialogOpen(true);
  };

  const handleSaveCreate = async () => {
    try {
      const response = await authAxios.post('/api/configurations', formData);

      if (response.data.success) {
        showSnackbar('Configuration created successfully', 'success');
        setCreateDialogOpen(false);
        fetchConfigurations();
      } else {
        throw new Error(response.data.message || 'Failed to create configuration');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create configuration';
      showSnackbar(errorMessage, 'error');
    }
  };

  const renderConfigValue = (config: Configuration) => {
    const maxLength = 100;
    let displayValue = config.config_value;
    
    if (config.config_type === 'json') {
      try {
        displayValue = JSON.stringify(JSON.parse(config.config_value), null, 2);
      } catch {
        // Keep original value if not valid JSON
      }
    }
    
    if (displayValue.length > maxLength) {
      return (
        <Tooltip title={displayValue}>
          <Typography variant="body2" component="div">
            {displayValue.substring(0, maxLength)}...
          </Typography>
        </Tooltip>
      );
    }
    
    return (
      <Typography variant="body2" component="div">
        {displayValue}
      </Typography>
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'default';
      case 'number': return 'primary';
      case 'boolean': return 'secondary';
      case 'json': return 'warning';
      case 'csv': return 'success';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading configurations...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={fetchConfigurations}>
            <RefreshIcon sx={{ mr: 1 }} />
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <SettingsIcon color="primary" />
                  <Typography variant="h5" component="h1">
                    System Configuration
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={fetchConfigurations}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateConfig}
                  >
                    Add Configuration
                  </Button>
                </Box>
              </Box>

              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Dynamic Configuration System:</strong> Changes to non-system configurations 
                  take effect immediately without requiring a server restart. System configurations 
                  marked with a warning icon require caution when modifying.
                </Typography>
              </Alert>

              <Tabs
                value={selectedCategory}
                onChange={(_, value) => setSelectedCategory(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3 }}
              >
                {categories.map((category) => (
                  <Tab
                    key={category}
                    label={`${category.charAt(0).toUpperCase() + category.slice(1)} (${configurations[category]?.length || 0})`}
                    value={category}
                  />
                ))}
              </Tabs>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Key</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>System</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {configurations[selectedCategory]?.map((config) => (
                      <TableRow key={config.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                            {config.config_key}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          {renderConfigValue(config)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={config.config_type}
                            size="small"
                            color={getTypeColor(config.config_type) as any}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {config.description || 'No description'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {config.is_system && (
                            <Tooltip title="System configuration - modify with caution">
                              <WarningIcon color="warning" fontSize="small" />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleEditConfig(config)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          {/* Delete functionality removed for security - configurations should not be deleted */}
                        </TableCell>
                      </TableRow>
                    )) || (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography color="text.secondary">
                            No configurations found in this category
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Configuration</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Configuration Key"
              value={formData.config_key}
              disabled
              fullWidth
            />
            <TextField
              label="Configuration Value"
              value={formData.config_value}
              onChange={(e) => setFormData(prev => ({ ...prev, config_value: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              helperText={selectedConfig?.is_system ? "Warning: This is a system configuration. Changes may affect system behavior." : ""}
            />
            <TextField
              label="Description"
              value={formData.description}
              disabled
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" startIcon={<SaveIcon />}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Configuration</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Configuration Key"
              value={formData.config_key}
              onChange={(e) => setFormData(prev => ({ ...prev, config_key: e.target.value }))}
              fullWidth
              required
              helperText="Unique identifier for this configuration"
            />
            <TextField
              label="Configuration Value"
              value={formData.config_value}
              onChange={(e) => setFormData(prev => ({ ...prev, config_value: e.target.value }))}
              multiline
              rows={4}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.config_type}
                onChange={(e) => setFormData(prev => ({ ...prev, config_type: e.target.value as any }))}
                label="Type"
              >
                {configTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
              >
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_system}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_system: e.target.checked }))}
                />
              }
              label="System Configuration (requires caution when modifying)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button onClick={handleSaveCreate} variant="contained" startIcon={<SaveIcon />}>
            Create Configuration
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete dialog removed - configurations should not be deleted for security */}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SystemConfiguration;
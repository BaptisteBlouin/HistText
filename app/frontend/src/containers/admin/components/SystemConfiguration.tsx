import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';
import { useResponsive } from '../../../lib/responsive-utils';
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
  Stack,
  Fade,
  useTheme,
  alpha,
  LinearProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Code as CodeIcon,
  DataObject as DataObjectIcon,
  Description as DescriptionIcon,
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
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();
  const [configurations, setConfigurations] = useState<ConfigurationsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('frontend');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
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

  // Force cards mode on mobile
  React.useEffect(() => {
    if (isMobile && viewMode === 'table') {
      setViewMode('cards');
    }
  }, [isMobile, viewMode]);

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return <DescriptionIcon />;
      case 'number': return <CodeIcon />;
      case 'boolean': return <Switch />;
      case 'json': return <DataObjectIcon />;
      case 'csv': return <ViewListIcon />;
      default: return <DescriptionIcon />;
    }
  };

  // Configuration Card Component for mobile view
  const ConfigCard: React.FC<{ config: Configuration }> = ({ config }) => (
    <Card
      sx={{
        mb: 2,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[4],
        },
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: `linear-gradient(135deg, ${theme.palette[getTypeColor(config.config_type) === 'default' ? 'primary' : getTypeColor(config.config_type) as any].light} 0%, ${theme.palette[getTypeColor(config.config_type) === 'default' ? 'primary' : getTypeColor(config.config_type) as any].main} 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  color: 'text.primary',
                  wordBreak: 'break-all',
                }}
              >
                {config.config_key}
              </Typography>
              {config.is_system && (
                <Tooltip title="System configuration - modify with caution">
                  <WarningIcon
                    color="warning"
                    sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                  />
                </Tooltip>
              )}
            </Box>
            <Chip
              icon={getTypeIcon(config.config_type)}
              label={config.config_type}
              size="small"
              color={getTypeColor(config.config_type) as any}
              sx={{ mb: 1 }}
            />
          </Box>
          <IconButton
            size="small"
            onClick={() => handleEditConfig(config)}
            color="primary"
            sx={{ ml: 1 }}
          >
            <EditIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Value:
          </Typography>
          <Box
            sx={{
              p: 1.5,
              bgcolor: alpha(theme.palette.grey[500], 0.1),
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              maxHeight: { xs: 100, sm: 120 },
              overflowY: 'auto',
            }}
          >
            {renderConfigValue(config)}
          </Box>
        </Box>
        
        {config.description && (
          <Typography variant="body2" color="text.secondary">
            {config.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography variant={isMobile ? 'body1' : 'h6'}>
          Loading configurations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchConfigurations}>
              <RefreshIcon sx={{ mr: 1 }} />
              Retry
            </Button>
          }
          sx={{ flexDirection: { xs: 'column', sm: 'row' } }}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Fade in={true} timeout={500}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          <Grid item xs={12}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2),
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                {/* Mobile Header */}
                {isMobile ? (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          p: 1,
                          borderRadius: '8px',
                          bgcolor: 'primary.main',
                          color: 'white',
                        }}
                      >
                        <SettingsIcon sx={{ fontSize: '1.25rem' }} />
                      </Box>
                      <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
                        System Config
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={fetchConfigurations}
                        sx={{ flex: 1 }}
                      >
                        Refresh
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleCreateConfig}
                        sx={{ flex: 1 }}
                      >
                        Add
                      </Button>
                    </Stack>
                  </Box>
                ) : (
                  /* Desktop Header */
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          p: 1.5,
                          borderRadius: '12px',
                          bgcolor: 'primary.main',
                          color: 'white',
                          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                        }}
                      >
                        <SettingsIcon />
                      </Box>
                      <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
                        System Configuration
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {!isMobile && (
                        <Tooltip title={viewMode === 'cards' ? 'Switch to table view' : 'Switch to card view'}>
                          <IconButton
                            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                            color="primary"
                          >
                            {viewMode === 'cards' ? <ViewListIcon /> : <ViewModuleIcon />}
                          </IconButton>
                        </Tooltip>
                      )}
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
                    </Stack>
                  </Box>
                )}

                <Alert
                  severity="info"
                  sx={{
                    mb: 3,
                    '& .MuiAlert-message': {
                      width: '100%',
                    },
                  }}
                >
                  <Typography variant={isMobile ? 'caption' : 'body2'}>
                    <strong>Dynamic Configuration:</strong> Changes to non-system configs take effect immediately. System configs {!isMobile && '(marked with warning icon)'} require caution.
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
                      label={isMobile 
                        ? `${category.charAt(0).toUpperCase() + category.slice(1)} (${configurations[category]?.length || 0})`
                        : `${category.charAt(0).toUpperCase() + category.slice(1)} (${configurations[category]?.length || 0})`
                      }
                      value={category}
                      sx={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        minWidth: { xs: 'auto', sm: 120 },
                        px: { xs: 1, sm: 2 },
                      }}
                    />
                  ))}
                </Tabs>

                {/* Content based on view mode */}
                {viewMode === 'cards' || isMobile ? (
                  /* Card View */
                  <Box>
                    {configurations[selectedCategory]?.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 } }}>
                        {configurations[selectedCategory].map((config) => (
                          <ConfigCard key={config.id} config={config} />
                        ))}
                      </Box>
                    ) : (
                      <Card sx={{ textAlign: 'center', py: 4 }}>
                        <CardContent>
                          <SettingsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No configurations found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            No configurations found in the {selectedCategory} category
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                ) : (
                  /* Table View - Desktop only */
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
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Edit Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <EditIcon color="primary" />
            <Typography variant={isMobile ? 'h6' : 'h5'} component="span">
              Edit Configuration
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
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
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, gap: 1 }}>
          {isMobile ? (
            <>
              <Button 
                onClick={() => setEditDialogOpen(false)} 
                fullWidth
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                variant="contained" 
                fullWidth
                startIcon={<SaveIcon />}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setEditDialogOpen(false)} startIcon={<CancelIcon />}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} variant="contained" startIcon={<SaveIcon />}>
                Save Changes
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Create Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AddIcon color="primary" />
            <Typography variant={isMobile ? 'h6' : 'h5'} component="span">
              Create Configuration
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
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
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, gap: 1 }}>
          {isMobile ? (
            <>
              <Button 
                onClick={() => setCreateDialogOpen(false)} 
                fullWidth
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveCreate} 
                variant="contained" 
                fullWidth
                startIcon={<SaveIcon />}
              >
                Create
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setCreateDialogOpen(false)} startIcon={<CancelIcon />}>
                Cancel
              </Button>
              <Button onClick={handleSaveCreate} variant="contained" startIcon={<SaveIcon />}>
                Create Configuration
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete dialog removed - configurations should not be deleted for security */}

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: isMobile ? 'center' : 'right' }}
        >
          <Alert 
            onClose={handleCloseSnackbar} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Fade>
  );
};

export default SystemConfiguration;
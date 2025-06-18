import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Alert,
  Fade,
  CircularProgress,
  InputAdornment,
  IconButton,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControlLabel,
  Switch,
  useTheme,
  alpha,
  Collapse,
  AppBar,
  Toolbar,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Checkbox,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DataGrid, GridColDef, GridRenderCellParams, GridSelectionModel } from "@mui/x-data-grid";
import {
  Add,
  Delete,
  Search,
  Storage,
  Computer,
  Link,
  Refresh,
  GetApp,
  DeleteSweep,
  SelectAll,
  CloudUpload,
  ExpandMore,
  ExpandLess,
  Clear,
  Edit,
  Cable,
  Dns,
  Router,
  SettingsEthernet,
  PlayArrow,
  Stop,
  Info,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  ViewModule,
  ViewList,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";
import { useResponsive } from "../../../lib/responsive-utils";

interface SolrDatabase {
  id: number;
  name: string;
  url: string;
  server_port: number;
  local_port: number;
  created_at: string;
  updated_at: string;
}

interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

const useAuthAxios = () => {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers = new AxiosHeaders({
          ...config.headers,
          Authorization: `Bearer ${accessToken}`,
        });
      }
      return config;
    }, Promise.reject);
    return instance;
  }, [accessToken]);
};

// Enhanced Database Card Component
interface DatabaseCardProps {
  database: SolrDatabase;
  selected: boolean;
  searchTerm: string;
  expanded: boolean;
  onSelect: (database: SolrDatabase) => void;
  onToggleExpand: (database: SolrDatabase) => void;
  onEdit: (database: SolrDatabase) => void;
  onDelete: (database: SolrDatabase) => void;
  onConnect: (database: SolrDatabase) => void;
  connecting: boolean;
}

const DatabaseCard: React.FC<DatabaseCardProps> = ({
  database,
  selected,
  searchTerm,
  expanded,
  onSelect,
  onToggleExpand,
  onEdit,
  onDelete,
  onConnect,
  connecting,
}) => {
  const theme = useTheme();

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  const getConnectionStatus = () => {
    // Simulated connection status - in real app this would come from API
    return Math.random() > 0.5 ? 'connected' : 'disconnected';
  };

  const connectionStatus = getConnectionStatus();

  return (
    <Card
      sx={{
        mb: 2,
        border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
            <Checkbox
              checked={selected}
              onChange={() => onSelect(database)}
              size="small"
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.25rem' },
                  lineHeight: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Storage color="primary" fontSize="small" />
                {highlightSearchTerm(database.name, searchTerm)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '0.95rem' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mt: 0.5,
                }}
              >
                <Link fontSize="small" />
                {highlightSearchTerm(database.url, searchTerm)}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={connectionStatus === 'connected' ? <CheckCircle /> : <ErrorIcon />}
              label={connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              color={connectionStatus === 'connected' ? 'success' : 'error'}
              size="small"
              variant="outlined"
            />
            <IconButton
              size="small"
              onClick={() => onToggleExpand(database)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Port Information */}
        <Stack direction="row" spacing={1} sx={{ mb: expanded ? 2 : 0, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<Computer />}
            label={`ID: ${database.id}`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Dns />}
            label={`Server: ${database.server_port}`}
            color="info"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Router />}
            label={`Local: ${database.local_port}`}
            color="success"
            size="small"
            variant="outlined"
          />
        </Stack>

        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Connection Details
                </Typography>
                <Typography variant="body2">
                  <strong>URL:</strong> {database.url}
                  <br />
                  <strong>Server Port:</strong> {database.server_port}
                  <br />
                  <strong>Local Port:</strong> {database.local_port}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Timestamps
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {new Date(database.created_at).toLocaleDateString()}
                  <br />
                  <strong>Updated:</strong> {new Date(database.updated_at).toLocaleDateString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  SSH Tunnel Information
                </Typography>
                <Typography variant="body2">
                  SSH tunnel connects local port {database.local_port} to remote {database.url}:{database.server_port}. 
                  This allows secure access to the Solr instance through an encrypted connection.
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: { xs: 2, sm: 3 }, pt: 0, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          <LoadingButton
            size="small"
            startIcon={<Cable />}
            onClick={() => onConnect(database)}
            loading={connecting}
            variant="contained"
            color="primary"
          >
            {connecting ? 'Connecting...' : 'Connect SSH'}
          </LoadingButton>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            startIcon={<Edit />}
            onClick={() => onEdit(database)}
            variant="outlined"
          >
            Edit
          </Button>
          <Button
            size="small"
            startIcon={<Delete />}
            onClick={() => onDelete(database)}
            color="error"
            variant="outlined"
          >
            Delete
          </Button>
        </Stack>
      </CardActions>
    </Card>
  );
};

// Mobile Header Component
interface MobileHeaderProps {
  title: string;
  subtitle: string;
  selectedCount: number;
  totalCount: number;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onAddDatabase: () => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  selectedCount,
  totalCount,
  autoRefresh,
  onToggleAutoRefresh,
  onAddDatabase,
  onBulkDelete,
  onClearSelection,
}) => {
  const theme = useTheme();

  return (
    <AppBar 
      position="sticky" 
      sx={{ 
        bgcolor: 'background.paper', 
        color: 'text.primary',
        boxShadow: 1,
        mb: 2,
      }}
    >
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Storage color="primary" fontSize="small" />
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          <IconButton 
            onClick={onToggleAutoRefresh} 
            color={autoRefresh ? "primary" : "default"}
            size="small"
          >
            <Refresh />
          </IconButton>
        </Box>

        {selectedCount > 0 && (
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              p: 1,
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" color="primary">
              {selectedCount} of {totalCount} selected
            </Typography>
            <Stack direction="row" spacing={1}>
              {onBulkDelete && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  onClick={onBulkDelete}
                >
                  Delete
                </Button>
              )}
              {onClearSelection && (
                <Button
                  size="small"
                  onClick={onClearSelection}
                >
                  Clear
                </Button>
              )}
            </Stack>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          {totalCount} databases configured
          {autoRefresh && " • Auto-refresh enabled"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const SolrDatabaseEnhanced: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  // State management
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [newDatabase, setNewDatabase] = useState<Partial<SolrDatabase>>({});
  const [editingDatabase, setEditingDatabase] = useState<Partial<SolrDatabase>>({});
  const [editingDatabaseId, setEditingDatabaseId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedDatabases, setSelectedDatabases] = useState<SolrDatabase[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openBulkDeleteDialog, setOpenBulkDeleteDialog] = useState(false);
  const [databaseToDelete, setDatabaseToDelete] = useState<SolrDatabase | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [connectingDatabases, setConnectingDatabases] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchDatabases();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchDatabases();
      }, 30000);
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const filteredDatabases = useMemo(() => 
    solrDatabases.filter((db) => {
      const searchText = search.toLowerCase();
      return !searchText || 
        db.name.toLowerCase().includes(searchText) ||
        db.url.toLowerCase().includes(searchText) ||
        db.server_port.toString().includes(searchText) ||
        db.local_port.toString().includes(searchText);
    }), [solrDatabases, search]);

  const fetchDatabases = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/solr_databases");
      setSolrDatabases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch databases failed:", err);
      showNotification("Failed to fetch Solr databases", "error");
    } finally {
      setLoading(false);
    }
  }, [authAxios]);

  const showNotification = (
    message: string,
    severity: NotificationState["severity"] = "info",
    duration: number = 5000,
  ) => {
    setNotification({ open: true, message, severity });
    setTimeout(
      () => setNotification((prev) => ({ ...prev, open: false })),
      duration,
    );
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      showNotification("Please select a file to import", "warning");
      return;
    }

    setImporting(true);
    
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        showNotification("CSV file must contain header and at least one data row", "error");
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const expectedHeaders = ['name', 'url', 'server_port', 'local_port'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.some(header => header.toLowerCase().includes(h)));
      if (missingHeaders.length > 0) {
        showNotification(`Missing required columns: ${missingHeaders.join(', ')}. Expected: name, url, server_port, local_port`, "error");
        return;
      }

      // Parse CSV data
      const databaseData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= 4) {
          databaseData.push({
            name: values[headers.findIndex(h => h.toLowerCase().includes('name'))],
            url: values[headers.findIndex(h => h.toLowerCase().includes('url'))],
            server_port: parseInt(values[headers.findIndex(h => h.toLowerCase().includes('server_port'))]),
            local_port: parseInt(values[headers.findIndex(h => h.toLowerCase().includes('local_port'))]),
          });
        }
      }

      if (databaseData.length === 0) {
        showNotification("No valid database data found in CSV", "error");
        return;
      }

      // Import databases
      let successCount = 0;
      const errors: string[] = [];
      
      for (const db of databaseData) {
        try {
          await authAxios.post('/api/solr_databases', db);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import database ${db.name}:`, err);
          
          let specificError = 'Unknown error';
          
          if (err.response?.data) {
            const responseData = err.response.data;
            
            if (responseData.error && responseData.error.message) {
              specificError = responseData.error.message;
            } else if (responseData.message) {
              specificError = responseData.message;
            } else if (responseData.error && typeof responseData.error === 'object') {
              if (responseData.error.code) {
                specificError = responseData.error.code.replace(/_/g, ' ');
              } else {
                specificError = 'Validation error';
              }
            } else if (typeof responseData === 'string') {
              specificError = responseData;
            } else {
              specificError = 'Invalid request format';
            }
          } else if (err.message) {
            specificError = err.message;
          }
          
          errors.push(`${db.name}: ${specificError}`);
        }
      }

      // Show detailed results
      if (successCount > 0 && errors.length === 0) {
        showNotification(`Successfully imported all ${successCount} databases`, "success");
        fetchDatabases();
      } else if (successCount > 0 && errors.length > 0) {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Imported ${successCount} databases successfully. ${errors.length} failed: ${errorSummary}`, "warning", 10000);
        fetchDatabases();
      } else {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Import failed for all databases: ${errorSummary}`, "error", 15000);
      }
      
      setOpenImportDialog(false);
      setImportFile(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      const errorMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Unknown error occurred';
      showNotification(`Import failed: ${errorMsg}`, "error", 10000);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = useCallback(() => {
    const csvHeaders = ['ID', 'Name', 'URL', 'Server Port', 'Local Port', 'Created At', 'Updated At'];
    const csvData = filteredDatabases.map(db => [
      db.id,
      db.name,
      db.url,
      db.server_port,
      db.local_port,
      new Date(db.created_at).toISOString(),
      new Date(db.updated_at).toISOString()
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `solr_databases_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    showNotification(`Exported ${filteredDatabases.length} databases to CSV`, 'success');
  }, [filteredDatabases]);

  const validateDatabaseForm = (dbData: Partial<SolrDatabase>, isEdit = false) => {
    const errors: string[] = [];
    
    if (!dbData.name?.trim()) {
      errors.push("Database name is required");
    } else {
      const existingDb = solrDatabases.find(db => 
        db.name.toLowerCase() === dbData.name?.toLowerCase() &&
        (!isEdit || db.id !== editingDatabaseId)
      );
      if (existingDb) {
        errors.push("A database with this name already exists");
      }
    }
    
    if (!dbData.url?.trim()) {
      errors.push("URL is required");
    } else if (!/^https?:\/\/.+/.test(dbData.url)) {
      errors.push("URL must start with http:// or https://");
    }
    
    if (!dbData.server_port || dbData.server_port < 1 || dbData.server_port > 65535) {
      errors.push("Server port must be between 1 and 65535");
    }
    
    if (!dbData.local_port || dbData.local_port < 1 || dbData.local_port > 65535) {
      errors.push("Local port must be between 1 and 65535");
    }
    
    if (dbData.server_port === dbData.local_port) {
      errors.push("Server port and local port must be different");
    }
    
    return errors;
  };

  const handleAddDatabase = async () => {
    const validationErrors = validateDatabaseForm(newDatabase);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    setAdding(true);
    try {
      await authAxios.post("/api/solr_databases", newDatabase);
      setNewDatabase({});
      setOpenAddDialog(false);
      fetchDatabases();
      showNotification(`Database "${newDatabase.name}" added successfully`, "success");
    } catch (err: any) {
      console.error("Add database failed:", err);
      showNotification(`Failed to add database: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateDatabase = async () => {
    if (!editingDatabaseId) return;
    
    const validationErrors = validateDatabaseForm(editingDatabase, true);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    setUpdating(true);
    try {
      await authAxios.put(`/api/solr_databases/${editingDatabaseId}`, editingDatabase);
      setEditingDatabase({});
      setEditingDatabaseId(null);
      setOpenEditDialog(false);
      fetchDatabases();
      showNotification(`Database "${editingDatabase.name}" updated successfully`, "success");
    } catch (err: any) {
      console.error("Update database failed:", err);
      showNotification(`Failed to update database: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteDatabase = async (database: SolrDatabase) => {
    try {
      await authAxios.delete(`/api/solr_databases/${database.id}`);
      showNotification(`Database "${database.name}" deleted successfully`, "success");
      fetchDatabases();
      setOpenDeleteDialog(false);
      setDatabaseToDelete(null);
    } catch (err: any) {
      console.error("Delete database failed:", err);
      showNotification(`Failed to delete database: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedDatabases.length === 0) return;

    try {
      await Promise.all(
        selectedDatabases.map(db => 
          authAxios.delete(`/api/solr_databases/${db.id}`)
        )
      );

      showNotification(
        `Successfully deleted ${selectedDatabases.length} database(s)`,
        "success"
      );

      setSelectedDatabases([]);
      setOpenBulkDeleteDialog(false);
      fetchDatabases();
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      showNotification(`Failed to delete some databases: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleConnectSSH = async (database: SolrDatabase) => {
    setConnectingDatabases(prev => new Set([...prev, database.id]));
    
    try {
      await authAxios.post(`/api/solr_databases/${database.id}/connect_ssh`);
      showNotification(`SSH connection established for "${database.name}"`, "success");
    } catch (err: any) {
      console.error("SSH connection failed:", err);
      showNotification(`SSH connection failed: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setConnectingDatabases(prev => {
        const newSet = new Set(prev);
        newSet.delete(database.id);
        return newSet;
      });
    }
  };

  const handleSelectDatabase = (database: SolrDatabase) => {
    const isSelected = selectedDatabases.some(db => db.id === database.id);
    
    if (isSelected) {
      setSelectedDatabases(selectedDatabases.filter(db => db.id !== database.id));
    } else {
      setSelectedDatabases([...selectedDatabases, database]);
    }
  };

  const handleToggleCardExpansion = (database: SolrDatabase) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(database.id)) {
      newExpanded.delete(database.id);
    } else {
      newExpanded.add(database.id);
    }
    setExpandedCards(newExpanded);
  };

  const handleEditOpen = (database: SolrDatabase) => {
    setEditingDatabaseId(database.id);
    setEditingDatabase({
      name: database.name,
      url: database.url,
      server_port: database.server_port,
      local_port: database.local_port,
    });
    setOpenEditDialog(true);
  };

  const handleSelectAll = () => {
    setSelectedDatabases([...filteredDatabases]);
  };

  const handleClearSelection = () => {
    setSelectedDatabases([]);
  };

  // Speed Dial Actions for Mobile
  // DataGrid columns for table view
  const columns: GridColDef[] = [
    {
      field: "id",
      headerName: "ID",
      width: 80,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Storage fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "url",
      headerName: "URL",
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "server_port",
      headerName: "Server Port",
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="info" />
      ),
    },
    {
      field: "local_port",
      headerName: "Local Port",
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="success" />
      ),
    },
    {
      field: "created_at",
      headerName: "Created",
      width: 120,
      renderCell: (params) => (
        <Typography variant="caption" color="text.secondary">
          {new Date(params.value).toLocaleDateString()}
        </Typography>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 280,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => {
        const db = params.row as SolrDatabase;
        const isConnecting = connectingDatabases.has(db.id);

        return (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Edit Database">
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleEditOpen(db)}
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Database">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  setDatabaseToDelete(db);
                  setOpenDeleteDialog(true);
                }}
              >
                <Delete />
              </IconButton>
            </Tooltip>
            <Tooltip title="Establish SSH tunnel">
              <LoadingButton
                variant="outlined"
                size="small"
                onClick={() => handleConnectSSH(db)}
                loading={isConnecting}
                startIcon={<Cable />}
                sx={{ minWidth: 120 }}
              >
                {isConnecting ? "Connecting..." : "Connect SSH"}
              </LoadingButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  const speedDialActions = [
    {
      icon: <Add />,
      name: 'Add Database',
      onClick: () => setOpenAddDialog(true),
    },
    {
      icon: <CloudUpload />,
      name: 'Import CSV',
      onClick: () => setOpenImportDialog(true),
    },
    {
      icon: <GetApp />,
      name: 'Export All',
      onClick: handleExportCSV,
    },
    {
      icon: <Refresh />,
      name: 'Refresh',
      onClick: fetchDatabases,
    },
  ];

  return (
    <Box sx={{ pb: isMobile ? 8 : 0 }}>
      {notification.open && (
        <Alert
          severity={notification.severity}
          sx={{ mb: 3 }}
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
        >
          {notification.message}
        </Alert>
      )}

      {/* Mobile Header */}
      {isMobile ? (
        <MobileHeader
          title="Solr Databases"
          subtitle="Manage database connections"
          selectedCount={selectedDatabases.length}
          totalCount={filteredDatabases.length}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onAddDatabase={() => setOpenAddDialog(true)}
          onBulkDelete={selectedDatabases.length > 0 ? () => setOpenBulkDeleteDialog(true) : undefined}
          onClearSelection={selectedDatabases.length > 0 ? handleClearSelection : undefined}
        />
      ) : (
        // Desktop Header
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <Storage color="primary" />
              Solr Database Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure and manage Solr database connections with SSH tunneling
            </Typography>
            {selectedDatabases.length > 0 && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedDatabases.length} database{selectedDatabases.length !== 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title={`Switch to ${viewMode === 'cards' ? 'Table' : 'Cards'} View`}>
              <IconButton
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                color="primary"
              >
                {viewMode === 'cards' ? <ViewList /> : <ViewModule />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle Auto-refresh (30s)">
              <IconButton 
                onClick={() => setAutoRefresh(!autoRefresh)} 
                color={autoRefresh ? "primary" : "default"}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Add Database
            </Button>
          </Stack>
        </Box>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Search databases by name, URL, or ports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size={isMobile ? "small" : "medium"}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: search && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <Clear />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  {filteredDatabases.length} of {solrDatabases.length} databases
                </Typography>
              </Stack>
            </Grid>
          </Grid>
          
          {/* Results summary and bulk actions */}
          {!isMobile && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color={selectedDatabases.length > 0 ? "primary" : "text.secondary"}>
                {selectedDatabases.length > 0 
                  ? `${selectedDatabases.length} database${selectedDatabases.length !== 1 ? 's' : ''} selected`
                  : `Showing ${filteredDatabases.length} of ${solrDatabases.length} databases`
                }
              </Typography>
              <Stack direction="row" spacing={1}>
                {selectedDatabases.length > 0 ? (
                  <>
                    <Button
                      size="small"
                      startIcon={<SelectAll />}
                      onClick={handleSelectAll}
                      disabled={filteredDatabases.length === 0}
                    >
                      Select All
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Clear />}
                      onClick={handleClearSelection}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => setOpenBulkDeleteDialog(true)}
                    >
                      Delete ({selectedDatabases.length})
                    </Button>
                  </>
                ) : (
                  <>
                    <Tooltip title="Import from CSV">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CloudUpload />}
                        onClick={() => setOpenImportDialog(true)}
                      >
                        Import
                      </Button>
                    </Tooltip>
                    <Tooltip title="Export All to CSV">
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<GetApp />}
                          onClick={handleExportCSV}
                          disabled={filteredDatabases.length === 0}
                        >
                          Export All
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Select All Databases">
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SelectAll />}
                          onClick={handleSelectAll}
                          disabled={filteredDatabases.length === 0}
                        >
                          Select All
                        </Button>
                      </span>
                    </Tooltip>
                  </>
                )}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Content Area */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Fade in={true} timeout={600}>
          <Box>
            {filteredDatabases.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Storage sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {search ? 'No databases found' : 'No databases configured yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {search 
                    ? `No databases match "${search}". Try a different search term.`
                    : 'Get started by adding your first Solr database connection.'
                  }
                </Typography>
                {!search && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Add First Database
                  </Button>
                )}
              </Paper>
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {filteredDatabases.map((database) => (
                  <Grid item xs={12} sm={6} md={4} key={database.id}>
                    <DatabaseCard
                      database={database}
                      selected={selectedDatabases.some(db => db.id === database.id)}
                      searchTerm={search}
                      expanded={expandedCards.has(database.id)}
                      onSelect={handleSelectDatabase}
                      onToggleExpand={handleToggleCardExpansion}
                      onEdit={handleEditOpen}
                      onDelete={(database) => {
                        setDatabaseToDelete(database);
                        setOpenDeleteDialog(true);
                      }}
                      onConnect={handleConnectSSH}
                      connecting={connectingDatabases.has(database.id)}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
                <DataGrid
                  rows={filteredDatabases}
                  columns={columns}
                  initialState={{
                    pagination: {
                      page: 0,
                      pageSize: 10,
                    },
                  }}
                  pageSize={100}
                  getRowId={(row) => row.id}
                  checkboxSelection
                  selectionModel={selectedDatabases.map(db => db.id)}
                  onSelectionModelChange={(newSelection: GridSelectionModel) => {
                    const selectedIds = newSelection as number[];
                    const newSelectedDatabases = filteredDatabases.filter(db => 
                      selectedIds.includes(db.id)
                    );
                    setSelectedDatabases(newSelectedDatabases);
                  }}
                  disableSelectionOnClick={false}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      outline: "none",
                      borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "rgba(76, 175, 80, 0.08)",
                      borderBottom: "2px solid rgba(76, 175, 80, 0.2)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    },
                    "& .MuiDataGrid-row": {
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      "&:hover": {
                        backgroundColor: "rgba(76, 175, 80, 0.08)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(76, 175, 80, 0.15)",
                      },
                    },
                    "& .MuiDataGrid-footerContainer": {
                      borderTop: "2px solid rgba(224, 224, 224, 0.3)",
                      backgroundColor: "rgba(248, 249, 250, 0.8)",
                    },
                    "& .MuiDataGrid-selectedRowCount": {
                      visibility: "hidden",
                    },
                  }}
                />
              </Paper>
            )}
          </Box>
        </Fade>
      )}

      {/* Mobile Speed Dial */}
      {isMobile && (
        <SpeedDial
          ariaLabel="Database actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          {speedDialActions.map((action) => (
            <SpeedDialAction
              key={action.name}
              icon={action.icon}
              tooltipTitle={action.name}
              onClick={action.onClick}
            />
          ))}
        </SpeedDial>
      )}

      {/* Add Database Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Add />
          Add New Solr Database
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Database Name"
                value={newDatabase.name || ""}
                onChange={(e) => setNewDatabase({ ...newDatabase, name: e.target.value })}
                fullWidth
                required
                error={!newDatabase.name?.trim()}
                helperText={!newDatabase.name?.trim() ? "Database name is required" : ""}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="URL"
                value={newDatabase.url || ""}
                onChange={(e) => setNewDatabase({ ...newDatabase, url: e.target.value })}
                fullWidth
                required
                placeholder="https://example.com"
                error={newDatabase.url ? !/^https?:\/\/.+/.test(newDatabase.url) : false}
                helperText={
                  !newDatabase.url?.trim() ? "URL is required" :
                  !/^https?:\/\/.+/.test(newDatabase.url) ? "URL must start with http:// or https://" : ""
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Server Port"
                type="number"
                value={newDatabase.server_port || ""}
                onChange={(e) => setNewDatabase({ ...newDatabase, server_port: parseInt(e.target.value) || 0 })}
                fullWidth
                required
                inputProps={{ min: 1, max: 65535 }}
                error={newDatabase.server_port ? (newDatabase.server_port < 1 || newDatabase.server_port > 65535) : false}
                helperText="Port 1-65535"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Local Port"
                type="number"
                value={newDatabase.local_port || ""}
                onChange={(e) => setNewDatabase({ ...newDatabase, local_port: parseInt(e.target.value) || 0 })}
                fullWidth
                required
                inputProps={{ min: 1, max: 65535 }}
                error={newDatabase.local_port ? (newDatabase.local_port < 1 || newDatabase.local_port > 65535 || newDatabase.local_port === newDatabase.server_port) : false}
                helperText={
                  newDatabase.local_port === newDatabase.server_port ? "Must differ from server port" : "Port 1-65535"
                }
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Info fontSize="small" />
              SSH tunnel will connect local port {newDatabase.local_port || '?'} to {newDatabase.url || 'server'}:{newDatabase.server_port || '?'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={adding}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleAddDatabase}
            loading={adding}
            disabled={
              !newDatabase.name?.trim() ||
              !newDatabase.url?.trim() ||
              !newDatabase.server_port ||
              !newDatabase.local_port ||
              newDatabase.server_port === newDatabase.local_port
            }
          >
            Add Database
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Edit Database Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Edit />
          Edit Solr Database
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Database Name"
                value={editingDatabase.name || ""}
                onChange={(e) => setEditingDatabase({ ...editingDatabase, name: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="URL"
                value={editingDatabase.url || ""}
                onChange={(e) => setEditingDatabase({ ...editingDatabase, url: e.target.value })}
                fullWidth
                required
                placeholder="https://example.com"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Server Port"
                type="number"
                value={editingDatabase.server_port || ""}
                onChange={(e) => setEditingDatabase({ ...editingDatabase, server_port: parseInt(e.target.value) || 0 })}
                fullWidth
                required
                inputProps={{ min: 1, max: 65535 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Local Port"
                type="number"
                value={editingDatabase.local_port || ""}
                onChange={(e) => setEditingDatabase({ ...editingDatabase, local_port: parseInt(e.target.value) || 0 })}
                fullWidth
                required
                inputProps={{ min: 1, max: 65535 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)} disabled={updating}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleUpdateDatabase}
            loading={updating}
          >
            Save Changes
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Database Deletion</DialogTitle>
        <DialogContent>
          {databaseToDelete && (
            <Typography>
              Are you sure you want to delete the database "{databaseToDelete.name}"? 
              This action cannot be undone and will remove all SSH tunnel configurations.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => databaseToDelete && handleDeleteDatabase(databaseToDelete)}
          >
            Delete Database
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={openBulkDeleteDialog} onClose={() => setOpenBulkDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Bulk Database Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedDatabases.length} selected database{selectedDatabases.length !== 1 ? 's' : ''}? 
            This action cannot be undone.
          </Typography>
          {selectedDatabases.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Databases to be deleted:
              </Typography>
              {selectedDatabases.slice(0, 5).map((db) => (
                <Typography key={db.id} variant="body2" sx={{ ml: 2 }}>
                  • {db.name} ({db.url})
                </Typography>
              ))}
              {selectedDatabases.length > 5 && (
                <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                  ... and {selectedDatabases.length - 5} more
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
          >
            Delete {selectedDatabases.length} Database{selectedDatabases.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog
        open={openImportDialog}
        onClose={() => setOpenImportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          }}
        >
          <CloudUpload />
          Import Solr Databases from CSV
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload a CSV file with columns: <strong>name, url, server_port, local_port</strong>
          </Typography>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            style={{ marginBottom: '16px' }}
          />
          {importFile && (
            <Typography variant="body2" color="success.main">
              Selected: {importFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={handleImportCSV}
            disabled={!importFile || importing}
            loading={importing}
            startIcon={importing ? <CircularProgress size={20} /> : <CloudUpload />}
            sx={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              "&:hover": {
                background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
              },
            }}
          >
            {importing ? 'Importing...' : 'Import'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SolrDatabaseEnhanced;
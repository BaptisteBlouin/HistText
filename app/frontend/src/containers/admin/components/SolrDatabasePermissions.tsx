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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  useTheme,
  alpha,
  Collapse,
  AppBar,
  Toolbar,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Tooltip,
  FormControlLabel,
  Switch,
  LinearProgress,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DataGrid, GridColDef, GridRenderCellParams, GridSelectionModel } from "@mui/x-data-grid";
import {
  Add,
  Delete,
  Search,
  Security,
  Storage,
  VpnKey,
  Refresh,
  CheckBox,
  CheckBoxOutlineBlank,
  GetApp,
  DeleteSweep,
  SelectAll,
  CloudUpload,
  ExpandMore,
  ExpandLess,
  Clear,
  Edit,
  Info,
  Storage as Database,
  Collections,
  Assignment,
  AdminPanelSettings,
  Shield,
  ViewList,
  ViewModule,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";
import { useResponsive } from "../../../lib/responsive-utils";

interface SolrDatabasePermission {
  solr_database_id: number;
  collection_name: string;
  permission: string;
  created_at: string;
}

interface SolrDatabase {
  id: number;
  name: string;
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

// Enhanced Permission Card Component
interface PermissionCardProps {
  permission: SolrDatabasePermission;
  database: SolrDatabase | undefined;
  selected: boolean;
  searchTerm: string;
  expanded: boolean;
  onSelect: (permission: SolrDatabasePermission) => void;
  onToggleExpand: (permission: SolrDatabasePermission) => void;
  onDelete: (permission: SolrDatabasePermission) => void;
}

const PermissionCard: React.FC<PermissionCardProps> = ({
  permission,
  database,
  selected,
  searchTerm,
  expanded,
  onSelect,
  onToggleExpand,
  onDelete,
}) => {
  const theme = useTheme();

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  const getPermissionColor = (permissionName: string) => {
    if (permissionName.includes("read") || permissionName.includes("view"))
      return "info";
    if (permissionName.includes("write") || permissionName.includes("create"))
      return "success";
    if (permissionName.includes("delete") || permissionName.includes("remove"))
      return "error";
    if (permissionName.includes("admin")) return "warning";
    return "default";
  };

  const getPermissionIcon = (permissionName: string) => {
    if (permissionName.includes("admin")) return <AdminPanelSettings fontSize="small" />;
    if (permissionName.includes("read") || permissionName.includes("view")) return <Info fontSize="small" />;
    if (permissionName.includes("write") || permissionName.includes("create")) return <Edit fontSize="small" />;
    if (permissionName.includes("delete")) return <Delete fontSize="small" />;
    return <VpnKey fontSize="small" />;
  };

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
              onChange={() => onSelect(permission)}
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
                {getPermissionIcon(permission.permission)}
                {highlightSearchTerm(permission.permission, searchTerm)}
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
                <Collections fontSize="small" />
                {highlightSearchTerm(permission.collection_name, searchTerm)}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={getPermissionColor(permission.permission).toUpperCase()}
              color={getPermissionColor(permission.permission) as any}
              size="small"
              variant="outlined"
            />
            <IconButton
              size="small"
              onClick={() => onToggleExpand(permission)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Database Information */}
        <Stack direction="row" spacing={1} sx={{ mb: expanded ? 2 : 0, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<Storage />}
            label={database?.name || `Database ${permission.solr_database_id}`}
            color="primary"
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<Database />}
            label={`ID: ${permission.solr_database_id}`}
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
                  Permission Details
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {permission.permission}
                  <br />
                  <strong>Type:</strong> {getPermissionColor(permission.permission).charAt(0).toUpperCase() + getPermissionColor(permission.permission).slice(1)}
                  <br />
                  <strong>Collection:</strong> {permission.collection_name}
                  <br />
                  <strong>Database:</strong> {database?.name || `ID ${permission.solr_database_id}`}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Assignment Info
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {new Date(permission.created_at).toLocaleDateString()}
                  <br />
                  <strong>Time:</strong> {new Date(permission.created_at).toLocaleTimeString()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Permission Description
                </Typography>
                <Typography variant="body2">
                  This permission allows specific access to the "{permission.collection_name}" collection 
                  in the {database?.name || 'selected'} database. The permission type "{permission.permission}" 
                  determines the level of access granted to users or roles.
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: { xs: 2, sm: 3 }, pt: 0, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<Delete />}
          onClick={() => onDelete(permission)}
          color="error"
          variant="outlined"
        >
          Remove
        </Button>
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
  onAddPermission: () => void;
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
  onAddPermission,
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
              <Security color="primary" fontSize="small" />
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
          {totalCount} permission assignments
          {autoRefresh && " • Auto-refresh enabled"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const SolrDatabasePermissionsEnhanced: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  // State management
  const [permissions, setPermissions] = useState<SolrDatabasePermission[]>([]);
  const [databases, setDatabases] = useState<SolrDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<SolrDatabase | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [newPermission, setNewPermission] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedPermissions, setSelectedPermissions] = useState<SolrDatabasePermission[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openBulkDeleteDialog, setOpenBulkDeleteDialog] = useState(false);
  const [permissionToDelete, setPermissionToDelete] = useState<SolrDatabasePermission | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchPermissions();
    fetchDatabases();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchPermissions();
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

  // When DB changes, load collections (aliases) for that DB
  useEffect(() => {
    if (selectedDatabase) {
      authAxios
        .get(`/api/solr/aliases?solr_database_id=${selectedDatabase.id}`)
        .then((res) => setAliases(Array.isArray(res.data) ? res.data : []))
        .catch(() => setAliases([]));
    } else {
      setAliases([]);
    }
    setSelectedCollections([]);
  }, [selectedDatabase]);

  const filteredPermissions = useMemo(() => 
    permissions.filter((p) => {
      const searchText = search.toLowerCase();
      return !searchText || 
        p.collection_name.toLowerCase().includes(searchText) ||
        p.permission.toLowerCase().includes(searchText);
    }), [permissions, search]);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/solr_database_permissions");
      setPermissions(Array.isArray(data) ? data : []);
      const perms = Array.from(
        new Set(
          (data as SolrDatabasePermission[]).map((item) => item.permission),
        ),
      ) as string[];
      setAvailablePermissions(perms);
      setSelectedPermissions([]); // Clear selection on refresh
    } catch (err) {
      console.error("Fetch permissions failed:", err);
      showNotification("Failed to fetch permissions", "error");
    } finally {
      setLoading(false);
    }
  }, [authAxios]);

  const fetchDatabases = useCallback(async () => {
    try {
      const { data } = await authAxios.get("/api/solr_databases");
      setDatabases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch databases failed:", err);
      showNotification("Failed to fetch databases", "error");
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

  const getDatabaseName = (databaseId: number) => {
    const database = databases.find(db => db.id === databaseId);
    return database ? database.name : `Database ${databaseId}`;
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
      const expectedHeaders = ['solr_database_id', 'collection_name', 'permission'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.some(header => header.toLowerCase().includes(h)));
      if (missingHeaders.length > 0) {
        showNotification(`Missing required columns: ${missingHeaders.join(', ')}. Expected: solr_database_id, collection_name, permission`, "error");
        return;
      }

      // Parse CSV data
      const permissionData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= 3) {
          permissionData.push({
            solr_database_id: parseInt(values[headers.findIndex(h => h.toLowerCase().includes('solr_database_id'))]),
            collection_name: values[headers.findIndex(h => h.toLowerCase().includes('collection_name'))],
            permission: values[headers.findIndex(h => h.toLowerCase().includes('permission'))],
          });
        }
      }

      if (permissionData.length === 0) {
        showNotification("No valid permission data found in CSV", "error");
        return;
      }

      // Import permissions
      let successCount = 0;
      const errors: string[] = [];
      
      for (const perm of permissionData) {
        try {
          await authAxios.post('/api/solr_database_permissions', perm);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import permission:`, err);
          
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
          
          errors.push(`DB${perm.solr_database_id}/${perm.collection_name}: ${specificError}`);
        }
      }

      // Show detailed results
      if (successCount > 0 && errors.length === 0) {
        showNotification(`Successfully imported all ${successCount} permissions`, "success");
        fetchPermissions();
      } else if (successCount > 0 && errors.length > 0) {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Imported ${successCount} permissions successfully. ${errors.length} failed: ${errorSummary}`, "warning", 10000);
        fetchPermissions();
      } else {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Import failed for all permissions: ${errorSummary}`, "error", 15000);
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

  const handleExportCSV = () => {
    const csvData = permissions.map(permission => ({
      "Database ID": permission.solr_database_id,
      "Database Name": getDatabaseName(permission.solr_database_id),
      "Collection": permission.collection_name,
      "Permission": permission.permission,
      "Created At": new Date(permission.created_at).toLocaleDateString()
    }));
    
    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solr-database-permissions-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification(`Exported ${permissions.length} permissions to CSV`, "success");
  };

  const permissionExists = (dbId: number, collection: string, permission: string) => {
    return permissions.some(p => 
      p.solr_database_id === dbId && 
      p.collection_name === collection && 
      p.permission.toLowerCase() === permission.toLowerCase()
    );
  };

  const isValidPermissionName = (permission: string) => {
    const permissionRegex = /^[a-zA-Z0-9_:.-]+$/;
    return permissionRegex.test(permission);
  };

  const validatePermissionForm = () => {
    const errors: string[] = [];
    
    if (!selectedDatabase) {
      errors.push("Please select a database");
    }
    
    if (selectedCollections.length === 0) {
      errors.push("Please select at least one collection");
    }
    
    if (!newPermission.trim()) {
      errors.push("Permission name is required");
    } else if (!isValidPermissionName(newPermission.trim())) {
      errors.push("Permission name can only contain letters, numbers, underscores, colons, dots, and hyphens");
    } else if (newPermission.trim().length > 100) {
      errors.push("Permission name must be less than 100 characters");
    }
    
    // Check for existing permissions
    if (selectedDatabase && newPermission.trim()) {
      const existingPermissions = [];
      for (const collection of selectedCollections) {
        if (permissionExists(selectedDatabase.id, collection, newPermission.trim())) {
          existingPermissions.push(collection);
        }
      }
      
      if (existingPermissions.length > 0) {
        if (existingPermissions.length === selectedCollections.length) {
          errors.push("This permission already exists for all selected collections");
        } else {
          errors.push(`Permission already exists for: ${existingPermissions.slice(0, 3).join(", ")}${existingPermissions.length > 3 ? ` and ${existingPermissions.length - 3} more` : ""}`);
        }
      }
    }
    
    return errors;
  };

  const handleAddPermission = async () => {
    const validationErrors = validatePermissionForm();
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    const dbName = selectedDatabase?.name || "Unknown";
    const permissionName = newPermission.trim();
    
    setAdding(true);
    try {
      const assignments = [];
      const newAssignments = [];
      
      for (const collection of selectedCollections) {
        if (!permissionExists(selectedDatabase!.id, collection, permissionName)) {
          assignments.push(
            authAxios.post("/api/solr_database_permissions", {
              solr_database_id: selectedDatabase!.id,
              collection_name: collection,
              permission: permissionName,
            })
          );
          newAssignments.push(collection);
        }
      }
      
      if (assignments.length === 0) {
        showNotification("All selected permissions already exist", "warning");
        return;
      }
      
      await Promise.all(assignments);
      
      const successMessage = newAssignments.length === 1 ?
        `Permission "${permissionName}" added to collection "${newAssignments[0]}" in database "${dbName}"` :
        `Permission "${permissionName}" added to ${newAssignments.length} collections in database "${dbName}"`;
      
      showNotification(successMessage, "success");
      setSelectedCollections([]);
      setNewPermission("");
      setOpenAddDialog(false);
      fetchPermissions();
    } catch (err: any) {
      console.error("Add permission failed:", err);
      showNotification(`Failed to add permissions: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePermission = async (permission: SolrDatabasePermission) => {
    const dbName = getDatabaseName(permission.solr_database_id);
    
    try {
      await authAxios.delete(
        `/api/solr_database_permissions/${permission.solr_database_id}/${encodeURIComponent(permission.collection_name)}/${encodeURIComponent(permission.permission)}`,
      );
      showNotification(`Permission "${permission.permission}" removed from collection "${permission.collection_name}" in database "${dbName}"`, "success");
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
      fetchPermissions();
    } catch (err: any) {
      console.error("Delete permission failed:", err);
      showNotification(`Failed to delete permission: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPermissions.length === 0) return;

    try {
      await Promise.all(
        selectedPermissions.map(perm => 
          authAxios.delete(
            `/api/solr_database_permissions/${perm.solr_database_id}/${encodeURIComponent(perm.collection_name)}/${encodeURIComponent(perm.permission)}`
          )
        )
      );

      showNotification(
        `Successfully deleted ${selectedPermissions.length} permission${selectedPermissions.length !== 1 ? 's' : ''}`,
        "success"
      );

      setSelectedPermissions([]);
      setOpenBulkDeleteDialog(false);
      fetchPermissions();
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      showNotification(`Failed to delete some permissions: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleSelectPermission = (permission: SolrDatabasePermission) => {
    const isSelected = selectedPermissions.some(p => 
      p.solr_database_id === permission.solr_database_id &&
      p.collection_name === permission.collection_name &&
      p.permission === permission.permission
    );
    
    if (isSelected) {
      setSelectedPermissions(selectedPermissions.filter(p => 
        !(p.solr_database_id === permission.solr_database_id &&
          p.collection_name === permission.collection_name &&
          p.permission === permission.permission)
      ));
    } else {
      setSelectedPermissions([...selectedPermissions, permission]);
    }
  };

  const handleToggleCardExpansion = (permission: SolrDatabasePermission) => {
    const key = `${permission.solr_database_id}-${permission.collection_name}-${permission.permission}`;
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedCards(newExpanded);
  };

  const handleSelectAll = () => {
    setSelectedPermissions([...filteredPermissions]);
  };

  const handleClearSelection = () => {
    setSelectedPermissions([]);
  };

  const handleSelectAllCollections = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedCollections(e.target.checked ? aliases : []);
  };

  // DataGrid columns for table view
  const columns: GridColDef[] = [
    {
      field: "solr_database_id",
      headerName: "DB ID",
      width: 80,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "collection_name",
      headerName: "Collection",
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Collections fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "permission",
      headerName: "Permission",
      flex: 1,
      renderCell: (params) => {
        const permission = params.value as string;
        const getPermissionIcon = (permissionName: string) => {
          if (permissionName.includes("admin")) return <AdminPanelSettings fontSize="small" />;
          if (permissionName.includes("read") || permissionName.includes("view")) return <Info fontSize="small" />;
          if (permissionName.includes("write") || permissionName.includes("create")) return <Edit fontSize="small" />;
          if (permissionName.includes("delete")) return <Delete fontSize="small" />;
          return <VpnKey fontSize="small" />;
        };
        
        const getPermissionColor = (permissionName: string) => {
          if (permissionName.includes("read") || permissionName.includes("view"))
            return "info";
          if (permissionName.includes("write") || permissionName.includes("create"))
            return "success";
          if (permissionName.includes("delete") || permissionName.includes("remove"))
            return "error";
          if (permissionName.includes("admin")) return "warning";
          return "default";
        };
        
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {getPermissionIcon(permission)}
            <Typography variant="body2">{permission}</Typography>
            <Chip
              label={getPermissionColor(permission).toUpperCase()}
              color={getPermissionColor(permission) as any}
              size="small"
              variant="outlined"
            />
          </Box>
        );
      },
    },
    {
      field: "database_name",
      headerName: "Database",
      width: 150,
      renderCell: (params: GridRenderCellParams) => {
        const permission = params.row as SolrDatabasePermission;
        const database = databases.find(db => db.id === permission.solr_database_id);
        return (
          <Chip 
            icon={<Storage />}
            label={database?.name || `Database ${permission.solr_database_id}`}
            size="small" 
            color="primary" 
            variant="outlined" 
          />
        );
      },
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
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Delete Permission">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setPermissionToDelete(params.row);
                setOpenDeleteDialog(true);
              }}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  // Speed Dial Actions for Mobile
  const speedDialActions = [
    {
      icon: <Add />,
      name: 'Add Permission',
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
      onClick: fetchPermissions,
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
          title="Database Permissions"
          subtitle="Manage collection access"
          selectedCount={selectedPermissions.length}
          totalCount={filteredPermissions.length}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onAddPermission={() => setOpenAddDialog(true)}
          onBulkDelete={selectedPermissions.length > 0 ? () => setOpenBulkDeleteDialog(true) : undefined}
          onClearSelection={selectedPermissions.length > 0 ? handleClearSelection : undefined}
        />
      ) : (
        // Desktop Header
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <Security color="primary" />
              Database Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage access permissions for Solr collections
            </Typography>
            {selectedPermissions.length > 0 && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title={`Switch to ${viewMode === 'cards' ? 'Table' : 'Cards'} View`}>
              <IconButton onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}>
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
              Add Permission
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
                placeholder="Search permissions by collection or name..."
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
                  {filteredPermissions.length} of {permissions.length} permissions
                </Typography>
              </Stack>
            </Grid>
          </Grid>
          
          {/* Results summary and bulk actions */}
          {!isMobile && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color={selectedPermissions.length > 0 ? "primary" : "text.secondary"}>
                {selectedPermissions.length > 0 
                  ? `${selectedPermissions.length} permission${selectedPermissions.length !== 1 ? 's' : ''} selected`
                  : `Showing ${filteredPermissions.length} of ${permissions.length} permissions`
                }
              </Typography>
              <Stack direction="row" spacing={1}>
                {selectedPermissions.length > 0 ? (
                  <>
                    <Button
                      size="small"
                      startIcon={<SelectAll />}
                      onClick={handleSelectAll}
                      disabled={filteredPermissions.length === 0}
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
                      Delete ({selectedPermissions.length})
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
                          disabled={filteredPermissions.length === 0}
                        >
                          Export All
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Select All Permissions">
                      <span>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<SelectAll />}
                          onClick={handleSelectAll}
                          disabled={filteredPermissions.length === 0}
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
            {filteredPermissions.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Security sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {search ? 'No permissions found' : 'No permissions configured yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {search 
                    ? `No permissions match "${search}". Try a different search term.`
                    : 'Get started by adding your first permission assignment.'
                  }
                </Typography>
                {!search && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Add First Permission
                  </Button>
                )}
              </Paper>
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {filteredPermissions.map((permission) => {
                  const database = databases.find(db => db.id === permission.solr_database_id);
                  const key = `${permission.solr_database_id}-${permission.collection_name}-${permission.permission}`;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <PermissionCard
                        permission={permission}
                        database={database}
                        selected={selectedPermissions.some(p => 
                          p.solr_database_id === permission.solr_database_id &&
                          p.collection_name === permission.collection_name &&
                          p.permission === permission.permission
                        )}
                        searchTerm={search}
                        expanded={expandedCards.has(key)}
                        onSelect={handleSelectPermission}
                        onToggleExpand={handleToggleCardExpansion}
                        onDelete={(permission) => {
                          setPermissionToDelete(permission);
                          setOpenDeleteDialog(true);
                        }}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
                <DataGrid
                  rows={filteredPermissions}
                  columns={columns}
                  initialState={{
                    pagination: {
                      page: 0,
                      pageSize: 10,
                    },
                  }}
                  pageSize={100}
                  getRowId={(row) => `${row.solr_database_id}-${row.collection_name}-${row.permission}`}
                  checkboxSelection
                  selectionModel={selectedPermissions.map(p => `${p.solr_database_id}-${p.collection_name}-${p.permission}`)}
                  onSelectionModelChange={(newSelection: GridSelectionModel) => {
                    const selectedKeys = newSelection as string[];
                    const newSelectedPermissions = filteredPermissions.filter(p => 
                      selectedKeys.includes(`${p.solr_database_id}-${p.collection_name}-${p.permission}`)
                    );
                    setSelectedPermissions(newSelectedPermissions);
                  }}
                  disableSelectionOnClick={false}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      outline: "none",
                      borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "rgba(244, 67, 54, 0.08)",
                      borderBottom: "2px solid rgba(244, 67, 54, 0.2)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    },
                    "& .MuiDataGrid-row": {
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      "&:hover": {
                        backgroundColor: "rgba(244, 67, 54, 0.08)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(244, 67, 54, 0.15)",
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
          ariaLabel="Permission actions"
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

      {/* Add Permission Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Add />
          Assign Database Permissions
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Database selection */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Database</InputLabel>
                <Select
                  value={selectedDatabase?.id ?? ""}
                  onChange={(e) =>
                    setSelectedDatabase(
                      databases.find(
                        (db) => db.id === Number(e.target.value),
                      ) || null,
                    )
                  }
                  label="Database"
                >
                  {databases.map((db) => (
                    <MenuItem key={db.id} value={db.id}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Storage fontSize="small" />
                        {db.name}
                        <Chip
                          label={`ID: ${db.id}`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {/* Permission name */}
            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={availablePermissions}
                inputValue={newPermission}
                onInputChange={(_, val) => setNewPermission(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Permission"
                    placeholder="Enter permission name..."
                    required
                    error={newPermission ? !isValidPermissionName(newPermission.trim()) : false}
                    helperText={
                      !newPermission?.trim() ? "Permission name is required" :
                      !isValidPermissionName(newPermission.trim()) ? "Only letters, numbers, underscores, colons, dots, and hyphens allowed" : ""
                    }
                  />
                )}
              />
            </Grid>
            {/* Collections (multi) */}
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Collections</InputLabel>
                <Select
                  multiple
                  value={selectedCollections}
                  onChange={(e) =>
                    setSelectedCollections(e.target.value as string[])
                  }
                  input={<OutlinedInput label="Collections" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                  disabled={aliases.length === 0}
                >
                  <MenuItem value="all">
                    <Checkbox
                      checked={
                        aliases.length > 0 &&
                        selectedCollections.length === aliases.length
                      }
                      indeterminate={
                        selectedCollections.length > 0 &&
                        selectedCollections.length < aliases.length
                      }
                      onChange={handleSelectAllCollections}
                      icon={<CheckBoxOutlineBlank fontSize="small" />}
                      checkedIcon={<CheckBox fontSize="small" />}
                    />
                    <ListItemText primary="Select All" />
                  </MenuItem>
                  {aliases.map((alias) => (
                    <MenuItem key={alias} value={alias}>
                      <Checkbox
                        checked={selectedCollections.includes(alias)}
                        icon={<CheckBoxOutlineBlank fontSize="small" />}
                        checkedIcon={<CheckBox fontSize="small" />}
                      />
                      <ListItemText primary={alias} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {selectedDatabase && selectedCollections.length > 0 && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Info fontSize="small" />
                Assigning "{newPermission || 'permission'}" to {selectedCollections.length} collection{selectedCollections.length !== 1 ? 's' : ''} in {selectedDatabase.name}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={adding}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleAddPermission}
            loading={adding}
            disabled={
              !selectedDatabase ||
              !newPermission.trim() ||
              selectedCollections.length === 0
            }
            startIcon={<Add />}
          >
            Add Permission to {selectedCollections.length || 0} Collection{selectedCollections.length !== 1 ? "s" : ""}
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Permission Removal</DialogTitle>
        <DialogContent>
          {permissionToDelete && (
            <Typography>
              Are you sure you want to remove the permission "{permissionToDelete.permission}" 
              for collection "{permissionToDelete.collection_name}"? This action cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => permissionToDelete && handleDeletePermission(permissionToDelete)}
          >
            Remove Permission
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={openBulkDeleteDialog} onClose={() => setOpenBulkDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Bulk Permission Removal</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove {selectedPermissions.length} selected permission{selectedPermissions.length !== 1 ? 's' : ''}? 
            This action cannot be undone.
          </Typography>
          {selectedPermissions.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Permissions to be removed:
              </Typography>
              {selectedPermissions.slice(0, 5).map((perm, index) => (
                <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                  • {perm.permission} on {perm.collection_name} ({getDatabaseName(perm.solr_database_id)})
                </Typography>
              ))}
              {selectedPermissions.length > 5 && (
                <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                  ... and {selectedPermissions.length - 5} more
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
            Remove {selectedPermissions.length} Permission{selectedPermissions.length !== 1 ? 's' : ''}
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
          Import Database Permissions from CSV
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload a CSV file with columns: <strong>solr_database_id, collection_name, permission</strong>
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

export default SolrDatabasePermissionsEnhanced;
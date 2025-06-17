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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { DataGrid, GridColDef, GridRenderCellParams, GridSelectionModel } from "@mui/x-data-grid";
import {
  Add,
  Delete,
  Search,
  Storage,
  Description,
  Language,
  TextFields,
  Settings,
  Refresh,
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
  Visibility,
  VisibilityOff,
  Code,
  Translate,
  FindInPage,
  ViewModule,
  ViewList,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";
import { useResponsive } from "../../../lib/responsive-utils";

interface SolrDatabaseInfo {
  id?: number;
  solr_database_id: number;
  collection_name: string;
  description: string;
  embeddings: string;
  lang: string;
  text_field: string;
  tokenizer: string;
  to_not_display: string[];
  created_at?: string;
  updated_at?: string;
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

// Enhanced Collection Info Card Component
interface CollectionInfoCardProps {
  collectionInfo: SolrDatabaseInfo;
  database: SolrDatabase | undefined;
  selected: boolean;
  searchTerm: string;
  expanded: boolean;
  onSelect: (collectionInfo: SolrDatabaseInfo) => void;
  onToggleExpand: (collectionInfo: SolrDatabaseInfo) => void;
  onEdit: (collectionInfo: SolrDatabaseInfo) => void;
  onDelete: (collectionInfo: SolrDatabaseInfo) => void;
}

const CollectionInfoCard: React.FC<CollectionInfoCardProps> = ({
  collectionInfo,
  database,
  selected,
  searchTerm,
  expanded,
  onSelect,
  onToggleExpand,
  onEdit,
  onDelete,
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

  const getLanguageChipColor = (lang: string) => {
    const colors = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];
    return colors[lang.length % colors.length] as any;
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
              onChange={() => onSelect(collectionInfo)}
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
                <Collections color="primary" fontSize="small" />
                {highlightSearchTerm(collectionInfo.collection_name, searchTerm)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '0.95rem' },
                  mt: 0.5,
                }}
              >
                {database?.name || `Database ID: ${collectionInfo.solr_database_id}`}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => onToggleExpand(collectionInfo)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Description */}
        {collectionInfo.description && (
          <Typography
            variant="body2"
            sx={{ 
              mb: 2,
              fontStyle: 'italic',
              color: 'text.secondary',
            }}
          >
            {highlightSearchTerm(collectionInfo.description, searchTerm)}
          </Typography>
        )}

        {/* Quick Info Chips */}
        <Stack direction="row" spacing={1} sx={{ mb: expanded ? 2 : 0, flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<Language />}
            label={collectionInfo.lang || 'No language'}
            color={collectionInfo.lang ? getLanguageChipColor(collectionInfo.lang) : 'default'}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<TextFields />}
            label={collectionInfo.text_field || 'No text field'}
            color={collectionInfo.text_field ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
          {collectionInfo.embeddings && (
            <Chip
              icon={<Code />}
              label={collectionInfo.embeddings}
              color="info"
              size="small"
              variant="filled"
            />
          )}
          {collectionInfo.to_not_display?.length > 0 && (
            <Chip
              icon={<VisibilityOff />}
              label={`${collectionInfo.to_not_display.length} hidden fields`}
              color="warning"
              size="small"
              variant="outlined"
            />
          )}
        </Stack>

        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Configuration Details
                </Typography>
                <Typography variant="body2">
                  <strong>Text Field:</strong> {collectionInfo.text_field || 'Not configured'}
                  <br />
                  <strong>Tokenizer:</strong> {collectionInfo.tokenizer || 'Default'}
                  <br />
                  <strong>Language:</strong> {collectionInfo.lang || 'Not specified'}
                  <br />
                  <strong>Embeddings:</strong> {collectionInfo.embeddings || 'None'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Display Settings
                </Typography>
                <Typography variant="body2">
                  <strong>Hidden Fields:</strong>
                  <br />
                  {collectionInfo.to_not_display?.length > 0 ? (
                    collectionInfo.to_not_display.map((field, index) => (
                      <span key={index}>
                        • {field}
                        <br />
                      </span>
                    ))
                  ) : (
                    'No fields hidden'
                  )}
                </Typography>
              </Grid>
              {(collectionInfo.created_at || collectionInfo.updated_at) && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Timestamps
                  </Typography>
                  <Typography variant="body2">
                    {collectionInfo.created_at && (
                      <>
                        <strong>Created:</strong> {new Date(collectionInfo.created_at).toLocaleString()}
                        <br />
                      </>
                    )}
                    {collectionInfo.updated_at && (
                      <>
                        <strong>Updated:</strong> {new Date(collectionInfo.updated_at).toLocaleString()}
                      </>
                    )}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </Collapse>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: { xs: 2, sm: 3 }, pt: 0, justifyContent: 'flex-end' }}>
        <Button
          size="small"
          startIcon={<Edit />}
          onClick={() => onEdit(collectionInfo)}
          variant="outlined"
        >
          Edit
        </Button>
        <Button
          size="small"
          startIcon={<Delete />}
          onClick={() => onDelete(collectionInfo)}
          color="error"
          variant="outlined"
        >
          Delete
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
  onAddCollection: () => void;
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
  onAddCollection,
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
              <Database color="primary" fontSize="small" />
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
          {totalCount} collection configurations
          {autoRefresh && " • Auto-refresh enabled"}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const SolrDatabaseInfoEnhanced: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();

  // State management
  const [collections, setCollections] = useState<SolrDatabaseInfo[]>([]);
  const [databases, setDatabases] = useState<SolrDatabase[]>([]);
  const [newCollection, setNewCollection] = useState<Partial<SolrDatabaseInfo>>({
    to_not_display: []
  });
  const [editingCollection, setEditingCollection] = useState<Partial<SolrDatabaseInfo>>({});
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedCollections, setSelectedCollections] = useState<SolrDatabaseInfo[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openBulkDeleteDialog, setOpenBulkDeleteDialog] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<SolrDatabaseInfo | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    fetchCollections();
    fetchDatabases();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchCollections();
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

  const filteredCollections = useMemo(() => 
    collections.filter((collection) => {
      const searchText = search.toLowerCase();
      return !searchText || 
        collection.collection_name.toLowerCase().includes(searchText) ||
        collection.description.toLowerCase().includes(searchText) ||
        collection.embeddings.toLowerCase().includes(searchText) ||
        collection.lang.toLowerCase().includes(searchText) ||
        collection.text_field.toLowerCase().includes(searchText);
    }), [collections, search]);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/solr_database_infos");
      setCollections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch collections failed:", err);
      showNotification("Failed to fetch collection information", "error");
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

  const validateCollectionForm = (collectionData: Partial<SolrDatabaseInfo>, isEdit = false) => {
    const errors: string[] = [];
    
    if (!collectionData.solr_database_id) {
      errors.push("Database selection is required");
    }
    
    if (!collectionData.collection_name?.trim()) {
      errors.push("Collection name is required");
    } else if (!/^[a-zA-Z0-9_-]+$/.test(collectionData.collection_name)) {
      errors.push("Collection name must contain only letters, numbers, underscores, and hyphens");
    } else {
      const existingCollection = collections.find(c => 
        c.collection_name.toLowerCase() === collectionData.collection_name?.toLowerCase() &&
        c.solr_database_id === collectionData.solr_database_id &&
        (!isEdit || c.id !== editingCollectionId)
      );
      if (existingCollection) {
        errors.push("A collection with this name already exists for this database");
      }
    }
    
    if (collectionData.description && collectionData.description.length > 500) {
      errors.push("Description must be less than 500 characters");
    }
    
    if (collectionData.lang && collectionData.lang.length > 10) {
      errors.push("Language code must be less than 10 characters");
    }
    
    return errors;
  };

  const handleAddCollection = async () => {
    const validationErrors = validateCollectionForm(newCollection);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    setAdding(true);
    try {
      await authAxios.post("/api/solr_database_infos", newCollection);
      setNewCollection({ to_not_display: [] });
      setOpenAddDialog(false);
      fetchCollections();
      showNotification(`Collection "${newCollection.collection_name}" added successfully`, "success");
    } catch (err: any) {
      console.error("Add collection failed:", err);
      showNotification(`Failed to add collection: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateCollection = async () => {
    if (!editingCollectionId) return;
    
    const validationErrors = validateCollectionForm(editingCollection, true);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    setUpdating(true);
    try {
      await authAxios.put(`/api/solr_database_infos/${editingCollectionId}`, editingCollection);
      setEditingCollection({});
      setEditingCollectionId(null);
      setOpenEditDialog(false);
      fetchCollections();
      showNotification(`Collection "${editingCollection.collection_name}" updated successfully`, "success");
    } catch (err: any) {
      console.error("Update collection failed:", err);
      showNotification(`Failed to update collection: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCollection = async (collection: SolrDatabaseInfo) => {
    try {
      await authAxios.delete(`/api/solr_database_infos/${collection.id}`);
      showNotification(`Collection "${collection.collection_name}" deleted successfully`, "success");
      fetchCollections();
      setOpenDeleteDialog(false);
      setCollectionToDelete(null);
    } catch (err: any) {
      console.error("Delete collection failed:", err);
      showNotification(`Failed to delete collection: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCollections.length === 0) return;

    try {
      await Promise.all(
        selectedCollections.map(collection => 
          authAxios.delete(`/api/solr_database_infos/${collection.id}`)
        )
      );

      showNotification(
        `Successfully deleted ${selectedCollections.length} collection(s)`,
        "success"
      );

      setSelectedCollections([]);
      setOpenBulkDeleteDialog(false);
      fetchCollections();
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      showNotification(`Failed to delete some collections: ${err.response?.data?.message || err.message}`, "error");
    }
  };

  const handleSelectCollection = (collection: SolrDatabaseInfo) => {
    const isSelected = selectedCollections.some(c => c.id === collection.id);
    
    if (isSelected) {
      setSelectedCollections(selectedCollections.filter(c => c.id !== collection.id));
    } else {
      setSelectedCollections([...selectedCollections, collection]);
    }
  };

  const handleToggleCardExpansion = (collection: SolrDatabaseInfo) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(collection.id!)) {
      newExpanded.delete(collection.id!);
    } else {
      newExpanded.add(collection.id!);
    }
    setExpandedCards(newExpanded);
  };

  const handleEditOpen = (collection: SolrDatabaseInfo) => {
    setEditingCollectionId(collection.id!);
    setEditingCollection({
      solr_database_id: collection.solr_database_id,
      collection_name: collection.collection_name,
      description: collection.description,
      embeddings: collection.embeddings,
      lang: collection.lang,
      text_field: collection.text_field,
      tokenizer: collection.tokenizer,
      to_not_display: collection.to_not_display || [],
    });
    setOpenEditDialog(true);
  };

  const handleSelectAll = () => {
    setSelectedCollections([...filteredCollections]);
  };

  const handleClearSelection = () => {
    setSelectedCollections([]);
  };

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
      field: "description",
      headerName: "Description",
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2">{params.value}</Typography>
      ),
    },
    {
      field: "lang",
      headerName: "Language",
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value || "N/A"} size="small" color="info" />
      ),
    },
    {
      field: "text_field",
      headerName: "Text Field",
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "embeddings",
      headerName: "Embeddings",
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value || "None"} size="small" color="warning" />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Collection">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEditOpen(params.row)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Collection">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setCollectionToDelete(params.row);
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
      name: 'Add Collection',
      onClick: () => setOpenAddDialog(true),
    },
    {
      icon: <CloudUpload />,
      name: 'Import CSV',
      onClick: () => {/* handleImportCSV */},
    },
    {
      icon: <GetApp />,
      name: 'Export All',
      onClick: () => {/* handleExportCSV */},
    },
    {
      icon: <Refresh />,
      name: 'Refresh',
      onClick: fetchCollections,
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
          title="Collection Info"
          subtitle="Manage collection metadata"
          selectedCount={selectedCollections.length}
          totalCount={filteredCollections.length}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
          onAddCollection={() => setOpenAddDialog(true)}
          onBulkDelete={selectedCollections.length > 0 ? () => setOpenBulkDeleteDialog(true) : undefined}
          onClearSelection={selectedCollections.length > 0 ? handleClearSelection : undefined}
        />
      ) : (
        // Desktop Header
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
              <Database color="primary" />
              Solr Collection Information
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure collection metadata, fields, and display settings
            </Typography>
            {selectedCollections.length > 0 && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                {selectedCollections.length} collection{selectedCollections.length !== 1 ? 's' : ''} selected
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
              Add Collection
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
                placeholder="Search collections by name, description, or configuration..."
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
                  {filteredCollections.length} of {collections.length} collections
                </Typography>
              </Stack>
            </Grid>
          </Grid>
          
          {/* Results summary and bulk actions */}
          {!isMobile && selectedCollections.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="primary">
                {selectedCollections.length} collection{selectedCollections.length !== 1 ? 's' : ''} selected
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<SelectAll />}
                  onClick={handleSelectAll}
                  disabled={filteredCollections.length === 0}
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
                  Delete ({selectedCollections.length})
                </Button>
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
            {filteredCollections.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Database sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {search ? 'No collections found' : 'No collections configured yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {search 
                    ? `No collections match "${search}". Try a different search term.`
                    : 'Get started by adding your first collection configuration.'
                  }
                </Typography>
                {!search && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenAddDialog(true)}
                    sx={{ mt: 2 }}
                  >
                    Add First Collection
                  </Button>
                )}
              </Paper>
            ) : viewMode === 'cards' ? (
              <Grid container spacing={2}>
                {filteredCollections.map((collection) => {
                  const database = databases.find(db => db.id === collection.solr_database_id);
                  return (
                    <Grid item xs={12} sm={6} md={4} key={collection.id}>
                      <CollectionInfoCard
                        collectionInfo={collection}
                        database={database}
                        selected={selectedCollections.some(c => c.id === collection.id)}
                        searchTerm={search}
                        expanded={expandedCards.has(collection.id!)}
                        onSelect={handleSelectCollection}
                        onToggleExpand={handleToggleCardExpansion}
                        onEdit={handleEditOpen}
                        onDelete={(collection) => {
                          setCollectionToDelete(collection);
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
                  rows={filteredCollections}
                  columns={columns}
                  initialState={{
                    pagination: {
                      page: 0,
                      pageSize: 10,
                    },
                  }}
                  pageSize={100}
                  getRowId={(row) => row.id || `${row.solr_database_id}-${row.collection_name}`}
                  checkboxSelection
                  selectionModel={selectedCollections.map(c => c.id)}
                  onSelectionModelChange={(newSelection: GridSelectionModel) => {
                    const selectedIds = newSelection as number[];
                    const newSelectedCollections = filteredCollections.filter(c => 
                      selectedIds.includes(c.id!)
                    );
                    setSelectedCollections(newSelectedCollections);
                  }}
                  disableSelectionOnClick={false}
                  sx={{
                    border: "none",
                    "& .MuiDataGrid-cell": {
                      outline: "none",
                      borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                    },
                    "& .MuiDataGrid-columnHeaders": {
                      backgroundColor: "rgba(103, 58, 183, 0.08)",
                      borderBottom: "2px solid rgba(103, 58, 183, 0.2)",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    },
                    "& .MuiDataGrid-row": {
                      transition: "background-color 0.2s ease, transform 0.1s ease",
                      "&:hover": {
                        backgroundColor: "rgba(103, 58, 183, 0.08)",
                        transform: "translateY(-1px)",
                        boxShadow: "0 4px 12px rgba(103, 58, 183, 0.15)",
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
          ariaLabel="Collection actions"
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

      {/* Add Collection Dialog */}
      <Dialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Add />
          Add New Collection Configuration
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Database</InputLabel>
                <Select
                  value={newCollection.solr_database_id || ''}
                  onChange={(e) => setNewCollection({ ...newCollection, solr_database_id: Number(e.target.value) })}
                  label="Database"
                >
                  {databases.map((database) => (
                    <MenuItem key={database.id} value={database.id}>
                      {database.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Collection Name"
                value={newCollection.collection_name || ""}
                onChange={(e) => setNewCollection({ ...newCollection, collection_name: e.target.value })}
                fullWidth
                required
                error={newCollection.collection_name ? !/^[a-zA-Z0-9_-]+$/.test(newCollection.collection_name) : false}
                helperText={
                  !newCollection.collection_name?.trim() ? "Collection name is required" :
                  !/^[a-zA-Z0-9_-]+$/.test(newCollection.collection_name) ? "Only letters, numbers, underscores, and hyphens allowed" : ""
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={newCollection.description || ""}
                onChange={(e) => setNewCollection({ ...newCollection, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
                inputProps={{ maxLength: 500 }}
                helperText={`${newCollection.description?.length || 0}/500 characters`}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Language"
                value={newCollection.lang || ""}
                onChange={(e) => setNewCollection({ ...newCollection, lang: e.target.value })}
                fullWidth
                placeholder="en, zh, fr, etc."
                inputProps={{ maxLength: 10 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Text Field"
                value={newCollection.text_field || ""}
                onChange={(e) => setNewCollection({ ...newCollection, text_field: e.target.value })}
                fullWidth
                placeholder="content, text, body"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tokenizer"
                value={newCollection.tokenizer || ""}
                onChange={(e) => setNewCollection({ ...newCollection, tokenizer: e.target.value })}
                fullWidth
                placeholder="standard, keyword, whitespace"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Embeddings"
                value={newCollection.embeddings || ""}
                onChange={(e) => setNewCollection({ ...newCollection, embeddings: e.target.value })}
                fullWidth
                placeholder="word2vec, fasttext, bert"
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={availableFields}
                value={newCollection.to_not_display || []}
                onChange={(_, value) => setNewCollection({ ...newCollection, to_not_display: value })}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Fields to Hide"
                    placeholder="Add field names to hide from display"
                    helperText="Fields that should not be displayed in search results"
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenAddDialog(false)} disabled={adding}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleAddCollection}
            loading={adding}
            disabled={
              !newCollection.solr_database_id ||
              !newCollection.collection_name?.trim()
            }
          >
            Add Collection
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog
        open={openEditDialog}
        onClose={() => setOpenEditDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Edit />
          Edit Collection Configuration
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Database</InputLabel>
                <Select
                  value={editingCollection.solr_database_id || ''}
                  onChange={(e) => setEditingCollection({ ...editingCollection, solr_database_id: Number(e.target.value) })}
                  label="Database"
                >
                  {databases.map((database) => (
                    <MenuItem key={database.id} value={database.id}>
                      {database.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Collection Name"
                value={editingCollection.collection_name || ""}
                onChange={(e) => setEditingCollection({ ...editingCollection, collection_name: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={editingCollection.description || ""}
                onChange={(e) => setEditingCollection({ ...editingCollection, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
                inputProps={{ maxLength: 500 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Language"
                value={editingCollection.lang || ""}
                onChange={(e) => setEditingCollection({ ...editingCollection, lang: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Text Field"
                value={editingCollection.text_field || ""}
                onChange={(e) => setEditingCollection({ ...editingCollection, text_field: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tokenizer"
                value={editingCollection.tokenizer || ""}
                onChange={(e) => setEditingCollection({ ...editingCollection, tokenizer: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Embeddings"
                value={editingCollection.embeddings || ""}
                onChange={(e) => setEditingCollection({ ...editingCollection, embeddings: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={availableFields}
                value={editingCollection.to_not_display || []}
                onChange={(_, value) => setEditingCollection({ ...editingCollection, to_not_display: value })}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Fields to Hide"
                    placeholder="Add field names to hide from display"
                  />
                )}
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
            onClick={handleUpdateCollection}
            loading={updating}
          >
            Save Changes
          </LoadingButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Collection Deletion</DialogTitle>
        <DialogContent>
          {collectionToDelete && (
            <Typography>
              Are you sure you want to delete the collection configuration for "{collectionToDelete.collection_name}"? 
              This action cannot be undone and will remove all metadata settings.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => collectionToDelete && handleDeleteCollection(collectionToDelete)}
          >
            Delete Collection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={openBulkDeleteDialog} onClose={() => setOpenBulkDeleteDialog(false)}>
        <DialogTitle sx={{ color: "error.main" }}>Confirm Bulk Collection Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedCollections.length} selected collection{selectedCollections.length !== 1 ? 's' : ''}? 
            This action cannot be undone.
          </Typography>
          {selectedCollections.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Collections to be deleted:
              </Typography>
              {selectedCollections.slice(0, 5).map((collection) => (
                <Typography key={collection.id} variant="body2" sx={{ ml: 2 }}>
                  • {collection.collection_name} ({databases.find(db => db.id === collection.solr_database_id)?.name || 'Unknown DB'})
                </Typography>
              ))}
              {selectedCollections.length > 5 && (
                <Typography variant="body2" sx={{ ml: 2, fontStyle: 'italic' }}>
                  ... and {selectedCollections.length - 5} more
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
            Delete {selectedCollections.length} Collection{selectedCollections.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SolrDatabaseInfoEnhanced;
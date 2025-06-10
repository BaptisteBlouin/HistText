import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Card,
  CardContent,
  Grid,
  Stack,
  Alert,
  Fade,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControlLabel,
  Switch,
  Badge,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams, GridSelectionModel } from "@mui/x-data-grid";
import { SkeletonLoader, CopyToClipboard } from "../../../components/ui";
import {
  Add,
  Edit,
  Delete,
  Search,
  Storage,
  Language,
  Refresh,
  Save,
  Cancel,
  Info,
  DataObject,
  GetApp,
  DeleteSweep,
  SelectAll,
  Autorenew,
  CloudUpload,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/** Interface for a collection's metadata and configuration. */
interface SolrDatabaseInfo {
  solr_database_id: number;
  collection_name: string;
  description: string;
  embeddings: string;
  lang?: string | null;
  text_field?: string | null;
  tokenizer?: string | null;
  to_not_display?: Array<string | null> | null;
}

/** Interface for a Solr database entry. */
interface SolrDatabase {
  id: number;
  name: string;
}

/** Notification/snackbar state. */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

/**
 * Custom Axios instance with Authorization header attached.
 */
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

/**
 * Main component for Solr database collection metadata management.
 * Allows admin to add, edit, or delete collection-level metadata and settings.
 */
const SolrDatabaseInfoComponent: React.FC = () => {
  const authAxios = useAuthAxios();

  // --- State variables ---
  const [solrDatabaseInfos, setSolrDatabaseInfos] = useState<
    SolrDatabaseInfo[]
  >([]);
  const [solrDatabases, setSolrDatabases] = useState<SolrDatabase[]>([]);
  const [selectedSolrDatabase, setSelectedSolrDatabase] =
    useState<SolrDatabase | null>(null);
  const [aliases, setAliases] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEmbeddings, setNewEmbeddings] = useState("");
  const [newLang, setNewLang] = useState<string | null>(null);
  const [newTextField, setNewTextField] = useState<string | null>(null);
  const [newTokenizer, setNewTokenizer] = useState<string | null>(null);
  const [newToNotDisplay, setNewToNotDisplay] = useState<Array<
    string | null
  > | null>(null);
  const [editingRecord, setEditingRecord] = useState<SolrDatabaseInfo | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SolrDatabaseInfo | null>(
    null,
  );
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedRows, setSelectedRows] = useState<GridSelectionModel>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  /** Initial data fetch for Solr DBs and collection metadata info. */
  useEffect(() => {
    fetchSolrDatabaseInfos();
    fetchSolrDatabases();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSolrDatabaseInfos();
      }, 30000); // Refresh every 30 seconds
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

  /** Filters info records by search term with highlighting. */
  const filteredInfos = useMemo(() => 
    solrDatabaseInfos.filter((info) =>
      `${info.collection_name} ${info.description} ${info.embeddings}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ), [solrDatabaseInfos, search]
  );

  // Highlight search terms
  const highlightText = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0 2px' }}>{part}</mark> : part
    );
  };

  // Handle CSV file import for Solr database info
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
      const expectedHeaders = ['solr_database_id', 'collection_name', 'description', 'embeddings'];
      
      // Validate headers
      const missingHeaders = expectedHeaders.filter(h => !headers.some(header => header.toLowerCase().includes(h)));
      if (missingHeaders.length > 0) {
        showNotification(`Missing required columns: ${missingHeaders.join(', ')}. Expected: solr_database_id, collection_name, description, embeddings`, "error");
        return;
      }

      // Parse CSV data
      const databaseInfoData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= 4) {
          databaseInfoData.push({
            solr_database_id: parseInt(values[headers.findIndex(h => h.toLowerCase().includes('solr_database_id'))]),
            collection_name: values[headers.findIndex(h => h.toLowerCase().includes('collection_name'))],
            description: values[headers.findIndex(h => h.toLowerCase().includes('description'))],
            embeddings: values[headers.findIndex(h => h.toLowerCase().includes('embeddings'))],
          });
        }
      }

      if (databaseInfoData.length === 0) {
        showNotification("No valid database info data found in CSV", "error");
        return;
      }

      // Import database info records
      let successCount = 0;
      const errors: string[] = [];
      
      for (const dbInfo of databaseInfoData) {
        try {
          await authAxios.post('/api/solr_database_info', dbInfo);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import database info ${dbInfo.collection_name}:`, err);
          
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
          
          errors.push(`${dbInfo.collection_name}: ${specificError}`);
        }
      }

      // Show detailed results with longer duration for errors
      if (successCount > 0 && errors.length === 0) {
        showNotification(`Successfully imported all ${successCount} database info records`, "success");
        fetchSolrDatabaseInfos();
      } else if (successCount > 0 && errors.length > 0) {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Imported ${successCount} records successfully. ${errors.length} failed: ${errorSummary}`, "warning", 10000);
        fetchSolrDatabaseInfos();
      } else {
        const errorSummary = errors.length <= 2 ? 
          errors.join('; ') : 
          `${errors.slice(0, 2).join('; ')}... and ${errors.length - 2} more errors`;
        showNotification(`Import failed for all database info records: ${errorSummary}`, "error", 15000);
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

  // Export to CSV functionality
  const handleExportCSV = useCallback(() => {
    const csvHeaders = ['Database ID', 'Collection Name', 'Description', 'Embeddings', 'Language', 'Text Field', 'Tokenizer', 'Hidden Fields'];
    const csvData = filteredInfos.map(info => [
      info.solr_database_id,
      info.collection_name,
      info.description,
      info.embeddings,
      info.lang || '',
      info.text_field || '',
      info.tokenizer || '',
      info.to_not_display ? info.to_not_display.filter(Boolean).join(';') : ''
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `solr_database_info_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    showNotification(`Exported ${filteredInfos.length} database info records to CSV`, 'success');
  }, [filteredInfos]);

  // Bulk delete functionality
  const handleBulkDelete = useCallback(() => {
    if (selectedRows.length === 0) {
      showNotification('No records selected for deletion', 'warning');
      return;
    }
    
    const selectedInfos = filteredInfos.filter(info => 
      selectedRows.includes(`${info.solr_database_id}-${info.collection_name}`)
    );
    setRecordToDelete(selectedInfos[0]); // Use first selected for display
    setOpenDeleteDialog(true);
  }, [selectedRows, filteredInfos]);

  // Bulk operations
  const handleSelectAll = () => {
    const allIds = filteredInfos.map(info => `${info.solr_database_id}-${info.collection_name}`);
    setSelectedRows(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedRows([]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'r':
            event.preventDefault();
            fetchSolrDatabaseInfos();
            break;
          case 'n':
            event.preventDefault();
            setOpenAddDialog(true);
            break;
          case 'a':
            if (event.shiftKey) {
              event.preventDefault();
              const allIds = filteredInfos.map(info => `${info.solr_database_id}-${info.collection_name}`);
              setSelectedRows(allIds);
            }
            break;
          case 'e':
            if (selectedRows.length > 0) {
              event.preventDefault();
              handleExportCSV();
            }
            break;
          case 'Delete':
          case 'Backspace':
            if (selectedRows.length > 0) {
              event.preventDefault();
              handleBulkDelete();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedRows, filteredInfos, handleExportCSV, handleBulkDelete]);

  /** Fetch Solr collection aliases for the selected DB. */
  useEffect(() => {
    if (selectedSolrDatabase) {
      authAxios
        .get(`/api/solr/aliases?solr_database_id=${selectedSolrDatabase.id}`)
        .then((res) => setAliases(Array.isArray(res.data) ? res.data : []))
        .catch(() => setAliases([]));
    } else {
      setAliases([]);
    }
    setNewCollectionName("");
    setAvailableFields([]);
  }, [selectedSolrDatabase]);

  /** When a collection is selected, fetch its field metadata. */
  useEffect(() => {
    if (selectedSolrDatabase && newCollectionName) {
      fetchCollectionMetadata(selectedSolrDatabase.id, newCollectionName);
    } else {
      setAvailableFields([]);
    }
  }, [selectedSolrDatabase, newCollectionName]);

  /**
   * Utility: show a snackbar notification.
   */
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

  /**
   * Fetch field names (metadata) for a Solr collection.
   */
  const fetchCollectionMetadata = async (
    solrDatabaseId: number,
    collectionName: string,
  ) => {
    try {
      const metadataResponse = await authAxios.get(
        `/api/solr/collection_metadata?collection=${encodeURIComponent(collectionName)}&solr_database_id=${solrDatabaseId}`,
      );
      if (metadataResponse.data && Array.isArray(metadataResponse.data)) {
        const fields = metadataResponse.data;
        const fieldNames = fields.map((field: any) => field.name);
        setAvailableFields(fieldNames);

        if (!editingRecord) {
          setNewTextField(null);
          setNewToNotDisplay(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch collection metadata:", error);
      setAvailableFields([]);
    }
  };

  /**
   * Load all Solr database info records (metadata/config for collections).
   */
  const fetchSolrDatabaseInfos = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/solr_database_info");
      setSolrDatabaseInfos(data);
    } catch (error) {
      console.error("Failed to fetch database info:", error);
      setSolrDatabaseInfos([]);
      showNotification("Failed to fetch database information", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load list of Solr databases for the dropdown.
   */
  const fetchSolrDatabases = async () => {
    try {
      const { data } = await authAxios.get("/api/solr_databases");
      setSolrDatabases(data);
    } catch (error) {
      console.error("Failed to fetch databases:", error);
      setSolrDatabases([]);
      showNotification("Failed to fetch databases", "error");
    }
  };

  /**
   * Check if collection info already exists
   */
  const collectionInfoExists = (dbId: number, collectionName: string, excludeRecord?: SolrDatabaseInfo) => {
    return solrDatabaseInfos.some(info => 
      info.solr_database_id === dbId && 
      info.collection_name.toLowerCase() === collectionName.toLowerCase() &&
      !(excludeRecord && info.solr_database_id === excludeRecord.solr_database_id && 
        info.collection_name === excludeRecord.collection_name)
    );
  };

  /**
   * Validate collection name format
   */
  const isValidCollectionName = (name: string) => {
    // Collection names should be alphanumeric with underscores/hyphens
    const collectionRegex = /^[a-zA-Z0-9_-]+$/;
    return collectionRegex.test(name);
  };

  /**
   * Validate database info form
   */
  const validateDatabaseInfoForm = () => {
    const errors: string[] = [];
    
    if (!selectedSolrDatabase) {
      errors.push("Please select a Solr database");
    }
    
    if (!newCollectionName.trim()) {
      errors.push("Collection name is required");
    } else if (!isValidCollectionName(newCollectionName)) {
      errors.push("Collection name can only contain letters, numbers, underscores, and hyphens");
    } else if (selectedSolrDatabase && collectionInfoExists(selectedSolrDatabase.id, newCollectionName, editingRecord || undefined)) {
      errors.push("Collection information already exists for this database");
    }
    
    if (!newDescription.trim()) {
      errors.push("Description is required");
    } else if (newDescription.length > 500) {
      errors.push("Description must be less than 500 characters");
    }
    
    if (!newEmbeddings.trim()) {
      errors.push("Embeddings field is required");
    }
    
    if (newLang && newLang.length > 10) {
      errors.push("Language code should be 10 characters or less");
    }
    
    return errors;
  };

  /**
   * Submit new or edited record with enhanced validation.
   */
  const handleAddOrUpdate = async () => {
    const validationErrors = validateDatabaseInfoForm();
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    const dbName = selectedSolrDatabase?.name || "Unknown";
    
    try {
      if (editingRecord) {
        await authAxios.put(
          `/api/solr_database_info/${selectedSolrDatabase!.id}/${encodeURIComponent(newCollectionName)}`,
          {
            description: newDescription,
            embeddings: newEmbeddings,
            lang: newLang,
            text_field: newTextField,
            tokenizer: newTokenizer,
            to_not_display: newToNotDisplay,
          },
        );
        showNotification(`Collection "${newCollectionName}" in database "${dbName}" updated successfully`, "success");
      } else {
        await authAxios.post("/api/solr_database_info", {
          solr_database_id: selectedSolrDatabase!.id,
          collection_name: newCollectionName,
          description: newDescription,
          embeddings: newEmbeddings,
          lang: newLang,
          text_field: newTextField,
          tokenizer: newTokenizer,
          to_not_display: newToNotDisplay,
        });
        showNotification(`Collection "${newCollectionName}" added to database "${dbName}" successfully`, "success");
      }
      fetchSolrDatabaseInfos();
      resetForm();
    } catch (error: any) {
      console.error("Failed to save record:", error);
      const errorMessage = error.response?.data?.message || error.message || "Unknown error occurred";
      
      if (error.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("Collection information already exists for this database", "error");
      } else if (error.response?.status === 404) {
        showNotification("Database or collection not found. Please refresh and try again.", "error");
        fetchSolrDatabaseInfos();
      } else if (error.response?.status === 400) {
        showNotification(`Invalid collection data: ${errorMessage}`, "error");
      } else if (error.response?.status === 422) {
        showNotification("Please check your input and try again", "error");
      } else {
        showNotification(`Failed to save record: ${errorMessage}`, "error");
      }
    }
  };

  /**
   * Populate form fields for editing a record.
   */
  const handleEdit = (record: SolrDatabaseInfo) => {
    const db =
      solrDatabases.find((db) => db.id === record.solr_database_id) || null;
    setEditingRecord(record);
    setSelectedSolrDatabase(db);
    setNewCollectionName(record.collection_name);
    setNewDescription(record.description);
    setNewEmbeddings(record.embeddings);
    setNewLang(record.lang ?? null);
    setNewTextField(record.text_field ?? null);
    setNewTokenizer(record.tokenizer ?? null);
    setNewToNotDisplay(record.to_not_display ?? null);

    if (db) {
      fetchCollectionMetadata(db.id, record.collection_name);
    }
    setOpenAddDialog(true);
  };

  /**
   * Delete a record with enhanced error handling.
   */
  const handleDelete = async (
    solr_database_id: number,
    collection_name: string,
  ) => {
    const dbName = solrDatabases.find(db => db.id === solr_database_id)?.name || "Unknown";
    
    try {
      await authAxios.delete(
        `/api/solr_database_info/${solr_database_id}/${encodeURIComponent(collection_name)}`,
      );
      setSelectedRows((prev: any) => prev.filter((rowId: any) => rowId !== `${solr_database_id}-${collection_name}`));
      fetchSolrDatabaseInfos();
      setOpenDeleteDialog(false);
      setRecordToDelete(null);
      showNotification(`Collection "${collection_name}" info deleted from database "${dbName}" successfully`, "success");
    } catch (error: any) {
      console.error("Failed to delete record:", error);
      const errorMessage = error.response?.data?.message || error.message || "Unknown error occurred";
      
      if (error.response?.status === 404) {
        showNotification("Collection information not found. It may have already been deleted.", "error");
        fetchSolrDatabaseInfos(); // Refresh to sync with server
      } else if (error.response?.status === 403) {
        showNotification("You don't have permission to delete this collection information", "error");
      } else if (error.response?.status === 409 || errorMessage.includes("constraint")) {
        showNotification("Cannot delete: collection info may be referenced by other data", "error");
      } else {
        showNotification(`Failed to delete record: ${errorMessage}`, "error");
      }
      setOpenDeleteDialog(false);
      setRecordToDelete(null);
    }
  };

  /**
   * Handle bulk deletion of selected records
   */
  const handleBulkDeleteConfirm = async () => {
    if (selectedRows.length === 0) return;
    
    const selectedInfos = filteredInfos.filter(info => 
      selectedRows.includes(`${info.solr_database_id}-${info.collection_name}`)
    );
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const info of selectedInfos) {
      try {
        await authAxios.delete(
          `/api/solr_database_info/${info.solr_database_id}/${encodeURIComponent(info.collection_name)}`
        );
        successCount++;
      } catch (err) {
        console.error(`Failed to delete info for ${info.collection_name}:`, err);
        errorCount++;
      }
    }
    
    if (successCount > 0) {
      showNotification(`Successfully deleted ${successCount} record(s)`, 'success');
    }
    if (errorCount > 0) {
      showNotification(`Failed to delete ${errorCount} record(s)`, 'error');
    }
    
    setSelectedRows([]);
    fetchSolrDatabaseInfos();
    setOpenDeleteDialog(false);
    setRecordToDelete(null);
  };

  /** Resets the form and editing state to blank. */
  const resetForm = () => {
    setEditingRecord(null);
    setSelectedSolrDatabase(null);
    setNewCollectionName("");
    setNewDescription("");
    setNewEmbeddings("");
    setNewLang(null);
    setNewTextField(null);
    setNewTokenizer(null);
    setNewToNotDisplay(null);
    setAvailableFields([]);
    setOpenAddDialog(false);
  };

  /** Handler for "Fields To Not Display" multiselect. */
  const handleToNotDisplayChange = (
    _: React.SyntheticEvent,
    newValue: string[],
  ) => {
    setNewToNotDisplay(newValue.map((v) => v || null));
  };

  // --- DataGrid columns definition ---
  const columns: GridColDef[] = [
    {
      field: "solr_database_id",
      headerName: "Database ID",
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "collection_name",
      headerName: "Collection",
      width: 220,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DataObject fontSize="small" color="primary" />
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
            {highlightText(params.value, search)}
          </Typography>
          <CopyToClipboard 
            text={params.value} 
            variant="icon" 
            size="small" 
            showToast={false}
            tooltipTitle="Copy collection name"
          />
        </Box>
      ),
    },
    {
      field: "description",
      headerName: "Description",
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2">{highlightText(params.value, search)}</Typography>
      ),
    },
    {
      field: "embeddings",
      headerName: "Embeddings",
      width: 150,
      renderCell: (params) => (
        <Chip label={highlightText(params.value, search)} size="small" color="info" />
      ),
    },
    {
      field: "lang",
      headerName: "Language",
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Language fontSize="small" color="action" />
          <Typography variant="body2">{params.value || "-"}</Typography>
        </Box>
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
      field: "tokenizer",
      headerName: "Tokenizer",
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">{params.value || "-"}</Typography>
      ),
    },
    {
      field: "to_not_display",
      headerName: "Hidden Fields",
      width: 200,
      renderCell: (params) => {
        const values = params.value as Array<string | null> | null;
        if (!values || values.length === 0)
          return <Typography variant="body2">-</Typography>;
        return (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {values.map(
              (value, index) =>
                value && (
                  <Chip
                    key={index}
                    label={value}
                    size="small"
                    variant="outlined"
                  />
                ),
            )}
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit Record">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEdit(params.row)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Record">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                setRecordToDelete(params.row);
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

  // --- Render ---
  return (
    <Fade in={true} timeout={600}>
      <Box>
        {notification.open && (
          <Alert
            severity={notification.severity}
            sx={{ mb: 3 }}
            onClose={() =>
              setNotification((prev) => ({ ...prev, open: false }))
            }
          >
            {notification.message}
          </Alert>
        )}

        {/* Page header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Info color="primary" />
              Database Information
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage collection metadata and configuration settings
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Auto-refresh (30s)">
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Autorenew fontSize="small" />
                    Auto
                  </Box>
                }
              />
            </Tooltip>
            <Tooltip title="Refresh Data (Ctrl+R)">
              <IconButton onClick={fetchSolrDatabaseInfos} color="primary">
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
                  background:
                    "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Add Database Info (Ctrl+N)
            </Button>
          </Stack>
        </Box>


        {/* Search and bulk operations */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search by collection, description, or embeddings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                  {selectedRows.length > 0 && (
                    <>
                      <Badge badgeContent={selectedRows.length} color="primary">
                        <Tooltip title="Export Selected to CSV (Ctrl+E)">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<GetApp />}
                            onClick={handleExportCSV}
                          >
                            Export
                          </Button>
                        </Tooltip>
                      </Badge>
                      <Tooltip title="Delete Selected (Delete/Backspace)">
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteSweep />}
                          onClick={handleBulkDelete}
                        >
                          Delete ({selectedRows.length})
                        </Button>
                      </Tooltip>
                      <Tooltip title="Deselect All">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleDeselectAll}
                        >
                          Clear
                        </Button>
                      </Tooltip>
                    </>
                  )}
                  {selectedRows.length === 0 && (
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
                            disabled={filteredInfos.length === 0}
                          >
                            Export All
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="Select All (Ctrl+Shift+A)">
                        <span>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<SelectAll />}
                            onClick={handleSelectAll}
                            disabled={filteredInfos.length === 0}
                          >
                            Select All
                          </Button>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Stack>
              </Grid>
            </Grid>
            {selectedRows.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Divider />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedRows.length} record(s) selected | Keyboard shortcuts: Ctrl+E (export), Delete (bulk delete), Ctrl+R (refresh)
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Table of collection info */}
        <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
          {loading ? (
            <SkeletonLoader variant="admin" rows={10} />
          ) : (
            <DataGrid
              rows={filteredInfos}
              columns={columns}
              initialState={{
                pagination: {
                  page: 0,
                  pageSize: 10,
                },
              }}
              pageSize={100}
              getRowId={(row) =>
                `${row.solr_database_id}-${row.collection_name}`
              }
              checkboxSelection
              selectionModel={selectedRows}
              onSelectionModelChange={(newSelection: any) => {
                setSelectedRows(newSelection);
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
          )}
        </Paper>

        {/* Add/Edit Dialog */}
        <Dialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          maxWidth="md"
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
            {editingRecord ? <Edit /> : <Add />}
            {editingRecord ? "Update Database Info" : "Add Database Info"}
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              {/* Solr DB selector */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Solr Database</InputLabel>
                  <Select
                    value={selectedSolrDatabase?.id || ""}
                    onChange={(e) =>
                      setSelectedSolrDatabase(
                        solrDatabases.find(
                          (db) => db.id === Number(e.target.value),
                        ) || null,
                      )
                    }
                    label="Solr Database"
                  >
                    {solrDatabases.map((db) => (
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
              {/* Collection name */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={aliases}
                  value={newCollectionName}
                  onChange={(_, value: string | null) =>
                    setNewCollectionName(value || "")
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Collection Name *"
                      required
                      error={!newCollectionName}
                      helperText={!newCollectionName && "Required"}
                    />
                  )}
                />
              </Grid>
              {/* Description */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Description *"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  fullWidth
                  required
                  error={!newDescription}
                  helperText={!newDescription && "Required"}
                />
              </Grid>
              {/* Embeddings */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Embeddings *"
                  value={newEmbeddings}
                  onChange={(e) => setNewEmbeddings(e.target.value)}
                  fullWidth
                  required
                  error={!newEmbeddings}
                  helperText={!newEmbeddings && "Required"}
                />
              </Grid>
              {/* Language */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="Language"
                  value={newLang || ""}
                  onChange={(e) => setNewLang(e.target.value || null)}
                  fullWidth
                />
              </Grid>
              {/* Text field selector */}
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Text Field</InputLabel>
                  <Select
                    value={newTextField || ""}
                    onChange={(e) => setNewTextField(e.target.value || null)}
                    label="Text Field"
                    disabled={availableFields.length === 0}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {availableFields.map((field) => (
                      <MenuItem key={field} value={field}>
                        {field}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              {/* Tokenizer */}
              <Grid item xs={12} md={4}>
                <TextField
                  label="Tokenizer"
                  value={newTokenizer || ""}
                  onChange={(e) => setNewTokenizer(e.target.value || null)}
                  fullWidth
                />
              </Grid>
              {/* Fields To Not Display multiselect */}
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={availableFields}
                  value={(newToNotDisplay || []).filter(Boolean) as string[]}
                  onChange={handleToNotDisplayChange}
                  renderInput={(params) => (
                    <TextField {...params} label="Fields To Not Display" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  disabled={availableFields.length === 0}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={resetForm} startIcon={<Cancel />}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAddOrUpdate}
              startIcon={editingRecord ? <Save /> : <Add />}
              disabled={
                !selectedSolrDatabase ||
                !newCollectionName ||
                !newDescription ||
                !newEmbeddings
              }
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              {editingRecord ? "Update" : "Add"} Record
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirm delete dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
        >
          <DialogTitle
            sx={{
              color: "error.main",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Delete />
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            {selectedRows.length > 1 ? (
              <Typography>
                Are you sure you want to delete {selectedRows.length} selected database info records? This action cannot be undone.
              </Typography>
            ) : (
              <Typography>
                Are you sure you want to delete the record for collection "
                {recordToDelete?.collection_name}"? This action cannot be undone.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                if (selectedRows.length > 1) {
                  handleBulkDeleteConfirm();
                } else if (recordToDelete) {
                  handleDelete(
                    recordToDelete.solr_database_id,
                    recordToDelete.collection_name
                  );
                }
              }}
            >
              Delete {selectedRows.length > 1 ? `${selectedRows.length} Records` : 'Record'}
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
            Import Solr Database Info from CSV
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload a CSV file with columns: <strong>solr_database_id, collection_name, description, embeddings</strong>
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
            <Button
              variant="contained"
              onClick={handleImportCSV}
              disabled={!importFile || importing}
              startIcon={importing ? <CircularProgress size={20} /> : <CloudUpload />}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default SolrDatabaseInfoComponent;

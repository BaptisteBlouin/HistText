import React, { useEffect, useState, useMemo } from "react";
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
  OutlinedInput,
  Checkbox,
  ListItemText,
  Card,
  CardContent,
  Grid,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
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
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/** Represents a collection permission entry. */
interface SolrDatabasePermission {
  solr_database_id: number;
  collection_name: string;
  permission: string;
  created_at: string;
}

/** Represents a Solr database object. */
interface SolrDatabase {
  id: number;
  name: string;
}

/** Snackbar notification state. */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

/**
 * Custom axios instance with auth header.
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
 * SolrDatabasePermissions:
 * Admin UI to assign or revoke permissions for collections in Solr databases.
 */
const SolrDatabasePermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // ----------------
  // State management
  // ----------------
  const [permissions, setPermissions] = useState<SolrDatabasePermission[]>([]);
  const [databases, setDatabases] = useState<SolrDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<SolrDatabase | null>(
    null,
  );
  const [aliases, setAliases] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>(
    [],
  );
  const [newPermission, setNewPermission] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [permissionToDelete, setPermissionToDelete] =
    useState<SolrDatabasePermission | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });

  // --------
  // Effects
  // --------

  /** Initial load of all permissions and database options. */
  useEffect(() => {
    fetchPermissions();
    fetchDatabases();
  }, []);

  /** When DB changes, load collections (aliases) for that DB. */
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

  // -----------
  // Functions
  // -----------

  /**
   * Snackbar notification helper.
   */
  const showNotification = (
    message: string,
    severity: NotificationState["severity"] = "info",
  ) => {
    setNotification({ open: true, message, severity });
    setTimeout(
      () => setNotification((prev) => ({ ...prev, open: false })),
      5000,
    );
  };

  /**
   * Fetch all permission assignments.
   */
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/solr_database_permissions");
      setPermissions(data);
      const perms = Array.from(
        new Set(
          (data as SolrDatabasePermission[]).map((item) => item.permission),
        ),
      ) as string[];
      setAvailablePermissions(perms);
    } catch (error) {
      console.error("Failed to fetch permissions:", error);
      setPermissions([]);
      showNotification("Failed to fetch permissions", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch all databases for selection.
   */
  const fetchDatabases = async () => {
    try {
      const { data } = await authAxios.get("/api/solr_databases");
      setDatabases(data);
    } catch (error) {
      console.error("Failed to fetch databases:", error);
      setDatabases([]);
      showNotification("Failed to fetch databases", "error");
    }
  };

  /**
   * Select/deselect all collections for the selected DB.
   */
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedCollections(e.target.checked ? aliases : []);
  };

  /**
   * Check if permission already exists for a collection
   */
  const permissionExists = (dbId: number, collection: string, permission: string) => {
    return permissions.some(p => 
      p.solr_database_id === dbId && 
      p.collection_name === collection && 
      p.permission.toLowerCase() === permission.toLowerCase()
    );
  };

  /**
   * Validate permission name format
   */
  const isValidPermissionName = (permission: string) => {
    // Permissions should be alphanumeric with underscores/colons
    const permissionRegex = /^[a-zA-Z0-9_:.-]+$/;
    return permissionRegex.test(permission);
  };

  /**
   * Validate permission assignment form
   */
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

  /**
   * Assign the selected permission to all chosen collections with enhanced validation.
   */
  const handleAdd = async () => {
    const validationErrors = validatePermissionForm();
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    const dbName = selectedDatabase?.name || "Unknown";
    const permissionName = newPermission.trim();
    
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
      fetchPermissions();
    } catch (error: any) {
      console.error("Failed to add permissions:", error);
      const errorMessage = error.response?.data?.message || error.message || "Unknown error occurred";
      
      if (error.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("Some permissions already exist. Please refresh and try again.", "error");
      } else if (error.response?.status === 404) {
        showNotification("Database or collection not found. Please refresh and try again.", "error");
      } else if (error.response?.status === 403) {
        showNotification("You don't have permission to assign database permissions", "error");
      } else if (error.response?.status === 400) {
        showNotification(`Invalid permission data: ${errorMessage}`, "error");
      } else {
        showNotification(`Failed to add permissions: ${errorMessage}`, "error");
      }
      fetchPermissions(); // Refresh data
    }
  };

  /**
   * Delete a permission assignment with enhanced error handling.
   */
  const handleDelete = async (
    id: number,
    collection: string,
    permission: string,
  ) => {
    const dbName = getDatabaseName(id);
    
    try {
      await authAxios.delete(
        `/api/solr_database_permissions/${id}/${encodeURIComponent(collection)}/${encodeURIComponent(permission)}`,
      );
      showNotification(`Permission "${permission}" removed from collection "${collection}" in database "${dbName}"`, "success");
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
      fetchPermissions();
    } catch (error: any) {
      console.error("Failed to delete permission:", error);
      const errorMessage = error.response?.data?.message || error.message || "Unknown error occurred";
      
      if (error.response?.status === 404) {
        showNotification("Permission assignment not found. It may have already been removed.", "error");
        fetchPermissions(); // Refresh to sync with server
      } else if (error.response?.status === 403) {
        showNotification("You don't have permission to remove this database permission", "error");
      } else if (error.response?.status === 409 || errorMessage.includes("constraint")) {
        showNotification("Cannot remove permission: it may be required for this collection", "error");
      } else {
        showNotification(`Failed to delete permission: ${errorMessage}`, "error");
      }
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
    }
  };

  /** Filter permissions by search term. */
  const filteredPermissions = permissions.filter((p) =>
    `${p.collection_name} ${p.permission}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  /** Helper: get DB name by ID. */
  const getDatabaseName = (id: number) => {
    const db = databases.find((d) => d.id === id);
    return db ? db.name : `Database ${id}`;
  };

  /** Helper: choose a Chip color for permission. */
  const getPermissionColor = (permission: string) => {
    if (permission.includes("read") || permission.includes("view"))
      return "info";
    if (permission.includes("write") || permission.includes("create"))
      return "success";
    if (permission.includes("delete") || permission.includes("remove"))
      return "error";
    if (permission.includes("admin")) return "warning";
    return "default";
  };

  // -------------------
  // DataGrid columns
  // -------------------
  const columns: GridColDef[] = [
    {
      field: "solr_database_id",
      headerName: "Database",
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Storage fontSize="small" color="primary" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {getDatabaseName(params.value)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {params.value}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: "collection_name",
      headerName: "Collection",
      width: 200,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          sx={{ fontFamily: "monospace" }}
        />
      ),
    },
    {
      field: "permission",
      headerName: "Permission",
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VpnKey fontSize="small" color="action" />
          <Chip
            label={params.value}
            color={getPermissionColor(params.value)}
            size="small"
          />
        </Box>
      ),
    },
    {
      field: "created_at",
      headerName: "Created",
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary">
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
      ),
    },
  ];

  // ------
  // Render
  // ------
  return (
    <Fade in={true} timeout={600}>
      <Box>
        {/* Snackbar notification */}
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

        {/* Header */}
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
              <Security color="primary" />
              Database Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage access permissions for Solr collections
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={fetchPermissions} color="primary">
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


        {/* Search */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by collection or permission..."
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
          </CardContent>
        </Card>

        {/* Permissions table */}
        <Paper sx={{ height: 600, borderRadius: 3, overflow: "hidden" }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <DataGrid
              rows={filteredPermissions}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 10 },
                },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              getRowId={(row) =>
                `${row.solr_database_id}-${row.collection_name}-${row.permission}`
              }
              disableRowSelectionOnClick
              checkboxSelection={false}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  outline: "none",
                  borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(255, 152, 0, 0.08)",
                  borderBottom: "2px solid rgba(255, 152, 0, 0.2)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row": {
                  transition: "background-color 0.2s ease, transform 0.1s ease",
                  "&:hover": {
                    backgroundColor: "rgba(255, 152, 0, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(255, 152, 0, 0.15)",
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

        {/* Add Permission Dialog */}
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
            <Add />
            Assign Database Permissions
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Grid container spacing={3}>
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
                        onChange={handleSelectAll}
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
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                handleAdd();
                setOpenAddDialog(false);
              }}
              disabled={
                !selectedDatabase ||
                !newPermission.trim() ||
                selectedCollections.length === 0
              }
              startIcon={<Add />}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Add Permission to {selectedCollections.length || 0} Collection
              {selectedCollections.length !== 1 ? "s" : ""}
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
            <Typography>
              Are you sure you want to delete the permission "
              {permissionToDelete?.permission}" for collection "
              {permissionToDelete?.collection_name}"? This action cannot be
              undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() =>
                permissionToDelete &&
                handleDelete(
                  permissionToDelete.solr_database_id,
                  permissionToDelete.collection_name,
                  permissionToDelete.permission,
                )
              }
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default SolrDatabasePermissions;

import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Chip,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  InputAdornment,
  Tooltip,
  IconButton,
  Grid,
  Paper,
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
  VpnKey,
  Shield,
  Refresh,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/** Role-permission mapping record */
interface RolePermission {
  role: string;
  permission: string;
  created_at: string;
}

/** Snackbar/alert notification state */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

/**
 * Returns an Axios instance with Authorization header set.
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
 * RolePermissions
 *
 * Admin UI for managing role-permission assignments.
 * - Lists all role-permission pairs.
 * - Lets admins add and remove permissions for roles.
 * - Inline search/filter.
 */
const RolePermissions: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Main data and UI state
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>(
    [],
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });

  // On mount, fetch all required data for dropdowns and grid
  useEffect(() => {
    fetchPermissions();
    fetchRoles();
    fetchAvailablePermissions();
  }, []);

  /** Show a notification/alert (auto-hides after 5s) */
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

  /** Fetch all role-permission pairs */
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/role_permissions");
      setPermissions(data);
    } catch (err) {
      console.error("Fetch role permissions failed", err);
      showNotification("Failed to fetch role permissions", "error");
    } finally {
      setLoading(false);
    }
  };

  /** Fetch all unique roles in the system */
  const fetchRoles = async () => {
    try {
      const { data } = await authAxios.get("/api/user_roles");
      const roleList = [
        ...new Set((data as { role: string }[]).map((item) => item.role)),
      ];
      setRoles(roleList);
      if (selectedRoles.length === 0 && roleList.length > 0) {
        setSelectedRoles([roleList[0]]);
      }
    } catch (err) {
      console.error("Fetch roles failed", err);
      showNotification("Failed to fetch roles", "error");
    }
  };

  /** Fetch all unique permissions in the system */
  const fetchAvailablePermissions = async () => {
    try {
      const { data } = await authAxios.get("/api/solr_database_permissions");
      const perms = [
        ...new Set(
          (data as { permission: string }[]).map((item) => item.permission),
        ),
      ];
      setAvailablePermissions(perms);
      if (selectedPermissions.length === 0 && perms.length > 0) {
        setSelectedPermissions([perms[0]]);
      }
    } catch (err) {
      console.error("Fetch permissions failed", err);
      showNotification("Failed to fetch available permissions", "error");
    }
  };

  /**
   * Check if a role-permission combination already exists
   */
  const rolePermissionExists = (role: string, permission: string) => {
    return permissions.some(p => p.role === role && p.permission === permission);
  };

  /**
   * Validate role permission assignment
   */
  const validatePermissionAssignment = () => {
    const errors: string[] = [];
    
    if (selectedRoles.length === 0) {
      errors.push("Please select at least one role");
    }
    
    if (selectedPermissions.length === 0) {
      errors.push("Please select at least one permission");
    }
    
    // Check for existing assignments
    const existingAssignments = [];
    for (const role of selectedRoles) {
      for (const permission of selectedPermissions) {
        if (rolePermissionExists(role, permission)) {
          existingAssignments.push(`Role "${role}" already has permission "${permission}"`);
        }
      }
    }
    
    if (existingAssignments.length > 0) {
      errors.push(...existingAssignments.slice(0, 3)); // Show max 3 conflicts
      if (existingAssignments.length > 3) {
        errors.push(`... and ${existingAssignments.length - 3} more conflicts`);
      }
    }
    
    return errors;
  };

  /** Assign multiple permissions to multiple roles with enhanced validation */
  const handleAdd = async () => {
    const validationErrors = validatePermissionAssignment();
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    try {
      const assignments = [];
      const newAssignments = [];
      
      for (const role of selectedRoles) {
        for (const permission of selectedPermissions) {
          if (!rolePermissionExists(role, permission)) {
            assignments.push(
              authAxios.post("/api/role_permissions", { role, permission })
            );
            newAssignments.push(`${role} → ${permission}`);
          }
        }
      }
      
      if (assignments.length === 0) {
        showNotification("All selected permission assignments already exist", "warning");
        return;
      }
      
      await Promise.all(assignments);
      setSelectedRoles([]);
      setSelectedPermissions([]);
      fetchPermissions();
      
      const successMessage = newAssignments.length === 1 ? 
        `Successfully assigned: ${newAssignments[0]}` :
        `Successfully assigned ${newAssignments.length} permission assignments`;
      
      showNotification(successMessage, "success");
    } catch (err: any) {
      console.error("Add role permissions failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("Some permission assignments already exist. Please refresh and try again.", "error");
      } else if (err.response?.status === 404) {
        showNotification("Role or permission not found. Please refresh and try again.", "error");
      } else if (err.response?.status === 403) {
        showNotification("You don't have permission to assign role permissions", "error");
      } else {
        showNotification(`Failed to assign permissions: ${errorMessage}`, "error");
      }
      fetchPermissions(); // Refresh data
    }
  };

  /** Remove a permission from a role with enhanced error handling */
  const handleDelete = async (role: string, permission: string) => {
    try {
      await authAxios.delete(
        `/api/role_permissions/${encodeURIComponent(role)}/${encodeURIComponent(permission)}`,
      );
      showNotification(`Successfully removed permission "${permission}" from role "${role}"`, "success");
      fetchPermissions();
    } catch (err: any) {
      console.error("Delete role permission failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 404) {
        showNotification("Permission assignment not found. It may have already been removed.", "error");
        fetchPermissions(); // Refresh to sync with server
      } else if (err.response?.status === 403) {
        showNotification("You don't have permission to remove this role permission", "error");
      } else if (err.response?.status === 409 || errorMessage.includes("constraint")) {
        showNotification("Cannot remove permission: it may be required for this role", "error");
      } else {
        showNotification(`Failed to remove permission: ${errorMessage}`, "error");
      }
    }
  };

  // Filter the table rows according to current search
  const filteredPermissions = permissions.filter((p) =>
    `${p.role} ${p.permission}`.toLowerCase().includes(search.toLowerCase()),
  );

  // Utility for consistent coloring of role chips
  const getRoleColor = (role: string) => {
    const colors = [
      "primary",
      "secondary",
      "success",
      "warning",
      "error",
      "info",
    ];
    const index = role.length % colors.length;
    return colors[index] as any;
  };

  // Utility for consistent coloring of permission chips
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

  // Table columns for the DataGrid
  const columns: GridColDef[] = [
    {
      field: "role",
      headerName: "Role",
      width: 200,
      renderCell: (params) => (
        <Chip
          icon={<Shield />}
          label={params.value}
          color={getRoleColor(params.value)}
          size="small"
          sx={{ fontWeight: 600 }}
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
            variant="outlined"
            size="small"
          />
        </Box>
      ),
    },
    {
      field: "created_at",
      headerName: "Created Date",
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
        <Tooltip title="Remove Permission">
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDelete(params.row.role, params.row.permission)}
          >
            <Delete />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Fade in={true} timeout={600}>
      <Box>
        {/* Inline notification (alert) */}
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

        {/* Page Header */}
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
              Role Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure permissions for each role in the system
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
              Assign Permissions
            </Button>
          </Stack>
        </Box>


        {/* Search field */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by role or permission..."
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

        {/* Permissions grid */}
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
              getRowId={(row) => `${row.role}-${row.permission}`}
              disableRowSelectionOnClick
              checkboxSelection={false}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  outline: "none",
                  borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(156, 39, 176, 0.08)",
                  borderBottom: "2px solid rgba(156, 39, 176, 0.2)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row": {
                  transition: "background-color 0.2s ease, transform 0.1s ease",
                  "&:hover": {
                    backgroundColor: "rgba(156, 39, 176, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(156, 39, 176, 0.15)",
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

        {/* Assign Permissions Dialog */}
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
            Assign Permissions to Roles
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={roles}
                  value={selectedRoles}
                  onChange={(_, newValue) => {
                    setSelectedRoles(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Roles"
                      placeholder="Choose roles..."
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((role, index) => (
                      <Chip
                        variant="outlined"
                        label={role}
                        size="small"
                        color={getRoleColor(role)}
                        icon={<Shield fontSize="small" />}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderOption={(props, role) => (
                    <Box component="li" {...props}>
                      <Shield fontSize="small" sx={{ mr: 1 }} />
                      {role}
                    </Box>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={availablePermissions}
                  value={selectedPermissions}
                  onChange={(_, newValue) => {
                    setSelectedPermissions(newValue.filter(v => typeof v === 'string'));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Permissions"
                      placeholder="Choose or type permissions..."
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((permission, index) => (
                      <Chip
                        variant="outlined"
                        label={permission}
                        size="small"
                        color={getPermissionColor(permission)}
                        icon={<VpnKey fontSize="small" />}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderOption={(props, permission) => (
                    <Box component="li" {...props}>
                      <VpnKey fontSize="small" sx={{ mr: 1 }} />
                      {permission}
                    </Box>
                  )}
                />
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
              disabled={selectedRoles.length === 0 || selectedPermissions.length === 0}
              startIcon={<Add />}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Assign {selectedPermissions.length} Permission{selectedPermissions.length !== 1 ? 's' : ''} to {selectedRoles.length} Role{selectedRoles.length !== 1 ? 's' : ''}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default RolePermissions;

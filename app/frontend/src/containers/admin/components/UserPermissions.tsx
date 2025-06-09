import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
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
  Chip,
  Avatar,
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
  Person,
  VpnKey,
  Refresh,
  Email,
} from "@mui/icons-material";
import Autocomplete from "@mui/material/Autocomplete";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/**
 * User-permission assignment record.
 */
interface UserPermission {
  user_id: number;
  permission: string;
  created_at: string;
}

/**
 * Minimal user profile for permission assignment.
 */
interface User {
  id: number;
  email: string;
  firstname?: string;
  lastname?: string;
}

/**
 * Notification state for feedback banners.
 */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
}

/**
 * Axios instance factory with automatic Authorization header from useAuth.
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
 * User permission management panel.
 * Lists, assigns, and removes user-permission links.
 */
const UserPermissions: React.FC = () => {
  const authAxios = useAuthAxios();

  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>(
    [],
  );
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [permissionToDelete, setPermissionToDelete] =
    useState<UserPermission | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    fetchPermissions();
    fetchUsers();
  }, []);

  /**
   * Utility to show a feedback message.
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
   * Loads user-permission assignments from the API.
   */
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/user_permissions");
      const valid = data.filter(
        (item: UserPermission) => item.user_id !== undefined && item.permission,
      );
      setPermissions(valid);
      const perms = Array.from(
        new Set(valid.map((item: UserPermission) => item.permission)),
      ).filter((p): p is string => typeof p === "string");
      setAvailablePermissions(perms);
    } catch (err) {
      console.error("Fetch permissions failed:", err);
      setPermissions([]);
      showNotification("Failed to fetch permissions", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Loads user list from the API.
   */
  const fetchUsers = async () => {
    try {
      const { data } = await authAxios.get("/api/users");
      setUsers(data);
    } catch (err) {
      console.error("Fetch users failed:", err);
      setUsers([]);
      showNotification("Failed to fetch users", "error");
    }
  };

  /**
   * Adds multiple permissions to multiple users via API.
   */
  const handleAdd = async () => {
    if (selectedUsers.length === 0 || selectedPermissions.length === 0) {
      showNotification("At least one user and one permission must be selected", "warning");
      return;
    }
    try {
      const assignments = [];
      for (const userId of selectedUsers) {
        for (const permission of selectedPermissions) {
          assignments.push(
            authAxios.post("/api/user_permissions", { user_id: userId, permission })
          );
        }
      }
      await Promise.all(assignments);
      setSelectedUsers([]);
      setSelectedPermissions([]);
      fetchPermissions();
      showNotification(
        `Successfully assigned ${selectedPermissions.length} permission(s) to ${selectedUsers.length} user(s)`,
        "success"
      );
    } catch (err) {
      console.error("Add permissions failed:", err);
      showNotification("Failed to add permissions", "error");
    }
  };

  /**
   * Deletes a user-permission link.
   */
  const handleDelete = async (userId: number, permission: string) => {
    try {
      await authAxios.delete(
        `/api/user_permissions/${userId}/${encodeURIComponent(permission)}`,
      );
      fetchPermissions();
      setOpenDeleteDialog(false);
      setPermissionToDelete(null);
      showNotification("Permission deleted successfully", "success");
    } catch (err) {
      console.error("Delete permission failed:", err);
      showNotification("Failed to delete permission", "error");
    }
  };

  /**
   * Formats a user's display name for grid or dialog use.
   */
  const getUserDisplayName = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return `User ${userId}`;
    const fullName = `${user.firstname || ""} ${user.lastname || ""}`.trim();
    return fullName || user.email;
  };

  /**
   * Generates avatar initials for a user.
   */
  const getUserInitials = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return "?";
    if (user.firstname && user.lastname) {
      return `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`;
    }
    return user.email.charAt(0).toUpperCase();
  };

  /**
   * Chooses a MUI color for a permission string.
   */
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

  const filteredPermissions = permissions.filter((p) => {
    const user = users.find((u) => u.id === p.user_id);
    const searchTerm = search.toLowerCase();
    return (
      user?.email.toLowerCase().includes(searchTerm) ||
      user?.firstname?.toLowerCase().includes(searchTerm) ||
      user?.lastname?.toLowerCase().includes(searchTerm) ||
      p.permission.toLowerCase().includes(searchTerm)
    );
  });

  const columns: GridColDef[] = [
    {
      field: "avatar",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Avatar sx={{ bgcolor: "primary.main" }}>
          {getUserInitials(params.row.user_id)}
        </Avatar>
      ),
    },
    {
      field: "user_id",
      headerName: "User ID",
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "user_name",
      headerName: "User",
      width: 250,
      renderCell: (params) => {
        const user = users.find((u) => u.id === params.row.user_id);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Person fontSize="small" color="action" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {getUserDisplayName(params.row.user_id)}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <Email fontSize="inherit" />
                {user?.email}
              </Typography>
            </Box>
          </Box>
        );
      },
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
              User Permissions
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Assign and manage individual user permissions
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


        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by user name, email, or permission..."
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
                  page: 0,
                  pageSize: 10,
                },
              }}
              pageSize={10}
              getRowId={(row) => `${row.user_id}-${row.permission}`}
              disableSelectionOnClick
              checkboxSelection={false}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  outline: "none",
                  borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(33, 150, 243, 0.08)",
                  borderBottom: "2px solid rgba(33, 150, 243, 0.2)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row": {
                  transition: "background-color 0.2s ease, transform 0.1s ease",
                  "&:hover": {
                    backgroundColor: "rgba(33, 150, 243, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(33, 150, 243, 0.15)",
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
              Are you sure you want to remove the permission "
              {permissionToDelete?.permission}" from user{" "}
              {permissionToDelete &&
                getUserDisplayName(permissionToDelete.user_id)}
              ? This action cannot be undone.
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
                  permissionToDelete.user_id,
                  permissionToDelete.permission,
                )
              }
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

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
            Assign Permissions to Users
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(user) => 
                    `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email
                  }
                  value={users.filter(user => selectedUsers.includes(user.id))}
                  onChange={(_, newValue) => {
                    setSelectedUsers(newValue.map(user => user.id));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Users"
                      placeholder="Choose users..."
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((user, index) => (
                      <Chip
                        variant="outlined"
                        label={`${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email}
                        size="small"
                        avatar={
                          <Avatar sx={{ width: 20, height: 20, fontSize: "0.7rem" }}>
                            {user.firstname?.charAt(0) || user.email.charAt(0)}
                          </Avatar>
                        }
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderOption={(props, user) => (
                    <Box component="li" {...props}>
                      <Avatar
                        sx={{ width: 24, height: 24, fontSize: "0.75rem", mr: 1 }}
                      >
                        {user.firstname?.charAt(0) || user.email.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {`${user.firstname || ""} ${user.lastname || ""}`.trim() || user.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email} (ID: {user.id})
                        </Typography>
                      </Box>
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
              disabled={selectedUsers.length === 0 || selectedPermissions.length === 0}
              startIcon={<Add />}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Assign {selectedPermissions.length} Permission{selectedPermissions.length !== 1 ? 's' : ''} to {selectedUsers.length} User{selectedUsers.length !== 1 ? 's' : ''}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default UserPermissions;

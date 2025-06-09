import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Paper,
  TextField,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Alert,
  useTheme,
  useMediaQuery,
  Fade,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import {
  Add,
  Edit,
  Delete,
  PersonAdd,
  Search,
  Email,
  Badge,
  CheckCircle,
  Cancel,
  People,
  Refresh,
} from "@mui/icons-material";
import axios, { AxiosHeaders } from "axios";
import { useAuth } from "../../../hooks/useAuth";

/**
 * Represents a user account in the system.
 */
interface User {
  id: number;
  email: string;
  hash_password: string;
  activated: boolean;
  firstname: string;
  lastname: string;
  created_at: string;
  updated_at: string;
}

/**
 * Notification banner state.
 */
interface NotificationState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "warning" | "info";
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
 * Main component for managing users. Provides CRUD operations for user accounts.
 */
const Users: React.FC = () => {
  const authAxios = useAuthAxios();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<Partial<User>>({});
  const [search, setSearch] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: "",
    severity: "info",
  });

  /**
   * Fetch users on component mount.
   */
  useEffect(() => {
    fetchUsers();
  }, []);

  /**
   * Loads all users from the API.
   */
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await authAxios.get("/api/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch users failed:", err);
      showNotification("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Show a temporary notification banner.
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
   * Validate email format
   */
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Check if user already exists
   */
  const userExists = (email: string, excludeId?: number) => {
    return users.some(user => 
      user.email.toLowerCase() === email.toLowerCase() && 
      user.id !== excludeId
    );
  };

  /**
   * Validate user form data
   */
  const validateUserForm = (userData: Partial<User>, isEdit = false) => {
    const errors: string[] = [];
    
    if (!userData.email?.trim()) {
      errors.push("Email is required");
    } else if (!isValidEmail(userData.email)) {
      errors.push("Please enter a valid email address");
    } else if (userExists(userData.email, isEdit ? editingUserId || undefined : undefined)) {
      errors.push("A user with this email already exists");
    }
    
    if (!userData.firstname?.trim()) {
      errors.push("First name is required");
    }
    
    if (!userData.lastname?.trim()) {
      errors.push("Last name is required");
    }
    
    if (!isEdit && !userData.hash_password?.trim()) {
      errors.push("Password is required");
    } else if (!isEdit && userData.hash_password && userData.hash_password.length < 6) {
      errors.push("Password must be at least 6 characters long");
    }
    
    return errors;
  };

  /**
   * Add a new user with enhanced validation.
   */
  const handleAdd = async () => {
    const validationErrors = validateUserForm(newUser);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    try {
      await authAxios.post("/api/users", newUser);
      setNewUser({});
      setOpenAddDialog(false);
      fetchUsers();
      showNotification(`User "${newUser.firstname} ${newUser.lastname}" added successfully`, "success");
    } catch (err: any) {
      console.error("Add user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("A user with this email already exists", "error");
      } else if (err.response?.status === 400) {
        showNotification(`Invalid user data: ${errorMessage}`, "error");
      } else if (err.response?.status === 422) {
        showNotification("Please check your input and try again", "error");
      } else {
        showNotification(`Failed to add user: ${errorMessage}`, "error");
      }
    }
  };

  /**
   * Update an existing user by id with enhanced validation.
   */
  const handleUpdate = async (id: number) => {
    const validationErrors = validateUserForm(editingUser, true);
    
    if (validationErrors.length > 0) {
      showNotification(validationErrors[0], "warning");
      return;
    }
    
    try {
      await authAxios.put(`/api/users/${id}`, editingUser);
      const userName = `${editingUser.firstname} ${editingUser.lastname}`.trim() || editingUser.email;
      setEditingUserId(null);
      setEditingUser({});
      fetchUsers();
      showNotification(`User "${userName}" updated successfully`, "success");
    } catch (err: any) {
      console.error("Update user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 409 || errorMessage.includes("already exists")) {
        showNotification("A user with this email already exists", "error");
      } else if (err.response?.status === 404) {
        showNotification("User not found. Please refresh and try again", "error");
        fetchUsers();
      } else if (err.response?.status === 400) {
        showNotification(`Invalid user data: ${errorMessage}`, "error");
      } else {
        showNotification(`Failed to update user: ${errorMessage}`, "error");
      }
    }
  };

  /**
   * Delete a user by id with enhanced error handling.
   */
  const handleDelete = async (id: number) => {
    const userToDeleteName = userToDelete ? 
      `${userToDelete.firstname} ${userToDelete.lastname}`.trim() || userToDelete.email : 
      `User ${id}`;
    
    try {
      await authAxios.delete(`/api/users/${id}`);
      fetchUsers();
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      showNotification(`User "${userToDeleteName}" deleted successfully`, "success");
    } catch (err: any) {
      console.error("Delete user failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Unknown error occurred";
      
      if (err.response?.status === 404) {
        showNotification("User not found. It may have already been deleted", "error");
        fetchUsers();
      } else if (err.response?.status === 409 || errorMessage.includes("constraint")) {
        showNotification("Cannot delete user: user has associated data (roles, permissions, etc.)", "error");
      } else if (err.response?.status === 403) {
        showNotification("You don't have permission to delete this user", "error");
      } else {
        showNotification(`Failed to delete user: ${errorMessage}`, "error");
      }
      setOpenDeleteDialog(false);
      setUserToDelete(null);
    }
  };

  /**
   * Open the dialog to confirm user deletion.
   */
  const handleDeleteDialogOpen = (user: User) => {
    setUserToDelete(user);
    setOpenDeleteDialog(true);
  };

  /**
   * Open the edit dialog for a specific user.
   */
  const handleEditOpen = (user: User) => {
    setEditingUserId(user.id);
    setEditingUser({
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      activated: user.activated,
    });
  };

  /**
   * Close the edit dialog.
   */
  const handleEditClose = () => {
    setEditingUserId(null);
    setEditingUser({});
  };

  const filteredUsers = users.filter((u) =>
    `${u.firstname} ${u.lastname} ${u.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  /**
   * Table columns for user data.
   */
  const columns: GridColDef[] = [
    {
      field: "avatar",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Avatar
          sx={{ bgcolor: params.row.activated ? "success.main" : "error.main" }}
        >
          {params.row.firstname?.charAt(0) ||
            params.row.email?.charAt(0) ||
            "?"}
        </Avatar>
      ),
    },
    {
      field: "id",
      headerName: "ID",
      width: 70,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: "firstname",
      headerName: "First Name",
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "lastname",
      headerName: "Last Name",
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {params.value || "-"}
        </Typography>
      ),
    },
    {
      field: "email",
      headerName: "Email",
      width: 250,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Email fontSize="small" color="action" />
          <Typography variant="body2">{params.value}</Typography>
        </Box>
      ),
    },
    {
      field: "activated",
      headerName: "Status",
      width: 130,
      renderCell: (params) => (
        <Chip
          icon={params.value ? <CheckCircle /> : <Cancel />}
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "error"}
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Edit User">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleEditOpen(params.row)}
            >
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteDialogOpen(params.row)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Stack>
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
              <People color="primary" />
              User Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage system users and their account settings
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Users">
              <IconButton onClick={fetchUsers} color="primary">
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
              }}
            >
              Add User
            </Button>
          </Stack>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search users by name or email..."
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
              rows={filteredUsers}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 10 },
                },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              getRowId={(row) => row.id}
              disableRowSelectionOnClick
              checkboxSelection={false}
              sx={{
                border: "none",
                "& .MuiDataGrid-cell": {
                  outline: "none",
                  borderBottom: "1px solid rgba(224, 224, 224, 0.4)",
                },
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "rgba(102, 126, 234, 0.08)",
                  borderBottom: "2px solid rgba(102, 126, 234, 0.2)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                },
                "& .MuiDataGrid-row": {
                  transition: "background-color 0.2s ease, transform 0.1s ease",
                  "&:hover": {
                    backgroundColor: "rgba(102, 126, 234, 0.08)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.15)",
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
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonAdd />
            Add New User
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={newUser.firstname || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, firstname: e.target.value })
                  }
                  fullWidth
                  required
                  error={!newUser.firstname?.trim()}
                  helperText={!newUser.firstname?.trim() ? "First name is required" : ""}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={newUser.lastname || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, lastname: e.target.value })
                  }
                  fullWidth
                  required
                  error={!newUser.lastname?.trim()}
                  helperText={!newUser.lastname?.trim() ? "Last name is required" : ""}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  type="email"
                  value={newUser.email || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  fullWidth
                  required
                  error={newUser.email ? (!isValidEmail(newUser.email) || userExists(newUser.email)) : false}
                  helperText={
                    !newUser.email?.trim() ? "Email is required" :
                    !isValidEmail(newUser.email) ? "Please enter a valid email address" :
                    userExists(newUser.email) ? "A user with this email already exists" : ""
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Password"
                  type="password"
                  value={newUser.hash_password || ""}
                  onChange={(e) =>
                    setNewUser({ ...newUser, hash_password: e.target.value })
                  }
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newUser.activated || false}
                      onChange={(e) =>
                        setNewUser({ ...newUser, activated: e.target.checked })
                      }
                    />
                  }
                  label="Account Activated"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleAdd}
              disabled={
                !newUser.email ||
                !newUser.firstname ||
                !newUser.lastname ||
                !newUser.hash_password
              }
            >
              Add User
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={editingUserId !== null}
          onClose={handleEditClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Edit />
            Edit User
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={editingUser.firstname || ""}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      firstname: e.target.value,
                    })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={editingUser.lastname || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, lastname: e.target.value })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email"
                  value={editingUser.email || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="New Password (leave empty to keep current)"
                  type="password"
                  value={editingUser.hash_password || ""}
                  onChange={(e) =>
                    setEditingUser({
                      ...editingUser,
                      hash_password: e.target.value,
                    })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={editingUser.activated || false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          activated: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Account Activated"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={handleEditClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => editingUserId && handleUpdate(editingUserId)}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
        >
          <DialogTitle sx={{ color: "error.main" }}>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete user "{userToDelete?.email}"? This
              action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => userToDelete && handleDelete(userToDelete.id)}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default Users;

import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Fade,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  Settings,
  Security,
  VpnKey,
  CheckCircle,
  Info,
  Group,
  Shield,
} from "@mui/icons-material";

/**
 * Displays user roles, permissions, and inferred capabilities based on the current authentication session.
 * Provides a breakdown of access, a capabilities list, and a security summary.
 *
 * @param auth - Auth context with session info
 */
export const Permissions = ({ auth }: { auth: any }) => {
  /**
   * Returns the list of roles from the current session.
   */
  const getUserRoles = () => {
    return auth.session?.roles || [];
  };

  /**
   * Returns the list of permissions from the current session.
   */
  const getUserPermissions = () => {
    return auth.session?.permissions || [];
  };

  /**
   * Derives user capabilities based on assigned roles and permissions.
   * Returns a human-readable set of capabilities.
   */
  const getCapabilities = () => {
    const roles = getUserRoles();
    const permissions = getUserPermissions();
    const capabilities = [];
    if (roles.includes("Admin")) {
      capabilities.push(
        "Full system access",
        "User management",
        "Database administration",
      );
    }
    if (permissions.includes("read")) {
      capabilities.push("View content", "Search data");
    }
    if (permissions.includes("write")) {
      capabilities.push("Create content", "Edit data");
    }
    if (permissions.includes("delete")) {
      capabilities.push("Delete content");
    }
    return capabilities.length > 0 ? capabilities : ["Standard user access"];
  };

  return (
    <Box sx={{ p: 4 }}>
      <Fade in={true} timeout={600}>
        <Box>
          {/* Header Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Permissions & Roles
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View your account permissions and access levels
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {/* Roles Section */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <Group sx={{ mr: 2, color: "primary.main" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Your Roles
                    </Typography>
                  </Box>
                  {getUserRoles().length > 0 ? (
                    <Stack spacing={2}>
                      {getUserRoles().map((role: string, index: number) => (
                        <Box key={index}>
                          <Chip
                            icon={<Shield />}
                            label={role}
                            color="primary"
                            size="medium"
                            sx={{ fontWeight: 500 }}
                          />
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            {role === "Admin" &&
                              "Full administrative access to the system"}
                            {role === "User" &&
                              "Standard user access with basic permissions"}
                            {role === "Editor" &&
                              "Content editing and management capabilities"}
                            {role === "Viewer" && "Read-only access to content"}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">
                      No specific roles assigned. You have standard user access.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Permissions Section */}
            <Grid item xs={12} md={6}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <VpnKey sx={{ mr: 2, color: "secondary.main" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Your Permissions
                    </Typography>
                  </Box>
                  {getUserPermissions().length > 0 ? (
                    <Stack spacing={1}>
                      {getUserPermissions().map(
                        (permission: string, index: number) => (
                          <Chip
                            key={index}
                            icon={<CheckCircle />}
                            label={permission}
                            color="secondary"
                            variant="outlined"
                            size="small"
                          />
                        ),
                      )}
                    </Stack>
                  ) : (
                    <Alert severity="info">
                      No specific permissions assigned. Contact an administrator
                      for access.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Capabilities Section */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <Security sx={{ mr: 2, color: "success.main" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      What You Can Do
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    Based on your roles and permissions, here's what you can
                    access:
                  </Typography>
                  <List>
                    {getCapabilities().map((capability, index) => (
                      <ListItem key={index} sx={{ py: 1 }}>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary={capability} />
                      </ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 3 }} />
                  <Alert severity="info" icon={<Info />}>
                    <Typography variant="body2">
                      Need additional permissions? Contact your system
                      administrator to request access to specific features or
                      data.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>

            {/* Security Summary */}
            <Grid item xs={12}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <Settings sx={{ mr: 2, color: "warning.main" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Account Security Summary
                    </Typography>
                  </Box>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography
                          variant="h4"
                          color="primary"
                          sx={{ fontWeight: 700 }}
                        >
                          {getUserRoles().length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Roles
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography
                          variant="h4"
                          color="secondary"
                          sx={{ fontWeight: 700 }}
                        >
                          {getUserPermissions().length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Permissions
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Box sx={{ textAlign: "center" }}>
                        <Typography
                          variant="h4"
                          color="success.main"
                          sx={{ fontWeight: 700 }}
                        >
                          {getCapabilities().length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Capabilities
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 3 }}>
                    <Chip
                      icon={<CheckCircle />}
                      label="Account Active"
                      color="success"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      icon={<Security />}
                      label="Secure Access"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Box>
  );
};

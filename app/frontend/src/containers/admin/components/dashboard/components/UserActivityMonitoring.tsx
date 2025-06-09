import React, { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Collapse,
  LinearProgress,
  Alert,
  Stack,
  Grid,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
} from "@mui/material";
import {
  Security,
  ExpandMore,
  ExpandLess,
  Person,
  PersonAdd,
  Warning,
  Shield,
  Schedule,
  Computer,
  VpnKey,
  Error as ErrorIcon,
  CheckCircle,
  AccountCircle,
} from "@mui/icons-material";
import { UserActivity } from "../types";
import { formatNumber } from "../utils/formatters";

/**
 * Props for UserActivityMonitoring component.
 * - `userActivity`: Activity and security information to display.
 * - `loading`: True if data is loading.
 * - `onToggle`: Callback to toggle visibility.
 * - `isVisible`: Current expanded/collapsed state.
 */
interface UserActivityMonitoringProps {
  userActivity: UserActivity | null;
  loading: boolean;
  onToggle: () => void;
  isVisible: boolean;
}

/**
 * Displays real-time user session, login, registration, and security event stats.
 * Allows toggling visibility and handles loading/error states.
 */
export const UserActivityMonitoring: React.FC<UserActivityMonitoringProps> = ({
  userActivity,
  loading,
  onToggle,
  isVisible,
}) => {
  /**
   * Returns an icon for each security event type.
   */
  const getSecurityEventIcon = (eventType: string) => {
    switch (eventType) {
      case "password_change":
        return <VpnKey color="success" />;
      case "password_reset":
        return <VpnKey color="warning" />;
      case "account_activation":
        return <CheckCircle color="success" />;
      case "failed_login":
        return <ErrorIcon color="error" />;
      case "suspicious_activity":
        return <Warning color="error" />;
      default:
        return <Shield color="info" />;
    }
  };

  /**
   * Maps severity string to a color name.
   */
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "success";
      default:
        return "default";
    }
  };

  /**
   * Formats a timestamp as "just now", "5m ago", etc.
   */
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  /**
   * Generates initials from first and last name.
   */
  const getUserInitials = (firstname: string, lastname: string) => {
    return `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase();
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Security />
            User Activity & Security Monitoring
          </Typography>
          <Button
            variant="outlined"
            onClick={onToggle}
            endIcon={isVisible ? <ExpandLess /> : <ExpandMore />}
            size="small"
          >
            {isVisible ? "Hide Activity" : "Show Activity"}
          </Button>
        </Box>

        <Collapse in={isVisible}>
          {loading ? (
            <LinearProgress sx={{ my: 2 }} />
          ) : !userActivity ? (
            <Alert severity="info">No user activity data available</Alert>
          ) : (
            <Stack spacing={4}>
              {/* Session Statistics Overview */}
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Session Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: "center",
                        bgcolor: "success.light",
                        color: "success.contrastText",
                      }}
                    >
                      <Typography variant="h6">
                        {formatNumber(
                          userActivity.session_statistics.total_active_sessions,
                        )}
                      </Typography>
                      <Typography variant="body2">Active Sessions</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: "center",
                        bgcolor: "primary.light",
                        color: "primary.contrastText",
                      }}
                    >
                      <Typography variant="h6">
                        {formatNumber(
                          userActivity.session_statistics.sessions_last_24h,
                        )}
                      </Typography>
                      <Typography variant="body2">Sessions (24h)</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: "center",
                        bgcolor: "info.light",
                        color: "info.contrastText",
                      }}
                    >
                      <Typography variant="h6">
                        {formatNumber(
                          userActivity.session_statistics.sessions_last_week,
                        )}
                      </Typography>
                      <Typography variant="body2">Sessions (7d)</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: "center",
                        bgcolor: "secondary.light",
                        color: "secondary.contrastText",
                      }}
                    >
                      <Typography variant="h6">
                        {formatNumber(
                          userActivity.session_statistics.unique_users_24h,
                        )}
                      </Typography>
                      <Typography variant="body2">
                        Unique Users (24h)
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Paper
                      sx={{
                        p: 2,
                        textAlign: "center",
                        bgcolor: "warning.light",
                        color: "warning.contrastText",
                      }}
                    >
                      <Typography variant="h6">
                        {userActivity.session_statistics.average_session_duration_minutes.toFixed(
                          0,
                        )}
                        m
                      </Typography>
                      <Typography variant="body2">Avg Session</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              <Grid container spacing={3}>
                {/* Recent Logins */}
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography
                      variant="h6"
                      gutterBottom
                      sx={{
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Person />
                      Recent Logins (24h)
                    </Typography>
                    <Paper sx={{ maxHeight: 400, overflow: "auto" }}>
                      <List dense>
                        {userActivity.recent_logins
                          .slice(0, 10)
                          .map((login, index) => (
                            <ListItem key={index} divider>
                              <ListItemAvatar>
                                <Avatar sx={{ bgcolor: "primary.main" }}>
                                  {getUserInitials(
                                    login.firstname,
                                    login.lastname,
                                  )}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={`${login.firstname} ${login.lastname}`}
                                secondary={
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ mt: 0.5 }}
                                  >
                                    <Typography variant="caption">
                                      {login.email}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={formatTimeAgo(login.login_time)}
                                    />
                                    {login.device && (
                                      <Chip
                                        size="small"
                                        icon={<Computer />}
                                        label={login.device}
                                        variant="outlined"
                                      />
                                    )}
                                  </Stack>
                                }
                              />
                            </ListItem>
                          ))}
                        {userActivity.recent_logins.length === 0 && (
                          <ListItem>
                            <ListItemText primary="No recent logins" />
                          </ListItem>
                        )}
                      </List>
                    </Paper>
                  </Box>
                </Grid>

                {/* Recent Registrations */}
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography
                      variant="h6"
                      gutterBottom
                      sx={{
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <PersonAdd />
                      Recent Registrations (7d)
                    </Typography>
                    <Paper sx={{ maxHeight: 400, overflow: "auto" }}>
                      <List dense>
                        {userActivity.user_registrations.map(
                          (registration, index) => (
                            <ListItem key={index} divider>
                              <ListItemAvatar>
                                <Avatar
                                  sx={{
                                    bgcolor: registration.activated
                                      ? "success.main"
                                      : "warning.main",
                                  }}
                                >
                                  {getUserInitials(
                                    registration.firstname,
                                    registration.lastname,
                                  )}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={`${registration.firstname} ${registration.lastname}`}
                                secondary={
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ mt: 0.5 }}
                                  >
                                    <Typography variant="caption">
                                      {registration.email}
                                    </Typography>
                                    <Chip
                                      size="small"
                                      label={
                                        registration.activated
                                          ? "Activated"
                                          : "Pending"
                                      }
                                      color={
                                        registration.activated
                                          ? "success"
                                          : "warning"
                                      }
                                    />
                                    <Chip
                                      size="small"
                                      label={formatTimeAgo(
                                        registration.registration_time,
                                      )}
                                    />
                                  </Stack>
                                }
                              />
                            </ListItem>
                          ),
                        )}
                        {userActivity.user_registrations.length === 0 && (
                          <ListItem>
                            <ListItemText primary="No recent registrations" />
                          </ListItem>
                        )}
                      </List>
                    </Paper>
                  </Box>
                </Grid>
              </Grid>

              {/* Security Events */}
              <Box>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Shield />
                  Security Events
                </Typography>
                <Paper>
                  <List>
                    {userActivity.security_events.map((event, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          {getSecurityEventIcon(event.event_type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={event.description}
                          secondary={
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ mt: 0.5 }}
                            >
                              {event.user_email && (
                                <Typography variant="caption">
                                  {event.user_email}
                                </Typography>
                              )}
                              <Chip
                                size="small"
                                label={event.severity.toUpperCase()}
                                color={getSeverityColor(event.severity) as any}
                              />
                              <Chip
                                size="small"
                                label={formatTimeAgo(event.timestamp)}
                              />
                              {event.ip_address && (
                                <Chip
                                  size="small"
                                  label={event.ip_address}
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                    {userActivity.security_events.length === 0 && (
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary="No security events to report" />
                      </ListItem>
                    )}
                  </List>
                </Paper>
              </Box>

              {/* Failed Login Attempts */}
              {userActivity.failed_login_attempts.length > 0 && (
                <Box>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{
                      fontWeight: 600,
                      color: "error.main",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Warning />
                    Failed Login Attempts
                  </Typography>
                  <Paper>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Email</TableCell>
                          <TableCell>Time</TableCell>
                          <TableCell>IP Address</TableCell>
                          <TableCell>Reason</TableCell>
                          <TableCell align="right">Count</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {userActivity.failed_login_attempts.map(
                          (attempt, index) => (
                            <TableRow key={index}>
                              <TableCell>{attempt.email}</TableCell>
                              <TableCell>
                                {formatTimeAgo(attempt.attempt_time)}
                              </TableCell>
                              <TableCell>
                                {attempt.ip_address || "N/A"}
                              </TableCell>
                              <TableCell>{attempt.reason}</TableCell>
                              <TableCell align="right">
                                <Chip
                                  size="small"
                                  label={attempt.count}
                                  color="error"
                                />
                              </TableCell>
                            </TableRow>
                          ),
                        )}
                      </TableBody>
                    </Table>
                  </Paper>
                </Box>
              )}

              <Typography
                variant="caption"
                display="block"
                sx={{ textAlign: "center", color: "text.secondary" }}
              >
                Last updated:{" "}
                {new Date(userActivity.last_updated).toLocaleString()}
              </Typography>
            </Stack>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

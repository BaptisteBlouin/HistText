import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useQueryParam } from "../hooks/useQueryParam";
import {
  Container,
  TextField,
  Button,
  Typography,
  Link,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Stack,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Lock,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Cancel,
  Login as LoginIcon,
  LockReset,
  Security,
} from "@mui/icons-material";

export const ResetPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const resetToken = useQueryParam("token");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] =
    useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const calculatePasswordStrength = useCallback((password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  }, []);

  const handlePasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordStrength(calculatePasswordStrength(value));
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 25) return "error";
    if (strength < 50) return "warning";
    if (strength < 75) return "info";
    return "success";
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 25) return "Very Weak";
    if (strength < 50) return "Weak";
    if (strength < 75) return "Good";
    return "Strong";
  };

  const validatePassword = (password: string): boolean => {
    const re =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^])[A-Za-z\d@$!%*?&#^]{8,}$/;
    return re.test(password);
  };

  const reset = async () => {
    setError(null);

    if (!resetToken) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    if (!newPassword.trim()) {
      setError("Please enter a new password");
      return;
    }

    if (!validatePassword(newPassword)) {
      setError(
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (newPassword !== newPasswordConfirmation) {
      setError("Passwords do not match");
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);
        setSuccess(true);
        setNewPassword("");
        setNewPasswordConfirmation("");
        // Redirect after showing success message
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } else {
        const data = await response.json();
        setError(
          data.message ||
            "Invalid or expired reset token. Please request a new password reset.",
        );
      }
    } catch (error) {
      console.error("Password reset failed:", error);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reset();
  };

  // Only redirect if authenticated and no errors and not processing
  if (auth.isAuthenticated && !error && !processing) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Alert severity="info">
          Already logged in. Redirecting you to the home page...
        </Alert>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              background: "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
              color: "white",
              p: 4,
              textAlign: "center",
            }}
          >
            <CheckCircle sx={{ fontSize: 64, mb: 2 }} />
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              Password Reset Complete!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Your password has been successfully changed
            </Typography>
          </Box>

          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Your password has been updated successfully. You can now sign in
                with your new password.
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You will be redirected to the login page in a few seconds...
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate("/login")}
              startIcon={<LoginIcon />}
              sx={{
                py: 1.5,
                background: "linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
                },
              }}
            >
              Continue to Sign In
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (!resetToken) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Card
          sx={{
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              background: "linear-gradient(135deg, #f44336 0%, #d32f2f 100%)",
              color: "white",
              p: 4,
              textAlign: "center",
            }}
          >
            <Cancel sx={{ fontSize: 48, mb: 2 }} />
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 600 }}
            >
              Invalid Reset Link
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              This password reset link is invalid or has expired
            </Typography>
          </Box>

          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body2">
                The password reset link you clicked is invalid or has expired.
                Please request a new password reset.
              </Typography>
            </Alert>

            <Stack spacing={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate("/recovery")}
                startIcon={<LockReset />}
                sx={{
                  py: 1.5,
                  background:
                    "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)",
                  },
                }}
              >
                Request New Reset Link
              </Button>

              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate("/login")}
                startIcon={<LoginIcon />}
              >
                Back to Sign In
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const passwordRequirements = [
    { text: "At least 8 characters", met: newPassword.length >= 8 },
    { text: "Contains uppercase letter", met: /[A-Z]/.test(newPassword) },
    { text: "Contains number", met: /[0-9]/.test(newPassword) },
    {
      text: "Contains special character",
      met: /[^A-Za-z0-9]/.test(newPassword),
    },
  ];

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Box
        sx={{
          display: "flex",
          gap: 4,
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        {/* Main Form */}
        <Box sx={{ flex: 1 }}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                background: "linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)",
                color: "white",
                p: 4,
                textAlign: "center",
              }}
            >
              <LockReset sx={{ fontSize: 48, mb: 2 }} />
              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                Reset Password
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9 }}>
                Create a new secure password for your account
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="New Password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                  placeholder="Enter your new password"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {newPassword && (
                  <Box sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2">
                        Password Strength:
                      </Typography>
                      <Typography
                        variant="body2"
                        color={`${getPasswordStrengthColor(passwordStrength)}.main`}
                        sx={{ fontWeight: 600 }}
                      >
                        {getPasswordStrengthText(passwordStrength)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={passwordStrength}
                      color={getPasswordStrengthColor(passwordStrength)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                )}

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={newPasswordConfirmation}
                  onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                  required
                  sx={{ mb: 3 }}
                  placeholder="Confirm your new password"
                  error={
                    newPasswordConfirmation !== "" &&
                    newPassword !== newPasswordConfirmation
                  }
                  helperText={
                    newPasswordConfirmation !== "" &&
                    newPassword !== newPasswordConfirmation
                      ? "Passwords do not match"
                      : ""
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Lock color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          edge="end"
                        >
                          {showConfirmPassword ? (
                            <VisibilityOff />
                          ) : (
                            <Visibility />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={
                    processing ||
                    !newPassword ||
                    !newPasswordConfirmation ||
                    newPassword !== newPasswordConfirmation ||
                    passwordStrength < 75
                  }
                  sx={{
                    py: 1.5,
                    mb: 3,
                    background:
                      "linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)",
                    "&:hover": {
                      background:
                        "linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%)",
                    },
                    "&:disabled": {
                      background: "rgba(0,0,0,0.12)",
                    },
                  }}
                  startIcon={
                    processing ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <LockReset />
                    )
                  }
                >
                  {processing ? "Resetting Password..." : "Reset Password"}
                </Button>

                <Divider sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    OR
                  </Typography>
                </Divider>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => navigate("/login")}
                  startIcon={<LoginIcon />}
                  sx={{ py: 1.2 }}
                >
                  Back to Sign In
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Password Requirements Sidebar */}
        <Box sx={{ flex: { xs: 1, md: 0.4 } }}>
          <Stack spacing={3}>
            {/* Password Requirements */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <Security sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Password Requirements
                  </Typography>
                </Box>

                <List dense>
                  {passwordRequirements.map((req, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {req.met ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : (
                          <Cancel color="error" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={req.text}
                        primaryTypographyProps={{
                          variant: "body2",
                          color: req.met ? "success.main" : "text.secondary",
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>

            {/* Security Tips */}
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <Security sx={{ mr: 1, color: "warning.main" }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Security Tips
                  </Typography>
                </Box>

                <Stack spacing={2}>
                  <Alert severity="info" sx={{ fontSize: "0.875rem" }}>
                    Use a unique password that you don't use anywhere else
                  </Alert>
                  <Alert severity="warning" sx={{ fontSize: "0.875rem" }}>
                    Avoid using personal information in your password
                  </Alert>
                  <Alert severity="success" sx={{ fontSize: "0.875rem" }}>
                    Consider using a password manager for secure passwords
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Remember your password?{" "}
          <Link
            onClick={() => navigate("/login")}
            sx={{ cursor: "pointer", fontWeight: 600 }}
          >
            Sign in here
          </Link>
        </Typography>
      </Box>
    </Container>
  );
};

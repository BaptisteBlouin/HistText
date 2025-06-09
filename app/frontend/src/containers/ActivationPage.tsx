import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useQueryParam } from "../hooks/useQueryParam";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Link,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Stack,
} from "@mui/material";
import {
  VpnKey,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Login as LoginIcon,
  PersonAdd,
  Refresh,
} from "@mui/icons-material";

export const ActivationPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const tokenFromUrl = useQueryParam("token") || "";
  const [activationToken, setActivationToken] = useState<string>(tokenFromUrl);
  const [processing, setProcessing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState<boolean>(false);

  // Auto-activate if token is provided in URL
  useEffect(() => {
    if (tokenFromUrl && !processing && !success && !error) {
      activate();
    }
  }, [tokenFromUrl]);

  const activate = async () => {
    if (!activationToken.trim()) {
      setError("Please enter your activation token");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/auth/activate?activation_token=${activationToken}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        setSuccess(true);
        // Redirect after a short delay to show success message
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        const data = await response.json();
        setError(
          data.message ||
            "Invalid or expired activation token. Please try again.",
        );
      }
    } catch (error) {
      console.error("Activation failed:", error);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    activate();
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
              Account Activated!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Your account has been successfully activated
            </Typography>
          </Box>

          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Congratulations! Your account is now active and ready to use.
                You will be redirected to the login page shortly.
              </Typography>
            </Alert>

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
            background: "linear-gradient(135deg, #2196f3 0%, #1976d2 100%)",
            color: "white",
            p: 4,
            textAlign: "center",
          }}
        >
          <VpnKey sx={{ fontSize: 48, mb: 2 }} />
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600 }}
          >
            Activate Account
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Enter your activation token to complete registration
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Activation Token"
              type={showToken ? "text" : "password"}
              value={activationToken}
              onChange={(e) => setActivationToken(e.target.value)}
              required
              sx={{ mb: 3 }}
              placeholder="Enter your activation token"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VpnKey color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowToken(!showToken)}
                      edge="end"
                    >
                      {showToken ? <VisibilityOff /> : <Visibility />}
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

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Check your email for the activation token. If you can't find it,
                check your spam folder or contact support.
              </Typography>
            </Alert>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={processing || !activationToken}
              sx={{
                py: 1.5,
                mb: 3,
                background: "linear-gradient(135deg, #2196f3 0%, #1976d2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                },
                "&:disabled": {
                  background: "rgba(0,0,0,0.12)",
                },
              }}
              startIcon={
                processing ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <CheckCircle />
                )
              }
            >
              {processing ? "Activating..." : "Activate Account"}
            </Button>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>

            <Stack spacing={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate("/register")}
                startIcon={<Refresh />}
                sx={{ py: 1.2 }}
              >
                Need New Activation Token?
              </Button>

              <Button
                fullWidth
                variant="text"
                onClick={() => navigate("/login")}
                startIcon={<LoginIcon />}
                sx={{ py: 1 }}
              >
                Already activated? Sign In
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Having trouble?{" "}
          <Link
            onClick={() => navigate("/register")}
            sx={{ cursor: "pointer", fontWeight: 600 }}
          >
            Register again
          </Link>{" "}
          or contact support
        </Typography>
      </Box>
    </Container>
  );
};

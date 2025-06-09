import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  InputAdornment,
  Stack,
} from "@mui/material";
import {
  Email,
  LockReset,
  Login as LoginIcon,
  PersonAdd,
  CheckCircle,
} from "@mui/icons-material";

export const RecoveryPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const recover = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      console.log(data);

      if (response.ok) {
        setSuccess(true);
        setEmail("");
      } else {
        setError(
          data.message || "Failed to send recovery email. Please try again.",
        );
      }
    } catch (error) {
      console.error("Recovery request failed:", error);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recover();
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
              Check Your Email
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Recovery instructions have been sent
            </Typography>
          </Box>

          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                We've sent password recovery instructions to your email address.
                Please check your inbox and follow the link to reset your
                password.
              </Typography>
            </Alert>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Didn't receive the email? Check your spam folder or try again with
              a different email address.
            </Typography>

            <Stack spacing={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  setSuccess(false);
                  setError(null);
                }}
                startIcon={<LockReset />}
              >
                Try Different Email
              </Button>

              <Button
                fullWidth
                variant="contained"
                onClick={() => navigate("/login")}
                startIcon={<LoginIcon />}
                sx={{
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                  },
                }}
              >
                Back to Sign In
              </Button>
            </Stack>
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
            background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
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
            Forgot Password?
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            No worries! Enter your email and we'll send you reset instructions
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 3 }}
              placeholder="Enter your email address"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
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
                We'll send you a secure link to reset your password. The link
                will expire in 1 hour for security.
              </Typography>
            </Alert>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={processing || !email}
              sx={{
                py: 1.5,
                mb: 3,
                background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)",
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
              {processing ? "Sending..." : "Send Reset Instructions"}
            </Button>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => navigate("/login")}
                startIcon={<LoginIcon />}
                sx={{ py: 1.2 }}
              >
                Back to Sign In
              </Button>

              <Button
                fullWidth
                variant="text"
                onClick={() => navigate("/register")}
                startIcon={<PersonAdd />}
                sx={{ py: 1 }}
              >
                Don't have an account? Sign Up
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

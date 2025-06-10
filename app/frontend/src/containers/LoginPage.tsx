import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Link,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Person, // Changed from Email to Person
  Lock,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  PersonAdd,
  LockReset,
} from "@mui/icons-material";

// Update the LoginPage to handle authentication state properly
export const LoginPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Get the intended destination from state, or default to home
  const from = location.state?.from?.pathname || "/";

  const login = async () => {
    setProcessing(true);
    setError(null);
    try {
      const success = await auth.login(email, password);
      if (success) {
        // Navigate to intended destination or home
        navigate(from, { replace: true });
      } else {
        setError("Invalid credentials. Please try again.");
      }
    } catch (err) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login();
  };

  // Only redirect if user is authenticated AND there's no error AND not currently processing
  // This allows error messages to be displayed
  if (auth.isAuthenticated && !error && !processing) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Alert severity="info">
          Already logged in. Redirecting you to the home page...
        </Alert>
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
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            p: 4,
            textAlign: "center",
          }}
        >
          <LoginIcon sx={{ fontSize: 48, mb: 2 }} />
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600 }}
          >
            Welcome Back
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Sign in to access your HistText account
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              sx={{ mb: 3 }}
              placeholder="Enter username"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
              placeholder="Enter password"
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
                      sx={{
                        "&:hover": {
                          backgroundColor: "primary.light",
                          color: "primary.dark",
                        },
                        transition: "all 0.2s ease",
                      }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
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
                <strong>Free Access:</strong> Create an account to access our
                free collections.
              </Typography>
            </Alert>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={processing || !email || !password}
              sx={{
                py: 1.5,
                mb: 3,
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "&:hover": {
                  background:
                    "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
                },
                "&:disabled": {
                  background: "rgba(0,0,0,0.12)",
                },
              }}
              startIcon={
                processing ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <LoginIcon />
                )
              }
            >
              {processing ? "Signing In..." : "Sign In"}
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
                onClick={() => navigate("/register")}
                startIcon={<PersonAdd />}
                sx={{ 
                  py: 1.2,
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: 2,
                  },
                  transition: "all 0.2s ease",
                }}
              >
                Create New Account
              </Button>

              <Button
                fullWidth
                variant="text"
                onClick={() => navigate("/recovery")}
                startIcon={<LockReset />}
                sx={{ 
                  py: 1,
                  "&:hover": {
                    backgroundColor: "action.hover",
                    transform: "translateX(4px)",
                  },
                  transition: "all 0.2s ease",
                }}
              >
                Forgot Password?
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          New to HistText?{" "}
          <Link
            onClick={() => navigate("/register")}
            sx={{ 
              cursor: "pointer", 
              fontWeight: 600,
              "&:hover": {
                color: "primary.dark",
                textDecoration: "underline",
              },
              transition: "all 0.2s ease",
            }}
          >
            Create an account
          </Link>
        </Typography>
      </Box>
    </Container>
  );
};

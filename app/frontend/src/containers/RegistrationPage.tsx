import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  Container,
  Paper,
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
  LinearProgress,
} from "@mui/material";
import {
  Person,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  PersonAdd,
  Login as LoginIcon,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";

export const RegistrationPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [processing, setProcessing] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Helper function to validate an email address
  const validateEmail = (email: string): boolean => {
    const re =
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(email).toLowerCase());
  };

  // Helper function to validate password strength - updated to match visual requirements
  const validatePassword = (password: string): boolean => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(
      password,
    );
    const hasNoSpaces = !/\s/.test(password); // Check for any whitespace

    return (
      hasMinLength &&
      hasUppercase &&
      hasLowercase &&
      hasNumber &&
      hasSpecialChar &&
      hasNoSpaces
    );
  };

  // Calculate password strength - updated special char regex
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 17;
    if (/[A-Z]/.test(password)) strength += 17;
    if (/[a-z]/.test(password)) strength += 17;
    if (/[0-9]/.test(password)) strength += 17;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password))
      strength += 16;
    if (!/\s/.test(password)) strength += 16; // No spaces
    return strength;
  };

  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 40) return "error";
    if (strength < 60) return "warning";
    if (strength < 80) return "info";
    return "success";
  };

  const getPasswordStrengthText = (strength: number) => {
    if (strength < 40) return "Very Weak";
    if (strength < 60) return "Weak";
    if (strength < 80) return "Good";
    return "Strong";
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "password") {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const register = async () => {
    // Reset errors on each attempt
    setErrors([]);

    // Validate inputs
    const validationErrors: string[] = [];
    if (!formData.firstname.trim()) {
      validationErrors.push("First name cannot be empty.");
    }
    if (!formData.lastname.trim()) {
      validationErrors.push("Last name cannot be empty.");
    }
    if (!validateEmail(formData.email)) {
      validationErrors.push("Please enter a valid email address.");
    }
    if (!validatePassword(formData.password)) {
      validationErrors.push(
        "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character (spaces not allowed).",
      );
    }
    if (formData.password !== formData.confirmPassword) {
      validationErrors.push("Passwords do not match.");
    }

    // If there are errors, display them and do not proceed
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstname: formData.firstname,
          lastname: formData.lastname,
          activated: false,
        }),
      });

      const data = await response.json();
      console.log(data);
      navigate("/login");
    } catch (error) {
      console.error("Registration failed", error);
      setErrors(["Registration failed. Please try again later."]);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register();
  };

  if (auth.isAuthenticated && errors.length === 0 && !processing) {
    navigate("/");
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: "center" }}>
        <Alert severity="info">
          Already logged in. Redirecting you to the home page...
        </Alert>
      </Container>
    );
  }

  // Updated password requirements to match validation function
  const passwordRequirements = [
    { text: "At least 8 characters", met: formData.password.length >= 8 },
    { text: "Contains uppercase letter", met: /[A-Z]/.test(formData.password) },
    { text: "Contains lowercase letter", met: /[a-z]/.test(formData.password) },
    { text: "Contains number", met: /[0-9]/.test(formData.password) },
    {
      text: "Contains special character",
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(formData.password),
    },
    { text: "No spaces allowed", met: !/\s/.test(formData.password) },
  ];

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
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
          <PersonAdd sx={{ fontSize: 48, mb: 2 }} />
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600 }}
          >
            Create Your Account
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Join HistText and start exploring texts
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit}>
            {/* Display validation errors */}
            {errors.length > 0 && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Stack spacing={1}>
                  {errors.map((error, idx) => (
                    <Typography key={idx} variant="body2">
                      • {error}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            )}

            <Stack spacing={3}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={formData.firstname}
                  onChange={(e) =>
                    handleInputChange("firstname", e.target.value)
                  }
                  required
                  placeholder="Enter your first name"
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
                  label="Last Name"
                  value={formData.lastname}
                  onChange={(e) =>
                    handleInputChange("lastname", e.target.value)
                  }
                  required
                  placeholder="Enter your last name"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
                placeholder="Enter your email address"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
                placeholder="Create a strong password"
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

              {formData.password && (
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography variant="body2">Password Strength:</Typography>
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
                    sx={{ height: 8, borderRadius: 4, mb: 2 }}
                  />

                  <Stack spacing={1}>
                    {passwordRequirements.map((req, index) => (
                      <Box
                        key={index}
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        {req.met ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : (
                          <Cancel color="error" fontSize="small" />
                        )}
                        <Typography
                          variant="body2"
                          color={req.met ? "success.main" : "text.secondary"}
                        >
                          {req.text}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleInputChange("confirmPassword", e.target.value)
                }
                required
                placeholder="Confirm your password"
                error={
                  formData.confirmPassword !== "" &&
                  formData.password !== formData.confirmPassword
                }
                helperText={
                  formData.confirmPassword !== "" &&
                  formData.password !== formData.confirmPassword
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

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={
                  processing ||
                  !formData.firstname ||
                  !formData.lastname ||
                  !formData.email ||
                  !formData.password ||
                  !formData.confirmPassword ||
                  formData.password !== formData.confirmPassword ||
                  passwordStrength < 100 // Updated to require all 5 criteria (20 * 5 = 100)
                }
                sx={{
                  py: 1.5,
                  mb: 3,
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
                    <PersonAdd />
                  )
                }
              >
                {processing ? "Creating Account..." : "Create Account"}
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
                Already have an account? Sign In
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Need help activating your account?{" "}
          <Link
            onClick={() => navigate("/activate")}
            sx={{ cursor: "pointer", fontWeight: 600 }}
          >
            Activate here
          </Link>
        </Typography>
      </Box>
    </Container>
  );
};

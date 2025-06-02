import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  LinearProgress,
  Stack,
  IconButton,
  Fade,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
  Security,
  CheckCircle,
  Cancel,
  Info,
  Save,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

/**
 * Returns an Axios instance with the current access token in the Authorization header.
 */
const useAuthAxios = () => {
  const { accessToken } = useAuth();
  return useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use(config => {
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
 * A form for authenticated users to change their password, including password strength feedback
 * and best-practice requirements UI.
 *
 * @param auth - The authentication context object.
 */
export const ChangePasswordForm = ({ auth }: { auth: any }) => {
  const authAxios = useAuthAxios();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  type PasswordField = 'current' | 'new' | 'confirm';
  const [showPasswords, setShowPasswords] = useState<{ [K in PasswordField]: boolean }>({
    current: false,
    new: false,
    confirm: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  /**
   * Calculates password strength based on presence of length, case, number, special character.
   */
  const calculatePasswordStrength = useCallback((password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    return strength;
  }, []);

  /**
   * Handles updates to input fields, updates password strength meter.
   */
  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'newPassword') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  }, [calculatePasswordStrength]);

  /**
   * Toggles the visibility of a password field.
   */
  const togglePasswordVisibility = useCallback((field: PasswordField) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  /**
   * Submits the change password form after validation, updating user password via API.
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordStrength < 75) {
      toast.error('Password is too weak. Please choose a stronger password.');
      return;
    }

    if (!formData.currentPassword) {
      toast.error('Current password is required');
      return;
    }

    const userId = auth.session?.userId;
    if (!userId) {
      toast.error('User ID not found');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch current user fields to preserve other data
      const userResponse = await authAxios.get(`/api/users/${userId}`);
      const currentUserData = userResponse.data;

      // Send only changed password and current data
      const updateData = {
        firstname: currentUserData.firstname,
        lastname: currentUserData.lastname,
        email: currentUserData.email,
        activated: currentUserData.activated,
        hash_password: formData.newPassword, // New password
      };

      await authAxios.put(`/api/users/${userId}`, updateData);
      
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStrength(0);
      toast.success('Password changed successfully!');
    } catch (error) {
      console.error('Error changing password:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error('Authentication failed. Please log in again.');
        } else if (error.response?.status === 404) {
          toast.error('User not found');
        } else if (error.response?.status === 403) {
          toast.error('You do not have permission to change this password');
        } else {
          toast.error('Failed to change password. Please try again.');
        }
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to change password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData, passwordStrength, auth.session?.userId, authAxios]);

  /**
   * Resets the form fields and password strength meter.
   */
  const handleReset = useCallback(() => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordStrength(0);
  }, []);

  /**
   * Returns a color name for password strength LinearProgress.
   */
  const getPasswordStrengthColor = (strength: number) => {
    if (strength < 25) return 'error';
    if (strength < 50) return 'warning';
    if (strength < 75) return 'info';
    return 'success';
  };

  /**
   * Returns a text label for password strength.
   */
  const getPasswordStrengthText = (strength: number) => {
    if (strength < 25) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 75) return 'Good';
    return 'Strong';
  };

  // Password requirements for user feedback UI
  const passwordRequirements = [
    { text: 'At least 8 characters', met: formData.newPassword.length >= 8 },
    { text: 'Contains uppercase letter', met: /[A-Z]/.test(formData.newPassword) },
    { text: 'Contains number', met: /[0-9]/.test(formData.newPassword) },
    { text: 'Contains special character', met: /[^A-Za-z0-9]/.test(formData.newPassword) },
  ];

  return (
    <Box sx={{ p: 4 }}>
      <Fade in={true} timeout={600}>
        <Box>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
              Security & Password
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Update your password to keep your account secure
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {/* Change Password Form */}
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Lock sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Change Password
                    </Typography>
                  </Box>

                  <Box component="form" onSubmit={handleSubmit}>
                    <Stack spacing={3}>
                      <TextField
                        fullWidth
                        label="Current Password"
                        type={showPasswords.current ? 'text' : 'password'}
                        value={formData.currentPassword}
                        onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                        required
                        disabled={isLoading}
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              onClick={() => togglePasswordVisibility('current')}
                              edge="end"
                              disabled={isLoading}
                            >
                              {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />

                      <TextField
                        fullWidth
                        label="New Password"
                        type={showPasswords.new ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={(e) => handleInputChange('newPassword', e.target.value)}
                        required
                        disabled={isLoading}
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              onClick={() => togglePasswordVisibility('new')}
                              edge="end"
                              disabled={isLoading}
                            >
                              {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />

                      {formData.newPassword && (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
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
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                      )}

                      <TextField
                        fullWidth
                        label="Confirm New Password"
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        required
                        disabled={isLoading}
                        error={formData.confirmPassword !== '' && formData.newPassword !== formData.confirmPassword}
                        helperText={
                          formData.confirmPassword !== '' && formData.newPassword !== formData.confirmPassword
                            ? 'Passwords do not match'
                            : ''
                        }
                        InputProps={{
                          endAdornment: (
                            <IconButton
                              onClick={() => togglePasswordVisibility('confirm')}
                              edge="end"
                              disabled={isLoading}
                            >
                              {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          ),
                        }}
                      />

                      <Stack direction="row" spacing={2}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          disabled={
                            !formData.currentPassword ||
                            !formData.newPassword ||
                            !formData.confirmPassword ||
                            formData.newPassword !== formData.confirmPassword ||
                            passwordStrength < 75 ||
                            isLoading
                          }
                          startIcon={isLoading ? <CircularProgress size={16} /> : <Save />}
                          sx={{
                            py: 1.5,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                            }
                          }}
                        >
                          {isLoading ? 'Changing Password...' : 'Change Password'}
                        </Button>
                        
                        <Button
                          type="button"
                          variant="outlined"
                          size="large"
                          onClick={handleReset}
                          disabled={isLoading}
                          startIcon={<Cancel />}
                        >
                          Reset Form
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Password Requirements & Security Info */}
            <Grid item xs={12} lg={4}>
              <Stack spacing={3}>
                {/* Password Requirements */}
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Security sx={{ mr: 1, color: 'primary.main' }} />
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
                              variant: 'body2',
                              color: req.met ? 'success.main' : 'text.secondary'
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
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Info sx={{ mr: 1, color: 'info.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Security Tips
                      </Typography>
                    </Box>
                    
                    <Stack spacing={2}>
                      <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                        Use a unique password that you don't use anywhere else
                      </Alert>
                      <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                        Avoid using personal information in your password
                      </Alert>
                      <Alert severity="success" sx={{ fontSize: '0.875rem' }}>
                        Consider using a password manager to generate and store secure passwords
                      </Alert>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Box>
  );
};
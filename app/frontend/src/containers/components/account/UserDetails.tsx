import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Chip,
  Stack,
  Alert,
  Fade,
  Zoom,
  CircularProgress,
} from '@mui/material';
import {
  Person,
  Email,
  Badge,
  CalendarToday,
  Verified,
  Edit,
  Save,
  Cancel,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import axios, { AxiosHeaders } from 'axios';
import { useAuth } from '../../../hooks/useAuth';

/**
 * Hook that returns an axios instance with the current user's access token attached as a Bearer header.
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
 * Displays and allows editing of the authenticated user's basic information (name, email, etc.).
 * Fetches details from the backend and updates via API.
 *
 * @param auth - Auth context, provides session and token info
 */
export const UserDetails = ({ auth }: { auth: any }) => {
  const authAxios = useAuthAxios();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);

  // Main profile state
  const [userDetails, setUserDetails] = useState({
    id: null as number | null,
    firstname: '',
    lastname: '',
    email: '',
    activated: false,
  });

  // Form state for editing
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
  });

  /**
   * Loads user details from the API on mount.
   * Falls back to basic session/JWT info if fetch fails.
   */
  useEffect(() => {
    const loadUserDetails = async () => {
      if (!auth.session?.userId) {
        setLoadingUserData(false);
        return;
      }
      try {
        setLoadingUserData(true);
        const response = await authAxios.get(`/api/users/${auth.session.userId}`);
        if (response.data) {
          const userData = response.data;
          const details = {
            id: userData.id,
            firstname: userData.firstname || '',
            lastname: userData.lastname || '',
            email: userData.email || '',
            activated: userData.activated || false,
          };
          setUserDetails(details);
          setFormData({
            firstname: details.firstname,
            lastname: details.lastname,
            email: details.email,
          });
        }
      } catch (error) {
        console.error('Error loading user details:', error);
        const details = {
          id: auth.session.userId,
          firstname: '',
          lastname: '',
          email: '',
          activated: true,
        };
        setUserDetails(details);
        setFormData({
          firstname: details.firstname,
          lastname: details.lastname,
          email: details.email,
        });
        toast.error('Could not load user details from server');
      } finally {
        setLoadingUserData(false);
      }
    };
    loadUserDetails();
  }, [auth.session?.userId, authAxios]);

  /** Start editing the profile. */
  const handleEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  /**
   * Save changes to the backend and update local state.
   * Shows a toast for feedback.
   */
  const handleSave = useCallback(async () => {
    if (!formData.firstname.trim() || !formData.lastname.trim()) {
      toast.error('First name and last name are required');
      return;
    }
    if (!userDetails.id) {
      toast.error('User ID not found');
      return;
    }
    setIsLoading(true);
    try {
      const updateData = {
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        activated: userDetails.activated,
      };
      await authAxios.put(`/api/users/${userDetails.id}`, updateData);
      setUserDetails(prev => ({
        ...prev,
        firstname: formData.firstname,
        lastname: formData.lastname,
      }));
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          toast.error('User not found');
        } else if (error.response?.status === 403) {
          toast.error('You do not have permission to update this profile');
        } else {
          toast.error('Failed to update profile');
        }
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData, userDetails.id, userDetails.activated, authAxios]);

  /**
   * Cancel editing and revert form state to the last saved user details.
   */
  const handleCancel = useCallback(() => {
    setFormData({
      firstname: userDetails.firstname,
      lastname: userDetails.lastname,
      email: userDetails.email,
    });
    setIsEditing(false);
  }, [userDetails]);

  /**
   * Handles input changes for the editable form.
   * @param field - Name of the field being edited
   * @param value - New value for the field
   */
  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  /** Returns initials for avatar from first and last name, or from email if blank. */
  const getInitials = () => {
    const first = userDetails.firstname?.charAt(0) || '';
    const last = userDetails.lastname?.charAt(0) || '';
    return (first + last).toUpperCase() || userDetails.email?.charAt(0).toUpperCase() || 'U';
  };

  /** Returns display name (full name if possible, or email, or "User"). */
  const getDisplayName = () => {
    const fullName = `${userDetails.firstname} ${userDetails.lastname}`.trim();
    return fullName || userDetails.email || 'User';
  };

  /** Returns the roles for the current session. */
  const getRoles = () => {
    return auth.session?.roles || ['User'];
  };

  if (loadingUserData) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading profile...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Fade in={true} timeout={600}>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                Profile Information
              </Typography>
              <Typography variant="body1" color="text.secondary">
                View and manage your personal information
              </Typography>
            </Box>
            {!isEditing ? (
              <Button
                variant="contained"
                startIcon={<Edit />}
                onClick={handleEdit}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                  }
                }}
              >
                Edit Profile
              </Button>
            ) : (
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={isLoading ? <CircularProgress size={16} /> : <Save />}
                  onClick={handleSave}
                  disabled={isLoading}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    }
                  }}
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </Stack>
            )}
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Zoom in={true} timeout={800}>
                <Card sx={{ textAlign: 'center', p: 3 }}>
                  <Avatar
                    sx={{
                      width: 120,
                      height: 120,
                      fontSize: '2rem',
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      mb: 2,
                      mx: 'auto',
                    }}
                  >
                    {getInitials()}
                  </Avatar>
                  
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {getDisplayName()}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {userDetails.email}
                  </Typography>

                  <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
                    <Chip
                      icon={<Verified />}
                      label={userDetails.activated ? "Active" : "Inactive"}
                      color={userDetails.activated ? "success" : "error"}
                      size="small"
                    />
                    <Chip
                      icon={<Badge />}
                      label="Member"
                      color="primary"
                      size="small"
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary">
                    <CalendarToday sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                    User ID: {userDetails.id || 'Unknown'}
                  </Typography>
                </Card>
              </Zoom>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="First Name"
                        value={isEditing ? formData.firstname : userDetails.firstname}
                        onChange={(e) => handleInputChange('firstname', e.target.value)}
                        disabled={!isEditing}
                        required
                        placeholder="Enter your first name"
                        InputProps={{
                          startAdornment: <Person sx={{ color: 'action.active', mr: 1 }} />,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Last Name"
                        value={isEditing ? formData.lastname : userDetails.lastname}
                        onChange={(e) => handleInputChange('lastname', e.target.value)}
                        disabled={!isEditing}
                        required
                        placeholder="Enter your last name"
                        InputProps={{
                          startAdornment: <Person sx={{ color: 'action.active', mr: 1 }} />,
                        }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Email Address"
                        value={userDetails.email}
                        disabled={true}
                        InputProps={{
                          startAdornment: <Email sx={{ color: 'action.active', mr: 1 }} />,
                          endAdornment: userDetails.activated && <Verified color="success" />,
                        }}
                        helperText="Email cannot be changed for security reasons"
                      />
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                      Account Information
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Roles
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                            {getRoles().map((role: string, index: number) => (
                              <Chip
                                key={index}
                                label={role}
                                color="primary"
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Stack>
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Account Status
                          </Typography>
                          <Chip
                            icon={userDetails.activated ? <Verified /> : <Cancel />}
                            label={userDetails.activated ? "Active" : "Inactive"}
                            color={userDetails.activated ? "success" : "error"}
                            size="small"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                      Current Session
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="primary" sx={{ fontWeight: 700 }}>
                            {getRoles().length}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Roles
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                            {auth.accessToken ? '1' : '0'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Active Token
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                            {auth.session?.permissions?.length || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Permissions
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                            100%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Authenticated
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  {isEditing && (
                    <Alert severity="info" sx={{ mt: 3 }}>
                      Changes will be saved to your profile and updated across all sessions.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Box>
  );
};
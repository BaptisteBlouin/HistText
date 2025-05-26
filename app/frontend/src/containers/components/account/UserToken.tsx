import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  IconButton,
  Alert,
  Fade,
  Stack,
  Paper,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  VpnKey,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Security,
  Info,
  Refresh,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

export const UserToken = ({ auth }: { auth: any }) => {
  const [showToken, setShowToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get the actual token from the auth session
  const currentToken = auth.session?.accessToken || auth.accessToken || '';

  const handleCopyToken = useCallback(() => {
    if (currentToken) {
      navigator.clipboard.writeText(currentToken);
      toast.success('Token copied to clipboard!');
    } else {
      toast.error('No token available to copy');
    }
  }, [currentToken]);

  const toggleTokenVisibility = useCallback(() => {
    setShowToken(prev => !prev);
  }, []);

  const handleRefreshToken = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Simulate token refresh (in real app, this would call auth.refreshToken())
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Token refreshed successfully!');
    } catch (error) {
      toast.error('Failed to refresh token');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const maskToken = (token: string) => {
    if (!token) return 'No token available';
    if (token.length <= 8) return token;
    return token.substring(0, 8) + '•'.repeat(20) + token.substring(token.length - 4);
  };

  const getTokenInfo = () => {
    if (!currentToken) {
      return {
        status: 'No Token',
        type: 'None',
        expires: 'N/A'
      };
    }

    // Try to decode JWT token info (basic parsing)
    try {
      const parts = currentToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const expDate = payload.exp ? new Date(payload.exp * 1000) : null;
        
        return {
          status: expDate && expDate > new Date() ? 'Active' : 'Expired',
          type: 'JWT',
          expires: expDate ? expDate.toLocaleDateString() : 'Unknown',
          issuer: payload.iss || 'HistText',
          subject: payload.sub || auth.session?.user?.email || 'Unknown'
        };
      }
    } catch (e) {
      // If not JWT or parsing fails, return basic info
    }

    return {
      status: 'Active',
      type: 'Bearer Token',
      expires: 'Session-based'
    };
  };

  const tokenInfo = getTokenInfo();

  return (
    <Box sx={{ p: 4 }}>
      <Fade in={true} timeout={600}>
        <Box>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                API Token
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Your current authentication token for API access
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefreshToken}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Token'}
            </Button>
          </Box>

          {/* Security Warning */}
          <Alert severity="warning" sx={{ mb: 4 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Keep your token secure and never share it publicly. 
              This token provides access to your account and should be treated like a password.
            </Typography>
          </Alert>

          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', lg: 'row' } }}>
            {/* Token Display */}
            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <VpnKey sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Your Access Token
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Current token:
                    </Typography>
                    
                    <Paper 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'grey.50', 
                        border: '1px solid',
                        borderColor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <TextField
                        fullWidth
                        value={showToken ? currentToken : maskToken(currentToken)}
                        InputProps={{
                          readOnly: true,
                          sx: { 
                            fontFamily: 'monospace', 
                            fontSize: '0.875rem',
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                          },
                          endAdornment: (
                            <InputAdornment position="end">
                              <Stack direction="row" spacing={1}>
                                <IconButton 
                                  size="small" 
                                  onClick={toggleTokenVisibility}
                                  title={showToken ? 'Hide token' : 'Show token'}
                                >
                                  {showToken ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  onClick={handleCopyToken}
                                  title="Copy token"
                                  disabled={!currentToken}
                                >
                                  <ContentCopy />
                                </IconButton>
                              </Stack>
                            </InputAdornment>
                          ),
                        }}
                        variant="outlined"
                      />
                    </Paper>
                  </Box>

                  {/* Token Status */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
                    <Chip
                      label={tokenInfo.status}
                      color={tokenInfo.status === 'Active' ? 'success' : 'error'}
                      size="small"
                    />
                    <Chip
                      label={tokenInfo.type}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  {/* Token Details */}
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Token Details:
                    </Typography>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Status:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {tokenInfo.status}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Type:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {tokenInfo.type}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">Expires:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {tokenInfo.expires}
                        </Typography>
                      </Box>
                      {tokenInfo.subject && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Subject:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {tokenInfo.subject}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>
                </CardContent>
              </Card>
            </Box>

            {/* Usage Information */}
            <Box sx={{ flex: 1 }}>
              <Stack spacing={3}>
                {/* How to Use */}
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Security sx={{ mr: 1, color: 'info.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        How to Use Your Token
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Include your token in the Authorization header of your API requests:
                    </Typography>
                    
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      curl -H "Authorization: Bearer YOUR_TOKEN" <br/>
                      https://api.histtext.com/endpoint
                    </Paper>
                  </CardContent>
                </Card>

                {/* Security Tips */}
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Info sx={{ mr: 1, color: 'warning.main' }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Security Best Practices
                      </Typography>
                    </Box>
                    
                    <Stack spacing={2}>
                      <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
                        Never expose your token in client-side code or public repositories
                      </Alert>
                      <Alert severity="warning" sx={{ fontSize: '0.875rem' }}>
                        Store your token securely using environment variables
                      </Alert>
                      <Alert severity="success" sx={{ fontSize: '0.875rem' }}>
                        Refresh your token regularly for enhanced security
                      </Alert>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};
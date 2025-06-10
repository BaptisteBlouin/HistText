import React, { useState, useCallback } from "react";
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
} from "@mui/material";
import {
  VpnKey,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Security,
  Info,
  Refresh,
} from "@mui/icons-material";
import { toast } from "react-toastify";

/**
 * Shows the user's current authentication token (JWT or session).
 * Allows masking/unmasking, copying, and (simulated) refreshing.
 * Shows basic decoded JWT details if available.
 */
export const UserToken = ({ auth }: { auth: any }) => {
  const [showToken, setShowToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // The access token from session or auth context
  const currentToken = auth.session?.accessToken || auth.accessToken || "";

  /**
   * Copies the current token to the clipboard.
   */
  const handleCopyToken = useCallback(() => {
    if (currentToken) {
      navigator.clipboard.writeText(currentToken);
      toast.success("Token copied to clipboard!");
    } else {
      toast.error("No token available to copy");
    }
  }, [currentToken]);

  /**
   * Toggles between masked and full token display.
   */
  const toggleTokenVisibility = useCallback(() => {
    setShowToken((prev) => !prev);
  }, []);

  /**
   * Refreshes the token by calling the refresh endpoint.
   */
  const handleRefreshToken = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include", // Include cookies for refresh token
        headers: {
          "Content-Type": "application/json",
          ...(auth.accessToken && { Authorization: auth.accessToken }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to refresh token");
      }

      const data = await response.json();
      
      // Update the auth context with the new access token
      if (auth.setAccessToken && data.access_token) {
        auth.setAccessToken(data.access_token);
        toast.success("Token refreshed successfully!");
      } else {
        throw new Error("No access token received");
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to refresh token"
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [auth]);

  /**
   * Masks the token for display (shows only part, replaces the middle).
   */
  const maskToken = (token: string) => {
    if (!token) return "No token available";
    if (token.length <= 8) return token;
    return (
      token.substring(0, 8) + "•".repeat(20) + token.substring(token.length - 4)
    );
  };

  /**
   * Decodes JWT and returns info for display, or fallback for session tokens.
   */
  const getTokenInfo = () => {
    if (!currentToken) {
      return {
        status: "No Token",
        type: "None",
        expires: "N/A",
      };
    }
    try {
      const parts = currentToken.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const expDate = payload.exp ? new Date(payload.exp * 1000) : null;
        return {
          status: expDate && expDate > new Date() ? "Active" : "Expired",
          type: "JWT",
          expires: expDate ? expDate.toLocaleDateString() : "Unknown",
          issuer: payload.iss || "HistText",
          subject: payload.sub || auth.session?.user?.email || "Unknown",
        };
      }
    } catch (e) {
      // Not JWT or decode failed
    }
    return {
      status: "Active",
      type: "Bearer Token",
      expires: "Session-based",
    };
  };

  const tokenInfo = getTokenInfo();

  return (
    <Box sx={{ p: 4 }}>
      <Fade in={true} timeout={600}>
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 4,
            }}
          >
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
              {isRefreshing ? "Refreshing..." : "Refresh Token"}
            </Button>
          </Box>

          <Alert severity="warning" sx={{ mb: 4 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Keep your token secure and never share
              it publicly. This token provides access to your account and should
              be treated like a password.
            </Typography>
          </Alert>

          <Box
            sx={{
              display: "flex",
              gap: 4,
              flexDirection: { xs: "column", lg: "row" },
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
                    <VpnKey sx={{ mr: 2, color: "primary.main" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Your Access Token
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Current token:
                    </Typography>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: "grey.50",
                        border: "1px solid",
                        borderColor: "grey.200",
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <TextField
                        fullWidth
                        value={
                          showToken ? currentToken : maskToken(currentToken)
                        }
                        InputProps={{
                          readOnly: true,
                          sx: {
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                            "& .MuiOutlinedInput-notchedOutline": {
                              border: "none",
                            },
                          },
                          endAdornment: (
                            <InputAdornment position="end">
                              <Stack direction="row" spacing={1}>
                                <IconButton
                                  size="small"
                                  onClick={toggleTokenVisibility}
                                  title={
                                    showToken ? "Hide token" : "Show token"
                                  }
                                >
                                  {showToken ? (
                                    <VisibilityOff />
                                  ) : (
                                    <Visibility />
                                  )}
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

                  <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                    <Chip
                      label={tokenInfo.status}
                      color={
                        tokenInfo.status === "Active" ? "success" : "error"
                      }
                      size="small"
                    />
                    <Chip
                      label={tokenInfo.type}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Token Details:
                    </Typography>
                    <Stack spacing={1}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="body2">Status:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {tokenInfo.status}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="body2">Type:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {tokenInfo.type}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography variant="body2">Expires:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {tokenInfo.expires}
                        </Typography>
                      </Box>
                      {tokenInfo.subject && (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
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

            <Box sx={{ flex: 1 }}>
              <Stack spacing={3}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Security sx={{ mr: 1, color: "info.main" }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        How to Use Your Token
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Include your token in the Authorization header of your API
                      requests:
                    </Typography>

                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: "grey.50",
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                      }}
                    >
                      curl -H "Authorization: Bearer YOUR_TOKEN" <br />
                      https://api.histtext.com/endpoint
                    </Paper>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Info sx={{ mr: 1, color: "warning.main" }} />
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Security Best Practices
                      </Typography>
                    </Box>

                    <Stack spacing={2}>
                      <Alert severity="info" sx={{ fontSize: "0.875rem" }}>
                        Never expose your token in client-side code or public
                        repositories
                      </Alert>
                      <Alert severity="warning" sx={{ fontSize: "0.875rem" }}>
                        Store your token securely using environment variables
                      </Alert>
                      <Alert severity="success" sx={{ fontSize: "0.875rem" }}>
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useQueryParam } from "../hooks/useQueryParam";
import { useNotification } from "../contexts/NotificationContext";
import {
  Container,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  AlertTitle,
  Button,
  Box,
  Fade,
} from "@mui/material";
import { Login as LoginIcon, Error as ErrorIcon } from "@mui/icons-material";

export const OauthLoginResultPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const errorMessage = useQueryParam("message");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleOAuthLogin = async () => {
      try {
        if (auth.completeOIDCLogin()) {
          showSuccess(
            "Login Successful!", 
            "Welcome back! Redirecting to your dashboard...",
            "You have been successfully signed in."
          );
          setTimeout(() => navigate("/"), 1500);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        setIsLoading(false);
        showError(
          "Login Failed",
          "There was an issue completing your login. Please try again.",
          "If this problem persists, please contact support."
        );
      }
    };

    handleOAuthLogin();
  }, [auth, navigate, showError, showSuccess]);

  if (errorMessage) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Fade in={true}>
          <Card elevation={3}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              <Alert 
                severity="error" 
                sx={{ mb: 3 }}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={() => navigate("/login")}
                    startIcon={<LoginIcon />}
                  >
                    Try Again
                  </Button>
                }
              >
                <AlertTitle>OAuth Login Failed</AlertTitle>
                {errorMessage}
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Don't worry, this happens sometimes. You can try logging in again or contact support if the issue persists.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate("/login")}
                  startIcon={<LoginIcon />}
                >
                  Back to Login
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Fade in={true}>
          <Card elevation={3}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <LoginIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Completing Sign In...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Please wait while we finish setting up your session.
              </Typography>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography variant="caption" color="text.secondary">
                This usually takes just a few seconds
              </Typography>
            </CardContent>
          </Card>
        </Fade>
      </Container>
    );
  }

  return null;
};

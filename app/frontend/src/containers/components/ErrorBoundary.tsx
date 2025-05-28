// components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import { Refresh, BugReport } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box sx={{ 
          p: 4, 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2
        }}>
          <BugReport sx={{ fontSize: 64, color: 'error.main', opacity: 0.7 }} />
          <Typography variant="h5" color="error.main" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Don't worry, your data is safe. Please try refreshing the component.
          </Typography>
          <Button 
            variant="contained" 
            onClick={this.handleRetry}
            startIcon={<Refresh />}
          >
            Try Again
          </Button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>
              <Typography variant="caption" component="pre">
                {this.state.error.message}
              </Typography>
            </Alert>
          )}
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
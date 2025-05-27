// app/frontend/src/containers/admin/components/dashboard/components/AsyncComponentWrapper.tsx
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  IconButton,
  Chip,
  Collapse,
  LinearProgress,
  Alert,
  Stack,
  Tooltip,
  Button,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Refresh,
  VisibilityOff,
  Visibility,
  Schedule,
  Error as ErrorIcon,
  CheckCircle,
} from '@mui/icons-material';

interface ComponentState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface AsyncComponentWrapperProps {
  componentId: string;
  title: string;
  children: React.ReactNode;
  state: ComponentState;
  onRefresh: () => Promise<void>;
  autoRefresh?: boolean;
  refreshInterval?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const AsyncComponentWrapper: React.FC<AsyncComponentWrapperProps> = ({
  componentId,
  title,
  children,
  state,
  onRefresh,
  autoRefresh = false,
  refreshInterval = 30000,
  collapsible = true,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [shouldLoad, setShouldLoad] = useState(defaultExpanded);
  const [countdown, setCountdown] = useState(0);

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh || !expanded || state.loading) return;

    const interval = setInterval(() => {
      onRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, expanded, state.loading, refreshInterval, onRefresh]);

  // Countdown for next refresh
  useEffect(() => {
    if (!autoRefresh || !expanded || state.loading) {
      setCountdown(0);
      return;
    }

    setCountdown(refreshInterval / 1000);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return refreshInterval / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, expanded, state.loading, state.lastUpdated, refreshInterval]);

  const handleToggle = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    // Load component when first expanded
    if (newExpanded && !shouldLoad) {
      setShouldLoad(true);
      if (!state.loaded && !state.loading) {
        onRefresh();
      }
    }
  }, [expanded, shouldLoad, state.loaded, state.loading, onRefresh]);

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  const getStatusIcon = () => {
    if (state.loading) return <Schedule color="warning" />;
    if (state.error) return <ErrorIcon color="error" />;
    if (state.loaded) return <CheckCircle color="success" />;
    return <VisibilityOff color="disabled" />;
  };

  const getStatusText = () => {
    if (state.loading) return 'Loading...';
    if (state.error) return 'Error';
    if (state.loaded) return 'Loaded';
    return 'Not loaded';
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Chip 
              icon={getStatusIcon()}
              label={getStatusText()}
              size="small"
              variant="outlined"
            />
          </Box>
        }
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* Auto-refresh countdown */}
            {autoRefresh && expanded && countdown > 0 && (
              <Typography variant="caption" color="text.secondary">
                Next refresh: {countdown}s
              </Typography>
            )}
            
            {/* Last updated */}
            {state.lastUpdated && (
              <Typography variant="caption" color="text.secondary">
                Updated: {state.lastUpdated.toLocaleTimeString()}
              </Typography>
            )}

            {/* Manual refresh */}
            <Tooltip title="Refresh Data">
              <IconButton 
                onClick={handleRefresh} 
                size="small"
                disabled={state.loading}
              >
                <Refresh />
              </IconButton>
            </Tooltip>

            {/* Expand/collapse */}
            {collapsible && (
              <IconButton onClick={handleToggle} size="small">
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            )}
          </Stack>
        }
        sx={{ pb: 0 }}
      />

      <Collapse in={expanded || !collapsible}>
        <CardContent sx={{ pt: 1 }}>
          {state.loading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Loading {title.toLowerCase()}...
              </Typography>
            </Box>
          )}

          {state.error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={handleRefresh}>
                  Retry
                </Button>
              }
            >
              {state.error}
            </Alert>
          )}

          {shouldLoad && (
            <Suspense 
              fallback={
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <LinearProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    Loading component...
                  </Typography>
                </Box>
              }
            >
              {children}
            </Suspense>
          )}

          {!shouldLoad && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Component not loaded. Click to expand and load.
              </Typography>
              <Button 
                variant="outlined" 
                onClick={handleToggle}
                startIcon={<Visibility />}
              >
                Load {title}
              </Button>
            </Box>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
};
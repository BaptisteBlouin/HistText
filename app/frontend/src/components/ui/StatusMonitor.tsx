import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  LinearProgress,
  useTheme,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Refresh,
  CheckCircle,
  Error,
  Warning,
  Info,
  Storage,
  Security,
  NetworkCheck,
} from '@mui/icons-material';

interface SystemStatus {
  database: 'healthy' | 'warning' | 'error';
  api: 'healthy' | 'warning' | 'error';
  solr: 'healthy' | 'warning' | 'error';
  authentication: 'healthy' | 'warning' | 'error';
}

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalDatabases: number;
  totalPermissions: number;
  responseTime: number;
  uptime: string;
}

interface StatusMonitorProps {
  compact?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const StatusMonitor: React.FC<StatusMonitorProps> = ({
  compact = false,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!compact);
  const [status, setStatus] = useState<SystemStatus>({
    database: 'healthy',
    api: 'healthy',
    solr: 'healthy',
    authentication: 'healthy',
  });
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    totalDatabases: 0,
    totalPermissions: 0,
    responseTime: 0,
    uptime: '0 days',
  });
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle fontSize="small" />;
      case 'warning': return <Warning fontSize="small" />;
      case 'error': return <Error fontSize="small" />;
      default: return <Info fontSize="small" />;
    }
  };

  const checkSystemHealth = async () => {
    setLoading(true);
    
    try {
      // For demo purposes, simulate healthy system
      // In real implementation, you would make actual API calls
      const responseTime = Math.random() * 500 + 100; // 100-600ms
      
      setStatus({
        database: 'healthy',
        api: 'healthy',
        solr: 'healthy',
        authentication: 'healthy',
      });
      
      setMetrics({
        totalUsers: Math.floor(Math.random() * 100) + 50,
        activeUsers: Math.floor(Math.random() * 50) + 20,
        totalDatabases: Math.floor(Math.random() * 10) + 5,
        totalPermissions: Math.floor(Math.random() * 20) + 10,
        responseTime: Math.floor(responseTime),
        uptime: '5 days',
      });

      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setStatus({
        database: 'error',
        api: 'error',
        solr: 'error',
        authentication: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    checkSystemHealth();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(checkSystemHealth, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval]);

  const overallHealth = Object.values(status).every(s => s === 'healthy') 
    ? 'healthy' 
    : Object.values(status).some(s => s === 'error') 
    ? 'error' 
    : 'warning';

  if (compact && !expanded) {
    return (
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <Card
          sx={{
            minWidth: 200,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[8],
            },
          }}
          onClick={() => setExpanded(true)}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={getStatusIcon(overallHealth)}
                label="System Status"
                color={getStatusColor(overallHealth) as any}
                size="small"
              />
              <ExpandMore fontSize="small" />
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ position: compact ? 'fixed' : 'relative', bottom: compact ? 16 : 0, right: compact ? 16 : 0, zIndex: compact ? 1000 : 1 }}>
      <Card sx={{ minWidth: compact ? 400 : '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NetworkCheck color="primary" />
              System Health Monitor
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Refresh Status">
                <IconButton size="small" onClick={checkSystemHealth} disabled={loading}>
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>
              {compact && (
                <IconButton size="small" onClick={() => setExpanded(false)}>
                  <ExpandLess fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          <Alert
            severity={overallHealth as any}
            sx={{ mb: 2 }}
            icon={getStatusIcon(overallHealth)}
          >
            System is {overallHealth === 'healthy' ? 'running normally' : overallHealth === 'warning' ? 'experiencing issues' : 'experiencing critical issues'}
          </Alert>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Storage color={status.database === 'healthy' ? 'success' : 'error'} />
                <Typography variant="caption" display="block">
                  Database
                </Typography>
                <Chip
                  label={status.database}
                  color={getStatusColor(status.database) as any}
                  size="small"
                />
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <NetworkCheck color={status.api === 'healthy' ? 'success' : 'error'} />
                <Typography variant="caption" display="block">
                  API
                </Typography>
                <Chip
                  label={status.api}
                  color={getStatusColor(status.api) as any}
                  size="small"
                />
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Storage color={status.solr === 'healthy' ? 'success' : 'error'} />
                <Typography variant="caption" display="block">
                  Solr
                </Typography>
                <Chip
                  label={status.solr}
                  color={getStatusColor(status.solr) as any}
                  size="small"
                />
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Security color={status.authentication === 'healthy' ? 'success' : 'error'} />
                <Typography variant="caption" display="block">
                  Auth
                </Typography>
                <Chip
                  label={status.authentication}
                  color={getStatusColor(status.authentication) as any}
                  size="small"
                />
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="primary">
                {metrics.totalUsers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Users ({metrics.activeUsers} active)
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="primary">
                {metrics.totalDatabases}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Solr Databases
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color="primary">
                {metrics.totalPermissions}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Permissions
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h4" color={metrics.responseTime > 1000 ? 'warning' : 'primary'}>
                {metrics.responseTime}ms
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Response Time
              </Typography>
            </Grid>
          </Grid>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            Last checked: {lastCheck.toLocaleTimeString()}
            {autoRefresh && ` • Auto-refresh: ${refreshInterval / 1000}s`}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StatusMonitor;
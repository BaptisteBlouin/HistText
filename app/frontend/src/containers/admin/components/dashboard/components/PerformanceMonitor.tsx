// app/frontend/src/containers/admin/components/dashboard/components/PerformanceMonitor.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Speed,
  Memory,
  NetworkCheck,
  Timer,
} from '@mui/icons-material';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  networkLatency: number;
  componentCount: number;
  lastUpdate: Date;
}

export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    componentCount: 0,
    lastUpdate: new Date(),
  });

  useEffect(() => {
    const measurePerformance = () => {
      // Measure render time using Performance API
      const renderStart = performance.now();
      
      // Simulate render measurement
      requestAnimationFrame(() => {
        const renderTime = performance.now() - renderStart;
        
        // Get memory usage (if available)
        const memoryUsage = (performance as any).memory?.usedJSHeapSize / 1048576 || 0;
        
        // Count React components (approximate)
        const componentCount = document.querySelectorAll('[data-reactroot] *').length;
        
        setMetrics(prev => ({
          ...prev,
          renderTime,
          memoryUsage,
          componentCount,
          lastUpdate: new Date(),
        }));
      });
    };

    // Measure network latency
    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch('/api/health', { method: 'HEAD' });
        const latency = performance.now() - start;
        setMetrics(prev => ({ ...prev, networkLatency: latency }));
      } catch (error) {
        console.error('Failed to measure network latency:', error);
      }
    };

    measurePerformance();
    measureLatency();

    const interval = setInterval(measurePerformance, 5000);
    const latencyInterval = setInterval(measureLatency, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(latencyInterval);
    };
  }, []);

  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'success';
    if (value <= thresholds.warning) return 'warning';
    return 'error';
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Speed />
          Performance Monitor
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Render Time
              </Typography>
              <Chip 
                icon={<Timer />}
                label={`${metrics.renderTime.toFixed(1)}ms`}
                color={getPerformanceColor(metrics.renderTime, { good: 16, warning: 33 })}
                size="small"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Memory Usage
              </Typography>
              <Chip 
                icon={<Memory />}
                label={`${metrics.memoryUsage.toFixed(1)}MB`}
                color={getPerformanceColor(metrics.memoryUsage, { good: 50, warning: 100 })}
                size="small"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Network Latency
              </Typography>
              <Chip 
                icon={<NetworkCheck />}
                label={`${metrics.networkLatency.toFixed(0)}ms`}
                color={getPerformanceColor(metrics.networkLatency, { good: 100, warning: 300 })}
                size="small"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                DOM Elements
              </Typography>
              <Chip 
                label={metrics.componentCount.toString()}
                color="info"
                size="small"
              />
            </Box>
          </Grid>
        </Grid>

        {/* Performance warnings */}
        {metrics.renderTime > 33 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            High render time detected. Consider optimizing component renders.
          </Alert>
        )}
        
        {metrics.memoryUsage > 100 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            High memory usage detected. Check for memory leaks.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
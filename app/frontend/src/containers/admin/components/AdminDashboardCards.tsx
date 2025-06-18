import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People,
  Storage,
  Psychology,
  Settings,
  MenuBook,
  TrendingUp,
  Security,
  Speed,
  Analytics,
} from '@mui/icons-material';
import { useResponsive } from '../../../lib/responsive-utils';

interface AdminCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  onClick: () => void;
  badge?: string;
  stats?: { label: string; value: string | number }[];
}

const AdminCard: React.FC<AdminCardProps> = ({
  title,
  description,
  icon,
  color = 'primary',
  onClick,
  badge,
  stats,
}) => {
  const theme = useTheme();
  const { isMobile } = useResponsive();

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 25px ${alpha(theme.palette[color].main, 0.25)}`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
        },
      }}
      onClick={onClick}
    >
      <CardContent sx={{ flex: 1, p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              p: { xs: 1.5, sm: 2 },
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
              color: 'white',
              boxShadow: `0 4px 12px ${alpha(theme.palette[color].main, 0.3)}`,
            }}
          >
            {icon}
          </Box>
          {badge && (
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: `${color}.light`,
                color: `${color}.contrastText`,
                borderRadius: '12px',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {badge}
            </Typography>
          )}
        </Box>

        <Typography
          variant={isMobile ? 'h6' : 'h5'}
          component="h3"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            lineHeight: 1.5,
            mb: stats ? 2 : 0,
          }}
        >
          {description}
        </Typography>

        {stats && stats.length > 0 && (
          <Box sx={{ mt: 'auto' }}>
            <Grid container spacing={1}>
              {stats.map((stat, index) => (
                <Grid item xs={6} key={index}>
                  <Box sx={{ textAlign: 'center', py: 1 }}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        color: `${color}.main`,
                        fontSize: { xs: '1rem', sm: '1.25rem' },
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {stat.label}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ p: { xs: 2, sm: 3 }, pt: 0 }}>
        <Button
          fullWidth
          variant="outlined"
          sx={{
            borderColor: `${color}.main`,
            color: `${color}.main`,
            '&:hover': {
              bgcolor: `${color}.main`,
              color: `${color}.contrastText`,
              borderColor: `${color}.main`,
            },
          }}
        >
          Configure
        </Button>
      </CardActions>
    </Card>
  );
};

interface AdminDashboardCardsProps {
  onNavigate: (section: number, subsection?: number) => void;
  dashboardStats?: {
    users: number;
    databases: number;
    roles: number;
    permissions: number;
  };
}

const AdminDashboardCards: React.FC<AdminDashboardCardsProps> = ({
  onNavigate,
  dashboardStats,
}) => {
  const { getGridColumns } = useResponsive();

  const cardData = [
    {
      title: 'Dashboard Overview',
      description: 'System status, analytics, and real-time monitoring',
      icon: <DashboardIcon />,
      color: 'error' as const,
      onClick: () => onNavigate(0),
      badge: 'Live',
      stats: dashboardStats ? [
        { label: 'Active Users', value: dashboardStats.users },
        { label: 'Databases', value: dashboardStats.databases },
      ] : undefined,
    },
    {
      title: 'Analytics Dashboard',
      description: 'Comprehensive insights, API analytics, and user behavior tracking',
      icon: <Analytics />,
      color: 'success' as const,
      onClick: () => onNavigate(1),
      badge: 'Advanced',
    },
    {
      title: 'User Management',
      description: 'Manage users, roles, and permissions across the platform',
      icon: <People />,
      color: 'info' as const,
      onClick: () => onNavigate(2),
      stats: dashboardStats ? [
        { label: 'Total Users', value: dashboardStats.users },
        { label: 'Active Roles', value: dashboardStats.roles },
      ] : undefined,
    },
    {
      title: 'Data Management',
      description: 'Configure databases, collections, and data access permissions',
      icon: <Storage />,
      color: 'info' as const,
      onClick: () => onNavigate(3),
      stats: dashboardStats ? [
        { label: 'Databases', value: dashboardStats.databases },
        { label: 'Permissions', value: dashboardStats.permissions },
      ] : undefined,
    },
    {
      title: 'System Configuration',
      description: 'Application settings, integrations, and global configurations',
      icon: <Settings />,
      color: 'primary' as const,
      onClick: () => onNavigate(4),
      badge: 'Critical',
    },
    {
      title: 'NLP Tools',
      description: 'Natural language processing, embeddings, and text analysis tools',
      icon: <Psychology />,
      color: 'primary' as const,
      onClick: () => onNavigate(5),
    },
    {
      title: 'API Documentation',
      description: 'Interactive API documentation and testing interface',
      icon: <MenuBook />,
      color: 'secondary' as const,
      onClick: () => onNavigate(6),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 1,
          }}
        >
          Administration Panel
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Manage your HistText platform configuration and settings
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {cardData.map((card, index) => (
          <Grid 
            item 
            xs={12} 
            sm={6} 
            md={4} 
            lg={getGridColumns() > 3 ? 3 : 4}
            key={index}
          >
            <AdminCard {...card} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AdminDashboardCards;
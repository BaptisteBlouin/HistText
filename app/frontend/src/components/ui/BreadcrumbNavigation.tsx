import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Breadcrumbs,
  Link,
  Typography,
  Box,
  Chip,
  useTheme,
} from '@mui/material';
import {
  NavigateNext,
  Home,
  AdminPanelSettings,
  People,
  Security,
  Storage,
  Info,
} from '@mui/icons-material';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
  current?: boolean;
}

interface BreadcrumbNavigationProps {
  items?: BreadcrumbItem[];
  maxItems?: number;
  darkMode?: boolean;
}

const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  items,
  maxItems = 8,
  darkMode = false,
}) => {
  const theme = useTheme();
  const location = useLocation();

  const getIconForPath = (path: string) => {
    if (path.includes('/admin')) return <AdminPanelSettings fontSize="small" />;
    if (path.includes('/users')) return <People fontSize="small" />;
    if (path.includes('/roles') || path.includes('/permissions')) return <Security fontSize="small" />;
    if (path.includes('/database')) return <Storage fontSize="small" />;
    if (path.includes('/info')) return <Info fontSize="small" />;
    return <Home fontSize="small" />;
  };

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      {
        label: 'Home',
        path: '/',
        icon: <Home fontSize="small" />,
      },
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;

      let label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      if (segment === 'admin') label = 'Admin Panel';
      if (segment === 'role_permissions') label = 'Role Permissions';
      if (segment === 'user_roles') label = 'User Roles';
      if (segment === 'user_permissions') label = 'User Permissions';
      if (segment === 'solr_database') label = 'Solr Databases';
      if (segment === 'solr_database_info') label = 'Database Info';
      if (segment === 'solr_database_permissions') label = 'Database Permissions';

      breadcrumbs.push({
        label,
        path: isLast ? undefined : currentPath,
        icon: getIconForPath(currentPath),
        current: isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbItems = generateBreadcrumbs();

  return (
    <Box
      sx={{
        py: 2,
        px: 3,
        backgroundColor: darkMode
          ? 'rgba(30, 30, 30, 0.8)'
          : 'rgba(248, 249, 250, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderRadius: '12px 12px 0 0',
        mb: 2,
      }}
    >
      <Breadcrumbs
        separator={<NavigateNext fontSize="small" />}
        maxItems={maxItems}
        sx={{
          '& .MuiBreadcrumbs-separator': {
            color: darkMode ? '#b0b0b0' : theme.palette.text.secondary,
          },
        }}
      >
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          if (isLast || !item.path) {
            return (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {item.icon}
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isLast ? 600 : 400,
                    color: isLast
                      ? theme.palette.primary.main
                      : darkMode ? '#ffffff' : theme.palette.text.primary,
                  }}
                >
                  {item.label}
                </Typography>
                {isLast && (
                  <Chip
                    label="Current"
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ ml: 1, height: 20 }}
                  />
                )}
              </Box>
            );
          }

          return (
            <Link
              key={index}
              component={RouterLink}
              to={item.path}
              underline="hover"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: darkMode ? '#b0b0b0' : theme.palette.text.secondary,
                transition: 'all 0.2s ease',
                padding: '4px 8px',
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : theme.palette.action.hover,
                  color: theme.palette.primary.main,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              {item.icon}
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {item.label}
              </Typography>
            </Link>
          );
        })}
      </Breadcrumbs>

      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {location.pathname.includes('/admin') && (
          <Typography 
            variant="caption" 
            sx={{ color: darkMode ? '#b0b0b0' : 'text.secondary' }}
          >
            💡 Use keyboard shortcuts: Ctrl+N (New), Ctrl+R (Refresh), Del (Delete selected), Esc (Clear)
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default BreadcrumbNavigation;

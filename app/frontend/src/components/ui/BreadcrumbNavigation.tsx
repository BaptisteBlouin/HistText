import React from 'react';
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
}

const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  items,
  maxItems = 8,
}) => {
  const theme = useTheme();

  // Simple breadcrumb for admin panel
  const breadcrumbItems: BreadcrumbItem[] = items || [
    {
      label: 'Home',
      path: '/',
      icon: <Home fontSize="small" />,
    },
    {
      label: 'Admin Panel',
      icon: <AdminPanelSettings fontSize="small" />,
      current: true,
    },
  ];

  return (
    <Box
      sx={{
        py: 2,
        px: 3,
        backgroundColor: theme.palette.mode === 'dark' 
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
            color: theme.palette.text.secondary,
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
                      : theme.palette.text.primary,
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
              href={item.path}
              underline="hover"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: theme.palette.text.secondary,
                transition: 'all 0.2s ease',
                padding: '4px 8px',
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
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
        <Typography variant="caption" color="text.secondary">
          💡 Use keyboard shortcuts: Ctrl+N (New), Ctrl+R (Refresh), Del (Delete selected), Esc (Clear)
        </Typography>
      </Box>
    </Box>
  );
};

export default BreadcrumbNavigation;
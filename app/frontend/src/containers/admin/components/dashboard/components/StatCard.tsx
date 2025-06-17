import React from "react";
import { Card, CardContent, Box, Typography, useTheme, useMediaQuery, Skeleton, Fade } from "@mui/material";

/**
 * Props for StatCard component.
 * - `icon`: Main icon displayed on the card.
 * - `title`: Title for the statistic.
 * - `value`: Value to display (string or number).
 * - `subtitle`: Optional subtitle.
 * - `color`: Theme color for background (default: primary).
 * - `loading`: If true, shows loading placeholder instead of value.
 */
interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  loading?: boolean;
}

/**
 * Displays a stylized card for a key statistic, with icon, value, and title.
 * Supports optional subtitle and loading state.
 */
export const StatCard: React.FC<StatCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  color = "primary",
  loading = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  if (loading) {
    return (
      <Card
        sx={{
          height: "100%",
          minHeight: { xs: 120, sm: 140, md: 160 },
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Skeleton variant="circular" width={isMobile ? 40 : 48} height={isMobile ? 40 : 48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={isMobile ? 32 : 40} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width="80%" height={isMobile ? 20 : 24} sx={{ mb: 0.5 }} />
              {subtitle && <Skeleton variant="text" width="90%" height={16} />}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Fade in={true} timeout={600}>
      <Card
        sx={{
          height: "100%",
          minHeight: { xs: 120, sm: 140, md: 160 },
          background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
          color: "white",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          cursor: "pointer",
          "&:hover": {
            transform: isMobile ? "none" : "translateY(-4px)",
            boxShadow: isMobile ? theme.shadows[2] : theme.shadows[8],
          },
          "&:active": {
            transform: isMobile ? "scale(0.98)" : "translateY(-2px)",
          },
        }}
      >
        <CardContent 
          sx={{ 
            display: "flex", 
            alignItems: "center", 
            gap: { xs: 1.5, sm: 2 }, 
            p: { xs: 2, sm: 2.5, md: 3 },
            height: "100%",
          }}
        >
          <Box 
            sx={{ 
              fontSize: { xs: 32, sm: 36, md: 40 }, 
              opacity: 0.9,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <Typography 
              variant={isMobile ? "h5" : isTablet ? "h4" : "h4"} 
              sx={{ 
                fontWeight: 700, 
                mb: 0.5,
                fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
                lineHeight: 1.2,
                wordBreak: "break-word",
              }}
            >
              {value}
            </Typography>
            <Typography 
              variant={isMobile ? "body1" : "h6"} 
              sx={{ 
                fontWeight: 600, 
                opacity: 0.9,
                fontSize: { xs: '0.875rem', sm: '1rem', md: '1.125rem' },
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  opacity: 0.8,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                  lineHeight: 1.4,
                  mt: 0.5,
                  wordBreak: "break-word",
                  display: "-webkit-box",
                  WebkitLineClamp: isMobile ? 2 : 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Fade>
  );
};

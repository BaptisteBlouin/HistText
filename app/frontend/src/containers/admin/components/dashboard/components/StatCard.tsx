import React from "react";
import { Card, CardContent, Box, Typography, useTheme } from "@mui/material";

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

  return (
    <Card
      sx={{
        height: "100%",
        background: `linear-gradient(135deg, ${theme.palette[color].light} 0%, ${theme.palette[color].main} 100%)`,
        color: "white",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, p: 3 }}>
        <Box sx={{ fontSize: 40, opacity: 0.9 }}>{icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            {loading ? "..." : value}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, opacity: 0.9 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

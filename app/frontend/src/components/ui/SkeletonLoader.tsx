import React from "react";
import { Box, Skeleton, Card, CardContent, Stack } from "@mui/material";

interface SkeletonLoaderProps {
  variant?: "table" | "card" | "admin" | "search";
  rows?: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = "table",
  rows = 5,
}) => {
  if (variant === "table") {
    return (
      <Box sx={{ width: "100%" }}>
        {/* Header skeleton */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width="30%" height={30} />
            <Box sx={{ flexGrow: 1 }} />
            <Skeleton variant="rectangular" width={120} height={36} />
          </Stack>
        </Box>
        
        {/* Table skeleton */}
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
          {/* Table header */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={2}>
              <Skeleton variant="text" width="20%" />
              <Skeleton variant="text" width="25%" />
              <Skeleton variant="text" width="15%" />
              <Skeleton variant="text" width="20%" />
              <Skeleton variant="text" width="20%" />
            </Stack>
          </Box>
          
          {/* Table rows */}
          {Array.from({ length: rows }).map((_, index) => (
            <Box key={index} sx={{ p: 2, borderBottom: index < rows - 1 ? 1 : 0, borderColor: "divider" }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Skeleton variant="rectangular" width={24} height={24} />
                <Skeleton variant="text" width="20%" />
                <Skeleton variant="text" width="25%" />
                <Skeleton variant="rectangular" width={60} height={24} />
                <Skeleton variant="text" width="15%" />
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Skeleton variant="circular" width={32} height={32} />
                </Stack>
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (variant === "card") {
    return (
      <Stack spacing={2}>
        {Array.from({ length: rows }).map((_, index) => (
          <Card key={index}>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Skeleton variant="circular" width={40} height={40} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Skeleton variant="text" width="60%" height={24} />
                    <Skeleton variant="text" width="40%" height={16} />
                  </Box>
                  <Skeleton variant="rectangular" width={80} height={24} />
                </Stack>
                <Skeleton variant="text" width="80%" height={16} />
                <Skeleton variant="rectangular" width="100%" height={60} />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  if (variant === "admin") {
    return (
      <Box>
        {/* Stats cards skeleton */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Skeleton variant="text" width="60%" height={16} />
                  <Skeleton variant="text" width="40%" height={32} />
                  <Skeleton variant="text" width="80%" height={14} />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
        
        {/* Main content skeleton */}
        <SkeletonLoader variant="table" rows={8} />
      </Box>
    );
  }

  if (variant === "search") {
    return (
      <Box>
        {/* Search header */}
        <Box sx={{ mb: 3 }}>
          <Skeleton variant="text" width="40%" height={36} />
          <Skeleton variant="rectangular" width="100%" height={56} sx={{ mt: 2 }} />
        </Box>
        
        {/* Search results */}
        <Stack spacing={2}>
          {Array.from({ length: rows }).map((_, index) => (
            <Card key={index} variant="outlined">
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Skeleton variant="rectangular" width={24} height={24} />
                    <Skeleton variant="text" width="70%" height={20} />
                  </Stack>
                  <Skeleton variant="text" width="90%" height={16} />
                  <Skeleton variant="text" width="60%" height={16} />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Skeleton variant="rectangular" width={60} height={20} />
                    <Skeleton variant="rectangular" width={80} height={20} />
                    <Skeleton variant="rectangular" width={40} height={20} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    );
  }

  return null;
};

export default SkeletonLoader;
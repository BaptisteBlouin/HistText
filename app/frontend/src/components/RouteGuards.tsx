import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CircularProgress, Box, Typography } from '@mui/material';

/**
 * Props for ProtectedRoute and PublicRoute components.
 * - `children`: Content to render if access is allowed.
 */
interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Protects a route by requiring authentication.
 * - Shows a loading spinner while auth status is pending.
 * - Redirects to /login if not authenticated, preserving the attempted location.
 */
export const ProtectedRoute = ({ children }: RouteGuardProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          gap: 2
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  // If not authenticated, redirect to login but preserve the attempted location
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

/**
 * Allows public (unauthenticated) access.
 * - Shows a loading spinner while auth status is pending.
 * - Never redirects; public pages are responsible for handling their own auth logic.
 */
export const PublicRoute = ({ children }: RouteGuardProps) => {
  const { isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          gap: 2
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Don't redirect - let the individual page components handle auth state
  return <>{children}</>;
};

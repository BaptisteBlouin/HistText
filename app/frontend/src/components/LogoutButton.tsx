import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApolloClient } from "@apollo/client";
import { useAuth } from "../hooks/useAuth";
import { Button, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { Logout as LogoutIcon } from "@mui/icons-material";

/**
 * Props for LogoutButton component.
 * - `variant`: Choose between 'button' (full button) or 'icon' (icon only).
 * - `collapsed`: If true, always renders as icon.
 * - `onComplete`: Optional callback after logout is complete.
 */
interface LogoutButtonProps {
  variant?: "button" | "icon";
  collapsed?: boolean;
  onComplete?: () => void;
}

/**
 * LogoutButton provides a sign-out UI as either a button or an icon.
 * Handles Apollo cache clearing, redirects, and loading state.
 */
export const LogoutButton = ({
  variant = "button",
  collapsed = false,
  onComplete,
}: LogoutButtonProps) => {
  const navigate = useNavigate();
  const apollo = useApolloClient();
  const { logout, isLoading } = useAuth();

  /**
   * Handles the logout process: calls logout, resets Apollo cache, and navigates.
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      // Clear Apollo cache
      apollo.resetStore();
      // Call completion callback if provided
      if (onComplete) onComplete();
      // Navigate after logout is complete
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      // Navigate anyway to prevent user being stuck
      navigate("/login", { replace: true });
    }
  }, [logout, apollo, navigate, onComplete]);

  if (variant === "icon" || collapsed) {
    return (
      <Tooltip title="Sign Out" placement="right">
        <IconButton
          color="error"
          onClick={handleLogout}
          disabled={isLoading}
          sx={{
            width: collapsed ? "100%" : 40,
            height: 40,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "error.main",
            "&:hover": {
              backgroundColor: "error.light",
              color: "white",
            },
          }}
        >
          {isLoading ? <CircularProgress size={16} /> : <LogoutIcon />}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      fullWidth
      variant="outlined"
      color="error"
      startIcon={isLoading ? <CircularProgress size={16} /> : <LogoutIcon />}
      onClick={handleLogout}
      disabled={isLoading}
    >
      {isLoading ? "Signing out..." : "Sign Out"}
    </Button>
  );
};

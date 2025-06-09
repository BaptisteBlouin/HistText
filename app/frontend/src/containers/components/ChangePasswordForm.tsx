import React, { useState } from "react";
import {
  Box,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { toast } from "react-toastify";

export const ChangePasswordForm = ({ auth }: { auth: any }) => {
  const [processing, setProcessing] = useState<boolean>(false);
  const [originalPassword, setOriginalPassword] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const changePassword = async () => {
    setProcessing(true);
    try {
      const response = await fetch("/api/auth/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({
          old_password: originalPassword,
          new_password: password,
        }),
      });

      if (!response.ok) {
        throw new Error("Password change failed");
      }

      toast.success("Password changed successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to change password.");
    } finally {
      setOriginalPassword("");
      setPassword("");
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ backgroundColor: "#f9f9f9", p: 3, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Change Password
      </Typography>
      <TextField
        label="Original Password"
        type="password"
        fullWidth
        variant="outlined"
        value={originalPassword}
        onChange={(e) => setOriginalPassword(e.target.value)}
        sx={{ mb: 3 }}
      />
      <TextField
        label="New Password"
        type={showPassword ? "text" : "password"}
        fullWidth
        variant="outlined"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                aria-label="toggle password visibility"
              >
                {showPassword ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 3 }}
      />
      <Button
        variant="contained"
        color="primary"
        disabled={processing || !originalPassword || !password}
        onClick={changePassword}
        fullWidth
        sx={{ mt: 2 }}
      >
        {processing ? "Changing..." : "Change Password"}
      </Button>
    </Box>
  );
};

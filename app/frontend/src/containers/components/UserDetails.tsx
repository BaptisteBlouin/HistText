import React from "react";
import { Box, Typography } from "@mui/material";

export const UserDetails = ({ auth }) => {
  return (
    <Box sx={{ backgroundColor: "#f9f9f9", p: 3, borderRadius: 2 }}>
      <Typography variant="h6">User Details</Typography>
      <Typography>User ID: {auth.session?.userId}</Typography>
    </Box>
  );
};

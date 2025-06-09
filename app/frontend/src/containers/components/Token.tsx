import React from "react";
import { Box, Typography } from "@mui/material";

export const UserToken = ({ auth }: { auth: any }) => {
  return (
    <Box sx={{ backgroundColor: "#f9f9f9", p: 3, borderRadius: 2 }}>
      <Typography variant="h6">Session API Token </Typography>
      <br></br>
      <Typography sx={{ wordBreak: "break-all" }}>
        {auth.accessToken}
      </Typography>
    </Box>
  );
};

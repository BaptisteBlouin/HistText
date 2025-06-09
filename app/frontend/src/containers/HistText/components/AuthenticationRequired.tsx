import React from "react";
import { Container, Paper, Typography } from "@mui/material";

const AUTH_REQUIRED_STYLES = {
  mt: 8,
  textAlign: "center" as const,
} as const;

const AUTH_PAPER_STYLES = {
  p: 6,
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "white",
} as const;

const AuthenticationRequired: React.FC = React.memo(() => (
  <Container maxWidth="sm" sx={AUTH_REQUIRED_STYLES}>
    <Paper sx={AUTH_PAPER_STYLES}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Authentication Required
      </Typography>
      <Typography variant="h6" sx={{ opacity: 0.9 }}>
        Please log in to access HistText features.
      </Typography>
    </Paper>
  </Container>
));

AuthenticationRequired.displayName = "AuthenticationRequired";

export default AuthenticationRequired;

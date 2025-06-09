import React, { useState } from "react";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  Stack,
  Chip,
  Collapse,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import {
  CloudQueue,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error,
  Warning,
  AccessTime,
} from "@mui/icons-material";
import { ComprehensiveStats } from "../types";
import { formatNumber } from "../utils/formatters";

/**
 * Props for SolrDatabaseStatus component.
 * - `comprehensiveStats`: Complete status information for all Solr databases and collections.
 */
interface SolrDatabaseStatusProps {
  comprehensiveStats: ComprehensiveStats;
}

/**
 * Displays status, metrics, and collection details for all Solr databases.
 * Collapsible for showing/hiding collection details.
 */
export const SolrDatabaseStatus: React.FC<SolrDatabaseStatusProps> = ({
  comprehensiveStats,
}) => {
  const [showSolrDetails, setShowSolrDetails] = useState<boolean>(false);

  /**
   * Returns an icon based on Solr database status.
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle color="success" />;
      case "offline":
        return <Error color="error" />;
      case "error":
        return <Warning color="warning" />;
      default:
        return <Warning color="disabled" />;
    }
  };

  /**
   * Returns a color name for MUI Chip based on status.
   */
  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "success";
      case "offline":
        return "error";
      case "error":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <CloudQueue />
            Solr Database Status
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setShowSolrDetails(!showSolrDetails)}
            endIcon={showSolrDetails ? <ExpandLess /> : <ExpandMore />}
            size="small"
          >
            {showSolrDetails ? "Hide Details" : "Show Details"}
          </Button>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {comprehensiveStats.solr_databases.map((db) => (
            <Grid item xs={12} sm={6} md={4} key={db.id}>
              <Paper
                sx={{ p: 2, display: "flex", alignItems: "center", gap: 2 }}
              >
                {getStatusIcon(db.status)}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {db.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={db.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(db.status) as any}
                    />
                    {db.response_time_ms && (
                      <Chip
                        icon={<AccessTime />}
                        label={`${db.response_time_ms}ms`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                  {db.document_count !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                      {formatNumber(db.document_count)} documents
                    </Typography>
                  )}
                  {db.error_message && (
                    <Typography variant="caption" color="error">
                      {db.error_message}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Collapse in={showSolrDetails}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Collection Details
          </Typography>
          {comprehensiveStats.solr_databases.map((db) => (
            <Box key={db.id} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {db.name} Collections
              </Typography>
              {db.collections.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Collection Name</TableCell>
                      <TableCell align="right">Documents</TableCell>
                      <TableCell align="center">Embeddings</TableCell>
                      <TableCell>Embedding Path</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {db.collections.map((collection) => (
                      <TableRow key={collection.name}>
                        <TableCell component="th" scope="row">
                          {collection.name}
                        </TableCell>
                        <TableCell align="right">
                          {collection.document_count !== undefined
                            ? formatNumber(collection.document_count)
                            : "N/A"}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={collection.has_embeddings ? "Yes" : "No"}
                            size="small"
                            color={
                              collection.has_embeddings ? "success" : "default"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {collection.embedding_path || "Default"}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No collections configured for this database.
                </Typography>
              )}
            </Box>
          ))}
        </Collapse>
      </CardContent>
    </Card>
  );
};

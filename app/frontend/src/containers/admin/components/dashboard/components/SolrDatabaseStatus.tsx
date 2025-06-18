import React, { useState } from "react";
import { useResponsive } from '../../../../../lib/responsive-utils';
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
  useTheme,
  alpha,
  Fade,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  CloudQueue,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error,
  Warning,
  AccessTime,
  ViewModule,
  ViewList,
  Storage,
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
  const theme = useTheme();
  const { isMobile, isTablet } = useResponsive();
  const [showSolrDetails, setShowSolrDetails] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Force cards mode on mobile
  React.useEffect(() => {
    if (isMobile && viewMode === 'table') {
      setViewMode('cards');
    }
  }, [isMobile, viewMode]);

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
    <Fade in={true} timeout={500}>
      <Card 
        sx={{ 
          mb: { xs: 2, sm: 4 },
          background: `linear-gradient(135deg, ${alpha(theme.palette.info.light, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
          border: '1px solid',
          borderColor: alpha(theme.palette.info.main, 0.2),
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Mobile Header */}
          {isMobile ? (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      p: 1,
                      borderRadius: '8px',
                      bgcolor: 'info.main',
                      color: 'white',
                    }}
                  >
                    <CloudQueue sx={{ fontSize: '1.25rem' }} />
                  </Box>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                    Database Status
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setShowSolrDetails(!showSolrDetails)}
                  sx={{ 
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'info.light', color: 'white' }
                  }}
                >
                  {showSolrDetails ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
            </Box>
          ) : (
            /* Desktop Header */
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: 'info.main',
                    color: 'white',
                    boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.3)}`,
                  }}
                >
                  <CloudQueue />
                </Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                  }}
                >
                  Solr Database Status
                </Typography>
              </Box>
              <Button
                variant="outlined"
                onClick={() => setShowSolrDetails(!showSolrDetails)}
                endIcon={showSolrDetails ? <ExpandLess /> : <ExpandMore />}
                size="small"
              >
                {showSolrDetails ? "Hide Details" : "Show Details"}
              </Button>
            </Box>
          )}

          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
            {comprehensiveStats.solr_databases.map((db) => (
              <Grid item xs={12} sm={6} md={4} key={db.id}>
                <Paper
                  sx={{ 
                    p: { xs: 2, sm: 2 },
                    display: "flex", 
                    alignItems: "center", 
                    gap: { xs: 1.5, sm: 2 },
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[4],
                    },
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: `linear-gradient(135deg, ${theme.palette.info.light} 0%, ${theme.palette.info.main} 100%)`,
                    },
                  }}
                >
                  <Box sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                    {getStatusIcon(db.status)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography 
                      variant={isMobile ? 'body1' : 'subtitle1'} 
                      sx={{ 
                        fontWeight: 600,
                        mb: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {db.name}
                    </Typography>
                    <Stack 
                      direction={isMobile ? 'column' : 'row'} 
                      spacing={1} 
                      alignItems={isMobile ? 'flex-start' : 'center'}
                      sx={{ mb: 1 }}
                    >
                      <Chip
                        label={db.status.toUpperCase()}
                        size="small"
                        color={getStatusColor(db.status) as any}
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                      />
                      {db.response_time_ms && (
                        <Chip
                          icon={<AccessTime sx={{ fontSize: '0.875rem' }} />}
                          label={`${db.response_time_ms}ms`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                        />
                      )}
                    </Stack>
                    {db.document_count !== undefined && (
                      <Typography variant={isMobile ? 'caption' : 'body2'} color="text.secondary">
                        {formatNumber(db.document_count)} {isMobile ? 'docs' : 'documents'}
                      </Typography>
                    )}
                    {db.error_message && (
                      <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                        {db.error_message}
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Collapse in={showSolrDetails}>
            <Divider sx={{ my: { xs: 2, sm: 2 } }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant={isMobile ? 'subtitle1' : 'h6'} gutterBottom>
                Collection Details
              </Typography>
              {!isMobile && (
                <Tooltip title={viewMode === 'cards' ? 'Switch to table view' : 'Switch to card view'}>
                  <IconButton
                    size="small"
                    onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                    color="primary"
                  >
                    {viewMode === 'cards' ? <ViewList /> : <ViewModule />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            {comprehensiveStats.solr_databases.map((db) => (
              <Box key={db.id} sx={{ mb: { xs: 2, sm: 3 } }}>
                <Typography variant={isMobile ? 'body1' : 'subtitle1'} sx={{ fontWeight: 600, mb: 1 }}>
                  {db.name} Collections
                </Typography>
                {db.collections.length > 0 ? (
                  viewMode === 'cards' || isMobile ? (
                    /* Card View for Mobile */
                    <Grid container spacing={{ xs: 1, sm: 2 }}>
                      {db.collections.map((collection) => (
                        <Grid item xs={12} sm={6} md={4} key={collection.name}>
                          <Paper
                            sx={{
                              p: { xs: 1.5, sm: 2 },
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                borderColor: 'primary.main',
                                boxShadow: theme.shadows[2],
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant={isMobile ? 'subtitle2' : 'subtitle1'} sx={{ fontWeight: 600 }}>
                                {collection.name}
                              </Typography>
                              <Chip
                                icon={<Storage sx={{ fontSize: '0.875rem' }} />}
                                label={collection.has_embeddings ? "Embeddings" : "No Embeddings"}
                                size="small"
                                color={collection.has_embeddings ? "success" : "default"}
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Box>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Documents:
                              </Typography>
                              <Typography variant={isMobile ? 'body2' : 'body1'} sx={{ fontWeight: 600 }}>
                                {collection.document_count !== undefined
                                  ? formatNumber(collection.document_count)
                                  : "N/A"}
                              </Typography>
                            </Box>
                            
                            {collection.embedding_path && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  Embedding Path:
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    fontFamily: 'monospace',
                                    bgcolor: alpha(theme.palette.grey[500], 0.1),
                                    p: 0.5,
                                    borderRadius: 0.5,
                                    mt: 0.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {collection.embedding_path || "Default"}
                                </Typography>
                              </Box>
                            )}
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    /* Table View for Desktop */
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
                  )
                ) : (
                  <Paper sx={{ p: { xs: 2, sm: 3 }, textAlign: 'center', bgcolor: alpha(theme.palette.grey[500], 0.05) }}>
                    <CloudQueue sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant={isMobile ? 'body2' : 'body1'} color="text.secondary">
                      No collections configured for this database.
                    </Typography>
                  </Paper>
                )}
              </Box>
            ))}
          </Collapse>
        </CardContent>
      </Card>
    </Fade>
  );
};

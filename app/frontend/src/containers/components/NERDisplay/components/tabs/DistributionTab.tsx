import React, { useMemo } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Alert,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  LinearProgress,
} from "@mui/material";
import { DataUsage } from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import DocumentLink from "../DocumentLink";

interface DistributionTabProps {
  stats: any;
  onDocumentClick: (documentId: string) => void;
}

/**
 * DistributionTab displays various entity-related statistical visualizations:
 * - Confidence Score Distribution (post-filtering)
 * - Entity Length Distribution (normalized text)
 * - Document Entity Diversity (unique vs total normalized entities)
 *
 * @param stats - Analytics statistics data related to entities.
 * @param onDocumentClick - Callback to handle clicks on document IDs.
 */
const DistributionTab: React.FC<DistributionTabProps> = ({
  stats,
  onDocumentClick,
}) => {
  // Memoize processed confidence distribution data with percentage formatted
  const confidenceDistributionData = useMemo(
    () =>
      stats?.confidenceDistribution?.map((item: any) => ({
        range: item.range,
        count: item.count,
        percentage: parseFloat(item.percentage.toFixed(1)),
      })) || [],
    [stats],
  );

  return (
    <Grid container spacing={3}>
      {/* Confidence Score Distribution Chart */}
      <Grid item xs={12} lg={6}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="h6">
                Confidence Score Distribution
              </Typography>
              <Chip
                label="Post-filtering"
                size="small"
                color="info"
                variant="outlined"
              />
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Distribution after filtering out entities with confidence &lt;
                30%
              </Typography>
            </Alert>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === "count" ? `${value} entities` : `${value}%`,
                    name === "count" ? "Count" : "Percentage",
                  ]}
                />
                <Bar dataKey="count" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Entity Length Distribution Chart */}
      <Grid item xs={12} lg={6}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="h6">Entity Length Distribution</Typography>
              <Chip
                label="Normalized text"
                size="small"
                color="success"
                variant="outlined"
              />
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Length distribution of normalized entities (after removing
                prefixes/suffixes)
              </Typography>
            </Alert>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={stats?.entityLengthDistribution?.slice(0, 20) || []}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="length" />
                <YAxis />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === "count" ? `${value} entities` : `${value}%`,
                    name === "count" ? "Count" : "Percentage",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Document Entity Diversity List */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="h6">Document Entity Diversity</Typography>
              <DataUsage color="success" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Documents with highest entity diversity (normalized unique
              entities / total entities). Click document IDs to view details.
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Diversity calculated using normalized entities - similar
                entities like "Apple Inc." and "Apple" count as one unique
                entity.
              </Typography>
            </Alert>
            <List>
              {stats?.documentsWithHighestDiversity
                ?.slice(0, 10)
                .map((doc: any, index: number) => {
                  const diversityPercent =
                    (doc.uniqueEntityCount / Math.max(doc.entityCount, 1)) *
                    100;
                  const chipColor =
                    diversityPercent > 80
                      ? "success"
                      : diversityPercent > 60
                        ? "warning"
                        : "error";

                  return (
                    <ListItem
                      key={index}
                      sx={{
                        px: 0,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <DocumentLink
                              documentId={doc.documentId}
                              onDocumentClick={onDocumentClick}
                            >
                              {doc.documentId.substring(0, 25) + "..."}
                            </DocumentLink>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Chip
                                label={`${diversityPercent.toFixed(0)}%`}
                                size="small"
                                color={chipColor}
                              />
                              <Typography
                                variant="caption"
                                color="success.main"
                              >
                                Quality score
                              </Typography>
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              {doc.uniqueEntityCount} unique / {doc.entityCount}{" "}
                              total entities
                            </Typography>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mt: 0.5,
                              }}
                            >
                              <LinearProgress
                                variant="determinate"
                                value={diversityPercent}
                                color={chipColor}
                                sx={{ flexGrow: 1, height: 4 }}
                              />
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(DistributionTab);

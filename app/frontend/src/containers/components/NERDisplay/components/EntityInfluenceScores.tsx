import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Alert,
  Tooltip,
  IconButton,
  Collapse,
} from "@mui/material";
import { Star, Info } from "@mui/icons-material";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

interface EntityInfluence {
  entity: string;
  influenceScore: number;
  spreadFactor: number;
  centralityScore: number;
  persistenceScore: number;
  bridgeScore: number;
  documentReach: number;
  cooccurrenceStrength: number;
  frequencyScore: number;
  diversityScore: number;
}

interface EntityInfluenceScoresProps {
  stats: any;
  entities: any[];
}

/**
 * Displays comprehensive influence scores for entities using a weighted multi-factor model.
 * Allows sorting by various metrics and provides detailed visualizations per entity.
 */
const EntityInfluenceScores: React.FC<EntityInfluenceScoresProps> = ({
  stats,
  entities,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<EntityInfluence | null>(
    null,
  );
  const [sortBy, setSortBy] = useState<
    "influence" | "spread" | "centrality" | "persistence" | "bridge"
  >("influence");
  const [showExplanation, setShowExplanation] = useState(false);

  /**
   * Computes influence scores for entities based on:
   * spread, centrality, persistence, bridging ability, frequency, and diversity.
   */
  const influenceScores = useMemo((): EntityInfluence[] => {
    if (!stats?.topEntities) return [];

    console.time("Computing entity influence scores");

    const totalDocuments = stats.totalDocuments || 1;
    const influences: EntityInfluence[] = [];

    stats.topEntities.forEach((entity: any) => {
      const entityText = entity.text;
      const entityCount = entity.count || 0;
      const documentReach = entity.documents || 1;

      const spreadFactor = documentReach / totalDocuments;

      const entityConnections =
        stats.strongestPairs?.filter(
          (pair: any) =>
            pair.entity1 === entityText || pair.entity2 === entityText,
        ) || [];
      const maxPossibleConnections = Math.max(
        (stats.topEntities?.length || 1) - 1,
        1,
      );
      const centralityScore = entityConnections.length / maxPossibleConnections;

      const avgOccurrencesPerDocument = entityCount / documentReach;
      const persistenceScore = Math.min(avgOccurrencesPerDocument / 10, 1);

      const relatedEntityTypes = new Set<string>();
      entityConnections.forEach((conn: any) => {
        const otherEntity =
          conn.entity1 === entityText ? conn.entity2 : conn.entity1;
        Object.entries(stats.topEntitiesByType || {}).forEach(
          ([type, typeEntities]: [string, any]) => {
            if (typeEntities.some((te: any) => te.text === otherEntity)) {
              relatedEntityTypes.add(type);
            }
          },
        );
      });
      const maxEntityTypes = Object.keys(stats.topEntitiesByType || {}).length;
      const bridgeScore =
        maxEntityTypes > 0 ? relatedEntityTypes.size / maxEntityTypes : 0;

      const cooccurrenceStrength =
        entityConnections.length > 0
          ? entityConnections.reduce(
              (sum: number, conn: any) => sum + (conn.strength || 0),
              0,
            ) / entityConnections.length
          : 0;

      const maxFrequency = Math.max(
        ...(stats.topEntities?.map((e: any) => e.count) || [1]),
      );
      const frequencyScore = entityCount / maxFrequency;

      const diversityScore = Math.min(documentReach / 10, 1);

      const influenceScore =
        spreadFactor * 0.25 +
        centralityScore * 0.2 +
        persistenceScore * 0.15 +
        bridgeScore * 0.15 +
        frequencyScore * 0.15 +
        diversityScore * 0.1;

      influences.push({
        entity: entityText,
        influenceScore,
        spreadFactor,
        centralityScore,
        persistenceScore,
        bridgeScore,
        documentReach,
        cooccurrenceStrength,
        frequencyScore,
        diversityScore,
      });
    });

    console.timeEnd("Computing entity influence scores");
    console.log(`Computed influence scores for ${influences.length} entities`);

    return influences.sort((a, b) => b.influenceScore - a.influenceScore);
  }, [stats]);

  /**
   * Sorts the influence scores according to the selected metric.
   */
  const sortedInfluenceScores = useMemo(() => {
    return [...influenceScores].sort((a, b) => {
      switch (sortBy) {
        case "influence":
          return b.influenceScore - a.influenceScore;
        case "spread":
          return b.spreadFactor - a.spreadFactor;
        case "centrality":
          return b.centralityScore - a.centralityScore;
        case "persistence":
          return b.persistenceScore - a.persistenceScore;
        case "bridge":
          return b.bridgeScore - a.bridgeScore;
        default:
          return b.influenceScore - a.influenceScore;
      }
    });
  }, [influenceScores, sortBy]);

  /**
   * Prepares radar chart data representing the influence factors for the selected entity.
   */
  const radarData = useMemo(() => {
    if (!selectedEntity) return [];

    return [
      {
        subject: "Spread",
        value: selectedEntity.spreadFactor * 100,
        fullMark: 100,
      },
      {
        subject: "Centrality",
        value: selectedEntity.centralityScore * 100,
        fullMark: 100,
      },
      {
        subject: "Persistence",
        value: selectedEntity.persistenceScore * 100,
        fullMark: 100,
      },
      {
        subject: "Bridge",
        value: selectedEntity.bridgeScore * 100,
        fullMark: 100,
      },
      {
        subject: "Frequency",
        value: selectedEntity.frequencyScore * 100,
        fullMark: 100,
      },
      {
        subject: "Diversity",
        value: selectedEntity.diversityScore * 100,
        fullMark: 100,
      },
    ];
  }, [selectedEntity]);

  /**
   * Prepares bar chart data for the top 10 entities by influence.
   */
  const barChartData = useMemo(() => {
    return sortedInfluenceScores.slice(0, 10).map((entity) => ({
      name:
        entity.entity.length > 15
          ? entity.entity.substring(0, 15) + "..."
          : entity.entity,
      fullName: entity.entity,
      influence: parseFloat((entity.influenceScore * 100).toFixed(1)),
      spread: parseFloat((entity.spreadFactor * 100).toFixed(1)),
      centrality: parseFloat((entity.centralityScore * 100).toFixed(1)),
    }));
  }, [sortedInfluenceScores]);

  if (!stats?.topEntities || influenceScores.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Entity Influence Scores</Typography>
          <Alert severity="info">
            Need entity data to compute influence scores.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Star color="primary" />
          <Typography variant="h6">Entity Influence Scores</Typography>
          <Chip
            label="6-Factor Analysis"
            size="small"
            color="primary"
            variant="outlined"
          />
          <IconButton
            size="small"
            onClick={() => setShowExplanation(!showExplanation)}
          >
            <Info />
          </IconButton>
        </Box>

        <Collapse in={showExplanation}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>How Influence is Computed:</strong>
              <br />
              1. <strong>Spread Factor (25%):</strong> Document reach ÷ Total
              documents
              <br />
              2. <strong>Centrality Score (20%):</strong> Entity connections ÷
              Max possible connections
              <br />
              3. <strong>Persistence Score (15%):</strong> Average occurrences
              per document (normalized)
              <br />
              4. <strong>Bridge Score (15%):</strong> How many different entity
              types it connects
              <br />
              5. <strong>Frequency Score (15%):</strong> Entity count ÷ Max
              entity count in corpus
              <br />
              6. <strong>Diversity Score (10%):</strong> Context diversity based
              on document spread
              <br />
              <br />
              <strong>Final Score:</strong> Weighted combination of all 6
              factors (0-100%)
            </Typography>
          </Alert>
        </Collapse>

        <Box sx={{ mb: 3 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="influence">Overall Influence</MenuItem>
              <MenuItem value="spread">Document Spread</MenuItem>
              <MenuItem value="centrality">Centrality Score</MenuItem>
              <MenuItem value="persistence">Persistence</MenuItem>
              <MenuItem value="bridge">Bridge Score</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Top Entity Influences by{" "}
            {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={10}
              />
              <YAxis />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <Box
                        sx={{
                          bgcolor: "background.paper",
                          p: 2,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="subtitle2">
                          {data.fullName}
                        </Typography>
                        <Typography variant="body2">
                          Overall Influence: {data.influence}%
                        </Typography>
                        <Typography variant="body2">
                          Document Spread: {data.spread}%
                        </Typography>
                        <Typography variant="body2">
                          Centrality: {data.centrality}%
                        </Typography>
                      </Box>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="influence" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Influence Rankings
            </Typography>
            <List sx={{ maxHeight: 400, overflow: "auto" }}>
              {sortedInfluenceScores.slice(0, 15).map((entity, index) => (
                <ListItem
                  key={index}
                  button
                  selected={selectedEntity?.entity === entity.entity}
                  onClick={() => setSelectedEntity(entity)}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    mb: 0.5,
                    "&.Mui-selected": {
                      borderColor: "primary.main",
                      backgroundColor: "primary.light",
                      color: "primary.contrastText",
                    },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box
                        component="span"
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                          #{index + 1}.{" "}
                          {entity.entity.length > 25
                            ? entity.entity.substring(0, 25) + "..."
                            : entity.entity}
                        </Typography>
                        <Chip
                          label={`${(entity.influenceScore * 100).toFixed(0)}%`}
                          size="small"
                          color="primary"
                        />
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: "block", mt: 1 }}>
                        <Box
                          component="span"
                          sx={{
                            display: "flex",
                            gap: 1,
                            mb: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Tooltip title="Document Reach">
                            <Chip
                              label={`${entity.documentReach} docs`}
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                          <Tooltip title="Centrality Score">
                            <Chip
                              label={`${(entity.centralityScore * 100).toFixed(0)}% central`}
                              size="small"
                              variant="outlined"
                              color="secondary"
                            />
                          </Tooltip>
                          <Tooltip title="Bridge Score">
                            <Chip
                              label={`${(entity.bridgeScore * 100).toFixed(0)}% bridge`}
                              size="small"
                              variant="outlined"
                              color="success"
                            />
                          </Tooltip>
                        </Box>

                        <Typography component="span" variant="caption" sx={{ display: "block" }}>
                          Spread: {(entity.spreadFactor * 100).toFixed(1)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={entity.spreadFactor * 100}
                          sx={{ height: 3, mb: 0.5 }}
                          color="primary"
                        />

                        <Typography component="span" variant="caption" sx={{ display: "block" }}>
                          Persistence:{" "}
                          {(entity.persistenceScore * 100).toFixed(1)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={entity.persistenceScore * 100}
                          sx={{ height: 3, mb: 0.5 }}
                          color="secondary"
                        />

                        <Typography component="span" variant="caption" sx={{ display: "block" }}>
                          Frequency: {(entity.frequencyScore * 100).toFixed(1)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={entity.frequencyScore * 100}
                          sx={{ height: 3 }}
                          color="success"
                        />
                      </Box>
                    }
                    primaryTypographyProps={{ component: "div" }}
                    secondaryTypographyProps={{ component: "div" }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          {selectedEntity && (
            <Box sx={{ flex: 1, minWidth: 300 }}>
              <Typography variant="subtitle2" gutterBottom>
                Influence Profile: {selectedEntity.entity}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" fontSize={12} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} fontSize={10} />
                  <Radar
                    name="Influence Factors"
                    dataKey="value"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>

              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Overall Influence:</strong>{" "}
                  {(selectedEntity.influenceScore * 100).toFixed(1)}%
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Document Reach:</strong>{" "}
                  {selectedEntity.documentReach} documents (
                  {(selectedEntity.spreadFactor * 100).toFixed(1)}% of corpus)
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Avg Cooccurrence Strength:</strong>{" "}
                  {selectedEntity.cooccurrenceStrength.toFixed(2)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Context Diversity:</strong>{" "}
                  {(selectedEntity.diversityScore * 100).toFixed(1)}%
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default React.memo(EntityInfluenceScores);

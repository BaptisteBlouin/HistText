import React, { useMemo } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Alert,
  Box,
  Badge,
  IconButton,
  Collapse,
} from "@mui/material";
import { NetworkCheck, FilterAlt, Psychology, Info } from "@mui/icons-material";
import CooccurrenceChart from "../CooccurrenceChart";
import CentralityScores from "../CentralityScores";
import StrongestPairs from "../StrongestPairs";

interface RelationshipsTabProps {
  stats: any;
  expandedSections: Set<string>;
  onToggleSection: (section: string) => void;
}

/**
 * RelationshipsTab component renders detailed analytics about entity relationships
 * in the dataset, focusing on co-occurrence patterns, centrality scores, and strongest pairs.
 *
 * It provides enhanced visualization and explanations of entity pair relationships,
 * including normalization, quality filtering, and statistical significance.
 *
 * @param stats - The statistics data object containing entity relationships and scores.
 * @param expandedSections - Set of expanded section keys for UI collapse control.
 * @param onToggleSection - Callback function to toggle the expanded/collapsed state of sections.
 */
const RelationshipsTab: React.FC<RelationshipsTabProps> = ({
  stats,
  expandedSections,
  onToggleSection,
}) => {
  // Prepare co-occurrence network data with enhanced metrics and labels
  const cooccurrenceNetworkData = useMemo(() => {
    if (!stats?.strongestPairs) return [];

    return stats.strongestPairs.slice(0, 15).map((pair: any) => ({
      name: `${pair.entity1} ↔ ${pair.entity2}`,
      entity1: pair.entity1,
      entity2: pair.entity2,
      strength: parseFloat(pair.strength.toFixed(2)),
      count: pair.count,
      documents: pair.documents.length,
      avgDistance: pair.avgDistance ? Math.round(pair.avgDistance) : "N/A",
      proximityScore: pair.proximityScore
        ? parseFloat(pair.proximityScore.toFixed(2))
        : 0,
      strengthLevel:
        pair.strength > 10
          ? "Very Strong"
          : pair.strength > 5
            ? "Strong"
            : pair.strength > 2
              ? "Moderate"
              : "Weak",
    }));
  }, [stats]);

  return (
    <Grid container spacing={3}>
      {/* Entity Co-occurrence Visualization Section */}
      <Grid item xs={12} lg={8}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <NetworkCheck color="primary" />
              <Typography variant="h6">
                Entity Relationships (Co-occurrence)
              </Typography>
              <Badge badgeContent="Enhanced" color="success" variant="dot">
                <FilterAlt />
              </Badge>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Enhanced Analysis:</strong> Shows normalized entity
                pairs that appear together more often than expected by chance.
                <br />
                <strong>Proximity Score:</strong> Combines statistical
                significance with physical distance in text.
                <br />
                <strong>Quality Filtering:</strong> Excludes noise words and
                low-confidence entities.
              </Typography>
            </Alert>
            <CooccurrenceChart data={cooccurrenceNetworkData} />
          </CardContent>
        </Card>
      </Grid>

      {/* Centrality Scores Section */}
      <Grid item xs={12} lg={4}>
        <CentralityScores centralityScores={stats?.centralityScores || []} />
      </Grid>

      {/* Strongest Entity Pairs Section with expandable explanation */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="h6">Strongest Entity Pairs</Typography>
              <Badge badgeContent="Enhanced" color="success" variant="dot">
                <Psychology />
              </Badge>
              <IconButton
                size="small"
                onClick={() => onToggleSection("cooccurrenceExplanation")}
              >
                <Info />
              </IconButton>
            </Box>

            <Collapse in={expandedSections.has("cooccurrenceExplanation")}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Enhanced Relationship Analysis:</strong>
                </Typography>
                <Typography variant="body2" component="div">
                  • <strong>Entity Normalization:</strong> "Mr. Smith" and
                  "Smith" are treated as the same entity
                  <br />• <strong>Quality Filtering:</strong> Excludes common
                  words, numbers, and low-confidence entities
                  <br />• <strong>Statistical Significance:</strong> How much
                  more than random chance (higher = more meaningful)
                  <br />• <strong>Proximity Weighting:</strong> Entities
                  appearing closer together get higher scores
                  <br />• <strong>Document Frequency:</strong> Relationships
                  appearing across multiple documents are stronger
                </Typography>
              </Alert>
            </Collapse>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Normalized entity pairs with statistically significant
              relationships and proximity weighting
            </Typography>

            <StrongestPairs strongestPairs={stats?.strongestPairs || []} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default React.memo(RelationshipsTab);

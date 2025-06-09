// Create app/frontend/src/containers/components/NERDisplay/components/NERAnalyticsLimitDialog.tsx
import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
  Chip,
  LinearProgress,
  Autocomplete,
  TextField,
  Checkbox,
  FormControlLabel,
  Divider,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import {
  Warning,
  TrendingUp,
  Speed,
  Memory,
  FilterList,
  Category,
  CheckBoxOutlineBlank,
  CheckBox,
} from "@mui/icons-material";
import config from "../../../../config.json";

const icon = <CheckBoxOutlineBlank fontSize="small" />;
const checkedIcon = <CheckBox fontSize="small" />;

interface NERAnalyticsLimitDialogProps {
  open: boolean;
  onClose: () => void;
  onProceed: (useLimited: boolean, selectedEntityTypes?: string[]) => void;
  totalEntities: number;
  maxEntities: number;
  estimatedTime: string;
  entityTypeStats?: Record<string, { count: number; percentage: number }>;
  entities?: any[];
}

const NERAnalyticsLimitDialog: React.FC<NERAnalyticsLimitDialogProps> = ({
  open,
  onClose,
  onProceed,
  totalEntities,
  maxEntities,
  estimatedTime,
  entityTypeStats = {},
  entities = [],
}) => {
  const percentageToProcess = Math.min(
    (maxEntities / totalEntities) * 100,
    100,
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showTypeFiltering, setShowTypeFiltering] = useState(false);

  // Process entity types from the provided data
  const availableEntityTypes = useMemo(() => {
    const typesFromStats = Object.keys(entityTypeStats).map((type) => ({
      label: type,
      count: entityTypeStats[type].count,
      percentage: entityTypeStats[type].percentage,
    }));

    // If we have entities data, extract types from there as well
    const typesFromEntities =
      entities.length > 0
        ? Array.from(new Set(entities.map((e) => e.labelFull || e.label))).map(
            (type) => {
              const count = entities.filter(
                (e) => (e.labelFull || e.label) === type,
              ).length;
              return {
                label: type,
                count,
                percentage: (count / entities.length) * 100,
              };
            },
          )
        : [];

    // Combine and deduplicate
    const allTypes = [...typesFromStats, ...typesFromEntities];
    const uniqueTypes = allTypes.reduce(
      (acc, current) => {
        const existing = acc.find((item) => item.label === current.label);
        if (!existing) {
          acc.push(current);
        } else if (current.count > existing.count) {
          // Keep the one with higher count
          acc[acc.indexOf(existing)] = current;
        }
        return acc;
      },
      [] as typeof typesFromStats,
    );

    return uniqueTypes.sort((a, b) => b.count - a.count);
  }, [entityTypeStats, entities]);

  // Calculate entities for selected types
  const entitiesFromSelectedTypes = useMemo(() => {
    if (selectedTypes.length === 0) return 0;

    if (entities.length > 0) {
      return entities.filter((e) =>
        selectedTypes.includes(e.labelFull || e.label),
      ).length;
    }

    return selectedTypes.reduce((total, type) => {
      const typeData = availableEntityTypes.find((t) => t.label === type);
      return total + (typeData?.count || 0);
    }, 0);
  }, [selectedTypes, availableEntityTypes, entities]);

  const handleSelectAllTypes = () => {
    if (selectedTypes.length === availableEntityTypes.length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(availableEntityTypes.map((t) => t.label));
    }
  };

  const handleProceedWithTypes = () => {
    onProceed(false, selectedTypes.length > 0 ? selectedTypes : undefined);
  };

  const getEntityTypeColor = (type: string) => {
    return config.NER_LABELS_COLORS[type] || "#757575";
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Warning color="warning" />
        Large Dataset Detected
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Your query returned{" "}
            <strong>{totalEntities.toLocaleString()} entities</strong>, which
            may result in slow performance for advanced analytics.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Performance Impact
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <Chip
              icon={<Speed />}
              label={`Estimated time: ${estimatedTime}`}
              color="warning"
              variant="outlined"
            />
            <Chip
              icon={<Memory />}
              label="High memory usage"
              color="error"
              variant="outlined"
            />
            <Chip
              icon={<TrendingUp />}
              label="Complex calculations"
              color="info"
              variant="outlined"
            />
          </Box>
        </Box>

        <Typography variant="h6" gutterBottom>
          Choose how to proceed:
        </Typography>

        <Grid container spacing={2}>
          {/* Option 1: Refine Query */}
          <Grid item xs={12} lg={6}>
            <Alert severity="info">
              <Typography variant="subtitle2" gutterBottom>
                <strong>Option 1: Refine your query (Recommended)</strong>
              </Typography>
              <Typography variant="body2">
                Add more specific search criteria to reduce the number of
                results and get more focused insights.
              </Typography>
            </Alert>
          </Grid>

          {/* Option 2: Analyze Subset */}
          <Grid item xs={12} lg={6}>
            <Alert severity="success">
              <Typography variant="subtitle2" gutterBottom>
                <strong>
                  Option 2: Analyze subset ({maxEntities.toLocaleString()}{" "}
                  entities)
                </strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Process the first {maxEntities.toLocaleString()} entities (
                {percentageToProcess.toFixed(1)}% of your data) for faster
                performance while still getting meaningful insights.
              </Typography>
              <LinearProgress
                variant="determinate"
                value={percentageToProcess}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Alert>
          </Grid>

          {/* Option 3: Entity Type Filtering */}
          {availableEntityTypes.length > 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Option 3: Filter by Entity Types</strong>
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Select specific entity types to analyze. This can
                  significantly reduce the dataset while maintaining relevance.
                </Typography>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showTypeFiltering}
                      onChange={(e) => setShowTypeFiltering(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Enable entity type filtering"
                />

                {showTypeFiltering && (
                  <Box sx={{ mt: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleSelectAllTypes}
                        startIcon={<Category />}
                      >
                        {selectedTypes.length === availableEntityTypes.length
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                      {selectedTypes.length > 0 && (
                        <Chip
                          label={`${entitiesFromSelectedTypes.toLocaleString()} entities selected`}
                          size="small"
                          color="primary"
                          icon={<FilterList />}
                        />
                      )}
                    </Box>

                    <Autocomplete
                      multiple
                      size="small"
                      options={availableEntityTypes}
                      disableCloseOnSelect
                      getOptionLabel={(option) =>
                        `${option.label} (${option.count.toLocaleString()})`
                      }
                      value={availableEntityTypes.filter((type) =>
                        selectedTypes.includes(type.label),
                      )}
                      onChange={(event, newValue) => {
                        setSelectedTypes(newValue.map((v) => v.label));
                      }}
                      renderOption={(props, option, { selected }) => (
                        <li {...props}>
                          <Checkbox
                            icon={icon}
                            checkedIcon={checkedIcon}
                            style={{ marginRight: 8 }}
                            checked={selected}
                          />
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              flexGrow: 1,
                            }}
                          >
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                backgroundColor: getEntityTypeColor(
                                  option.label,
                                ),
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 500 }}
                            >
                              {option.label}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              ({option.count.toLocaleString()} entities,{" "}
                              {option.percentage.toFixed(1)}%)
                            </Typography>
                          </Box>
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Entity Types"
                          placeholder="Choose specific types to analyze..."
                        />
                      )}
                      renderTags={(tagValue, getTagProps) =>
                        tagValue.map((option, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={option.label}
                            size="small"
                            label={`${option.label} (${option.count.toLocaleString()})`}
                            style={{
                              backgroundColor: getEntityTypeColor(option.label),
                              color: "white",
                            }}
                          />
                        ))
                      }
                      sx={{ mt: 1 }}
                    />

                    {selectedTypes.length > 0 && (
                      <Card variant="outlined" sx={{ mt: 2 }}>
                        <CardContent sx={{ py: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Selection Summary
                          </Typography>
                          <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
                            <Typography variant="body2">
                              <strong>Selected Types:</strong>{" "}
                              {selectedTypes.length} of{" "}
                              {availableEntityTypes.length}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Total Entities:</strong>{" "}
                              {entitiesFromSelectedTypes.toLocaleString()}
                            </Typography>
                            <Typography variant="body2">
                              <strong>Reduction:</strong>{" "}
                              {(
                                (1 -
                                  entitiesFromSelectedTypes / totalEntities) *
                                100
                              ).toFixed(1)}
                              %
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={
                              (entitiesFromSelectedTypes / totalEntities) * 100
                            }
                            sx={{ height: 6, borderRadius: 3 }}
                            color={
                              entitiesFromSelectedTypes < maxEntities
                                ? "success"
                                : "warning"
                            }
                          />
                          {entitiesFromSelectedTypes > maxEntities && (
                            <Typography
                              variant="caption"
                              color="warning.main"
                              sx={{ mt: 1, display: "block" }}
                            >
                              Still above recommended limit. Consider selecting
                              fewer types.
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                )}
              </Alert>
            </Grid>
          )}

          {/* Option 4: Process All */}
          <Grid item xs={12}>
            <Alert severity="error">
              <Typography variant="subtitle2" gutterBottom>
                <strong>
                  Option 4: Process all entities (Not recommended)
                </strong>
              </Typography>
              <Typography variant="body2">
                This may take several minutes and could cause browser slowdowns
                or crashes.
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel & Refine Query
        </Button>
        <Button
          onClick={() => onProceed(true)}
          variant="contained"
          color="success"
        >
          Analyze Subset ({maxEntities.toLocaleString()})
        </Button>
        {showTypeFiltering && selectedTypes.length > 0 && (
          <Button
            onClick={handleProceedWithTypes}
            variant="contained"
            color="primary"
            disabled={entitiesFromSelectedTypes === 0}
          >
            Analyze Selected Types ({entitiesFromSelectedTypes.toLocaleString()}
            )
          </Button>
        )}
        <Button
          onClick={() => onProceed(false)}
          variant="contained"
          color="error"
        >
          Process All (Risky)
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default React.memo(NERAnalyticsLimitDialog);

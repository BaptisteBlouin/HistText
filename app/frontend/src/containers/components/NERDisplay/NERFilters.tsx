import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Box,
  Stack,
  ButtonGroup,
  Button,
  Collapse,
} from "@mui/material";
import { TuneSharp } from "@mui/icons-material";

interface NERFiltersProps {
  showAdvancedFilters: boolean;
  searchTerm: string;
  minConfidence: number;
  onMinConfidenceChange: (confidence: number) => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (order: "asc" | "desc") => void;
}

const NERFilters: React.FC<NERFiltersProps> = ({
  showAdvancedFilters,
  minConfidence,
  onMinConfidenceChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}) => {
  return (
    <Collapse in={showAdvancedFilters}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <TuneSharp />
            Advanced Filters
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Confidence Filter
              </Typography>
              <Box sx={{ px: 2 }}>
                <Typography variant="caption">
                  Min Confidence: {(minConfidence * 100).toFixed(0)}%
                </Typography>
                <Slider
                  value={minConfidence * 100}
                  min={0}
                  max={100}
                  step={5}
                  onChange={(_, v) =>
                    onMinConfidenceChange((v as number) / 100)
                  }
                  valueLabelDisplay="auto"
                  size="small"
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Sort Options
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={sortBy}
                    onChange={(e) => onSortByChange(e.target.value)}
                  >
                    <MenuItem value="text">Entity Text</MenuItem>
                    <MenuItem value="label">Entity Type</MenuItem>
                    <MenuItem value="confidence">Confidence</MenuItem>
                    <MenuItem value="id">Document ID</MenuItem>
                  </Select>
                </FormControl>

                <ButtonGroup size="small">
                  <Button
                    variant={sortOrder === "asc" ? "contained" : "outlined"}
                    onClick={() => onSortOrderChange("asc")}
                  >
                    ASC
                  </Button>
                  <Button
                    variant={sortOrder === "desc" ? "contained" : "outlined"}
                    onClick={() => onSortOrderChange("desc")}
                  >
                    DESC
                  </Button>
                </ButtonGroup>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Collapse>
  );
};

export default React.memo(NERFilters);

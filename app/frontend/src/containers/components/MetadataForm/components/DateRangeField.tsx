import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  TextField
} from '@mui/material';

/**
 * Props for the DateRangeField component.
 *
 * @property dateRange - Min and max date boundaries, or null to hide field.
 * @property formData - Form state containing min_date and max_date.
 * @property onFormChange - Handler for input change events.
 */
interface DateRangeFieldProps {
  dateRange: { min: string; max: string } | null;
  formData: any;
  onFormChange: (event: any, index: number) => void;
}

/**
 * Renders a date range filter with start and end date fields.
 * Shown only if dateRange is provided.
 */
const DateRangeField: React.FC<DateRangeFieldProps> = ({
  dateRange,
  formData,
  onFormChange
}) => {
  if (!dateRange) return null;

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          Date Range Filter
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Start Date"
              type="date"
              name="min_date"
              value={formData.min_date?.[0]?.value || dateRange.min.split('T')[0]}
              onChange={e => onFormChange(e, 0)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="End Date"
              type="date"
              name="max_date"
              value={formData.max_date?.[0]?.value || dateRange.max.split('T')[0]}
              onChange={e => onFormChange(e, 0)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default React.memo(DateRangeField);
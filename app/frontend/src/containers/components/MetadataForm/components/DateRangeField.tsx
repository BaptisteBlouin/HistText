import React from "react";
import { 
  Card, 
  CardContent, 
  Typography, 
  Grid, 
  TextField, 
  Box,
  Chip
} from "@mui/material";
import { 
  DateRange,
  CalendarToday,
  Schedule
} from "@mui/icons-material";

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
  onFormChange,
}) => {
  if (!dateRange) return null;

  // Format dates for display
  const formatDateRange = () => {
    const startDate = new Date(dateRange.min).toLocaleDateString();
    const endDate = new Date(dateRange.max).toLocaleDateString();
    return `${startDate} - ${endDate}`;
  };

  // Check if user has set custom dates
  const hasCustomDates = (formData.min_date?.[0]?.value && formData.min_date[0].value !== dateRange.min.split("T")[0]) ||
                         (formData.max_date?.[0]?.value && formData.max_date[0].value !== dateRange.max.split("T")[0]);

  return (
    <Card variant="outlined" sx={{ mb: 3, overflow: "visible" }}>
      <CardContent sx={{ pb: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.main" }}>
            Date Range Filter
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DateRange sx={{ color: "primary.main" }} />
            {hasCustomDates && (
              <Chip 
                label="Custom" 
                size="small" 
                color="primary" 
                variant="outlined"
                sx={{ fontSize: "0.75rem" }}
              />
            )}
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Start Date"
              type="date"
              name="min_date"
              value={
                formData.min_date?.[0]?.value || dateRange.min.split("T")[0]
              }
              onChange={(e) => onFormChange(e, 0)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="medium"
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <Schedule sx={{ color: "primary.main", mr: 1, fontSize: 20 }} />
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "primary.main",
                      borderWidth: 2,
                    }
                  },
                  "&.Mui-focused": {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "primary.main",
                      borderWidth: 2,
                    }
                  }
                },
                "& .MuiInputLabel-root": {
                  fontWeight: 600,
                  "&.Mui-focused": {
                    color: "primary.main",
                  }
                }
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              label="End Date"
              type="date"
              name="max_date"
              value={
                formData.max_date?.[0]?.value || dateRange.max.split("T")[0]
              }
              onChange={(e) => onFormChange(e, 0)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="medium"
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <Schedule sx={{ color: "secondary.main", mr: 1, fontSize: 20 }} />
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  transition: "all 0.2s ease-in-out",
                  "&:hover": {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "secondary.main",
                      borderWidth: 2,
                    }
                  },
                  "&.Mui-focused": {
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "secondary.main",
                      borderWidth: 2,
                    }
                  }
                },
                "& .MuiInputLabel-root": {
                  fontWeight: 600,
                  "&.Mui-focused": {
                    color: "secondary.main",
                  }
                }
              }}
            />
          </Grid>
        </Grid>

        {hasCustomDates && (
          <Box sx={{ mt: 2, p: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'success.dark' : 'success.50', borderRadius: 1 }}>
            <Typography variant="caption" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 500 }}>
              <CalendarToday sx={{ fontSize: 14 }} />
              Custom date range applied
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default React.memo(DateRangeField);

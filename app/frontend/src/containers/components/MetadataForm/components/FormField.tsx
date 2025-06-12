import React, { useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Autocomplete,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Box,
  Alert,
  Collapse,
} from "@mui/material";
import {
  Star,
  Remove,
  Add,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  Lightbulb,
} from "@mui/icons-material";
import ContextHelp from "../../../../components/ui/ContextHelp";
import { useSmartValidation } from "../../../../hooks/useSmartValidation";

/**
 * Props for the FormField component.
 *
 * @property field - Metadata for the field (name, possible values, etc.).
 * @property formData - Current form values for all fields.
 * @property collectionInfo - Information about the collection, including the main text field.
 * @property hasEmbeddings - Whether embeddings/AI search is enabled.
 * @property neighbors - AI word suggestions for fields.
 * @property loadingNeighbors - Loading state for fetching neighbors.
 * @property metadata - All metadata fields.
 * @property onFormChange - Handler for manual text input changes.
 * @property onSelectChange - Handler for dropdown/select changes.
 * @property onToggleNot - Handler to toggle NOT logic for an entry.
 * @property onAddBooleanField - Handler to add an AND/OR boolean field.
 * @property onRemoveBooleanField - Handler to remove a boolean field.
 * @property onFetchNeighbors - Handler to fetch AI suggestions.
 * @property onRemoveNeighborDropdown - Handler to hide AI suggestions.
 * @property shouldAutoFocus - Whether this field should receive focus on mount.
 */
interface FormFieldProps {
  field: any;
  formData: any;
  collectionInfo: any;
  hasEmbeddings: boolean;
  neighbors: { [key: string]: string[] };
  loadingNeighbors: { [key: string]: boolean };
  metadata: any[];
  onFormChange: (event: any, index: number) => void;
  onSelectChange: (
    fieldName: string,
    newValue: string | null,
    index: number,
  ) => void;
  onToggleNot: (name: string, index: number) => void;
  onAddBooleanField: (name: string, operator: string) => void;
  onRemoveBooleanField: (name: string, index: number) => void;
  onFetchNeighbors: (inputValue: string, fieldName: string) => void;
  onRemoveNeighborDropdown: (fieldName: string) => void;
  shouldAutoFocus?: boolean;
}

/**
 * Dynamic form field supporting AND/OR boolean logic, AI suggestions, and rich validation.
 * Renders as select/autocomplete or text field depending on field metadata.
 */
const FormField: React.FC<FormFieldProps> = ({
  field,
  formData,
  collectionInfo,
  hasEmbeddings,
  neighbors,
  loadingNeighbors,
  metadata,
  onFormChange,
  onSelectChange,
  onToggleNot,
  onAddBooleanField,
  onRemoveBooleanField,
  onFetchNeighbors,
  onRemoveNeighborDropdown,
  shouldAutoFocus = false,
}) => {
  const { validateField } = useSmartValidation(
    formData,
    metadata,
    collectionInfo,
  );
  const isTextField = collectionInfo?.text_field === field.name;
  
  // Ref for the first input field to enable autofocus
  const firstInputRef = useRef<HTMLInputElement>(null);
  
  // Auto-focus the field if requested
  useEffect(() => {
    if (shouldAutoFocus && firstInputRef.current) {
      // Small delay to ensure the component is fully rendered
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoFocus]);

  // Get validation for this field
  const validation = validateField(field.name, formData[field.name] || []);

  // Get appropriate help topic based on field type
  const getFieldHelpTopic = () => {
    if (field.name.toLowerCase().includes("date")) return "date_range";
    if (field.possible_values?.length > 0) return "field_selection";
    return "search_terms"; // Default for text fields
  };

  // Helper function to get validation icon and color
  const getValidationIcon = () => {
    switch (validation.status) {
      case "valid":
        return { icon: <CheckCircle />, color: "success.main" };
      case "warning":
        return { icon: <Warning />, color: "warning.main" };
      case "error":
        return { icon: <ErrorIcon />, color: "error.main" };
      default:
        return null;
    }
  };

  // Helper function to get border styles based on validation
  const getInputStyles = (entry: any, index: number) => {
    let borderColor = "inherit";
    let borderWidth = 1;
    let backgroundColor = "transparent";

    // Boolean operator styling (base layer)
    if (entry.not) {
      borderColor = "error.main";
      borderWidth = 2;
      backgroundColor = "rgba(244, 67, 54, 0.05)";
    } else if (entry.operator === "AND") {
      borderColor = "success.main";
      borderWidth = 2;
      backgroundColor = "rgba(76, 175, 80, 0.05)";
    } else if (entry.operator === "OR") {
      borderColor = "info.main";
      borderWidth = 2;
      backgroundColor = "rgba(33, 150, 243, 0.05)";
    }

    // Validation styling
    if (validation.status === "error") {
      borderColor = "error.main";
      borderWidth = 2;
      backgroundColor = "rgba(244, 67, 54, 0.08)";
    } else if (
      validation.status === "valid" &&
      validation.hasValue &&
      !entry.operator &&
      !entry.not
    ) {
      borderColor = "success.light";
      borderWidth = 1;
    }

    // Special treatment for primary text field
    if (isTextField && validation.status !== "error") {
      borderWidth = Math.max(borderWidth, 1);
    }

    return {
      "& .MuiOutlinedInput-root": {
        borderColor,
        borderWidth,
        backgroundColor,
        fontWeight: isTextField ? 600 : "inherit",
        transition: "all 0.2s ease",
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor,
          borderWidth: borderWidth + 1,
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor,
          borderWidth: borderWidth + 1,
          boxShadow: `0 0 0 2px ${
            borderColor === "error.main"
              ? "rgba(244, 67, 54, 0.2)"
              : borderColor === "success.main"
                ? "rgba(76, 175, 80, 0.2)"
                : borderColor === "info.main"
                  ? "rgba(33, 150, 243, 0.2)"
                  : "rgba(102, 126, 234, 0.2)"
          }`,
        },
      },
    };
  };

  const validationIcon = getValidationIcon();

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        border: isTextField ? "2px solid" : "1px solid",
        borderColor: isTextField
          ? "primary.main"
          : validation.status === "error"
            ? "error.main"
            : validation.status === "warning"
              ? "warning.main"
              : validation.status === "valid"
                ? "success.light"
                : "divider",
        position: "relative",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "visible",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: isTextField ? 6 : 3,
          borderColor: isTextField ? "primary.dark" : validation.status === "error" ? "error.main" : "primary.light",
        },
        ...(isTextField && {
          background: (theme) => `linear-gradient(135deg, 
            ${theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.04)'} 0%, 
            ${theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.02)' : 'rgba(25, 118, 210, 0.01)'} 100%)`,
        }),
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        {/* Field Header with Help */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {field.name}
          </Typography>
          <ContextHelp topic={getFieldHelpTopic()} size="small" />
          {validationIcon && (
            <Box
              sx={{
                color: validationIcon.color,
                display: "flex",
                alignItems: "center",
              }}
            >
              {validationIcon.icon}
            </Box>
          )}
        </Box>

        {/* Field Status Indicators */}
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {isTextField && (
            <Chip
              label="Primary Text Field"
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
          {hasEmbeddings && isTextField && (
            <Tooltip title="Find words with similar meanings using AI. Click ⭐ to get suggestions.">
              <Chip
                label="AI Search"
                size="small"
                color="secondary"
                variant="outlined"
                icon={<Star />}
              />
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Validation Message */}
      <Collapse
        in={validation.status !== "empty" && validation.status !== "valid"}
      >
        <Alert
          severity={validation.status as any}
          sx={{ mb: 2, fontSize: "0.875rem" }}
          icon={false}
        >
          {validation.message}
        </Alert>
      </Collapse>

      {/* Suggestions */}
      <Collapse
        in={validation.suggestions && validation.suggestions.length > 0}
      >
        <Box sx={{ mb: 2 }}>
          {validation.suggestions?.map((suggestion, index) => (
            <Box
              key={index}
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}
            >
              <Lightbulb sx={{ fontSize: 16, color: "info.main" }} />
              <Typography variant="caption" color="info.main">
                {suggestion}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      {/* Form Fields */}
      {field.possible_values?.length > 0 ? (
        <Box>
          {formData[field.name]?.map((entry: any, idx: number) => (
            <Box
              key={`${field.name}-${idx}`}
              sx={{ mb: idx < formData[field.name].length - 1 ? 2 : 0 }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Tooltip
                  title={
                    entry.not ? "Click to include this value" : "Click to exclude this value"
                  }
                >
                  <Button
                    variant={entry.not ? "contained" : "outlined"}
                    color={entry.not ? "error" : "success"}
                    size="small"
                    onClick={() => onToggleNot(field.name, idx)}
                    sx={{
                      minWidth: 80,
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: "none",
                      fontSize: "0.75rem",
                      backgroundColor: entry.not ? "error.main" : "transparent",
                      borderColor: entry.not ? "error.main" : "success.main",
                      color: entry.not ? "white" : "success.main",
                      "&:hover": {
                        backgroundColor: entry.not ? "error.dark" : "success.light",
                        borderColor: entry.not ? "error.dark" : "success.main",
                        color: entry.not ? "white" : "white",
                        transform: "translateY(-1px)",
                        boxShadow: 3,
                      },
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {entry.not ? "Exclude" : "Include"}
                  </Button>
                </Tooltip>

                <Box sx={{ flexGrow: 1 }}>
                  <Autocomplete
                    options={field.possible_values}
                    value={entry.value || null}
                    onChange={(_, newValue) =>
                      onSelectChange(field.name, newValue, idx)
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder={`Select ${field.name}...`}
                        sx={getInputStyles(entry, idx)}
                      />
                    )}
                  />
                </Box>

                {idx > 0 && (
                  <IconButton
                    onClick={() => onRemoveBooleanField(field.name, idx)}
                    size="small"
                    color="error"
                    sx={{
                      bgcolor: "error.light",
                      "&:hover": { bgcolor: "error.main", color: "white" },
                    }}
                  >
                    <Remove />
                  </IconButton>
                )}
              </Box>

              {idx === formData[field.name].length - 1 && entry.value && entry.value.trim() && (
                <ButtonGroup size="small" variant="contained" sx={{ mt: 2, width: "100%" }}>
                  <Button
                    onClick={() => onAddBooleanField(field.name, "AND")}
                    color="success"
                    startIcon={<Add />}
                    sx={{
                      flex: 1,
                      fontWeight: 600,
                      "&:hover": {
                        boxShadow: 3,
                        transform: "translateY(-1px)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    AND
                    <ContextHelp
                      topic="and_operator"
                      variant="inline"
                      size="small"
                    />
                  </Button>
                  <Button
                    onClick={() => onAddBooleanField(field.name, "OR")}
                    color="info"
                    startIcon={<Add />}
                    sx={{
                      flex: 1,
                      fontWeight: 600,
                      "&:hover": {
                        boxShadow: 3,
                        transform: "translateY(-1px)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    OR
                    <ContextHelp
                      topic="or_operator"
                      variant="inline"
                      size="small"
                    />
                  </Button>
                </ButtonGroup>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Box>
          {formData[field.name]?.map((entry: any, idx: number) => (
            <Box
              key={`${field.name}-${idx}`}
              sx={{ mb: idx < formData[field.name].length - 1 ? 2 : 0 }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
              >
                <Tooltip
                  title={
                    entry.not ? "Click to include this value" : "Click to exclude this value"
                  }
                >
                  <Button
                    variant={entry.not ? "contained" : "outlined"}
                    color={entry.not ? "error" : "success"}
                    size="small"
                    onClick={() => onToggleNot(field.name, idx)}
                    sx={{
                      minWidth: 80,
                      fontWeight: 600,
                      borderRadius: 2,
                      textTransform: "none",
                      fontSize: "0.75rem",
                      backgroundColor: entry.not ? "error.main" : "transparent",
                      borderColor: entry.not ? "error.main" : "success.main",
                      color: entry.not ? "white" : "success.main",
                      "&:hover": {
                        backgroundColor: entry.not ? "error.dark" : "success.light",
                        borderColor: entry.not ? "error.dark" : "success.main",
                        color: entry.not ? "white" : "white",
                        transform: "translateY(-1px)",
                        boxShadow: 3,
                      },
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {entry.not ? "Exclude" : "Include"}
                  </Button>
                </Tooltip>

                <Box sx={{ flexGrow: 1 }}>
                  <TextField
                    name={field.name}
                    value={entry.value}
                    onChange={(e) => onFormChange(e, idx)}
                    size="small"
                    fullWidth
                    placeholder={`Enter ${field.name}...`}
                    inputRef={idx === 0 && shouldAutoFocus ? firstInputRef : undefined}
                    InputProps={{
                      endAdornment: idx === 0 &&
                        hasEmbeddings &&
                        isTextField && (
                          <Tooltip title="Find similar words using AI embeddings">
                            <IconButton
                              onClick={() =>
                                onFetchNeighbors(entry.value, field.name)
                              }
                              disabled={
                                loadingNeighbors[field.name] || !entry.value
                              }
                              size="small"
                              color="primary"
                              sx={{
                                "&:hover": {
                                  bgcolor: "primary.light",
                                  color: "white",
                                },
                              }}
                            >
                              {loadingNeighbors[field.name] ? (
                                <CircularProgress size={16} />
                              ) : (
                                <Star />
                              )}
                            </IconButton>
                          </Tooltip>
                        ),
                    }}
                    sx={getInputStyles(entry, idx)}
                  />
                </Box>

                {idx > 0 && (
                  <IconButton
                    onClick={() => onRemoveBooleanField(field.name, idx)}
                    size="small"
                    color="error"
                    sx={{
                      bgcolor: "error.light",
                      "&:hover": { bgcolor: "error.main", color: "white" },
                    }}
                  >
                    <Remove />
                  </IconButton>
                )}
              </Box>

              {neighbors[field.name] && idx === 0 && (
                <Box sx={{ 
                  mb: 2, 
                  p: 2, 
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.15)' : 'primary.50',
                  borderRadius: 2,
                  border: 1,
                  borderColor: "primary.main"
                }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Star sx={{ fontSize: 18, color: "primary.main" }} />
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, color: "primary.main" }}
                      >
                        AI Suggestions
                      </Typography>
                      <Chip 
                        label={neighbors[field.name].length} 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => onRemoveNeighborDropdown(field.name)}
                      sx={{ 
                        fontSize: "0.75rem",
                        color: "primary.main",
                        "&:hover": {
                          bgcolor: "primary.light",
                          color: "white",
                        }
                      }}
                    >
                      Hide
                    </Button>
                  </Box>
                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}
                  >
                    {neighbors[field.name].map(
                      (neighbor: string, index: number) => (
                        <Chip
                          key={index}
                          label={neighbor}
                          size="small"
                          clickable
                          variant="outlined"
                          color="primary"
                          onClick={() =>
                            onSelectChange(field.name, neighbor, idx)
                          }
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            "&:hover": {
                              bgcolor: "primary.main",
                              color: "white",
                              transform: "translateY(-2px)",
                              boxShadow: 2,
                            },
                            transition: "all 0.2s ease",
                          }}
                        />
                      ),
                    )}
                  </Box>
                </Box>
              )}

              {idx === formData[field.name].length - 1 && entry.value && entry.value.trim() && (
                <ButtonGroup size="small" variant="contained" sx={{ mt: 2, width: "100%" }}>
                  <Button
                    onClick={() => onAddBooleanField(field.name, "AND")}
                    color="success"
                    startIcon={<Add />}
                    sx={{
                      flex: 1,
                      fontWeight: 600,
                      "&:hover": {
                        boxShadow: 3,
                        transform: "translateY(-1px)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    AND
                    <ContextHelp
                      topic="and_operator"
                      variant="inline"
                      size="small"
                    />
                  </Button>
                  <Button
                    onClick={() => onAddBooleanField(field.name, "OR")}
                    color="info"
                    startIcon={<Add />}
                    sx={{
                      flex: 1,
                      fontWeight: 600,
                      "&:hover": {
                        boxShadow: 3,
                        transform: "translateY(-1px)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    OR
                    <ContextHelp
                      topic="or_operator"
                      variant="inline"
                      size="small"
                    />
                  </Button>
                </ButtonGroup>
              )}
            </Box>
          ))}
        </Box>
      )}
      </CardContent>
    </Card>
  );
};

export default React.memo(FormField);

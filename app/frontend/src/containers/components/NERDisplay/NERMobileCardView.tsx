import React, { useState, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  IconButton,
  Collapse,
  TextField,
  InputAdornment,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Alert,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Search,
  Visibility,
  Clear,
  TableChart,
} from "@mui/icons-material";

interface NERMobileCardViewProps {
  displayEntities: any[];
  stats: any;
  onIdClick: (id: string) => void;
  isLoading?: boolean;
}

const NERMobileCardView: React.FC<NERMobileCardViewProps> = ({
  displayEntities,
  stats,
  onIdClick,
  isLoading = false,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>("");
  const [filterText, setFilterText] = useState("");
  
  const theme = useTheme();
  const isVerySmallScreen = useMediaQuery('(max-width:400px)');

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = displayEntities;

    // Apply search filter
    if (filterText.trim()) {
      const searchLower = filterText.toLowerCase();
      filtered = filtered.filter(entity =>
        entity.text?.toLowerCase().includes(searchLower) ||
        entity.labelFull?.toLowerCase().includes(searchLower) ||
        entity.id?.toString().includes(searchLower)
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (sortField === 'confidence') {
          return (bVal || 0) - (aVal || 0); // Sort confidence descending
        }
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    }

    return filtered;
  }, [displayEntities, filterText, sortField]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = processedData.slice(startIndex, startIndex + pageSize);

  const toggleCardExpansion = (entityId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(entityId)) {
      newExpanded.delete(entityId);
    } else {
      newExpanded.add(entityId);
    }
    setExpandedCards(newExpanded);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'success';
    if (confidence > 0.6) return 'warning';
    return 'error';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence > 0.8) return 'High';
    if (confidence > 0.6) return 'Medium';
    return 'Low';
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} sx={{ mb: 2 }}>
            <CardContent>
              <Stack spacing={1}>
                <Skeleton variant="text" width="30%" height={24} />
                <Skeleton variant="rectangular" width="60%" height={32} />
                <Skeleton variant="text" width="100%" height={20} />
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="rectangular" width={80} height={24} />
                  <Skeleton variant="rectangular" width={60} height={24} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  // Empty state
  if (processedData.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Alert severity="info">
          {filterText ? `No entities found for "${filterText}"` : "No entities to display"}
        </Alert>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Fixed Header with Info and Controls */}
      <Box sx={{ p: { xs: 1, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        {/* Header Info */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="subtitle1"
            sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
          >
            <TableChart fontSize="small" />
            Entity Details
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            <Chip
              label={`${displayEntities.length} entities`}
              size="small"
              color="primary"
            />
            {displayEntities.length !== stats.totalEntities && (
              <Chip
                label={`${((displayEntities.length / stats.totalEntities) * 100).toFixed(1)}% shown`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>

        {/* Search and Filter Controls */}
        <Stack spacing={2}>
          <TextField
            size="small"
            placeholder="Search entities..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: filterText && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFilterText("")}>
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 100, flex: 1 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={sortField}
                label="Sort by"
                onChange={(e) => setSortField(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="confidence">Confidence</MenuItem>
                <MenuItem value="text">Entity Text</MenuItem>
                <MenuItem value="labelFull">Type</MenuItem>
                <MenuItem value="start">Position</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 80, flex: 0 }}>
              <InputLabel>Per page</InputLabel>
              <Select
                value={pageSize}
                label="Per page"
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <MenuItem value={5}>5</MenuItem>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {/* Results Summary */}
          <Typography variant="caption" color="text.secondary">
            Showing {startIndex + 1}-{Math.min(startIndex + pageSize, processedData.length)} of {processedData.length} entities
          </Typography>
        </Stack>
      </Box>

      {/* Scrollable Content Area */}
      <Box 
        sx={{ 
          flex: 1,
          overflow: 'auto',
          p: { xs: 1, sm: 2 },
          pb: { xs: 2, sm: 3 }
        }}
      >
        {/* Entity Cards */}
        <Stack spacing={{ xs: 1.5, sm: 2 }}>
          {paginatedData.map((entity, index) => {
            const entityId = `${entity.id}-${entity.start}-${index}`;
            const isExpanded = expandedCards.has(entityId);
            const confidence = entity.confidence || 0;
            const confidenceColor = getConfidenceColor(confidence);
            
            return (
              <Card 
                key={entityId} 
                variant="outlined"
                sx={{ 
                  '&:hover': { 
                    boxShadow: 2,
                    transform: 'translateY(-1px)',
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
                  {/* Header Row */}
                  <Stack 
                    direction="row" 
                    justifyContent="space-between" 
                    alignItems="flex-start"
                    sx={{ mb: 1.5 }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Document ID */}
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                      >
                        Document ID
                      </Typography>
                      <Typography 
                        variant="subtitle2" 
                        color="primary"
                        noWrap
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                          fontSize: { xs: '0.875rem', sm: '0.95rem' },
                          fontWeight: 600
                        }}
                        onClick={() => onIdClick(entity.id)}
                      >
                        {entity.id}
                      </Typography>
                    </Box>
                    
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                      <IconButton 
                        size="small" 
                        onClick={() => onIdClick(entity.id)}
                        color="primary"
                      >
                        <Visibility fontSize="small" />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => toggleCardExpansion(entityId)}
                      >
                        {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </Stack>

                  {/* Entity Text with Styling */}
                  <Box 
                    sx={{ 
                      mb: 1.5,
                      backgroundColor: `${entity.color}20`,
                      padding: { xs: '6px 10px', sm: '8px 12px' },
                      borderRadius: 1,
                      border: `1px solid ${entity.color}40`,
                      display: 'inline-block',
                      maxWidth: '100%'
                    }}
                  >
                    <Typography 
                      variant="body1"
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.9rem', sm: '1rem' },
                        color: 'text.primary',
                        wordBreak: 'break-word'
                      }}
                    >
                      {entity.text}
                    </Typography>
                  </Box>

                  {/* Entity Type and Confidence */}
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                    <Chip
                      label={entity.labelFull}
                      size="small"
                      sx={{
                        backgroundColor: entity.color,
                        color: 'white',
                        fontWeight: 600,
                        fontSize: { xs: '0.7rem', sm: '0.75rem' }
                      }}
                    />
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <LinearProgress
                        variant="determinate"
                        value={confidence * 100}
                        color={confidenceColor}
                        sx={{ 
                          width: { xs: 40, sm: 60 }, 
                          height: { xs: 4, sm: 6 }, 
                          borderRadius: 3 
                        }}
                      />
                      <Chip
                        label={`${(confidence * 100).toFixed(1)}%`}
                        size="small"
                        color={confidenceColor}
                        variant="outlined"
                        sx={{ 
                          fontSize: { xs: '0.65rem', sm: '0.7rem' },
                          height: { xs: 20, sm: 24 }
                        }}
                      />
                      <Chip
                        label={getConfidenceLabel(confidence)}
                        size="small"
                        color={confidenceColor}
                        sx={{ 
                          fontSize: { xs: '0.65rem', sm: '0.7rem' },
                          height: { xs: 20, sm: 24 }
                        }}
                      />
                    </Box>
                  </Stack>

                  {/* Expanded Content */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Stack spacing={1.5}>
                        <Box>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                          >
                            Position in Text
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: { xs: '0.875rem', sm: '0.95rem' },
                              mt: 0.5
                            }}
                          >
                            Characters {entity.start} - {entity.end}
                          </Typography>
                        </Box>
                        
                        <Box>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                          >
                            Confidence Score
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: { xs: '0.875rem', sm: '0.95rem' },
                              mt: 0.5
                            }}
                          >
                            {(confidence * 100).toFixed(2)}% ({getConfidenceLabel(confidence)} confidence)
                          </Typography>
                        </Box>

                        <Box>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                          >
                            Entity Type Details
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: { xs: '0.875rem', sm: '0.95rem' },
                              mt: 0.5
                            }}
                          >
                            {entity.labelFull} ({entity.label || 'N/A'})
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            );
          })}
        </Stack>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
              color="primary"
              size={isVerySmallScreen ? "small" : "medium"}
              showFirstButton={totalPages > 5 && !isVerySmallScreen}
              showLastButton={totalPages > 5 && !isVerySmallScreen}
              siblingCount={isVerySmallScreen ? 0 : 1}
              sx={{
                '& .MuiPaginationItem-root': {
                  fontSize: isVerySmallScreen ? '0.75rem' : '0.875rem',
                  minWidth: isVerySmallScreen ? 28 : 32,
                  height: isVerySmallScreen ? 28 : 32,
                }
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default React.memo(NERMobileCardView);
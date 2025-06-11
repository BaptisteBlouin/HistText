import React, { useState, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
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
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  ExpandMore,
  ExpandLess,
  Search,
  Visibility,
  FilterList,
  Clear,
} from "@mui/icons-material";

interface MobileCardViewProps {
  rowData: any[];
  columnDefs: any[];
  onIdClick?: (id: string) => void;
  isLoading?: boolean;
  showConcordance?: boolean;
  searchText?: string;
  onSearchChange?: (text: string) => void;
}

const MobileCardView: React.FC<MobileCardViewProps> = ({
  rowData,
  columnDefs,
  onIdClick,
  isLoading = false,
  showConcordance = false,
  searchText = "",
  onSearchChange,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>("");
  const [filterText, setFilterText] = useState("");
  
  const theme = useTheme();
  const isVerySmallScreen = useMediaQuery('(max-width:400px)');

  // Get important columns for display
  const getDisplayColumns = () => {
    // Find ID column
    const idColumn = columnDefs.find(col => 
      col.field?.toLowerCase().includes('id') || 
      col.headerName?.toLowerCase().includes('id')
    );
    
    // Find main text column (usually the longest content)
    const textColumn = columnDefs.find(col => 
      col.cellClass?.includes?.('main-column') ||
      col.field?.toLowerCase().includes('text') ||
      col.field?.toLowerCase().includes('content') ||
      col.field?.toLowerCase().includes('body')
    );
    
    // Find other important columns (exclude very long text fields from preview)
    const metadataColumns = columnDefs.filter(col => 
      col !== idColumn && 
      col !== textColumn && 
      !col.hide &&
      col.field !== 'actions'
    );

    return { idColumn, textColumn, metadataColumns };
  };

  const { idColumn, textColumn, metadataColumns } = getDisplayColumns();

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = rowData;

    // Apply search filter
    if (filterText.trim()) {
      const searchLower = filterText.toLowerCase();
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    }

    return filtered;
  }, [rowData, filterText, sortField]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = processedData.slice(startIndex, startIndex + pageSize);

  const toggleCardExpansion = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const truncateText = (text: string, maxLength: number = 120) => {
    if (!text) return "";
    const cleanText = String(text).replace(/\s+/g, ' ').trim();
    return cleanText.length > maxLength ? `${cleanText.substring(0, maxLength)}...` : cleanText;
  };

  const formatValue = (value: any, column: any) => {
    if (value == null) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (column.field?.toLowerCase().includes('date')) {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    return String(value);
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
                <Skeleton variant="text" width="100%" height={20} />
                <Skeleton variant="text" width="80%" height={20} />
                <Stack direction="row" spacing={1}>
                  <Skeleton variant="rectangular" width={60} height={24} />
                  <Skeleton variant="rectangular" width={80} height={24} />
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
          {filterText ? `No results found for "${filterText}"` : "No data to display"}
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
      {/* Fixed Header with Controls */}
      <Box sx={{ p: { xs: 1, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        {/* Search and Filter Controls */}
        <Stack spacing={2}>
          <TextField
            size="small"
            placeholder="Search in results..."
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
                {metadataColumns.slice(0, 5).map((col) => (
                  <MenuItem key={col.field} value={col.field}>
                    {(col.headerName || col.field).substring(0, 15)}
                  </MenuItem>
                ))}
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
            Showing {startIndex + 1}-{Math.min(startIndex + pageSize, processedData.length)} of {processedData.length} results
          </Typography>
        </Stack>
      </Box>

      {/* Scrollable Content Area */}
      <Box 
        sx={{ 
          flex: 1,
          overflow: 'auto',
          p: { xs: 1, sm: 2 },
          pb: { xs: 2, sm: 3 } // Extra padding at bottom for last card
        }}
      >
        {/* Card List */}
        <Stack spacing={{ xs: 1.5, sm: 2 }}>
          {paginatedData.map((row, index) => {
            const rowId = row[idColumn?.field] || `row-${index}`;
            const isExpanded = expandedCards.has(String(rowId));
            
            return (
              <Card 
                key={rowId} 
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
                      {/* ID and Main Identifier */}
                      {idColumn && (
                        <Typography 
                          variant="subtitle2" 
                          color="primary"
                          noWrap
                          sx={{ 
                            cursor: onIdClick ? 'pointer' : 'default',
                            '&:hover': onIdClick ? { textDecoration: 'underline' } : {},
                            fontSize: { xs: '0.875rem', sm: '0.95rem' }
                          }}
                          onClick={() => onIdClick?.(String(rowId))}
                        >
                          ID: {formatValue(row[idColumn.field], idColumn)}
                        </Typography>
                      )}
                    </Box>
                    
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
                      {onIdClick && (
                        <IconButton 
                          size="small" 
                          onClick={() => onIdClick(String(rowId))}
                          color="primary"
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      )}
                      <IconButton 
                        size="small" 
                        onClick={() => toggleCardExpansion(String(rowId))}
                      >
                        {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </Stack>

                  {/* Preview Content */}
                  {textColumn && (
                    <Typography 
                      variant="body2" 
                      color="text.primary"
                      sx={{ 
                        mb: 1.5, 
                        lineHeight: 1.4,
                        fontSize: { xs: '0.875rem', sm: '0.95rem' },
                        wordBreak: 'break-word'
                      }}
                    >
                      {isExpanded 
                        ? formatValue(row[textColumn.field], textColumn)
                        : truncateText(formatValue(row[textColumn.field], textColumn), 120)
                      }
                    </Typography>
                  )}

                  {/* Metadata Chips */}
                  <Box sx={{ mb: 1 }}>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                      {metadataColumns.slice(0, isExpanded ? metadataColumns.length : 2).map((col) => {
                        const value = row[col.field];
                        if (!value) return null;
                        
                        const displayValue = String(formatValue(value, col));
                        const truncatedValue = displayValue.length > 20 ? displayValue.substring(0, 20) + '...' : displayValue;
                        
                        return (
                          <Chip
                            key={col.field}
                            label={`${col.headerName || col.field}: ${truncatedValue}`}
                            size="small"
                            variant="outlined"
                            sx={{ 
                              fontSize: { xs: '0.7rem', sm: '0.75rem' },
                              height: { xs: 24, sm: 28 }
                            }}
                          />
                        );
                      })}
                      {!isExpanded && metadataColumns.length > 2 && (
                        <Chip
                          label={`+${metadataColumns.length - 2} more`}
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => toggleCardExpansion(String(rowId))}
                          sx={{ 
                            fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                            cursor: 'pointer',
                            height: { xs: 24, sm: 28 }
                          }}
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Expanded Content */}
                  <Collapse in={isExpanded}>
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Stack spacing={1.5}>
                        {metadataColumns.map((col) => (
                          <Box key={col.field}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              sx={{ fontWeight: 600, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                            >
                              {col.headerName || col.field}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: { xs: '0.875rem', sm: '0.95rem' },
                                wordBreak: 'break-word',
                                mt: 0.5
                              }}
                            >
                              {formatValue(row[col.field], col)}
                            </Typography>
                          </Box>
                        ))}
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

export default React.memo(MobileCardView);
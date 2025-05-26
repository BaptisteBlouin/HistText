import { useState, useMemo } from 'react';

// Memoized filtering function
const useFilteredEntities = (
  entities: any[], 
  searchTerm: string, 
  selectedLabels: string[], 
  minConfidence: number,
  sortBy: string,
  sortOrder: 'asc' | 'desc'
) => {
  return useMemo(() => {
    let filtered = entities;

    // Apply filters only if needed
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entity => 
        entity.textLower.includes(searchLower) ||
        entity.labelFull.toLowerCase().includes(searchLower) ||
        entity.id.toLowerCase().includes(searchLower)
      );
    }

    if (selectedLabels.length > 0) {
      const labelSet = new Set(selectedLabels);
      filtered = filtered.filter(entity => labelSet.has(entity.label));
    }

    if (minConfidence > 0) {
      filtered = filtered.filter(entity => entity.confidence >= minConfidence);
    }

    // Optimized sorting
    if (sortBy && filtered.length > 0) {
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'text':
            comparison = a.textLower.localeCompare(b.textLower);
            break;
          case 'label':
            comparison = a.labelFull.localeCompare(b.labelFull);
            break;
          case 'confidence':
            comparison = a.confidence - b.confidence;
            break;
          case 'id':
            comparison = a.id.localeCompare(b.id);
            break;
          default:
            comparison = 0;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }, [entities, searchTerm, selectedLabels, minConfidence, sortBy, sortOrder]);
};

export const useNERFilters = (entities: any[], stats: any) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [quickFilterMode, setQuickFilterMode] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Memoized unique labels
  const uniqueLabels = useMemo(() => 
    Array.from(new Set(entities.map(e => e.label))), [entities]
  );

  // Memoized filtered data
  const filteredEntities = useFilteredEntities(
    entities, searchTerm, selectedLabels, minConfidence, sortBy, sortOrder
  );

  // Quick filter effect
  const displayEntities = useMemo(() => {
    if (quickFilterMode === 'all') return filteredEntities;
    
    const confidenceMap = {
      'high': (e: any) => e.confidence > 0.8,
      'medium': (e: any) => e.confidence > 0.6 && e.confidence <= 0.8,
      'low': (e: any) => e.confidence <= 0.6
    };
    
    return filteredEntities.filter(confidenceMap[quickFilterMode]);
  }, [filteredEntities, quickFilterMode]);

  const clearAllFilters = () => {
    setSelectedLabels([]);
    setSearchTerm('');
    setMinConfidence(0);
    setQuickFilterMode('all');
  };

  return {
    searchTerm,
    setSearchTerm,
    selectedLabels,
    setSelectedLabels,
    minConfidence,
    setMinConfidence,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    showAdvancedFilters,
    setShowAdvancedFilters,
    quickFilterMode,
    setQuickFilterMode,
    filteredEntities,
    displayEntities,
    uniqueLabels,
    clearAllFilters
  };
};
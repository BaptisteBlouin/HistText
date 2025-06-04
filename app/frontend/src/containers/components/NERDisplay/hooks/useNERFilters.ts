import { useState, useMemo } from 'react';

/**
 * Memoized hook to filter and sort entities based on search term, labels, confidence, and sorting preferences.
 * 
 * @param entities Array of entity objects to filter.
 * @param searchTerm Text to search within entity text, label, or document ID.
 * @param selectedLabels Array of selected entity labels to filter.
 * @param minConfidence Minimum confidence threshold.
 * @param sortBy Property to sort by ('text', 'label', 'confidence', 'id').
 * @param sortOrder Sort direction: ascending ('asc') or descending ('desc').
 * @returns Filtered and sorted array of entities.
 */
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

/**
 * Custom React hook to manage entity filtering, sorting, and quick filtering states.
 * 
 * @param entities Array of entities to filter.
 * @param stats Optional statistics (currently unused, reserved for future use).
 * @returns Filtering state and handlers for managing entity filters and sorting.
 */
export const useNERFilters = (entities: any[], stats: any) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>('confidence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [quickFilterMode, setQuickFilterMode] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const uniqueLabels = useMemo(() => 
    Array.from(new Set(entities.map(e => e.label))), [entities]
  );

  const filteredEntities = useFilteredEntities(
    entities, searchTerm, selectedLabels, minConfidence, sortBy, sortOrder
  );

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
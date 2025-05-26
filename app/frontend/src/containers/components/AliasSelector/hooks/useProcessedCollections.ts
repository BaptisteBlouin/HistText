import { useMemo } from 'react';

interface CollectionInfo {
  name: string;
  description: string;
  isSelected: boolean;
  matchesSearch: boolean;
}

export const useProcessedCollections = (
  aliases: string[],
  descriptions: Record<string, string>,
  selectedAlias: string,
  searchTerm: string
) => {
  const processedCollections = useMemo(() => {
    const collections: CollectionInfo[] = aliases.map(alias => ({
      name: alias,
      description: descriptions[alias] || 'No description available',
      isSelected: alias === selectedAlias,
      matchesSearch: !searchTerm || 
        alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (descriptions[alias] || '').toLowerCase().includes(searchTerm.toLowerCase())
    }));

    return collections.filter(col => col.matchesSearch);
  }, [aliases, descriptions, selectedAlias, searchTerm]);

  const selectedCollection = useMemo(() => 
    processedCollections.find(col => col.isSelected) || null
  , [processedCollections]);

  return {
    processedCollections,
    selectedCollection
  };
};
import { useMemo } from 'react';

interface CollectionInfo {
  name: string;
  description: string;
  isSelected: boolean;
  matchesSearch: boolean;
}

/**
 * Custom hook for processing collection alias data for selector UIs.
 *
 * Returns a filtered and annotated list of collections based on the search term,
 * along with the currently selected collection object (if any).
 *
 * @param aliases - Array of collection aliases.
 * @param descriptions - Map of alias to description.
 * @param selectedAlias - The currently selected alias.
 * @param searchTerm - Search term for filtering collections.
 * @returns An object with processedCollections (filtered, annotated) and selectedCollection.
 */
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
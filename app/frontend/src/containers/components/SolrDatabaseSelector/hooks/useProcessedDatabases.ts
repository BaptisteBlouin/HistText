import { useMemo } from 'react';

interface SolrDatabase {
  id: number;
  name: string;
  local_port: number;
  description?: string;
}

interface DatabaseInfo {
  database: SolrDatabase;
  isSelected: boolean;
  matchesSearch: boolean;
}

export const useProcessedDatabases = (
  solrDatabases: SolrDatabase[],
  selectedSolrDatabase: SolrDatabase | null,
  searchTerm: string
) => {
  const processedDatabases = useMemo(() => {
    const databases: DatabaseInfo[] = solrDatabases.map(db => ({
      database: db,
      isSelected: db.id === selectedSolrDatabase?.id,
      matchesSearch: !searchTerm || 
        db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (db.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    }));

    return databases.filter(db => db.matchesSearch);
  }, [solrDatabases, selectedSolrDatabase, searchTerm]);

  const selectedDatabase = useMemo(() => 
    processedDatabases.find(db => db.isSelected) || null
  , [processedDatabases]);

  return {
    processedDatabases,
    selectedDatabase
  };
};
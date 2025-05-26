interface SolrDatabase {
  id: number;
  name: string;
  local_port: number;
  description?: string;
}

export const truncateDescription = (description: string, maxLength: number = 80): string => {
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + '...';
};

export const getDatabaseInitials = (name: string): string => {
  return name
    .split(/[-_\s]/)
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};

export const getDatabaseDescription = (database: SolrDatabase): string => {
  return database.description || 'No description available';
};
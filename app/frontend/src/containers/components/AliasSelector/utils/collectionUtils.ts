export const truncateDescription = (description: string, maxLength: number = 120): string => {
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + '...';
};

export const getCollectionInitials = (name: string): string => {
  return name
    .split(/[-_\s]/)
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
};
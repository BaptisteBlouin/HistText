/**
 * Truncates a description string to a specified maximum length and adds ellipsis.
 *
 * @param description - The text to truncate.
 * @param maxLength - Maximum allowed length before truncating (default: 120).
 * @returns Truncated string with '...' appended if longer than maxLength.
 */
export const truncateDescription = (
  description: string,
  maxLength: number = 120,
): string => {
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
};

/**
 * Generates collection initials from a collection name.
 * Splits on dash, underscore, or whitespace, takes first two initials.
 *
 * @param name - The collection name.
 * @returns Uppercase initials (up to two characters).
 */
export const getCollectionInitials = (name: string): string => {
  return name
    .split(/[-_\s]/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
};

/**
 * Determines if a field should be excluded from display based on its name and collection config.
 * Fields related to dates or explicitly marked to be hidden are excluded.
 *
 * @param fieldName - The name of the field to check.
 * @param collectionInfo - Collection metadata, may contain a list of fields to exclude.
 * @returns True if the field should be excluded; otherwise false.
 */
export const shouldExcludeField = (fieldName: string, collectionInfo: any): boolean => {
  if (
    fieldName.toLowerCase().includes('date') ||
    fieldName.toLowerCase().includes('year') ||
    fieldName.toLowerCase().includes('month') ||
    fieldName.toLowerCase().includes('day')
  ) {
    return true;
  }

  if (collectionInfo?.to_not_display && collectionInfo.to_not_display.includes(fieldName)) {
    return true;
  }

  return false;
};

/**
 * Checks if the given field is the primary text field for the collection.
 *
 * @param fieldName - The field name to check.
 * @param collectionInfo - Collection metadata containing the text_field designation.
 * @returns True if the field is the primary text field; otherwise false.
 */
export const isTextField = (fieldName: string, collectionInfo: any): boolean => {
  return collectionInfo?.text_field === fieldName;
};

/**
 * Assigns a priority number to a field based on its name for sorting purposes.
 * Lower numbers mean higher priority.
 *
 * Priority:
 * 1 - fields containing 'title'
 * 2 - fields containing 'content', 'text', or 'body'
 * 3 - fields containing 'date'
 * 10 - fields containing 'id'
 * 5 - all others
 *
 * @param field - Field object with a 'name' property.
 * @returns Numeric priority for sorting.
 */
export const getFieldPriority = (field: any): number => {
  const name = field.name.toLowerCase();
  if (name.includes('title')) return 1;
  if (name.includes('content') || name.includes('text') || name.includes('body')) return 2;
  if (name.includes('date')) return 3;
  if (name.includes('id')) return 10;
  return 5;
};

/**
 * Sorts an array of field objects by priority determined from their names.
 *
 * @param fields - Array of field objects each containing a 'name' property.
 * @returns A new array sorted by field priority ascending.
 */
export const sortFieldsByPriority = (fields: any[]): any[] => {
  return [...fields].sort((a, b) => getFieldPriority(a) - getFieldPriority(b));
};
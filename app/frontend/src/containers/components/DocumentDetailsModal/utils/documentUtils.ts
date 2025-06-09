/**
 * Returns a string icon name for a given document field.
 *
 * @param fieldName - Name of the document field.
 * @returns Icon name as a string.
 */
export const getFieldIcon = (fieldName: string) => {
  const name = fieldName.toLowerCase();
  if (name.includes("title") || name.includes("name")) return "Article";
  if (
    name.includes("content") ||
    name.includes("text") ||
    name.includes("body")
  )
    return "Description";
  if (name.includes("date") || name.includes("time")) return "Info";
  if (name.includes("id")) return "DataObject";
  return "Label";
};

/**
 * Determines the priority (sort order) for a document field.
 *
 * @param fieldName - Name of the document field.
 * @returns Numeric priority, lower is higher priority.
 */
export const getFieldPriority = (fieldName: string): number => {
  const name = fieldName.toLowerCase();
  if (name.includes("title")) return 1;
  if (
    name.includes("content") ||
    name.includes("text") ||
    name.includes("body")
  )
    return 2;
  if (name.includes("date")) return 3;
  if (name.includes("id")) return 10;
  return 5;
};

/**
 * Determines whether content should be considered "long" (for collapse/expand UI).
 *
 * @param content - Field content as string.
 * @returns True if content is longer than 200 chars.
 */
export const isLongContent = (content: string): boolean => {
  return typeof content === "string" && content.length > 200;
};

/**
 * Returns an array of [fieldName, value] entries for a document, filtered and sorted by priority.
 *
 * @param document - Document object with fields.
 * @returns Array of [fieldName, value] entries.
 */
export const processDocumentFields = (document: any) => {
  if (!document) return [];

  return Object.entries(document)
    .filter(([key]) => !(key.startsWith("_") && key.endsWith("_")))
    .filter(([key]) => !key.startsWith("score"))
    .sort(([a], [b]) => getFieldPriority(a) - getFieldPriority(b));
};

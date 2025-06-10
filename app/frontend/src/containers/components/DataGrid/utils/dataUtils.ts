const contentCache = new Map();
const MAX_CACHE_SIZE = 1000;

/**
 * Maintains the size of the contentCache by trimming to last 500 entries if over MAX_CACHE_SIZE.
 */
export const manageCacheSize = () => {
  if (contentCache.size > MAX_CACHE_SIZE) {
    // Simple LRU-like cleanup - keep the most recent entries
    const entries = Array.from(contentCache.entries());
    contentCache.clear();
    
    // Keep the last 60% of entries to avoid frequent cleanups
    const keepCount = Math.floor(MAX_CACHE_SIZE * 0.6);
    entries.slice(-keepCount).forEach(([key, value]) => {
      contentCache.set(key, value);
    });
    
    // Only log in development to avoid production console spam
    if (process.env.NODE_ENV === 'development') {
      console.log(`Cache cleaned: ${entries.length} -> ${contentCache.size} entries`);
    }
  }
};

/**
 * Extracts and concatenates context windows around search terms found in the input text.
 *
 * @param text - Source text to search within.
 * @param searchTerms - Array of terms to match/highlight.
 * @param contextLength - Number of chars before/after match to keep as context.
 * @returns Concordance snippet containing search term contexts.
 */
export const createConcordance = (
  text: string,
  searchTerms: string[],
  contextLength = 100,
): string => {
  if (!text || typeof text !== "string") return text?.toString() || "";
  if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0)
    return text;

  const lowerText = text.toLowerCase();
  const matches: Array<{ start: number; end: number; term: string }> = [];

  const limitedTerms = searchTerms.slice(0, 5);

  limitedTerms.forEach((term) => {
    if (term && typeof term === "string" && term.length > 1) {
      const lowerTerm = term.toLowerCase();
      let index = lowerText.indexOf(lowerTerm);
      
      // Find only the first match per term
      if (index !== -1) {
        matches.push({
          start: index,
          end: index + lowerTerm.length,
          term: term,
        });
      }
    }
  });

  if (matches.length === 0) {
    // For concordance mode, show truncated text with "..." when no matches
    const fallbackLength = contextLength * 2;
    if (text.length > fallbackLength) {
      return text.substring(0, fallbackLength) + "...";
    }
    return text;
  }

  matches.sort((a, b) => a.start - b.start);

  const contexts: Array<{ start: number; end: number }> = [];
  matches.forEach((match) => {
    const start = Math.max(0, match.start - contextLength);
    const end = Math.min(text.length, match.end + contextLength);

    const lastContext = contexts[contexts.length - 1];
    if (lastContext && start <= lastContext.end + 20) {
      lastContext.end = Math.max(lastContext.end, end);
    } else {
      contexts.push({ start, end });
    }
  });

  let concordance = "";
  contexts.forEach((context, index) => {
    // Add separator between different contexts
    if (index > 0) {
      concordance += " ... ";
    }
    
    // Add left ellipsis if we're not starting from the beginning of the text
    if (context.start > 0) {
      concordance += "...";
    }
    
    // Add the actual context content
    concordance += text.substring(context.start, context.end);
    
    // Add right ellipsis if we're not at the end of the text
    if (context.end < text.length) {
      concordance += "...";
    }
  });

  return concordance;
};

/**
 * Returns the list of canonical field names considered as ID fields.
 */
export const getIdFieldNames = () => [
  "id",
  "Id",
  "ID",
  "docId",
  "DocId",
  "documentId",
  "DocumentId",
  "identifier",
  "Identifier",
  "doc_id",
  "document_id",
  "_id",
];

/**
 * Checks if a given field name should be treated as an ID field.
 *
 * @param field - Field name to check.
 * @returns True if field is considered an ID field.
 */
export const isIdField = (field: string): boolean => {
  const idFieldNames = getIdFieldNames();
  return idFieldNames.some(
    (idName) =>
      field === idName ||
      field.toLowerCase() === idName.toLowerCase() ||
      field.toLowerCase().includes("_id") ||
      field.toLowerCase().includes("id_"),
  );
};

export { contentCache };

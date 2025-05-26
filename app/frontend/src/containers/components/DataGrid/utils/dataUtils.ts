const contentCache = new Map();
const MAX_CACHE_SIZE = 1000;

export const manageCacheSize = () => {
  if (contentCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(contentCache.entries());
    contentCache.clear();
    entries.slice(-500).forEach(([key, value]) => {
      contentCache.set(key, value);
    });
  }
};

export const createConcordance = (text: string, searchTerms: string[], contextLength = 100): string => {
  if (!text || typeof text !== 'string') return text?.toString() || '';
  if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) return text;
  
  const lowerText = text.toLowerCase();
  const matches: Array<{start: number; end: number; term: string}> = [];
  
  searchTerms.forEach(term => {
    if (term && typeof term === 'string' && term.length > 1) {
      const lowerTerm = term.toLowerCase();
      let index = lowerText.indexOf(lowerTerm);
      while (index !== -1) {
        matches.push({
          start: index,
          end: index + lowerTerm.length,
          term: term
        });
        index = lowerText.indexOf(lowerTerm, index + 1);
      }
    }
  });
  
  if (matches.length === 0) {
    return text.length > contextLength * 2 
      ? text.substring(0, contextLength * 2) + '...'
      : text;
  }
  
  matches.sort((a, b) => a.start - b.start);
  
  const contexts: Array<{start: number; end: number}> = [];
  matches.forEach(match => {
    const start = Math.max(0, match.start - contextLength);
    const end = Math.min(text.length, match.end + contextLength);
    
    const lastContext = contexts[contexts.length - 1];
    if (lastContext && start <= lastContext.end + 20) {
      lastContext.end = Math.max(lastContext.end, end);
    } else {
      contexts.push({ start, end });
    }
  });
  
  let concordance = '';
  contexts.forEach((context, index) => {
    if (index > 0) concordance += ' ... ';
    if (context.start > 0) concordance += '...';
    concordance += text.substring(context.start, context.end);
    if (context.end < text.length) concordance += '...';
  });
  
  return concordance;
};

export const getIdFieldNames = () => [
  'id', 'Id', 'ID', 'docId', 'DocId', 'documentId', 'DocumentId',
  'identifier', 'Identifier', 'doc_id', 'document_id', '_id',
];

export const isIdField = (field: string): boolean => {
  const idFieldNames = getIdFieldNames();
  return idFieldNames.some(idName =>
    field === idName ||
    field.toLowerCase() === idName.toLowerCase() ||
    field.toLowerCase().includes('_id') ||
    field.toLowerCase().includes('id_')
  );
};

export { contentCache };
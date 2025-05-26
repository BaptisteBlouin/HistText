interface QueryTerm {
  field: string;
  value: string;
  operator: string;
  not: boolean;
}

export const parseFormDataToTerms = (formData: any): QueryTerm[] => {
  const terms: QueryTerm[] = [];
  
  Object.entries(formData).forEach(([field, entries]: [string, any]) => {
    if (Array.isArray(entries)) {
      entries.forEach((entry: any) => {
        if (entry.value && entry.value.trim()) {
          terms.push({
            field,
            value: entry.value.trim(),
            operator: entry.operator || 'AND',
            not: entry.not || false
          });
        }
      });
    }
  });
  
  return terms;
};

// Helper function to check if a field is a date field
const isDateField = (fieldName: string): boolean => {
  const dateFieldPatterns = [
    'date',
    'date_rdt', 
    'min_date',
    'max_date',
    'created_at',
    'updated_at',
    'timestamp'
  ];
  
  const lowerFieldName = fieldName.toLowerCase();
  return dateFieldPatterns.some(pattern => 
    lowerFieldName.includes(pattern) || 
    lowerFieldName.endsWith('_date') ||
    lowerFieldName.endsWith('_dt') ||
    lowerFieldName.endsWith('_rdt')
  );
};

export const getSearchTermsForField = (formData: any, fieldName: string): string[] => {
  // Don't highlight date fields
  if (isDateField(fieldName)) {
    return [];
  }
  
  const terms = parseFormDataToTerms(formData);
  return terms
    .filter(term => term.field === fieldName && !term.not)
    .map(term => term.value)
    .filter(value => value && value.length > 0);
};

// NEW: Get ALL search terms from the entire query for cross-field highlighting
export const getAllSearchTermsFromQuery = (formData: any): string[] => {
  const terms = parseFormDataToTerms(formData);
  const allTerms = terms
    .filter(term => !term.not && !isDateField(term.field)) // Exclude date fields
    .map(term => term.value)
    .filter(value => value && value.length > 0);
  
  // Remove duplicates and return
  return [...new Set(allTerms)];
};

// NEW: Get search terms for a specific field, but also include global terms for highlighting
export const getHighlightTermsForField = (formData: any, fieldName: string): string[] => {
  // Don't highlight date fields at all
  if (isDateField(fieldName)) {
    return [];
  }
  
  // Get terms specific to this field
  const fieldTerms = getSearchTermsForField(formData, fieldName);
  
  // Get ALL terms from the query for cross-field highlighting (excluding date fields)
  const allTerms = getAllSearchTermsFromQuery(formData);
  
  // Combine and deduplicate
  const combinedTerms = [...new Set([...fieldTerms, ...allTerms])];
  
  console.log(`Highlight terms for field "${fieldName}":`, combinedTerms);
  return combinedTerms;
};

export const getAllSearchTerms = (formData: any): string[] => {
  return getAllSearchTermsFromQuery(formData);
};

// NEW: Debug function to see what terms are being extracted
export const debugFormData = (formData: any): void => {
  console.log('=== FORM DATA DEBUG ===');
  console.log('Raw formData:', formData);
  
  const terms = parseFormDataToTerms(formData);
  console.log('Parsed terms:', terms);
  
  const allTerms = getAllSearchTermsFromQuery(formData);
  console.log('All search terms for highlighting:', allTerms);
  
  Object.keys(formData).forEach(field => {
    const fieldTerms = getSearchTermsForField(formData, field);
    const highlightTerms = getHighlightTermsForField(formData, field);
    console.log(`Field "${field}":`, {
      isDateField: isDateField(field),
      fieldSpecificTerms: fieldTerms,
      allHighlightTerms: highlightTerms
    });
  });
  console.log('=== END DEBUG ===');
};
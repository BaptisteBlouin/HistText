// app/frontend/src/containers/components/MetadataForm/utils/queryParser.ts
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
  
  // Get ALL search terms from the entire query for cross-field highlighting
  export const getAllSearchTermsFromQuery = (formData: any): string[] => {
    const terms = parseFormDataToTerms(formData);
    const allTerms = terms
      .filter(term => !term.not && !isDateField(term.field))
      .map(term => term.value)
      .filter(value => value && value.length > 0);
    
    return [...new Set(allTerms)];
  };
  
  // Get search terms for a specific field, including global terms for highlighting
  export const getHighlightTermsForField = (formData: any, fieldName: string): string[] => {
    if (isDateField(fieldName)) {
      return [];
    }
    
    const fieldTerms = getSearchTermsForField(formData, fieldName);
    const allTerms = getAllSearchTermsFromQuery(formData);
    const combinedTerms = [...new Set([...fieldTerms, ...allTerms])];
    
    console.log(`Highlight terms for field "${fieldName}":`, combinedTerms);
    return combinedTerms;
  };
  
  export const getAllSearchTerms = (formData: any): string[] => {
    return getAllSearchTermsFromQuery(formData);
  };
  
  // Debug function to see what terms are being extracted
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
  
  // FIXED: Parse raw query string back to form data structure
  export const parseQueryToFormData = (queryString: string, metadata: any[]): any => {
    const formData: any = {};
    
    // Initialize empty form data
    metadata.forEach(field => {
      formData[field.name] = [{ value: '', operator: '', not: false }];
    });
  
    if (!queryString.trim()) {
      return formData;
    }
  
    try {
      // Clean the query string - decode URL encoding
      let cleanQuery = decodeURIComponent(queryString)
        .replace(/%22/g, '"')
        .replace(/\+/g, ' ')
        .trim();
  
      console.log('Parsing query:', cleanQuery);
  
      // Remove outer parentheses if they wrap the entire query
      if (cleanQuery.startsWith('(') && cleanQuery.endsWith(')')) {
        cleanQuery = cleanQuery.slice(1, -1);
      }
  
      // Split by AND/OR while preserving parentheses and quotes
      const terms = extractTermsFromQuery(cleanQuery);
      console.log('Extracted terms:', terms);
      
      terms.forEach(term => {
        const parsed = parseIndividualTerm(term);
        console.log('Parsed term:', parsed);
        
        if (parsed && metadata.find(f => f.name === parsed.field)) {
          // Clear the default empty entry and add the parsed one
          if (formData[parsed.field][0].value === '') {
            formData[parsed.field] = [];
          }
          
          formData[parsed.field].push({
            value: parsed.value,
            operator: parsed.operator,
            not: parsed.not
          });
        }
      });
  
      // Clean up empty arrays
      metadata.forEach(field => {
        if (formData[field.name].length === 0) {
          formData[field.name] = [{ value: '', operator: '', not: false }];
        }
      });
  
    } catch (error) {
      console.error('Error parsing query to form data:', error);
    }
  
    console.log('Final form data:', formData);
    return formData;
  };
  
  // FIXED: Helper function to extract terms from query while respecting parentheses and quotes
  const extractTermsFromQuery = (query: string): string[] => {
    const terms: string[] = [];
    let current = '';
    let parenthesesLevel = 0;
    let inQuotes = false;
    let i = 0;
    
    while (i < query.length) {
      const char = query[i];
      
      if (char === '"' && (i === 0 || query[i-1] !== '\\')) {
        inQuotes = !inQuotes;
        current += char;
        i++;
      } else if (!inQuotes) {
        if (char === '(') {
          parenthesesLevel++;
          current += char;
          i++;
        } else if (char === ')') {
          parenthesesLevel--;
          current += char;
          i++;
        } else if (parenthesesLevel === 0) {
          // Check for operators at top level
          const remaining = query.substr(i);
          if (remaining.startsWith(' AND ')) {
            if (current.trim()) {
              terms.push(current.trim());
              current = '';
            }
            i += 5; // Skip ' AND '
            continue;
          } else if (remaining.startsWith(' OR ')) {
            if (current.trim()) {
              terms.push(current.trim());
              current = '';
            }
            i += 4; // Skip ' OR '
            continue;
          } else {
            current += char;
            i++;
          }
        } else {
          current += char;
          i++;
        }
      } else {
        current += char;
        i++;
      }
    }
    
    if (current.trim()) {
      terms.push(current.trim());
    }
    
    return terms;
  };
  
  // FIXED: Helper function to parse individual term
  const parseIndividualTerm = (term: string): { field: string; value: string; operator: string; not: boolean } | null => {
    let cleanTerm = term.trim();
    let not = false;
    let operator = 'AND';
    
    // Check for NOT at the beginning
    if (cleanTerm.toLowerCase().startsWith('not ')) {
      not = true;
      cleanTerm = cleanTerm.substring(4).trim();
    }
    
    // Remove outer parentheses
    if (cleanTerm.startsWith('(') && cleanTerm.endsWith(')')) {
      cleanTerm = cleanTerm.slice(1, -1).trim();
    }
    
    // Look for field:value pattern
    const colonIndex = cleanTerm.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }
    
    const field = cleanTerm.substring(0, colonIndex).trim();
    let value = cleanTerm.substring(colonIndex + 1).trim();
    
    // Remove quotes if present
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    
    // Skip if value is empty
    if (!value) {
      return null;
    }
    
    return { field, value, operator, not };
  };
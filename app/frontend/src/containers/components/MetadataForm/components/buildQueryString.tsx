// app/frontend/src/containers/components/buildQueryString.tsx
import config from '../../../config.json';

/**
 * Enhanced query string builder that supports both form data and raw queries
 * with improved Boolean logic and parentheses handling.
 */
export const buildQueryString = (
  formData: Record<string, { value: string; operator?: string; not?: boolean }[]>,
  dateRange: { min: string; max: string } | null,
  options?: {
    mode?: 'simple' | 'advanced' | 'raw';
    rawQuery?: string;
    customGrouping?: boolean;
  }
): string => {
  const { mode = 'advanced', rawQuery, customGrouping = false } = options || {};

  // If raw mode and raw query provided, return it directly (no encoding for display)
  if (mode === 'raw' && rawQuery) {
    return rawQuery.trim();
  }

  const parts: string[] = [];

  for (const [key, entries] of Object.entries(formData)) {
    // Filter out empty values and date fields
    if (key === 'min_date' || key === 'max_date') continue;
    
    const cleaned = entries.filter(e => e.value && e.value.trim() !== '');
    if (!cleaned.length) continue;

    // Don't encode field names or values for display - keep them readable
    const fieldName = key;

    if (mode === 'simple') {
      // Simple mode: just AND all non-empty values together
      const simpleTerms = cleaned
        .filter(e => !e.not) // Ignore NOT in simple mode
        .map(e => `${fieldName}:"${e.value}"`)
        .join(' AND ');
      
      if (simpleTerms) parts.push(simpleTerms);
      continue;
    }

    // Advanced mode: handle complex Boolean logic
    
    // Separate positive and negative entries
    const posEntries = cleaned.filter(e => !e.not);
    const negEntries = cleaned.filter(e => e.not);

    // Build positive clauses with proper operator grouping
    let posClause = '';
    if (posEntries.length > 0) {
      if (customGrouping) {
        // Custom grouping: respect exact operator sequences
        posClause = buildCustomGroupedClause(posEntries, fieldName);
      } else {
        // Standard grouping: group by operator type
        posClause = buildStandardGroupedClause(posEntries, fieldName);
      }
    }

    // Build negative clauses
    const negClause = negEntries.length > 0 
      ? (() => {
          const terms = negEntries.map(e => `${fieldName}:"${e.value}"`);
          const orGroup = terms.length > 1 ? `(${terms.join(' OR ')})` : terms[0];
          return `NOT ${orGroup}`;
        })()
      : '';

    // Combine positive and negative for this field
    let fieldPart = '';
    if (posClause && negClause) {
      fieldPart = `(${posClause} AND ${negClause})`;
    } else {
      fieldPart = posClause || negClause;
    }

    if (fieldPart) parts.push(fieldPart);
  }

  // Handle date range if present
  if (dateRange && formData.min_date?.[0]?.value && formData.max_date?.[0]?.value) {
    const dateField = config.default_date_name || 'date';
    parts.push(
      `${dateField}:[${formData.min_date[0].value}T00:00:00Z TO ${formData.max_date[0].value}T23:59:59Z]`,
    );
  }

  // Join all field parts with AND
  return parts.join(' AND ').trim();
};

/**
 * Build clause with standard operator grouping (AND groups, OR groups)
 */
function buildStandardGroupedClause(entries: any[], fieldName: string): string {
  const andTerms: string[] = [];
  const orTerms: string[] = [];
  
  entries.forEach(entry => {
    const term = `${fieldName}:"${entry.value}"`;
    if (entry.operator === 'OR') {
      orTerms.push(term);
    } else {
      andTerms.push(term);
    }
  });
  
  const groups: string[] = [];
  
  if (andTerms.length > 0) {
    groups.push(andTerms.length > 1 ? `(${andTerms.join(' AND ')})` : andTerms[0]);
  }
  
  if (orTerms.length > 0) {
    groups.push(orTerms.length > 1 ? `(${orTerms.join(' OR ')})` : orTerms[0]);
  }
  
  return groups.join(' AND ');
}

/**
 * Build clause with custom grouping that respects operator sequences
 */
function buildCustomGroupedClause(entries: any[], fieldName: string): string {
  if (entries.length === 1) {
    return `${fieldName}:"${entries[0].value}"`;
  }

  const terms: string[] = [];
  
  entries.forEach((entry, idx) => {
    const term = `${fieldName}:"${entry.value}"`;
    
    if (idx === 0) {
      terms.push(term);
    } else {
      const operator = entry.operator || 'AND';
      terms.push(`${operator} ${term}`);
    }
  });
  
  return terms.length > 1 ? `(${terms.join(' ')})` : terms[0];
}

/**
 * Create URL-encoded version for API calls
 */
export const buildEncodedQueryString = (
  formData: Record<string, { value: string; operator?: string; not?: boolean }[]>,
  dateRange: { min: string; max: string } | null,
  options?: {
    mode?: 'simple' | 'advanced' | 'raw';
    rawQuery?: string;
    customGrouping?: boolean;
  }
): string => {
  const { mode = 'advanced', rawQuery } = options || {};

  // For raw queries, encode properly for API
  if (mode === 'raw' && rawQuery) {
    return encodeURIComponent(rawQuery.trim());
  }

  // For form-based queries, build with encoding
  const parts: string[] = [];

  for (const [key, entries] of Object.entries(formData)) {
    if (key === 'min_date' || key === 'max_date') continue;
    
    const cleaned = entries.filter(e => e.value && e.value.trim() !== '');
    if (!cleaned.length) continue;

    const encKey = encodeURIComponent(key);

    // Build the same logic but with encoding
    const posEntries = cleaned.filter(e => !e.not);
    const negEntries = cleaned.filter(e => e.not);

    let posClause = '';
    if (posEntries.length > 0) {
      const clauses = posEntries.map((e, idx) => {
        const term = `${encKey}:${encodeURIComponent(`"${e.value}"`)}`;
        if (idx === 0) return term;
        const op = e.operator || 'AND';
        return `${op} ${term}`;
      });
      posClause = clauses.length > 1 ? `(${clauses.join(' ')})` : clauses[0];
    }

    const negClause = negEntries.length > 0 
      ? (() => {
          const terms = negEntries.map(e => `${encKey}:${encodeURIComponent(`"${e.value}"`)}`);
          const orGroup = terms.length > 1 ? `(${terms.join(' OR ')})` : terms[0];
          return `NOT ${orGroup}`;
        })()
      : '';

    let fieldPart = '';
    if (posClause && negClause) {
      fieldPart = `(${posClause} AND ${negClause})`;
    } else {
      fieldPart = posClause || negClause;
    }

    if (fieldPart) parts.push(fieldPart);
  }

  // Handle date range
  if (dateRange && formData.min_date?.[0]?.value && formData.max_date?.[0]?.value) {
    const dateField = config.default_date_name || 'date';
    parts.push(
      `${dateField}:[${formData.min_date[0].value}T00:00:00Z TO ${formData.max_date[0].value}T23:59:59Z]`,
    );
  }

  return parts.join(' AND ').trim();
};
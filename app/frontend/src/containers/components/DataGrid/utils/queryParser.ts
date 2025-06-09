/**
 * Represents a parsed query term from form data.
 */
interface QueryTerm {
  field: string;
  value: string;
  operator: string;
  not: boolean;
}

/**
 * Parses the search form data into a flat array of query terms.
 *
 * @param formData - The full form state object.
 * @returns An array of QueryTerm objects.
 */
export const parseFormDataToTerms = (formData: any): QueryTerm[] => {
  const terms: QueryTerm[] = [];

  Object.entries(formData).forEach(([field, entries]: [string, any]) => {
    if (Array.isArray(entries)) {
      entries.forEach((entry: any) => {
        if (entry.value && entry.value.trim()) {
          terms.push({
            field,
            value: entry.value.trim(),
            operator: entry.operator || "AND",
            not: entry.not || false,
          });
        }
      });
    }
  });

  return terms;
};

/**
 * Determines if a field name likely refers to a date/timestamp field.
 *
 * @param fieldName - The field name to check.
 * @returns True if it matches common date patterns.
 */
const isDateField = (fieldName: string): boolean => {
  const dateFieldPatterns = [
    "date",
    "date_rdt",
    "min_date",
    "max_date",
    "created_at",
    "updated_at",
    "timestamp",
  ];

  const lowerFieldName = fieldName.toLowerCase();
  return dateFieldPatterns.some(
    (pattern) =>
      lowerFieldName.includes(pattern) ||
      lowerFieldName.endsWith("_date") ||
      lowerFieldName.endsWith("_dt") ||
      lowerFieldName.endsWith("_rdt"),
  );
};

/**
 * Returns non-negated search terms for a specific field, skipping date fields.
 *
 * @param formData - The form state.
 * @param fieldName - The field to extract terms for.
 * @returns Array of terms (strings) for this field.
 */
export const getSearchTermsForField = (
  formData: any,
  fieldName: string,
): string[] => {
  if (isDateField(fieldName)) {
    return [];
  }

  const terms = parseFormDataToTerms(formData);
  return terms
    .filter((term) => term.field === fieldName && !term.not)
    .map((term) => term.value)
    .filter((value) => value && value.length > 0);
};

/**
 * Gets all search terms in the query (all fields, non-negated, non-date).
 *
 * @param formData - The form state.
 * @returns Array of all unique search terms in the query.
 */
export const getAllSearchTermsFromQuery = (formData: any): string[] => {
  const terms = parseFormDataToTerms(formData);
  const allTerms = terms
    .filter((term) => !term.not && !isDateField(term.field))
    .map((term) => term.value)
    .filter((value) => value && value.length > 0);
  return [...new Set(allTerms)];
};

/**
 * Gets highlight terms for a field: field-specific terms and all cross-field terms.
 * Never returns anything for date fields.
 *
 * @param formData - The form state.
 * @param fieldName - The field to extract highlight terms for.
 * @returns Array of unique highlight terms for this field.
 */
export const getHighlightTermsForField = (
  formData: any,
  fieldName: string,
): string[] => {
  if (isDateField(fieldName)) {
    return [];
  }

  const fieldTerms = getSearchTermsForField(formData, fieldName);
  const allTerms = getAllSearchTermsFromQuery(formData);
  const combinedTerms = [...new Set([...fieldTerms, ...allTerms])];

  console.log(`Highlight terms for field "${fieldName}":`, combinedTerms);
  return combinedTerms;
};

/**
 * Gets all unique search terms in the query.
 *
 * @param formData - The form state.
 * @returns Array of search terms.
 */
export const getAllSearchTerms = (formData: any): string[] => {
  return getAllSearchTermsFromQuery(formData);
};

/**
 * Debug utility to log parsed terms and highlights for each field.
 *
 * @param formData - The form state.
 */
export const debugFormData = (formData: any): void => {
  console.log("=== FORM DATA DEBUG ===");
  console.log("Raw formData:", formData);

  const terms = parseFormDataToTerms(formData);
  console.log("Parsed terms:", terms);

  const allTerms = getAllSearchTermsFromQuery(formData);
  console.log("All search terms for highlighting:", allTerms);

  Object.keys(formData).forEach((field) => {
    const fieldTerms = getSearchTermsForField(formData, field);
    const highlightTerms = getHighlightTermsForField(formData, field);
    console.log(`Field "${field}":`, {
      isDateField: isDateField(field),
      fieldSpecificTerms: fieldTerms,
      allHighlightTerms: highlightTerms,
    });
  });
  console.log("=== END DEBUG ===");
};

import config from "../../../config.json";

/**
 * Builds a Solr query string from formData and dateRange, correctly handling
 * groupings of positive and negative clauses per field, including nested AND/OR and NOT.
 *
 * For each field:
 *  - Positive entries (not=false) are joined using their .operator (default AND) and
 *    wrapped in parentheses if more than one.
 *  - Negative entries (not=true) are OR-joined and prefixed by a single NOT, e.g.
 *    NOT (field:"A" OR field:"B").
 *  - If both positives and negatives exist, they are combined as
 *    ( (positives) AND NOT (negatives) ).
 *  - If only negatives exist, it emits NOT (...).
 *
 * Date ranges are appended as a top-level AND clause if present.
 */
export const buildQueryString = (
  formData: Record<
    string,
    { value: string; operator?: string; not?: boolean }[]
  >,
  dateRange: { min: string; max: string } | null,
): string => {
  const parts: string[] = [];

  for (const [key, entries] of Object.entries(formData)) {
    // Filter out empty values and date fields
    if (key === "min_date" || key === "max_date") continue;

    const cleaned = entries.filter((e) => e.value && e.value.trim() !== "");
    if (!cleaned.length) continue;

    const encKey = encodeURIComponent(key);

    // Build positive clauses (not=false)
    const posEntries = cleaned.filter((e) => !e.not);
    const posClause = posEntries.length
      ? (() => {
          const clauses = posEntries.map((e, idx) => {
            const term = `${encKey}:${encodeURIComponent(`"${e.value}"`)}`;
            if (idx === 0) return term;
            const op = e.operator || "AND";
            return `${op} ${term}`;
          });
          return clauses.length > 1 ? `(${clauses.join(" ")})` : clauses[0];
        })()
      : "";

    // Build negative clauses (not=true)
    const negEntries = cleaned.filter((e) => e.not);
    const negClause = negEntries.length
      ? (() => {
          const terms = negEntries.map(
            (e) => `${encKey}:${encodeURIComponent(`"${e.value}"`)}`,
          );
          const orGroup =
            terms.length > 1 ? `(${terms.join(" OR ")})` : terms[0];
          return `NOT ${orGroup}`;
        })()
      : "";

    // Combine pos + neg for this field
    let fieldPart = "";
    if (posClause && negClause) {
      fieldPart = `(${posClause} AND ${negClause})`;
    } else {
      fieldPart = posClause || negClause;
    }

    if (fieldPart) parts.push(fieldPart);
  }

  // Handle date range if present
  if (
    dateRange &&
    formData.min_date?.[0]?.value &&
    formData.max_date?.[0]?.value
  ) {
    parts.push(
      `${config.default_date_name}:[${formData.min_date[0].value}T00:00:00Z TO ${formData.max_date[0].value}T23:59:59Z]`,
    );
  }

  // Join all field parts with AND
  return parts.join(" AND ").trim();
};

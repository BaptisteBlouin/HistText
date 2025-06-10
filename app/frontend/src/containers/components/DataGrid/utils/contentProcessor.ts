import { contentCache, manageCacheSize, createConcordance } from "./dataUtils";
import {
  getSearchTermsForField,
  getHighlightTermsForField,
  debugFormData,
} from "./queryParser";
import config from "../../../../../config.json";

const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
const NERLABELS2FULL = config.NERLABELS2FULL;
const viewNERFields = config.viewNERFields;

interface ProcessedElement {
  type: "text" | "ner" | "highlight";
  content: string;
  color?: string;
  label?: string;
  key?: string;
}

/**
 * Splits a string into text and NER (Named Entity Recognition) highlight elements based on provided annotations.
 *
 * @param stringValue - The text content to process.
 * @param documentId - Document ID for looking up NER data.
 * @param field - Field name for viewNERFields matching.
 * @param nerData - NER data for the document.
 * @param viewNER - Whether to show NER highlights.
 * @param showConcordance - Whether concordance mode is enabled.
 * @returns Array of ProcessedElement objects.
 */
export const processContentWithNER = (
  stringValue: string,
  documentId: string,
  field: string,
  nerData: any,
  viewNER: boolean,
  showConcordance: boolean,
): ProcessedElement[] => {
  let elements: ProcessedElement[] = [];
  let lastIndex = 0;

  const shouldHighlightNER =
    viewNER &&
    viewNERFields.some(
      (fieldValue) => field === fieldValue || field.includes(fieldValue),
    ) &&
    nerData?.[documentId]?.t &&
    Array.isArray(nerData[documentId].t);

  if (shouldHighlightNER && !showConcordance) {
    try {
      const annotations = nerData[documentId].t
        .map((text: string, index: number) => ({
          s: nerData[documentId].s[index],
          e: nerData[documentId].e[index],
          l: nerData[documentId].l[index],
        }))
        .sort((a: any, b: any) => a.s - b.s);

      annotations.forEach(({ s, e, l }: any) => {
        if (s > lastIndex && s < stringValue.length) {
          elements.push({
            type: "text",
            content: stringValue.slice(lastIndex, s),
          });
        }
        if (s < stringValue.length) {
          const endPos = Math.min(e, stringValue.length);
          const label = l[0];
          const color =
            label in NER_LABELS_COLORS
              ? NER_LABELS_COLORS[label as keyof typeof NER_LABELS_COLORS]
              : "#gray";
          const fullLabel =
            label in NERLABELS2FULL
              ? NERLABELS2FULL[label as keyof typeof NERLABELS2FULL]
              : label;

          elements.push({
            type: "ner",
            content: stringValue.slice(s, endPos),
            color: color,
            label: fullLabel,
            key: `${s}-${endPos}`,
          });
          lastIndex = endPos;
        }
      });

      if (lastIndex < stringValue.length) {
        elements.push({ type: "text", content: stringValue.slice(lastIndex) });
      }
    } catch (error) {
      console.error("Error processing NER annotations:", error);
      elements = [{ type: "text", content: stringValue }];
    }
  } else {
    elements = [{ type: "text", content: stringValue }];
  }

  return elements;
};

/**
 * Highlights all occurrences of provided search terms in the given elements.
 * Handles multiple highlight passes to prevent overlap and maximize match length.
 *
 * @param elements - Array of ProcessedElement objects.
 * @param searchTerms - Array of search terms to highlight.
 * @returns Array of ProcessedElement with highlights inserted.
 */
export const processContentWithHighlights = (
  elements: ProcessedElement[],
  searchTerms: string[],
): ProcessedElement[] => {
  if (searchTerms.length === 0) return elements;

  // Sort terms by length (longest first) to avoid partial matches overriding longer matches
  const sortedTerms = [...searchTerms].sort((a, b) => b.length - a.length);

  let processedElements = elements;

  sortedTerms.forEach((term) => {
    if (term && typeof term === "string" && term.length > 1) {
      processedElements = processedElements.flatMap((element) => {
        if (element.type === "text") {
          let content = element.content;
          if (typeof content !== "string") {
            content = String(content || "");
          }
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(`(${escapedTerm})`, "gi");
          const parts = content.split(regex);
          const newElements: ProcessedElement[] = [];
          parts.forEach((part, index) => {
            if (index % 2 === 1) {
              newElements.push({
                type: "highlight",
                content: part,
                key: `${term}-${index}-${Math.random()}`,
              });
            } else if (part) {
              newElements.push({ type: "text", content: part });
            }
          });
          return newElements.length > 0
            ? newElements
            : [{ type: "text", content: String(content) }];
        }
        return [element];
      });
    }
  });

  return processedElements;
};

/**
 * Processes the content for a grid cell, applying NER and/or highlight spans, caching results.
 * Handles concordance snippets for main text column in concordance mode.
 *
 * @param value - Cell value.
 * @param field - Field name.
 * @param data - Entire row data object.
 * @param nerData - NER annotations data.
 * @param viewNER - Whether to show NER highlights.
 * @param formData - Search/form data.
 * @param showConcordance - Whether concordance mode is enabled.
 * @param mainTextColumn - Main text column name.
 * @returns Array of ProcessedElement objects for rendering.
 */
export const processContent = (
  value: any,
  field: string,
  data: any,
  nerData: any,
  viewNER: boolean,
  formData: any,
  showConcordance: boolean,
  mainTextColumn: string,
): ProcessedElement[] => {
  // Early return for empty values
  if (!value && value !== 0) return [];

  let stringValue = "";
  if (typeof value === "string") {
    stringValue = value;
  } else if (typeof value === "number") {
    stringValue = value.toString();
  } else if (value !== null && value !== undefined) {
    stringValue = String(value);
  } else {
    return [];
  }

  const documentId = data.id;
  const isMainTextColumn = field === mainTextColumn;

  // Optimized cache key generation (keep full content processing)
  const highlightTerms = getHighlightTermsForField(formData, field);
  const cacheKey = `${documentId}_${field}_${stringValue.slice(0, 50)}_${viewNER}_${showConcordance}_${highlightTerms.slice(0, 3).join("_")}`;

  // Check cache first for performance
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey);
  }

  // Apply concordance - NO length limits
  if (showConcordance && isMainTextColumn) {
    const searchTerms = getSearchTermsForField(formData, field);
    if (searchTerms.length > 0) {
      stringValue = createConcordance(stringValue, searchTerms); // Process full content
    }
    // Remove the else truncation - process full content always
  }

  // Process content with NER (existing logic) - NO limits
  let elements = processContentWithNER(
    stringValue,
    documentId,
    field,
    nerData,
    viewNER,
    showConcordance,
  );

  // Apply search highlighting with limited terms for performance (keep this optimization)
  const limitedHighlightTerms = highlightTerms.slice(0, 10);
  elements = processContentWithHighlights(elements, limitedHighlightTerms);

  // Cache the result
  contentCache.set(cacheKey, elements);
  manageCacheSize();

  return elements;
};
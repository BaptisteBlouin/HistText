import { contentCache, manageCacheSize, createConcordance } from './dataUtils';
import { getSearchTermsForField, getHighlightTermsForField, debugFormData } from './queryParser';
import config from '../../../../../config.json';

const NER_LABELS_COLORS = config.NER_LABELS_COLORS;
const NERLABELS2FULL = config.NERLABELS2FULL;
const viewNERFields = config.viewNERFields;

interface ProcessedElement {
  type: 'text' | 'ner' | 'highlight';
  content: string;
  color?: string;
  label?: string;
  key?: string;
}

export const processContentWithNER = (
  stringValue: string,
  documentId: string,
  field: string,
  nerData: any,
  viewNER: boolean,
  showConcordance: boolean
): ProcessedElement[] => {
  let elements: ProcessedElement[] = [];
  let lastIndex = 0;

  const shouldHighlightNER = viewNER &&
    viewNERFields.some(fieldValue => field === fieldValue || field.includes(fieldValue)) &&
    nerData?.[documentId]?.t &&
    Array.isArray(nerData[documentId].t);

  if (shouldHighlightNER && !showConcordance) {
    try {
      const annotations = nerData[documentId].t.map((text: string, index: number) => ({
        s: nerData[documentId].s[index],
        e: nerData[documentId].e[index],
        l: nerData[documentId].l[index],
      })).sort((a: any, b: any) => a.s - b.s);

      annotations.forEach(({ s, e, l }: any) => {
        if (s > lastIndex && s < stringValue.length) {
          elements.push({ type: 'text', content: stringValue.slice(lastIndex, s) });
        }
        if (s < stringValue.length) {
          const endPos = Math.min(e, stringValue.length);
          const label = l[0];
          const color = NER_LABELS_COLORS[label] || '#gray';
          elements.push({
            type: 'ner',
            content: stringValue.slice(s, endPos),
            color: color,
            label: NERLABELS2FULL[label] || label,
            key: `${s}-${endPos}`
          });
          lastIndex = endPos;
        }
      });

      if (lastIndex < stringValue.length) {
        elements.push({ type: 'text', content: stringValue.slice(lastIndex) });
      }
    } catch (error) {
      console.error('Error processing NER annotations:', error);
      elements = [{ type: 'text', content: stringValue }];
    }
  } else {
    elements = [{ type: 'text', content: stringValue }];
  }

  return elements;
};

// ENHANCED: Now supports multiple highlighting passes for better term matching
export const processContentWithHighlights = (
  elements: ProcessedElement[],
  searchTerms: string[]
): ProcessedElement[] => {
  if (searchTerms.length === 0) return elements;

  console.log('Processing highlights with terms:', searchTerms);

  // Sort terms by length (longest first) to avoid partial matches overriding longer matches
  const sortedTerms = [...searchTerms].sort((a, b) => b.length - a.length);

  let processedElements = elements;

  // Process each search term
  sortedTerms.forEach(term => {
    if (term && typeof term === 'string' && term.length > 1) {
      processedElements = processedElements.flatMap(element => {
        if (element.type === 'text') {
          let content = element.content;
          
          if (typeof content !== 'string') {
            content = String(content || '');
          }
          
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${escapedTerm})`, 'gi');
          
          const parts = content.split(regex);
          const newElements: ProcessedElement[] = [];
          
          parts.forEach((part, index) => {
            if (index % 2 === 1) {
              // This is a matched term
              newElements.push({ 
                type: 'highlight', 
                content: part, 
                key: `${term}-${index}-${Math.random()}` 
              });
            } else if (part) {
              // This is regular text
              newElements.push({ type: 'text', content: part });
            }
          });
          
          return newElements.length > 0 ? newElements : [{ type: 'text', content: String(content) }];
        }
        return [element];
      });
    }
  });

  return processedElements;
};

export const processContent = (
  value: any,
  field: string,
  data: any,
  nerData: any,
  viewNER: boolean,
  formData: any,
  showConcordance: boolean,
  mainTextColumn: string
): ProcessedElement[] => {
  if (!value && value !== 0) return [];

  let stringValue = '';
  if (typeof value === 'string') {
    stringValue = value;
  } else if (typeof value === 'number') {
    stringValue = value.toString();
  } else if (value !== null && value !== undefined) {
    stringValue = String(value);
  } else {
    return [];
  }

  const documentId = data.id;
  
  // Apply concordance for main text column when showing concordance mode
  const isMainTextColumn = field === mainTextColumn;
  if (showConcordance && isMainTextColumn) {
    const searchTerms = getSearchTermsForField(formData, field);
    if (searchTerms.length > 0) {
      stringValue = createConcordance(stringValue, searchTerms);
    } else if (stringValue.length > 300) {
      stringValue = stringValue.substring(0, 300) + '...';
    }
  }
  
  // ENHANCED: Get ALL highlight terms (field-specific + cross-field)
  const highlightTerms = getHighlightTermsForField(formData, field);
  
  // Create cache key with all highlight terms
  const cacheKey = `${documentId}_${field}_${stringValue.slice(0, 50)}_${viewNER}_${showConcordance}_${highlightTerms.join('_')}`;
  
  // Check cache first
  if (contentCache.has(cacheKey)) {
    return contentCache.get(cacheKey);
  }

  // Debug output for the first few cells
  if (Math.random() < 0.01) { // Only log 1% of the time to avoid spam
    debugFormData(formData);
  }

  // Process content with NER
  let elements = processContentWithNER(stringValue, documentId, field, nerData, viewNER, showConcordance);
  
  // Apply search highlighting with ALL terms
  elements = processContentWithHighlights(elements, highlightTerms);

  // Cache the result
  contentCache.set(cacheKey, elements);
  manageCacheSize();
  
  return elements;
};
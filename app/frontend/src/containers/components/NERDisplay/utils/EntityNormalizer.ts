/**
 * Utility class for normalizing and filtering named entities.
 * 
 * Provides methods to:
 * - Normalize entity text by cleaning, removing prefixes/suffixes, and standardizing case.
 * - Filter out entities based on stop words, length, confidence, and other heuristics.
 * - Cache results for improved performance.
 */
export class EntityNormalizer {
  private static readonly STOP_WORDS_SET = new Set([
    // Numbers and ordinals
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
    '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
    
    // Common words
    'the', 'a', 'an', 'this', 'that', 'these', 'those',
    'today', 'yesterday', 'tomorrow', 'now', 'then', 'later',
    'said', 'says', 'say', 'made', 'make', 'did', 'do', 'went', 'go',
    'got', 'get', 'had', 'have', 'was', 'were', 'is', 'are', 'am', 'be',
    
    // Pronouns
    'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
    
    // Generic terms
    'something', 'someone', 'somewhere', 'nothing', 'no one', 'nowhere',
    'everything', 'everyone', 'everywhere'
  ]);

  // Regular expressions to remove common prefixes and suffixes from entity text
  private static readonly PREFIX_REGEX = /^(mr\.|mrs\.|ms\.|dr\.|prof\.|president|minister|chairman|director|chief|head|deputy|vice|the|a|an)\s+/i;
  private static readonly SUFFIX_REGEX = /\s+(inc\.?|corp\.?|ltd\.?|llc|co\.?|company|corporation|limited|group|international|intl)$/i;
  
  // Caches for normalized text and filter results to enhance performance
  private static cache = new Map<string, string>();
  private static filterCache = new Map<string, boolean>();

  /**
   * Normalize entity text by trimming, removing punctuation, quotes,
   * prefixes, suffixes, possessives, and standardizing to lowercase.
   * Uses caching to optimize repeated normalization.
   * 
   * @param text - Original entity text
   * @returns Normalized entity text
   */
  static normalize(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }

    let normalized = text.trim()
      .replace(/\s+/g, ' ')                    
      .replace(/[.,;:!?]+$/, '')               
      .replace(/\([^)]*\)/g, '')               
      .replace(/["'"`''""]/g, '');             

    const lower = normalized.toLowerCase();
    
    let cleaned = lower
      .replace(this.PREFIX_REGEX, '')         
      .replace(this.SUFFIX_REGEX, '')         
      .replace(/'s$|s'$/g, '')                 
      .trim();

    if (cleaned.startsWith('the ')) {
      cleaned = cleaned.substring(4);
    }

    if (this.cache.size > 10000) {
      this.cache.clear();
    }
    this.cache.set(text, cleaned);
    
    return cleaned;
  }

  /**
   * Determine if an entity should be filtered out based on heuristics
   * such as stop words, length, confidence, numeric content, punctuation,
   * and presence of web artifacts.
   * Caches results for repeated queries.
   * 
   * @param text - Original entity text
   * @param label - Entity label/type
   * @param confidence - Confidence score of entity recognition
   * @returns True if entity should be filtered out, false otherwise
   */
  static shouldFilter(text: string, label: string, confidence: number): boolean {
    if (!text || typeof text !== 'string') return true;
    
    const cacheKey = `${text}|${label}|${confidence}`;
    if (this.filterCache.has(cacheKey)) {
      return this.filterCache.get(cacheKey)!;
    }

    const normalizedText = text.toLowerCase().trim();
    
    let shouldFilter = false;
    
    if (normalizedText.length <= 1 || normalizedText.length > 100) {
      shouldFilter = true;
    } else if (this.STOP_WORDS_SET.has(normalizedText)) {
      shouldFilter = true;
    } else if (/^\d+$/.test(normalizedText) && !['DATE', 'TIME', 'MONEY'].includes(label)) {
      shouldFilter = true;
    } else if (/^[^\w\s]+$/.test(normalizedText)) {
      shouldFilter = true;
    } else if (confidence < 0.3) {
      shouldFilter = true;
    } else if (['http', 'https', 'www', 'html', 'pdf'].some(artifact => normalizedText.includes(artifact))) {
      shouldFilter = true;
    }

    if (this.filterCache.size > 5000) {
      this.filterCache.clear();
    }
    this.filterCache.set(cacheKey, shouldFilter);
    
    return shouldFilter;
  }

  /**
   * Return display text for an entity, defaults to trimmed original text.
   * 
   * @param originalText - Original entity text
   * @param normalizedText - Normalized entity text (unused here but available)
   * @returns Text to display in UI
   */
  static getDisplayText(originalText: string, normalizedText: string): string {
    return originalText.trim();
  }

  /**
   * Generate a unique key for an entity based on normalized text and label.
   * 
   * @param normalizedText - Normalized entity text
   * @param label - Entity label/type
   * @returns Unique string key representing the entity
   */
  static createEntityKey(normalizedText: string, label: string): string {
    return `${normalizedText}|||${label}`;
  }

  /**
   * Clear the internal caches to free memory.
   */
  static clearCache() {
    this.cache.clear();
    this.filterCache.clear();
  }
}
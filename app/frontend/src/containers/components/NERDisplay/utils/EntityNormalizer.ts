// app/frontend/src/containers/components/NERDisplay/utils/EntityNormalizer.ts
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
  
    private static readonly PREFIX_REGEX = /^(mr\.|mrs\.|ms\.|dr\.|prof\.|president|minister|chairman|director|chief|head|deputy|vice|the|a|an)\s+/i;
    private static readonly SUFFIX_REGEX = /\s+(inc\.?|corp\.?|ltd\.?|llc|co\.?|company|corporation|limited|group|international|intl)$/i;
    
    // Performance cache
    private static cache = new Map<string, string>();
    private static filterCache = new Map<string, boolean>();
  
    static normalize(text: string): string {
      if (!text || typeof text !== 'string') return '';
      
      // Check cache first
      if (this.cache.has(text)) {
        return this.cache.get(text)!;
      }
  
      // Basic cleaning
      let normalized = text.trim()
        .replace(/\s+/g, ' ')                    // Multiple spaces
        .replace(/[.,;:!?]+$/, '')               // Trailing punctuation
        .replace(/\([^)]*\)/g, '')               // Parenthetical content
        .replace(/["'"`''""]/g, '');             // Quotes
  
      const lower = normalized.toLowerCase();
      
      // Apply regex-based cleaning
      let cleaned = lower
        .replace(this.PREFIX_REGEX, '')          // Remove prefixes
        .replace(this.SUFFIX_REGEX, '')          // Remove suffixes
        .replace(/'s$|s'$/g, '')                 // Remove possessives
        .trim();
  
      // Remove "the" at beginning if it remains
      if (cleaned.startsWith('the ')) {
        cleaned = cleaned.substring(4);
      }
  
      // Cache result (limit cache size)
      if (this.cache.size > 10000) {
        this.cache.clear();
      }
      this.cache.set(text, cleaned);
      
      return cleaned;
    }
  
    static shouldFilter(text: string, label: string, confidence: number): boolean {
      if (!text || typeof text !== 'string') return true;
      
      const cacheKey = `${text}|${label}|${confidence}`;
      if (this.filterCache.has(cacheKey)) {
        return this.filterCache.get(cacheKey)!;
      }
  
      const normalizedText = text.toLowerCase().trim();
      
      let shouldFilter = false;
      
      // Length checks
      if (normalizedText.length <= 1 || normalizedText.length > 100) {
        shouldFilter = true;
      }
      // Stop words
      else if (this.STOP_WORDS_SET.has(normalizedText)) {
        shouldFilter = true;
      }
      // Pure numbers (unless specific types)
      else if (/^\d+$/.test(normalizedText) && !['DATE', 'TIME', 'MONEY'].includes(label)) {
        shouldFilter = true;
      }
      // Punctuation only
      else if (/^[^\w\s]+$/.test(normalizedText)) {
        shouldFilter = true;
      }
      // Low confidence
      else if (confidence < 0.3) {
        shouldFilter = true;
      }
      // Web artifacts
      else if (['http', 'https', 'www', 'html', 'pdf'].some(artifact => normalizedText.includes(artifact))) {
        shouldFilter = true;
      }
  
      // Cache result
      if (this.filterCache.size > 5000) {
        this.filterCache.clear();
      }
      this.filterCache.set(cacheKey, shouldFilter);
      
      return shouldFilter;
    }
  
    static getDisplayText(originalText: string, normalizedText: string): string {
      return originalText.trim();
    }
  
    static createEntityKey(normalizedText: string, label: string): string {
      return `${normalizedText}|||${label}`;
    }
  
    static clearCache() {
      this.cache.clear();
      this.filterCache.clear();
    }
  }
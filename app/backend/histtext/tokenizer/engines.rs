//! Core tokenization engines for different language types.

use super::utils::{
    safe_truncate_string, safe_take_chars, is_likely_latin_safe,
    JIEBA, ENGLISH_STOPWORDS, CHINESE_STOPWORDS
};

/// Ultra-fast tokenization with automatic language detection
/// 
/// # Arguments
/// * `text` - Text to tokenize
/// * `cloud` - Apply word cloud filtering (stopwords, length limits)
/// 
/// # Returns
/// Vector of tokens
pub fn tokenize_text_ultra_fast(text: &str, cloud: bool) -> Vec<String> {
    tokenize_text_with_limit(text, cloud, 1000)
}

/// Tokenization with configurable token limit
/// 
/// # Arguments
/// * `text` - Text to tokenize
/// * `cloud` - Apply word cloud filtering
/// * `max_tokens` - Maximum number of tokens to return
/// 
/// # Returns
/// Vector of tokens up to max_tokens limit
pub fn tokenize_text_with_limit(text: &str, cloud: bool, max_tokens: usize) -> Vec<String> {
    if text.is_empty() || max_tokens == 0 {
        return Vec::new();
    }
    
    let safe_text = if text.len() > 50000 {
        safe_truncate_string(text, 50000)
    } else {
        text
    };
    
    if is_likely_latin_safe(safe_text) {
        tokenize_latin_ultra_fast(safe_text, cloud, max_tokens)
    } else {
        tokenize_cjk_fast(safe_text, cloud, max_tokens)
    }
}

/// Fast Latin text tokenization
/// 
/// Optimized for English and other Latin-script languages with
/// efficient whitespace-based splitting and character filtering.
/// 
/// # Arguments
/// * `text` - Text to tokenize
/// * `cloud` - Apply stopword filtering and length limits
/// * `max_tokens` - Maximum tokens to extract
/// 
/// # Returns
/// Vector of cleaned and filtered tokens
pub fn tokenize_latin_ultra_fast(text: &str, cloud: bool, max_tokens: usize) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut count = 0;
    
    if cloud {
        for word in text.split_whitespace() {
            if count >= max_tokens {
                break;
            }
            
            let cleaned: String = word.chars()
                .filter(|c| c.is_alphabetic())
                .collect::<String>()
                .to_lowercase();
                
            if !cleaned.is_empty() && 
               cleaned.len() < 20 && 
               !ENGLISH_STOPWORDS.contains(&cleaned) {
                tokens.push(cleaned);
                count += 1;
            }
        }
    } else {
        for word in text.split_whitespace() {
            if count >= max_tokens {
                break;
            }
            
            let cleaned: String = word.chars()
                .filter(|c| c.is_alphabetic())
                .collect::<String>()
                .to_lowercase();
                
            if !cleaned.is_empty() && cleaned.len() < 30 {
                tokens.push(cleaned);
                count += 1;
            }
        }
    }
    
    tokens
}

/// Fast CJK (Chinese, Japanese, Korean) text tokenization
/// 
/// Uses Jieba for Chinese text segmentation with optimizations
/// for handling large texts and filtering inappropriate segments.
/// 
/// # Arguments
/// * `text` - Text to tokenize
/// * `cloud` - Apply stopword filtering and CJK-specific filters
/// * `max_tokens` - Maximum tokens to extract
/// 
/// # Returns
/// Vector of segmented CJK tokens
pub fn tokenize_cjk_fast(text: &str, cloud: bool, max_tokens: usize) -> Vec<String> {
    let safe_text = safe_take_chars(text, 5000);
    
    let segments = JIEBA.cut(&safe_text, false);
    let mut tokens = Vec::new();
    let mut count = 0;
    
    for segment in segments {
        if count >= max_tokens {
            break;
        }
        
        let trimmed = segment.trim();
        if trimmed.is_empty() || trimmed.len() > 10 {
            continue;
        }
        
        if cloud {
            if !CHINESE_STOPWORDS.contains(trimmed) && 
               !trimmed.chars().any(|c| c.is_ascii_alphabetic()) {
                tokens.push(trimmed.to_string());
                count += 1;
            }
        } else {
            tokens.push(trimmed.to_string());
            count += 1;
        }
    }
    
    tokens
}

/// Legacy tokenization function for backward compatibility
/// 
/// # Arguments
/// * `text` - Text to tokenize
/// * `cloud` - Apply word cloud filtering
/// 
/// # Returns
/// Vector of tokens
pub fn tokenize_text_fast(text: &str, cloud: bool) -> Vec<String> {
    tokenize_text_ultra_fast(text, cloud)
}

/// Generic tokenization function for backward compatibility
/// 
/// # Arguments
/// * `text` - Text to tokenize
/// * `cloud` - Apply word cloud filtering
/// 
/// # Returns
/// Vector of tokens
pub fn tokenize_text(text: &str, cloud: bool) -> Vec<String> {
    tokenize_text_ultra_fast(text, cloud)
}
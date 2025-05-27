//! Utility functions for tokenization operations.

use jieba_rs::Jieba;
use lazy_static::lazy_static;
use regex::Regex;
use std::collections::HashSet;
use stop_words::{get, LANGUAGE as SwLang};

use super::types::TokenizeResult;
use super::engines::tokenize_text_with_limit;

lazy_static! {
    /// Global Jieba instance for Chinese text segmentation
    pub static ref JIEBA: Jieba = Jieba::new();
    
    /// Regex for extracting Latin alphabetic words
    pub static ref LATIN_TOKENIZER: Regex = Regex::new(r"\b[a-zA-Z]{2,}\b")
        .expect("Failed to compile LATIN_TOKENIZER");
    
    /// Regex for word boundary splitting
    pub static ref WORD_BOUNDARY: Regex = Regex::new(r"\W+")
        .expect("Failed to compile WORD_BOUNDARY");
    
    /// English stopwords set for filtering
    pub static ref ENGLISH_STOPWORDS: HashSet<String> = {
        get(SwLang::English)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect()
    };
    
    /// Chinese stopwords set for filtering
    pub static ref CHINESE_STOPWORDS: HashSet<String> = {
        get(SwLang::Chinese).into_iter().collect()
    };
}

/// Safely truncates a string at a valid UTF-8 character boundary
/// 
/// # Arguments
/// * `text` - Input text to truncate
/// * `max_bytes` - Maximum number of bytes to keep
/// 
/// # Returns
/// String slice truncated at a safe character boundary
pub fn safe_truncate_string(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }
    
    let mut truncate_at = max_bytes;
    while truncate_at > 0 && !text.is_char_boundary(truncate_at) {
        truncate_at -= 1;
    }
    
    &text[..truncate_at]
}

/// Safely takes a specified number of characters from text
/// 
/// # Arguments
/// * `text` - Input text
/// * `max_chars` - Maximum number of characters to take
/// 
/// # Returns
/// String containing up to max_chars characters
pub fn safe_take_chars(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

/// Detects if text is likely to contain primarily Latin characters
/// 
/// Uses sampling to determine if the text should be processed with
/// Latin-based tokenization or CJK tokenization.
/// 
/// # Arguments
/// * `text` - Text to analyze
/// 
/// # Returns
/// True if text appears to be primarily Latin-based
pub fn is_likely_latin_safe(text: &str) -> bool {
    if text.len() < 10 {
        return true;
    }
    
    let sample: String = text.chars().take(200).collect();
    
    let ascii_letters = sample.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let total_chars = sample.chars().count();
    
    if total_chars == 0 {
        return true;
    }
    
    let ascii_ratio = ascii_letters as f32 / total_chars as f32;
    ascii_ratio > 0.5
}

/// Processes multiple texts in parallel for tokenization
/// 
/// This function uses Rayon for parallel processing with panic recovery
/// to handle individual text processing failures gracefully.
/// 
/// # Arguments
/// * `texts` - Array of texts to tokenize
/// * `cloud` - Whether to apply word cloud filtering
/// * `max_tokens_per_text` - Maximum tokens per text
/// 
/// # Returns
/// Vector of tokenization results
pub fn batch_tokenize_parallel(
    texts: &[String], 
    cloud: bool, 
    max_tokens_per_text: usize
) -> Vec<TokenizeResult> {
    use rayon::prelude::*;
    
    texts
        .par_iter()
        .enumerate()
        .map(|(index, text)| {
            let words = std::panic::catch_unwind(|| {
                tokenize_text_with_limit(text, cloud, max_tokens_per_text)
            }).unwrap_or_else(|_| {
                eprintln!("Tokenization failed for text at index {}", index);
                Vec::new()
            });
            
            let token_count = words.len();
            TokenizeResult {
                text_index: index,
                words,
                token_count,
            }
        })
        .collect()
}
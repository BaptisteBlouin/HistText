//! Text tokenization utilities for both Latin-script and CJK languages.
//! 
//! Features:
//! - Language-aware tokenization with script detection
//! - Punctuation and non-alphanumeric character removal
//! - Unicode-based CJK detection with fallback to heuristics
//! - Latin text tokenization via whitespace splitting
//! - CJK text segmentation via Jieba
//! - Optional stopword filtering for word cloud use cases
//! - HTTP endpoint for tokenization requests

use actix_web::{web, Error, HttpResponse};
use jieba_rs::Jieba;
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use stop_words::{get, LANGUAGE as SwLang};
use utoipa::{IntoParams, ToSchema};
use whatlang::{detect, Script};

/// Request parameters for tokenization
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct TokenizeRequest {
    /// Text to tokenize
    #[schema(example = "This is a sample text for tokenization.")]
    pub text: String,
    
    /// Whether to filter tokens for word cloud use
    #[schema(example = false)]
    #[serde(default)]
    pub cloud: bool,
}

/// Response containing tokenized words
#[derive(Serialize, ToSchema)]
pub struct TokenizeResponse {
    /// Tokenized words
    pub words: Vec<String>,
}

lazy_static! {
    /// Jieba segmenter for CJK text
    static ref JIEBA: Jieba = Jieba::new();
    
    /// Regex for removing punctuation and non-alphanumeric characters
    static ref RE_CLEAN: Regex =
        Regex::new(r"[^\p{L}\p{Nd}\s]+").expect("Failed to compile RE_CLEAN");
}

/// Checks if text contains any CJK ideographs
///
/// # Arguments
/// * `text` - The text to check
///
/// # Returns
/// `true` if the text contains any CJK characters
fn contains_cjk(text: &str) -> bool {
    text.chars().any(|c| {
        let cp = c as u32;
        (0x4E00..=0x9FFF).contains(&cp)      // CJK Unified Ideographs
            || (0x3400..=0x4DBF).contains(&cp)      // CJK Unified Ideographs Extension A
            || (0x20000..=0x2A6DF).contains(&cp)    // CJK Unified Ideographs Extension B
            || (0x2A700..=0x2B73F).contains(&cp)    // CJK Unified Ideographs Extension C
            || (0x2B740..=0x2B81F).contains(&cp)    // CJK Unified Ideographs Extension D
            || (0x2B820..=0x2CEAF).contains(&cp)    // CJK Unified Ideographs Extension E
            || (0xF900..=0xFAFF).contains(&cp)      // CJK Compatibility Ideographs
            || (0x2F800..=0x2FA1F).contains(&cp)    // CJK Compatibility Ideographs Supplement
    })
}

/// Determines if text should be processed as Latin script
///
/// Uses multiple detection methods:
/// 1. First checks for CJK characters
/// 2. Then uses whatlang's script detection
/// 3. Falls back to ASCII-to-letter ratio heuristic
///
/// # Arguments
/// * `text` - The text to analyze
///
/// # Returns
/// `true` if the text should be treated as Latin script
fn is_latin_script(text: &str) -> bool {
    // Quick check for CJK characters
    if contains_cjk(text) {
        return false;
    }
    
    // Try whatlang detection
    if let Some(info) = detect(text) {
        return info.script() == Script::Latin;
    }
    
    // Fall back to ASCII ratio heuristic
    let sample: String = text.chars().take(100).collect();
    let ascii_letters = sample.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let total_letters = sample.chars().filter(|c| c.is_alphabetic()).count();
    
    if total_letters == 0 {
        true
    } else {
        (ascii_letters as f32) / (total_letters as f32) >= 0.5
    }
}

/// Tokenizes text with language-appropriate segmentation
///
/// # Arguments
/// * `text` - The text to tokenize
/// * `cloud` - When true, applies stopword filtering and removes mixed-script tokens
///
/// # Returns
/// A vector of tokenized words
pub fn tokenize_text(text: &str, cloud: bool) -> Vec<String> {
    // Clean text by removing punctuation and non-alphanumeric characters
    let cleaned = RE_CLEAN.replace_all(text, "").to_string();

    // Detect whether to use Latin or CJK tokenization
    let latin = is_latin_script(&cleaned);

    // Tokenize based on detected script
    let raw_tokens: Vec<String> = if latin {
        // Latin script: split on whitespace
        cleaned
            .split_whitespace()
            .map(|s| s.to_lowercase())
            .collect()
    } else {
        // CJK script: use Jieba segmentation
        JIEBA
            .cut(&cleaned, true)
            .into_iter()
            .map(String::from)
            .collect()
    };

    // Clean up tokens
    let mut tokens: Vec<String> = raw_tokens
        .into_iter()
        .map(|tok| tok.trim().to_string())
        .filter(|tok| !tok.is_empty())
        .collect();

    // Apply cloud-specific filtering if requested
    if cloud {
        // Get appropriate stopwords based on script
        let stops: HashSet<String> = if latin {
            get(SwLang::English)
                .into_iter()
                .map(|w| w.to_lowercase())
                .collect()
        } else {
            get(SwLang::Chinese).into_iter().collect()
        };

        // Filter tokens
        tokens.retain(|tok| {
            // Remove stopwords
            if stops.contains(tok) {
                return false;
            }
            
            // For CJK text, remove tokens with Latin characters
            if !latin && tok.chars().any(|c| c.is_ascii_alphabetic()) {
                return false;
            }
            
            true
        });
    }

    tokens
}

/// HTTP endpoint for tokenizing text
///
/// Accepts a JSON payload with text and tokenization options,
/// and returns the tokenized words as a JSON response.
///
/// # Arguments
/// * `params` - JSON request with text to tokenize and options
///
/// # Returns
/// HTTP response with JSON array of tokens or an error status
#[utoipa::path(
    post,
    path = "/api/tokenize",
    tag = "Text Processing",
    request_body = TokenizeRequest,
    responses(
        (status = 200, description = "Successfully tokenized text with language-appropriate segmentation", body = TokenizeResponse),
        (status = 400, description = "Invalid request format or missing required fields"),
        (status = 500, description = "Tokenization processing error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn tokenize(params: web::Json<TokenizeRequest>) -> Result<HttpResponse, Error> {
    let TokenizeRequest { text, cloud } = params.into_inner();
    let words = tokenize_text(&text, cloud);
    Ok(HttpResponse::Ok().json(TokenizeResponse { words }))
}
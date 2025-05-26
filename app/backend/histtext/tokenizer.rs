use actix_web::{web, Error, HttpResponse};
use jieba_rs::Jieba;
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use stop_words::{get, LANGUAGE as SwLang};
use utoipa::{IntoParams, ToSchema};
use rayon::prelude::*;

#[derive(Deserialize, ToSchema, IntoParams)]
pub struct TokenizeRequest {
    #[schema(example = "This is a sample text for tokenization.")]
    pub text: String,
    #[schema(example = false)]
    #[serde(default)]
    pub cloud: bool,
}

#[derive(Deserialize, ToSchema, IntoParams)]
pub struct BatchTokenizeRequest {
    #[schema(example = "[\"This is text one\", \"This is text two\"]")]
    pub texts: Vec<String>,
    #[schema(example = false)]
    #[serde(default)]
    pub cloud: bool,
    #[schema(example = 1000)]
    #[serde(default)]
    pub max_tokens_per_text: Option<usize>,
}

#[derive(Serialize, ToSchema)]
pub struct TokenizeResponse {
    pub words: Vec<String>,
}

#[derive(Serialize, ToSchema)]
pub struct BatchTokenizeResponse {
    pub results: Vec<TokenizeResult>,
    pub total_texts: usize,
    pub total_tokens: usize,
}

#[derive(Serialize, ToSchema)]
pub struct TokenizeResult {
    pub text_index: usize,
    pub words: Vec<String>,
    pub token_count: usize,
}

lazy_static! {
    static ref JIEBA: Jieba = Jieba::new();
    static ref LATIN_TOKENIZER: Regex = Regex::new(r"\b[a-zA-Z]{2,}\b").expect("Failed to compile LATIN_TOKENIZER");
    static ref WORD_BOUNDARY: Regex = Regex::new(r"\W+").expect("Failed to compile WORD_BOUNDARY");
    static ref ENGLISH_STOPWORDS: HashSet<String> = {
        get(SwLang::English)
            .into_iter()
            .map(|w| w.to_lowercase())
            .collect()
    };
    static ref CHINESE_STOPWORDS: HashSet<String> = {
        get(SwLang::Chinese).into_iter().collect()
    };
}

fn safe_truncate_string(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }
    
    // Find the last valid character boundary at or before max_bytes
    let mut truncate_at = max_bytes;
    while truncate_at > 0 && !text.is_char_boundary(truncate_at) {
        truncate_at -= 1;
    }
    
    &text[..truncate_at]
}

fn safe_take_chars(text: &str, max_chars: usize) -> String {
    text.chars().take(max_chars).collect()
}

fn is_likely_latin_safe(text: &str) -> bool {
    if text.len() < 10 {
        return true;
    }
    
    // Use char-based iteration instead of byte slicing
    let sample: String = text.chars().take(200).collect();
    
    let ascii_letters = sample.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let total_chars = sample.chars().count();
    
    if total_chars == 0 {
        return true;
    }
    
    let ascii_ratio = ascii_letters as f32 / total_chars as f32;
    ascii_ratio > 0.5
}

fn tokenize_latin_ultra_fast(text: &str, cloud: bool, max_tokens: usize) -> Vec<String> {
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

fn tokenize_cjk_fast(text: &str, cloud: bool, max_tokens: usize) -> Vec<String> {
    // Safely truncate text to avoid very long processing
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

pub fn tokenize_text_ultra_fast(text: &str, cloud: bool) -> Vec<String> {
    tokenize_text_with_limit(text, cloud, 1000)
}

pub fn tokenize_text_with_limit(text: &str, cloud: bool, max_tokens: usize) -> Vec<String> {
    if text.is_empty() || max_tokens == 0 {
        return Vec::new();
    }
    
    // Safely truncate very long texts
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

pub fn batch_tokenize_parallel(
    texts: &[String], 
    cloud: bool, 
    max_tokens_per_text: usize
) -> Vec<TokenizeResult> {
    // Use a safer parallel approach with error handling
    texts
        .par_iter()
        .enumerate()
        .map(|(index, text)| {
            // Catch any panics in individual tokenization
            let words = std::panic::catch_unwind(|| {
                tokenize_text_with_limit(text, cloud, max_tokens_per_text)
            }).unwrap_or_else(|_| {
                // If tokenization panics, return empty vector and log
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

pub fn tokenize_text_fast(text: &str, cloud: bool) -> Vec<String> {
    tokenize_text_ultra_fast(text, cloud)
}

pub fn tokenize_text(text: &str, cloud: bool) -> Vec<String> {
    tokenize_text_ultra_fast(text, cloud)
}

#[utoipa::path(
    post,
    path = "/api/tokenize",
    tag = "Text Processing",
    request_body = TokenizeRequest,
    responses(
        (status = 200, description = "Successfully tokenized text", body = TokenizeResponse),
        (status = 400, description = "Invalid request format"),
        (status = 500, description = "Tokenization processing error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn tokenize(params: web::Json<TokenizeRequest>) -> Result<HttpResponse, Error> {
    let TokenizeRequest { text, cloud } = params.into_inner();
    
    // Catch any potential panics
    let words = std::panic::catch_unwind(|| {
        tokenize_text_ultra_fast(&text, cloud)
    }).unwrap_or_else(|_| {
        eprintln!("Tokenization panic caught for single text");
        Vec::new()
    });
    
    Ok(HttpResponse::Ok().json(TokenizeResponse { words }))
}

#[utoipa::path(
    post,
    path = "/api/tokenize/batch",
    tag = "Text Processing",
    request_body = BatchTokenizeRequest,
    responses(
        (status = 200, description = "Successfully tokenized multiple texts in parallel", body = BatchTokenizeResponse),
        (status = 400, description = "Invalid request format or too many texts"),
        (status = 500, description = "Batch tokenization processing error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn batch_tokenize(params: web::Json<BatchTokenizeRequest>) -> Result<HttpResponse, Error> {
    let BatchTokenizeRequest { texts, cloud, max_tokens_per_text } = params.into_inner();
    
    if texts.len() > 10000 {
        return Ok(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Too many texts. Maximum 10,000 texts per batch."
        })));
    }
    
    let max_tokens = max_tokens_per_text.unwrap_or(500).min(2000);
    
    // Catch any potential panics in batch processing
    let results = std::panic::catch_unwind(|| {
        batch_tokenize_parallel(&texts, cloud, max_tokens)
    }).unwrap_or_else(|_| {
        eprintln!("Batch tokenization panic caught, falling back to sequential processing");
        // Fallback to sequential processing if parallel fails
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| {
                let words = tokenize_text_with_limit(text, cloud, max_tokens);
                let token_count = words.len();
                TokenizeResult {
                    text_index: index,
                    words,
                    token_count,
                }
            })
            .collect()
    });
    
    let total_tokens: usize = results.iter().map(|r| r.token_count).sum();
    
    Ok(HttpResponse::Ok().json(BatchTokenizeResponse {
        results,
        total_texts: texts.len(),
        total_tokens,
    }))
}
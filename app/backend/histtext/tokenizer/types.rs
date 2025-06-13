//! Type definitions for tokenization operations.

use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// Request parameters for single text tokenization
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct TokenizeRequest {
    /// Text content to tokenize
    #[schema(example = "This is a sample text for tokenization.")]
    pub text: String,

    /// Whether to apply word cloud filtering (removes stopwords and short tokens)
    #[schema(example = false)]
    #[serde(default)]
    pub cloud: bool,
}

/// Request parameters for batch text tokenization
#[derive(Deserialize, ToSchema, IntoParams)]
pub struct BatchTokenizeRequest {
    /// Array of text strings to tokenize
    #[schema(example = "[\"This is text one\", \"This is text two\"]")]
    pub texts: Vec<String>,

    /// Whether to apply word cloud filtering
    #[schema(example = false)]
    #[serde(default)]
    pub cloud: bool,

    /// Maximum number of tokens to extract per text (default: 1000)
    #[schema(example = 1000)]
    #[serde(default)]
    pub max_tokens_per_text: Option<usize>,
}

/// Response for single text tokenization
#[derive(Serialize, ToSchema)]
pub struct TokenizeResponse {
    /// Array of extracted tokens/words
    pub words: Vec<String>,
}

/// Response for batch text tokenization
#[derive(Serialize, ToSchema)]
pub struct BatchTokenizeResponse {
    /// Array of tokenization results for each input text
    pub results: Vec<TokenizeResult>,

    /// Total number of texts processed
    pub total_texts: usize,

    /// Total number of tokens extracted across all texts
    pub total_tokens: usize,
}

/// Individual tokenization result within a batch
#[derive(Serialize, ToSchema)]
pub struct TokenizeResult {
    /// Index of the original text in the batch
    pub text_index: usize,

    /// Extracted tokens/words for this text
    pub words: Vec<String>,

    /// Number of tokens extracted for this text
    pub token_count: usize,
}

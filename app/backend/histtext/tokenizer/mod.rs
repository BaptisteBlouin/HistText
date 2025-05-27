//! Text tokenization module for multilingual text processing.
//! 
//! This module provides comprehensive tokenization capabilities supporting both
//! Latin-based languages and CJK (Chinese, Japanese, Korean) languages with
//! optimized processing for large text volumes and batch operations.

pub mod types;
pub mod handlers;
pub mod engines;
pub mod utils;

// Re-export main handlers
pub use handlers::{tokenize, batch_tokenize};

// Re-export types
pub use types::{TokenizeRequest, BatchTokenizeRequest, TokenizeResponse, BatchTokenizeResponse};

// Re-export core functions for internal use
pub use engines::{tokenize_text_fast, tokenize_text_ultra_fast, tokenize_text_with_limit, tokenize_text};
pub use utils::batch_tokenize_parallel;

// Re-export OpenAPI path structs for utoipa
pub use handlers::{__path_tokenize, __path_batch_tokenize};
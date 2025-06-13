//! Text tokenization module for multilingual text processing.
//!
//! This module provides comprehensive tokenization capabilities supporting both
//! Latin-based languages and CJK (Chinese, Japanese, Korean) languages with
//! optimized processing for large text volumes and batch operations.

pub mod engines;
pub mod handlers;
pub mod types;
pub mod utils;

// Re-export main handlers
pub use handlers::{batch_tokenize, tokenize};

// Re-export types
pub use types::{TokenizeRequest, TokenizeResponse};

// Re-export core functions for internal use
pub use engines::tokenize_text_fast;

// Re-export OpenAPI path structs for utoipa
pub use handlers::__path_tokenize;

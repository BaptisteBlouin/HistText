//! HTTP request handlers for tokenization operations.

use actix_web::{web, Error, HttpResponse};
use log::error;

use super::types::{TokenizeRequest, BatchTokenizeRequest, TokenizeResponse, BatchTokenizeResponse};
use super::engines::tokenize_text_ultra_fast;
use super::utils::batch_tokenize_parallel;

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
    
    let words = std::panic::catch_unwind(|| {
        tokenize_text_ultra_fast(&text, cloud)
    }).unwrap_or_else(|_| {
        error!("Tokenization panic caught for single text");
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
    
    let results = std::panic::catch_unwind(|| {
        batch_tokenize_parallel(&texts, cloud, max_tokens)
    }).unwrap_or_else(|_| {
        error!("Batch tokenization panic caught, falling back to sequential processing");
        
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| {
                let words = tokenize_text_ultra_fast(text, cloud);
                let token_count = words.len();
                super::types::TokenizeResult {
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
use crate::histtext::embeddings::{
    cache::get_cached_embeddings,
    similarity::{SimilaritySearcher, SimilarityMetric},
    types::{NeighborsRequest, NeighborsResponse, NeighborResult},
    stats,
};
use crate::services::database::Database;
use actix_web::{web, HttpResponse, Responder};
use log::{info, warn};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Deserialize, ToSchema)]
pub struct EnhancedNeighborsRequest {
    #[schema(example = "democracy")]
    pub word: String,
    #[schema(example = 1)]
    pub solr_database_id: i32,
    #[schema(example = "my_collection")]
    pub collection_name: String,
    #[schema(example = 10)]
    pub k: Option<usize>,
    #[schema(example = 0.3)]
    pub threshold: Option<f32>,
    #[schema(example = true)]
    pub include_scores: Option<bool>,
    #[schema(example = "cosine")]
    pub metric: Option<String>,
    #[schema(example = true)]
    pub use_parallel: Option<bool>,
}

impl From<EnhancedNeighborsRequest> for NeighborsRequest {
    fn from(enhanced: EnhancedNeighborsRequest) -> Self {
        Self {
            word: enhanced.word,
            solr_database_id: enhanced.solr_database_id,
            collection_name: enhanced.collection_name,
            k: enhanced.k,
            threshold: enhanced.threshold,
            include_scores: enhanced.include_scores,
        }
    }
}

#[derive(Deserialize, ToSchema)]
pub struct BatchNeighborsRequest {
    #[schema(example = json!(["democracy", "freedom", "justice"]))]
    pub words: Vec<String>,
    #[schema(example = 1)]
    pub solr_database_id: i32,
    #[schema(example = "my_collection")]
    pub collection_name: String,
    #[schema(example = 5)]
    pub k: Option<usize>,
    #[schema(example = 0.3)]
    pub threshold: Option<f32>,
    #[schema(example = true)]
    pub include_scores: Option<bool>,
    #[schema(example = "cosine")]
    pub metric: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct BatchNeighborsResponse {
    pub results: Vec<WordNeighborsResult>,
    pub stats: BatchStats,
}

#[derive(Serialize, ToSchema)]
pub struct WordNeighborsResult {
    pub word: String,
    pub neighbors: NeighborsResponse,
    pub processing_time_ms: u64,
}

#[derive(Serialize, ToSchema)]
pub struct BatchStats {
    pub total_time_ms: u64,
    pub words_processed: usize,
    pub words_with_embeddings: usize,
    pub avg_time_per_word_ms: f64,
}

#[derive(Deserialize, ToSchema)]
pub struct SimilarityRequest {
    #[schema(example = "king")]
    pub word1: String,
    #[schema(example = "queen")]
    pub word2: String,
    #[schema(example = 1)]
    pub solr_database_id: i32,
    #[schema(example = "my_collection")]
    pub collection_name: String,
    #[schema(example = "cosine")]
    pub metric: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct SimilarityResponse {
    pub word1: String,
    pub word2: String,
    pub similarity: f32,
    pub metric: String,
    pub both_found: bool,
}

#[derive(Deserialize, ToSchema)]
pub struct AnalogyRequest {
    #[schema(example = "king")]
    pub word_a: String,
    #[schema(example = "man")]
    pub word_b: String,
    #[schema(example = "queen")]
    pub word_c: String,
    #[schema(example = 1)]
    pub solr_database_id: i32,
    #[schema(example = "my_collection")]
    pub collection_name: String,
    #[schema(example = 5)]
    pub k: Option<usize>,
}

#[derive(Serialize, ToSchema)]
pub struct AnalogyResponse {
    pub analogy: String,
    pub candidates: Vec<NeighborResult>,
    pub all_words_found: bool,
}

#[utoipa::path(
    post,
    path = "/api/compute-neighbors",
    tag = "Embeddings",
    request_body = NeighborsRequest,
    responses(
        (status = 200, description = "Successfully computed word neighbors", body = NeighborsResponse),
        (status = 500, description = "Failed to load embeddings or compute neighbors")
    ),
    security(("bearer_auth" = []))
)]
pub async fn compute_neighbors_handler(
    db: web::Data<Database>,
    request: web::Json<NeighborsRequest>,
) -> impl Responder {
    compute_neighbors(db, request).await
}

#[utoipa::path(
    post,
    path = "/api/embeddings/neighbors",
    tag = "Embeddings",
    request_body = EnhancedNeighborsRequest,
    responses(
        (status = 200, description = "Successfully computed word neighbors with enhanced options", body = NeighborsResponse),
        (status = 400, description = "Invalid parameters or unsupported metric"),
        (status = 500, description = "Failed to load embeddings or compute neighbors")
    ),
    security(("bearer_auth" = []))
)]
pub async fn enhanced_neighbors(
    db: web::Data<Database>,
    request: web::Json<EnhancedNeighborsRequest>,
) -> impl Responder {
    let enhanced_request = request.into_inner();
    
    let metric = match enhanced_request.metric.as_deref() {
        Some("cosine") | None => SimilarityMetric::Cosine,
        Some("euclidean") => SimilarityMetric::Euclidean,
        Some("dot_product") => SimilarityMetric::DotProduct,
        Some("manhattan") => SimilarityMetric::Manhattan,
        Some(unknown) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid similarity metric",
                "supported_metrics": ["cosine", "euclidean", "dot_product", "manhattan"],
                "provided": unknown
            }));
        }
    };
    
    let standard_request: NeighborsRequest = enhanced_request.into();
    
    info!(
        "Enhanced neighbors request for '{}' using {:?} metric",
        standard_request.word, metric
    );
    
    let embeddings = match get_cached_embeddings(
        &db,
        standard_request.solr_database_id,
        &standard_request.collection_name,
    ).await {
        Some(embeddings) => embeddings,
        None => {
            warn!(
                "No embeddings available for collection {}",
                standard_request.collection_name
            );
            return HttpResponse::Ok().json(NeighborsResponse {
                neighbors: vec![],
                has_embeddings: false,
                query_word: standard_request.word.clone(),
                k: standard_request.get_k(),
                threshold: standard_request.get_threshold(),
            });
        }
    };
    
    let searcher = SimilaritySearcher::with_metric(metric)
        .with_parallel(true);
    
    let response = searcher.find_neighbors(&standard_request, &embeddings);
    
    HttpResponse::Ok().json(response)
}

#[utoipa::path(
    post,
    path = "/api/embeddings/batch-neighbors",
    tag = "Embeddings",
    request_body = BatchNeighborsRequest,
    responses(
        (status = 200, description = "Successfully computed neighbors for multiple words", body = BatchNeighborsResponse),
        (status = 400, description = "Invalid parameters or too many words"),
        (status = 500, description = "Failed to load embeddings or compute neighbors")
    ),
    security(("bearer_auth" = []))
)]
pub async fn batch_neighbors(
    db: web::Data<Database>,
    request: web::Json<BatchNeighborsRequest>,
) -> impl Responder {
    let batch_request = request.into_inner();
    
    if batch_request.words.len() > 50 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Too many words in batch request",
            "max_allowed": 50,
            "provided": batch_request.words.len()
        }));
    }
    
    let start_time = std::time::Instant::now();
    
    let metric = match batch_request.metric.as_deref() {
        Some("cosine") | None => SimilarityMetric::Cosine,
        Some("euclidean") => SimilarityMetric::Euclidean,
        Some("dot_product") => SimilarityMetric::DotProduct,
        Some("manhattan") => SimilarityMetric::Manhattan,
        Some(unknown) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid similarity metric",
                "supported_metrics": ["cosine", "euclidean", "dot_product", "manhattan"],
                "provided": unknown
            }));
        }
    };
    
    let embeddings = match get_cached_embeddings(
        &db,
        batch_request.solr_database_id,
        &batch_request.collection_name,
    ).await {
        Some(embeddings) => embeddings,
        None => {
            return HttpResponse::Ok().json(BatchNeighborsResponse {
                results: vec![],
                stats: BatchStats {
                    total_time_ms: start_time.elapsed().as_millis() as u64,
                    words_processed: 0,
                    words_with_embeddings: 0,
                    avg_time_per_word_ms: 0.0,
                },
            });
        }
    };
    
    let searcher = SimilaritySearcher::with_metric(metric)
        .with_parallel(false);
    
    let mut results = Vec::new();
    let mut words_with_embeddings = 0;
    
    for word in batch_request.words {
        let word_start_time = std::time::Instant::now();
        
        let standard_request = NeighborsRequest {
            word: word.clone(),
            solr_database_id: batch_request.solr_database_id,
            collection_name: batch_request.collection_name.clone(),
            k: batch_request.k,
            threshold: batch_request.threshold,
            include_scores: batch_request.include_scores,
        };
        
        let response = searcher.find_neighbors(&standard_request, &embeddings);
        
        if response.has_embeddings && !response.neighbors.is_empty() {
            words_with_embeddings += 1;
        }
        
        results.push(WordNeighborsResult {
            word,
            neighbors: response,
            processing_time_ms: word_start_time.elapsed().as_millis() as u64,
        });
    }
    
    let total_time = start_time.elapsed().as_millis() as u64;
    let words_processed = results.len();
    
    let stats = BatchStats {
        total_time_ms: total_time,
        words_processed,
        words_with_embeddings,
        avg_time_per_word_ms: if words_processed > 0 {
            total_time as f64 / words_processed as f64
        } else {
            0.0
        },
    };
    
    HttpResponse::Ok().json(BatchNeighborsResponse { results, stats })
}

#[utoipa::path(
    post,
    path = "/api/embeddings/similarity",
    tag = "Embeddings",
    request_body = SimilarityRequest,
    responses(
        (status = 200, description = "Successfully computed similarity between two words", body = SimilarityResponse),
        (status = 400, description = "Invalid parameters or unsupported metric"),
        (status = 500, description = "Failed to load embeddings")
    ),
    security(("bearer_auth" = []))
)]
pub async fn word_similarity(
    db: web::Data<Database>,
    request: web::Json<SimilarityRequest>,
) -> impl Responder {
    let similarity_request = request.into_inner();
    
    let metric = match similarity_request.metric.as_deref() {
        Some("cosine") | None => SimilarityMetric::Cosine,
        Some("euclidean") => SimilarityMetric::Euclidean,
        Some("dot_product") => SimilarityMetric::DotProduct,
        Some("manhattan") => SimilarityMetric::Manhattan,
        Some(unknown) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid similarity metric",
                "supported_metrics": ["cosine", "euclidean", "dot_product", "manhattan"],
                "provided": unknown
            }));
        }
    };
    
    let embeddings = match get_cached_embeddings(
        &db,
        similarity_request.solr_database_id,
        &similarity_request.collection_name,
    ).await {
        Some(embeddings) => embeddings,
        None => {
            return HttpResponse::Ok().json(SimilarityResponse {
                word1: similarity_request.word1,
                word2: similarity_request.word2,
                similarity: 0.0,
                metric: format!("{:?}", metric),
                both_found: false,
            });
        }
    };
    
    let word1_lower = similarity_request.word1.to_lowercase();
    let word2_lower = similarity_request.word2.to_lowercase();
    
    let embedding1 = embeddings.get(&word1_lower);
    let embedding2 = embeddings.get(&word2_lower);
    
    let (similarity, both_found) = match (embedding1, embedding2) {
        (Some(emb1), Some(emb2)) => {
            let searcher = SimilaritySearcher::with_metric(metric);
            let sim = searcher.compute_similarity(emb1, emb2);
            (sim, true)
        }
        _ => (0.0, false),
    };
    
    HttpResponse::Ok().json(SimilarityResponse {
        word1: similarity_request.word1,
        word2: similarity_request.word2,
        similarity,
        metric: format!("{:?}", metric),
        both_found,
    })
}

#[utoipa::path(
    post,
    path = "/api/embeddings/analogy",
    tag = "Embeddings",
    request_body = AnalogyRequest,
    responses(
        (status = 200, description = "Successfully computed word analogy", body = AnalogyResponse),
        (status = 400, description = "Invalid parameters"),
        (status = 500, description = "Failed to load embeddings")
    ),
    security(("bearer_auth" = []))
)]
pub async fn word_analogy(
    db: web::Data<Database>,
    request: web::Json<AnalogyRequest>,
) -> impl Responder {
    let analogy_request = request.into_inner();
    let k = analogy_request.k.unwrap_or(5).min(20);
    
    let embeddings = match get_cached_embeddings(
        &db,
        analogy_request.solr_database_id,
        &analogy_request.collection_name,
    ).await {
        Some(embeddings) => embeddings,
        None => {
            return HttpResponse::Ok().json(AnalogyResponse {
                analogy: format!("{} is to {} as {} is to ?", 
                    analogy_request.word_a, analogy_request.word_b, analogy_request.word_c),
                candidates: vec![],
                all_words_found: false,
            });
        }
    };
    
    let word_a_lower = analogy_request.word_a.to_lowercase();
    let word_b_lower = analogy_request.word_b.to_lowercase();
    let word_c_lower = analogy_request.word_c.to_lowercase();
    
    let embedding_a = embeddings.get(&word_a_lower);
    let embedding_b = embeddings.get(&word_b_lower);
    let embedding_c = embeddings.get(&word_c_lower);
    
    let candidates = match (embedding_a, embedding_b, embedding_c) {
        (Some(emb_a), Some(emb_b), Some(emb_c)) => {
            let mut analogy_vector = Vec::with_capacity(emb_a.vector.len());
            for ((b_val, a_val), c_val) in emb_b.vector.iter()
                .zip(emb_a.vector.iter())
                .zip(emb_c.vector.iter()) {
                analogy_vector.push(b_val - a_val + c_val);
            }
            
            let analogy_embedding = crate::histtext::embeddings::types::Embedding::new(analogy_vector);
            
            let searcher = SimilaritySearcher::with_metric(SimilarityMetric::Cosine);
            let mut scored_candidates = Vec::new();
            
            for (word, embedding) in embeddings.iter() {
                if word == &word_a_lower || word == &word_b_lower || word == &word_c_lower {
                    continue;
                }
                
                let similarity = searcher.compute_similarity(&analogy_embedding, embedding);
                scored_candidates.push((word.clone(), similarity));
            }
            
            scored_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
            scored_candidates
                .into_iter()
                .take(k)
                .map(|(word, similarity)| NeighborResult::with_similarity(word, similarity))
                .collect()
        }
        _ => vec![],
    };
    
    let all_words_found = embedding_a.is_some() && embedding_b.is_some() && embedding_c.is_some();
    
    HttpResponse::Ok().json(AnalogyResponse {
        analogy: format!("{} is to {} as {} is to ?", 
            analogy_request.word_a, analogy_request.word_b, analogy_request.word_c),
        candidates,
        all_words_found,
    })
}

pub async fn compute_neighbors(
    db: web::Data<Database>,
    query: web::Json<NeighborsRequest>,
) -> impl Responder {
    let start_time = std::time::Instant::now();
    
    info!(
        "Received request to compute neighbors for word: {} in collection: {} (database ID: {})",
        query.word, query.collection_name, query.solr_database_id
    );

    let embeddings_opt = get_cached_embeddings(&db, query.solr_database_id, &query.collection_name).await;

    let embeddings = match embeddings_opt {
        Some(emb) => emb,
        None => {
            warn!(
                "No embeddings available for collection {}",
                query.collection_name
            );
            return HttpResponse::Ok().json(NeighborsResponse {
                neighbors: vec![],
                has_embeddings: false,
                query_word: query.word.clone(),
                k: query.get_k(),
                threshold: query.get_threshold(),
            });
        }
    };

    let searcher = SimilaritySearcher::new();
    let response = searcher.find_neighbors(&query, &embeddings);

    stats::record_search_time(start_time.elapsed());

    if response.neighbors.is_empty() {
        warn!("No neighbors found for word: {}", query.word);
    } else {
        info!(
            "Found {} neighbors for word {}",
            response.neighbors.len(),
            query.word
        );
    }

    HttpResponse::Ok().json(response)
}
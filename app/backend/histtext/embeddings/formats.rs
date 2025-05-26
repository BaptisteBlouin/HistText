use crate::histtext::embeddings::types::{
    Embedding, EmbeddingConfig, EmbeddingError, EmbeddingMap, EmbeddingResult, EmbeddingStats,
};

use log::{debug, info, warn};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::time::Instant;

pub async fn load_embeddings(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, EmbeddingStats)> {
    let start_time = Instant::now();
    info!("Loading embeddings from: {}", path);

    if !Path::new(path).exists() {
        return Err(EmbeddingError::FileNotFound(path.to_string()));
    }

    let file_size = std::fs::metadata(path)?.len();
    
    if path.ends_with(".txt") || path.ends_with(".vec") {
        info!("Using text format loader for: {}", path);
        load_text_format(path, config, file_size, start_time).await
    } else {
        info!("Attempting finalfusion loader for: {}", path);
        match try_finalfusion_loaders(path, config, file_size, start_time).await {
            Ok(result) => Ok(result),
            Err(_) => {
                warn!("Finalfusion failed, falling back to text format");
                load_text_format(path, config, file_size, start_time).await
            }
        }
    }
}

async fn load_text_format(
    path: &str,
    config: &EmbeddingConfig,
    file_size: u64,
    start_time: Instant,
) -> EmbeddingResult<(EmbeddingMap, EmbeddingStats)> {
    let file = File::open(path)?;
    let buf_reader = BufReader::new(file);
    let mut embeddings = HashMap::new();
    let mut dimension = 0;
    let mut words_loaded = 0;
    let max_words = if config.max_words > 0 {
        config.max_words
    } else {
        200_000
    };
    
    for (line_num, line_result) in buf_reader.lines().enumerate() {
        if words_loaded >= max_words {
            info!("Reached maximum word limit of {}", max_words);
            break;
        }
        
        let line = line_result?;
        let line = line.trim();
        
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        if line_num == 0 {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() == 2 && parts[0].parse::<usize>().is_ok() && parts[1].parse::<usize>().is_ok() {
                info!("Skipping header line: {}", line);
                continue;
            }
        }
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        
        let word = parts[0].to_string();
        
        if config.skip_invalid_words && !is_valid_word(&word) {
            continue;
        }
        
        let vector_parts = &parts[1..];
        let mut vector = Vec::with_capacity(vector_parts.len());
        
        for part in vector_parts {
            match part.parse::<f32>() {
                Ok(value) => vector.push(value),
                Err(_) => continue,
            }
        }
        
        if vector.is_empty() {
            continue;
        }
        
        if dimension == 0 {
            dimension = vector.len();
        } else if config.validate_dimensions && vector.len() != dimension {
            continue;
        }
        
        let mut embedding = Embedding::new(vector);
        if config.normalize_on_load {
            embedding.normalize();
        }
        
        embeddings.insert(word, embedding);
        words_loaded += 1;
        
        if words_loaded % 10000 == 0 {
            debug!("Loaded {} words...", words_loaded);
        }
    }
    
    let load_time_ms = start_time.elapsed().as_millis() as u64;
    let memory_usage = estimate_memory_usage(&embeddings);
    
    let stats = EmbeddingStats {
        word_count: embeddings.len(),
        dimension,
        format: "Text".to_string(),
        file_size,
        load_time_ms,
        memory_usage,
        normalized: config.normalize_on_load,
        encoding: config.text_encoding.clone(),
        was_compressed: path.ends_with(".gz"),
    };
    
    info!(
        "Successfully loaded {} embeddings using text format in {}ms ({}MB memory)",
        embeddings.len(),
        load_time_ms,
        memory_usage / 1024 / 1024
    );
    
    Ok((embeddings, stats))
}

async fn try_finalfusion_loaders(
    path: &str,
    config: &EmbeddingConfig,
    file_size: u64,
    start_time: Instant,
) -> EmbeddingResult<(EmbeddingMap, EmbeddingStats)> {
    
    let loaders = vec![
        ("Word2Vec Binary", LoaderType::Word2Vec),
        ("FastText Binary", LoaderType::FastText),
        ("Generic Binary", LoaderType::Binary),
    ];
    
    for (name, loader_type) in loaders {
        info!("Trying finalfusion loader: {}", name);
        
        match try_load_with_loader(path, &loader_type, config).await {
            Ok((embeddings, dimension)) => {
                if embeddings.is_empty() {
                    debug!("Loader {} loaded 0 embeddings, trying next", name);
                    continue;
                }
                
                let load_time_ms = start_time.elapsed().as_millis() as u64;
                let memory_usage = estimate_memory_usage(&embeddings);
                
                let stats = EmbeddingStats {
                    word_count: embeddings.len(),
                    dimension,
                    format: name.to_string(),
                    file_size,
                    load_time_ms,
                    memory_usage,
                    normalized: config.normalize_on_load,
                    encoding: None,
                    was_compressed: path.ends_with(".gz"),
                };
                
                info!(
                    "Successfully loaded {} embeddings using {} in {}ms ({}MB memory)",
                    embeddings.len(),
                    name,
                    load_time_ms,
                    memory_usage / 1024 / 1024
                );
                
                return Ok((embeddings, stats));
            }
            Err(e) => {
                debug!("Failed to load with {}: {}", name, e);
                continue;
            }
        }
    }
    
    Err(EmbeddingError::Format(
        "Could not load file with any finalfusion format".to_string()
    ))
}

#[derive(Debug, Clone)]
enum LoaderType {
    Binary,
    FastText,
    Word2Vec,
}

async fn try_load_with_loader(
    path: &str,
    loader_type: &LoaderType,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    match loader_type {
        LoaderType::Binary => load_with_finalfusion_binary(path, config).await,
        LoaderType::FastText => load_with_finalfusion_fasttext(path, config).await,
        LoaderType::Word2Vec => load_with_finalfusion_word2vec(path, config).await,
    }
}

async fn load_with_finalfusion_binary(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    use finalfusion::prelude::*;
    
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<VocabWrap, StorageWrap>, Box<dyn std::error::Error + Send + Sync>> {
            let mut file = File::open(&path)?;
            let embeddings = Embeddings::read_embeddings(&mut file)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_embeddings_wrapped(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion binary error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

async fn load_with_finalfusion_fasttext(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    use finalfusion::prelude::*;
    use finalfusion::storage::NdArray;
    use finalfusion::vocab::SubwordVocab;
    use finalfusion::compat::fasttext::FastTextIndexer;
    
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<SubwordVocab<FastTextIndexer>, NdArray>, Box<dyn std::error::Error + Send + Sync>> {
            let file = File::open(&path)?;
            let mut buf_reader = BufReader::new(file);
            let embeddings = Embeddings::read_fasttext(&mut buf_reader)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_fasttext_embeddings(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion FastText error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

async fn load_with_finalfusion_word2vec(
    path: &str,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    use finalfusion::prelude::*;
    use finalfusion::storage::NdArray;
    use finalfusion::vocab::SimpleVocab;
    
    let embeddings_result = tokio::task::spawn_blocking({
        let path = path.to_string();
        move || -> Result<Embeddings<SimpleVocab, NdArray>, Box<dyn std::error::Error + Send + Sync>> {
            let file = File::open(&path)?;
            let mut buf_reader = BufReader::new(file);
            let embeddings = Embeddings::read_word2vec_binary(&mut buf_reader)?;
            Ok(embeddings)
        }
    }).await;
    
    match embeddings_result {
        Ok(Ok(embeddings)) => convert_finalfusion_embeddings(embeddings, config).await,
        Ok(Err(e)) => Err(EmbeddingError::Format(format!("FinalFusion Word2Vec error: {}", e))),
        Err(e) => Err(EmbeddingError::Format(format!("Task error: {}", e))),
    }
}

async fn convert_finalfusion_embeddings(
    embeddings: finalfusion::prelude::Embeddings<finalfusion::vocab::SimpleVocab, finalfusion::storage::NdArray>,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    use finalfusion::vocab::Vocab;
    use finalfusion::storage::Storage;
    
    let vocab = embeddings.vocab();
    let storage = embeddings.storage();
    let dimension = storage.shape().1;
    let words = vocab.words();
    let vocab_len = words.len();
    
    info!("Converting finalfusion embeddings: {} words, {} dimensions", vocab_len, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(vocab_len)
    } else {
        vocab_len.min(200_000)
    };
    
    let mut our_embeddings = HashMap::new();
    
    for (idx, word) in words.iter().enumerate() {
        if idx >= max_words {
            break;
        }
        
        if config.skip_invalid_words && !is_valid_word(word) {
            continue;
        }
        
        if let Some(embedding_view) = embeddings.embedding(word) {
            if let Some(vector_slice) = embedding_view.as_slice() {
                let vector: Vec<f32> = vector_slice.to_vec();
                
                let mut embedding = Embedding::new(vector);
                if config.normalize_on_load {
                    embedding.normalize();
                }
                
                our_embeddings.insert(word.to_string(), embedding);
            }
        }
        
        if idx % 10000 == 0 && idx > 0 {
            debug!("Converted {} words...", idx);
        }
    }
    
    info!("Successfully converted {} embeddings", our_embeddings.len());
    Ok((our_embeddings, dimension))
}

async fn convert_finalfusion_fasttext_embeddings(
    embeddings: finalfusion::prelude::Embeddings<finalfusion::vocab::SubwordVocab<finalfusion::compat::fasttext::FastTextIndexer>, finalfusion::storage::NdArray>,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    use finalfusion::vocab::Vocab;
    use finalfusion::storage::Storage;
    
    let vocab = embeddings.vocab();
    let storage = embeddings.storage();
    let dimension = storage.shape().1;
    let words = vocab.words();
    let vocab_len = words.len();
    
    info!("Converting FastText embeddings: {} words, {} dimensions", vocab_len, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(vocab_len)
    } else {
        vocab_len.min(200_000)
    };
    
    let mut our_embeddings = HashMap::new();
    
    for (idx, word) in words.iter().enumerate() {
        if idx >= max_words {
            break;
        }
        
        if config.skip_invalid_words && !is_valid_word(word) {
            continue;
        }
        
        if let Some(embedding_view) = embeddings.embedding(word) {
            if let Some(vector_slice) = embedding_view.as_slice() {
                let vector: Vec<f32> = vector_slice.to_vec();
                
                let mut embedding = Embedding::new(vector);
                if config.normalize_on_load {
                    embedding.normalize();
                }
                
                our_embeddings.insert(word.to_string(), embedding);
            }
        }
        
        if idx % 10000 == 0 && idx > 0 {
            debug!("Converted {} words...", idx);
        }
    }
    
    info!("Successfully converted {} FastText embeddings", our_embeddings.len());
    Ok((our_embeddings, dimension))
}

async fn convert_finalfusion_embeddings_wrapped(
    embeddings: finalfusion::prelude::Embeddings<finalfusion::vocab::VocabWrap, finalfusion::storage::StorageWrap>,
    config: &EmbeddingConfig,
) -> EmbeddingResult<(EmbeddingMap, usize)> {
    use finalfusion::prelude::*;
    use finalfusion::vocab::Vocab;
    use finalfusion::storage::Storage;
    
    let vocab = embeddings.vocab();
    let storage = embeddings.storage();
    let dimension = storage.shape().1;
    
    let words = match vocab {
        VocabWrap::SimpleVocab(v) => v.words(),
        VocabWrap::FastTextSubwordVocab(v) => v.words(),
        VocabWrap::ExplicitSubwordVocab(v) => v.words(),
        _ => return Err(EmbeddingError::UnsupportedFormat("Unsupported vocab type".to_string())),
    };
    
    let vocab_len = words.len();
    
    info!("Converting wrapped embeddings: {} words, {} dimensions", vocab_len, dimension);
    
    let max_words = if config.max_words > 0 {
        config.max_words.min(vocab_len)
    } else {
        vocab_len.min(200_000)
    };
    
    let mut our_embeddings = HashMap::new();
    
    for (idx, word) in words.iter().enumerate() {
        if idx >= max_words {
            break;
        }
        
        if config.skip_invalid_words && !is_valid_word(word) {
            continue;
        }
        
        if let Some(embedding_view) = embeddings.embedding(word) {
            if let Some(vector_slice) = embedding_view.as_slice() {
                let vector: Vec<f32> = vector_slice.to_vec();
                
                let mut embedding = Embedding::new(vector);
                if config.normalize_on_load {
                    embedding.normalize();
                }
                
                our_embeddings.insert(word.to_string(), embedding);
            }
        }
        
        if idx % 10000 == 0 && idx > 0 {
            debug!("Converted {} words...", idx);
        }
    }
    
    info!("Successfully converted {} wrapped embeddings", our_embeddings.len());
    Ok((our_embeddings, dimension))
}

fn is_valid_word(word: &str) -> bool {
    !word.is_empty() 
        && word.len() <= 200
        && !word.chars().any(|c| c.is_control())
        && word.chars().count() <= 100
}

fn estimate_memory_usage(embeddings: &EmbeddingMap) -> usize {
    let mut total = 0;
    
    for (word, embedding) in embeddings {
        total += word.len() + std::mem::size_of::<String>();
        total += embedding.vector.len() * std::mem::size_of::<f32>();
        total += std::mem::size_of::<Embedding>();
        total += 32;
    }
    
    total
}
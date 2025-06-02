# toolkit/histtext_toolkit/operations/enhanced_ner.py
"""Enhanced NER operations with modern models and optimizations."""

import asyncio
import os
import time
import json
from typing import Any, Optional, List, Dict, Iterator
from dataclasses import asdict

import numpy as np
from tqdm import tqdm

from ..cache.manager import get_cache_manager
from ..core.config import ModelConfig
from ..core.logging import get_logger
from ..models.base import EnhancedNERModel, EntitySpan, ProcessingMode, GPUMemoryManager
from ..models.enhanced_registry import create_enhanced_ner_model
from ..solr.client import SolrClient

logger = get_logger(__name__)


class EnhancedNERProcessor:
    """Enhanced NER processor with modern optimizations."""
    
    def __init__(
        self, 
        model: EnhancedNERModel, 
        cache_root: Optional[str] = None,
        processing_mode: ProcessingMode = ProcessingMode.BATCH,
        enable_caching: bool = True
    ):
        self.model = model
        self.cache_root = cache_root
        self.processing_mode = processing_mode
        self.enable_caching = enable_caching
        
        self._entity_cache = {} if enable_caching else None
        self._processing_stats = {
            "total_texts": 0,
            "total_entities": 0,
            "total_time": 0.0,
            "cache_hits": 0
        }
    
    def extract_entities(
        self, 
        text: str, 
        entity_types: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> List[EntitySpan]:
        """Extract entities with caching and optimization."""
        
        if not text or not text.strip():
            return []
        
        # Check cache first
        if use_cache and self.enable_caching and self._entity_cache is not None:
            cache_key = f"{hash(text)}_{hash(str(entity_types))}"
            if cache_key in self._entity_cache:
                self._processing_stats["cache_hits"] += 1
                return self._entity_cache[cache_key]
        
        start_time = time.time()
        
        # Extract entities
        entities = self.model.extract_entities(text, entity_types)
        
        # Update stats
        processing_time = time.time() - start_time
        self._processing_stats["total_texts"] += 1
        self._processing_stats["total_entities"] += len(entities)
        self._processing_stats["total_time"] += processing_time
        
        # Cache result
        if use_cache and self.enable_caching and self._entity_cache is not None:
            cache_key = f"{hash(text)}_{hash(str(entity_types))}"
            self._entity_cache[cache_key] = entities
        
        return entities
    
    def extract_entities_batch(
        self,
        texts: List[str],
        entity_types: Optional[List[str]] = None,
        show_progress: bool = True
    ) -> List[List[EntitySpan]]:
        """Optimized batch processing with progress tracking."""
        
        if not texts:
            return []
        
        start_time = time.time()
        
        # Filter out empty texts but keep track of original positions
        text_mapping = []
        valid_texts = []
        
        for i, text in enumerate(texts):
            if text and text.strip():
                text_mapping.append((i, len(valid_texts)))
                valid_texts.append(text)
            else:
                text_mapping.append((i, -1))  # -1 indicates empty text
        
        # Process valid texts
        if valid_texts:
            if hasattr(self.model, 'extract_entities_batch') and len(valid_texts) > 10:
                # Use model's batch processing
                valid_results = self.model.extract_entities_batch(valid_texts, entity_types)
            else:
                # Process individually with progress bar
                valid_results = []
                iterator = tqdm(valid_texts, desc="Processing texts") if show_progress else valid_texts
                
                for text in iterator:
                    entities = self.extract_entities(text, entity_types)
                    valid_results.append(entities)
        else:
            valid_results = []
        
        # Map results back to original positions
        results = []
        valid_idx = 0
        
        for original_idx, valid_pos in text_mapping:
            if valid_pos == -1:
                results.append([])  # Empty text
            else:
                results.append(valid_results[valid_idx])
                valid_idx += 1
        
        # Update global stats
        processing_time = time.time() - start_time
        total_entities = sum(len(entities) for entities in results)
        
        self._processing_stats["total_texts"] += len(texts)
        self._processing_stats["total_entities"] += total_entities
        self._processing_stats["total_time"] += processing_time
        
        if show_progress:
            logger.info(f"Processed {len(texts)} texts, found {total_entities} entities in {processing_time:.2f}s")
        
        return results
    
    def extract_entities_streaming(
        self,
        texts: Iterator[str],
        entity_types: Optional[List[str]] = None,
        batch_size: int = 32
    ) -> Iterator[List[EntitySpan]]:
        """Stream processing for large datasets."""
        
        batch = []
        for text in texts:
            batch.append(text)
            
            if len(batch) >= batch_size:
                # Process batch
                results = self.extract_entities_batch(batch, entity_types, show_progress=False)
                for result in results:
                    yield result
                
                batch = []
                
                # Memory cleanup
                if len(batch) % (batch_size * 10) == 0:
                    GPUMemoryManager.clear_cache()
        
        # Process remaining batch
        if batch:
            results = self.extract_entities_batch(batch, entity_types, show_progress=False)
            for result in results:
                yield result
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get processing statistics."""
        stats = self._processing_stats.copy()
        
        if stats["total_texts"] > 0:
            stats["avg_entities_per_text"] = stats["total_entities"] / stats["total_texts"]
            stats["avg_time_per_text"] = stats["total_time"] / stats["total_texts"]
            stats["entities_per_second"] = stats["total_entities"] / stats["total_time"] if stats["total_time"] > 0 else 0
        
        if self.enable_caching:
            stats["cache_hit_rate"] = stats["cache_hits"] / stats["total_texts"] if stats["total_texts"] > 0 else 0
        
        # Add GPU memory info if available
        gpu_info = GPUMemoryManager.get_memory_info()
        if gpu_info:
            stats["gpu_memory"] = gpu_info
        
        return stats
    
    def clear_cache(self):
        """Clear entity cache."""
        if self._entity_cache is not None:
            self._entity_cache.clear()
            logger.info("Cleared entity cache")


async def enhanced_precompute_ner(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    cache_root: str,
    model_name: str,
    start: int = 0,
    batch_size: int = 1000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    entity_types: Optional[List[str]] = None,
    processing_mode: ProcessingMode = ProcessingMode.BATCH,
    optimization_level: int = 1,
    enable_streaming: bool = False,
    jsonl_prefix: Optional[str] = None,
    format_type: str = "enhanced"
) -> int:
    """Enhanced NER precomputation with modern optimizations."""
    
    # Create enhanced model
    model = create_enhanced_ner_model(
        model_config, 
        processing_mode=processing_mode,
        optimization_level=optimization_level
    )
    
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0
    
    # Create enhanced processor
    processor = EnhancedNERProcessor(
        model, 
        cache_root=cache_root,
        processing_mode=processing_mode
    )
    
    # Setup cache directory
    cache_dir = os.path.join(cache_root, model_name, collection, text_field)
    os.makedirs(cache_dir, exist_ok=True)
    
    logger.info(f"Starting enhanced NER precomputation...")
    logger.info(f"Model: {model_config.name} ({model_config.type})")
    logger.info(f"Processing mode: {processing_mode.value}")
    logger.info(f"Cache directory: {cache_dir}")
    
    if entity_types:
        logger.info(f"Entity types: {entity_types}")
    
    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0
    total_entities = 0
    
    try:
        while num_batches is None or current_batch < num_batches:
            logger.info(f"Processing batch {current_batch + 1} (docs {current_start}-{current_start + batch_size - 1})")
            
            # Get documents from Solr
            documents = await solr_client.get_document_batch(
                collection, text_field, current_start, batch_size, filter_query
            )
            
            if not documents:
                logger.info("No more documents found")
                break
            
            # Extract texts and IDs
            doc_ids = list(documents.keys())
            texts = list(documents.values())
            
            # Process with enhanced NER
            batch_start_time = time.time()
            
            if enable_streaming and len(texts) > 100:
                # Use streaming for large batches
                results = list(processor.extract_entities_streaming(
                    iter(texts), entity_types, batch_size=min(32, len(texts)//4)
                ))
            else:
                # Standard batch processing
                results = processor.extract_entities_batch(texts, entity_types)
            
            batch_time = time.time() - batch_start_time
            
            # Convert results to cache format
            entities_for_cache = {}
            batch_entities = 0
            
            for doc_id, entities in zip(doc_ids, results):
                if entities:
                    if format_type == "enhanced":
                        # Enhanced format with more metadata
                        entities_for_cache[doc_id] = [
                            {
                                **asdict(entity),
                                "model_name": model_name,
                                "extraction_time": batch_time / len(results),
                                "model_confidence": entity.confidence
                            }
                            for entity in entities
                        ]
                    else:
                        # Standard format
                        entities_for_cache[doc_id] = [
                            {
                                "text": entity.text,
                                "labels": entity.labels,
                                "start_pos": entity.start_pos,
                                "end_pos": entity.end_pos,
                                "confidence": entity.confidence
                            }
                            for entity in entities
                        ]
                    batch_entities += len(entities)
            
            # Cache results
            if entities_for_cache:
                cache_manager = get_cache_manager(cache_root)
                cache_manager.save_annotations(
                    model_name,
                    collection,
                    text_field,
                    entities_for_cache,
                    jsonl_prefix,
                    current_start,
                    format_type
                )
            
            # Update counters
            total_docs += len(documents)
            total_entities += batch_entities
            
            # Log progress
            logger.info(f"Batch {current_batch + 1}: {len(documents)} docs, {batch_entities} entities, {batch_time:.2f}s")
            
            # Memory management
            if current_batch % 5 == 0:
                GPUMemoryManager.clear_cache()
            
            # Check for completion
            if len(documents) < batch_size:
                logger.info("Completed collection - no more documents")
                break
            
            current_batch += 1
            current_start += batch_size
    
    except Exception as e:
        logger.error(f"Error during enhanced NER processing: {e}")
    
    finally:
        # Get final stats
        stats = processor.get_processing_stats()
        
        # Log final statistics
        logger.info(f"\n{'='*60}")
        logger.info(f"Enhanced NER Processing Complete")
        logger.info(f"{'='*60}")
        logger.info(f"Documents processed: {total_docs}")
        logger.info(f"Total entities found: {total_entities}")
        logger.info(f"Average entities per document: {total_entities/total_docs if total_docs > 0 else 0:.2f}")
        logger.info(f"Processing time: {stats['total_time']:.2f}s")
        logger.info(f"Throughput: {stats.get('entities_per_second', 0):.2f} entities/sec")
        
        if stats.get('cache_hit_rate'):
            logger.info(f"Cache hit rate: {stats['cache_hit_rate']:.1%}")
        
        if stats.get('gpu_memory'):
            gpu_info = stats['gpu_memory']
            logger.info(f"GPU memory usage: {gpu_info.get('allocated', 0):.1f}GB / {gpu_info.get('total', 0):.1f}GB")
        
        logger.info(f"Results cached in: {cache_dir}")
        logger.info(f"{'='*60}")
        
        # Unload model
        model.unload()
    
    return total_docs


# Integration function for backward compatibility
async def precompute_ner_enhanced(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    cache_root: str,
    model_name: str,
    **kwargs
) -> int:
    """Enhanced version of the original precompute_ner function."""
    
    # Detect if we should use enhanced processing
    use_enhanced = (
        model_config.type.lower() in ["nuner", "flair", "gliner_enhanced", "llm_ner"] or
        model_config.additional_params.get("use_enhanced", False)
    )
    
    if use_enhanced:
        return await enhanced_precompute_ner(
            solr_client, collection, text_field, model_config,
            cache_root, model_name, **kwargs
        )
    else:
        # Fall back to original implementation
        from .ner import precompute_ner
        return await precompute_ner(
            solr_client, collection, text_field, model_config,
            cache_root, model_name, **kwargs
        )
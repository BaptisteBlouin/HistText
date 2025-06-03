# toolkit/histtext_toolkit/operations/ner.py
"""Simplified NER operations."""

import os
import time
import json
from typing import List, Optional, Dict, Any
from pathlib import Path
from tqdm import tqdm
import numpy as np

from ..cache.manager import get_cache_manager
from ..core.config import ModelConfig
from ..core.logging import get_logger
from ..models.registry import create_ner_model
from ..models.base import EntitySpan, GPUMemoryManager
from ..solr.client import SolrClient
from ..models.ner_labels import get_compact_label, get_label_stats

logger = get_logger(__name__)

class NERProcessor:
    """Simplified NER processor with compact labels."""
    
    def __init__(self, model, cache_root: Optional[str] = None):
        self.model = model
        self.cache_root = cache_root
    
    def _convert_to_serializable(self, value):
        """Convert numpy/torch types to JSON serializable types."""
        if isinstance(value, (np.integer, np.int32, np.int64)):
            return int(value)
        elif isinstance(value, (np.floating, np.float32, np.float64)):
            return float(value)
        elif hasattr(value, 'item'):  # torch tensors
            return value.item()
        else:
            return value
    
    def process_documents_flat(
        self, 
        documents: Dict[str, str], 
        entity_types: Optional[List[str]] = None,
        use_compact_labels: bool = True,
        include_label_stats: bool = False
    ) -> List[Dict[str, Any]]:
        """Process documents and return flat format with compact labels."""
        flat_docs = []
        total_entities = 0
        all_labels = []
        processed_count = 0
        empty_count = 0
        error_count = 0
        
        # Sample first few documents for detailed logging
        sample_doc_ids = list(documents.keys())[:2] if len(documents) > 0 else []
        
        for doc_id, text in tqdm(documents.items(), desc="Processing documents"):
            try:
                # Check for empty or whitespace-only text
                if not text or text.isspace():
                    empty_count += 1
                    if doc_id in sample_doc_ids:
                        logger.debug(f"Skipping empty document {doc_id}")
                    continue
                
                # Log sample document processing
                if doc_id in sample_doc_ids:
                    logger.info(f"Processing sample document {doc_id} (length: {len(text)})")
                
                # Extract entities using the model
                entities = self.model.extract_entities(text, entity_types)
                processed_count += 1
                
                # Log entities found for sample documents
                if doc_id in sample_doc_ids and entities:
                    logger.info(f"Found {len(entities)} entities in sample document {doc_id}")
                    for i, ent in enumerate(entities[:3]):  # Show first 3
                        logger.info(f"  - '{ent.text}' ({ent.labels[0] if ent.labels else 'NO_LABEL'})")
                
                if entities:
                    total_entities += len(entities)
                    
                    # Process labels
                    processed_labels = []
                    for entity in entities:
                        original_label = entity.labels[0] if entity.labels else "MISC"
                        
                        if use_compact_labels:
                            from ..models.ner_labels import get_compact_label
                            compact_label = get_compact_label(original_label)
                            processed_labels.append(compact_label)
                        else:
                            processed_labels.append(original_label)
                        
                        if include_label_stats:
                            all_labels.append(original_label)
                    
                    # Create flat document structure
                    flat_doc = {
                        "doc_id": [doc_id] * len(entities),
                        "t": [entity.text for entity in entities],
                        "l": processed_labels,
                        "s": [self._convert_to_serializable(entity.start_pos) for entity in entities],
                        "e": [self._convert_to_serializable(entity.end_pos) for entity in entities],
                        "c": [self._convert_to_serializable(entity.confidence) for entity in entities]
                    }
                    flat_docs.append(flat_doc)
            
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing document {doc_id}: {e}")
                if doc_id in sample_doc_ids:
                    import traceback
                    logger.debug(f"Error traceback: {traceback.format_exc()}")
        
        # Summary logging
        logger.info(f"Processed {processed_count} documents ({empty_count} empty, {error_count} errors)")
        logger.info(f"Found {total_entities} entities in {len(flat_docs)} documents")
        
        # Log label statistics if requested
        if include_label_stats and all_labels:
            from collections import Counter
            stats = Counter(all_labels)
            logger.info("Label distribution:")
            for label, count in sorted(stats.items(), key=lambda x: x[1], reverse=True)[:10]:
                if use_compact_labels:
                    from ..models.ner_labels import get_compact_label
                    compact = get_compact_label(label)
                    logger.info(f"  {label} -> {compact}: {count}")
                else:
                    logger.info(f"  {label}: {count}")
        
        return flat_docs
    
    def save_results(
        self, 
        flat_docs: List[Dict[str, Any]], 
        cache_dir: Path, 
        start: int, 
        jsonl_prefix: Optional[str] = None,
        save_label_mapping: bool = True
    ):
        """Save results to cache with label mapping."""
        if not flat_docs:
            logger.warning("No results to save")
            return
        
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Save main results
        jsonl_filename = f"batch_{start:08d}.jsonl"
        if jsonl_prefix:
            jsonl_filename = f"{jsonl_prefix}_{jsonl_filename}"
        
        jsonl_path = cache_dir / jsonl_filename
        
        try:
            with open(jsonl_path, 'w', encoding='utf-8') as f:
                for doc in flat_docs:
                    f.write(json.dumps(doc, ensure_ascii=False) + '\n')
            
            # Save label mapping file
            if save_label_mapping:
                mapping_path = cache_dir / "label_mapping.json"
                if not mapping_path.exists():
                    from ..models.ner_labels import get_all_compact_labels
                    mapping_data = {
                        "compact_to_full": get_all_compact_labels(),
                        "description": "Mapping from compact NER labels to full labels",
                        "format_version": "1.0"
                    }
                    
                    with open(mapping_path, 'w', encoding='utf-8') as f:
                        json.dump(mapping_data, f, indent=2, ensure_ascii=False)
                    
                    logger.info(f"Saved label mapping to {mapping_path}")
            
            total_entities = sum(len(doc.get("t", [])) for doc in flat_docs)
            logger.info(f"Saved {len(flat_docs)} documents with {total_entities} entities to {jsonl_path}")
            
        except Exception as e:
            logger.error(f"Error saving results: {e}")
            raise
    
async def precompute_ner(
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
    jsonl_prefix: Optional[str] = None,
    decimal_precision: Optional[int] = None,
    format_type: str = "flat",
    use_compact_labels: bool = True,
    include_label_stats: bool = False,
) -> int:
    """NER precomputation with comprehensive error handling and debugging."""
    
    logger.info(f"Starting NER precomputation...")
    logger.info(f"Model: {model_config.name} ({model_config.type})")
    logger.info(f"Collection: {collection}")
    logger.info(f"Text Field: {text_field}")
    logger.info(f"Format: {format_type}")
    logger.info(f"Compact Labels: {use_compact_labels}")
    logger.info(f"Start: {start}, Batch Size: {batch_size}")
    
    if entity_types:
        logger.info(f"Entity Types: {entity_types}")
    else:
        logger.info("Entity Types: All (no filtering)")
    
    # Create and load model
    model = create_ner_model(model_config)
    if not model:
        logger.error("Failed to create NER model")
        return 0
    
    logger.info(f"Loading model {model_config.name}...")
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0
    
    logger.info("Model loaded successfully")
    
    # Setup directories
    cache_dir = Path(cache_root) / model_name / collection / text_field
    schema_path = Path(cache_root) / f"{collection}_ner.yaml"
    
    # Create schema
    _create_flat_schema_with_compact_labels(str(schema_path), use_compact_labels)
    logger.info(f"Schema file: {schema_path}")
    logger.info(f"Cache directory: {cache_dir}")
    
    # Create processor
    processor = NERProcessor(model, cache_root)
    
    # Initialize counters
    current_start = start
    current_batch = 0
    total_docs = 0
    total_entities = 0
    session_start_time = time.time()
    processed_doc_ids = set()  # Track processed documents to avoid duplicates
    
    try:
        # Test model with sample data first - AVOID OVERLAP WITH BATCH PROCESSING
        logger.info("Testing model with sample data from collection...")
        
        # Calculate test offset to avoid overlap with batch processing
        if start == 0:
            # If starting from beginning, use documents beyond the first batch
            test_start = batch_size + 10
        else:
            # If starting from middle, use documents before the start position
            test_start = max(0, start - 10)
        
        test_docs = await solr_client.get_document_batch(
            collection, text_field, test_start, 3, filter_query
        )
        
        # Fallback if no docs at test offset - use start position but track them
        if not test_docs:
            logger.info("No documents at test offset, using start position for test")
            test_docs = await solr_client.get_document_batch(
                collection, text_field, start, min(3, batch_size), filter_query
            )
            
            if test_docs:
                # Track these so we don't process them again
                processed_doc_ids.update(test_docs.keys())
                logger.info(f"Test documents will be skipped in batch processing: {list(test_docs.keys())}")
        
        if not test_docs:
            logger.error("No documents found in collection for testing")
            return 0
        
        # Test model on sample documents
        test_results = processor.process_documents_flat(
            test_docs, entity_types, use_compact_labels, include_label_stats
        )
        
        test_entities = sum(len(doc.get("t", [])) for doc in test_results)
        logger.info(f"Model test: {test_entities} entities found in {len(test_docs)} sample documents")
        
        if test_entities == 0:
            logger.warning("No entities found in sample documents. This may indicate:")
            logger.warning("  - Text content doesn't contain recognizable entities")
            logger.warning("  - Entity type filtering is too restrictive")
            logger.warning("  - Model confidence threshold is too high")
            logger.warning("  - Text encoding issues")
            
            # Show sample text
            for doc_id, text in list(test_docs.items())[:2]:
                logger.warning(f"Sample text from {doc_id}: {repr(text[:200])}")
        
        # Process batches
        with tqdm(desc="Processing batches", unit="batch") as pbar:
            while num_batches is None or current_batch < num_batches:
                logger.info(f"Processing batch {current_batch + 1}")
                
                # Get documents from Solr
                documents = await solr_client.get_document_batch(
                    collection, text_field, current_start, batch_size, filter_query
                )
                
                if not documents:
                    logger.info("No more documents found")
                    break
                
                # Filter out documents already processed in test phase
                if processed_doc_ids:
                    original_count = len(documents)
                    documents = {
                        doc_id: text for doc_id, text in documents.items() 
                        if doc_id not in processed_doc_ids
                    }
                    filtered_count = original_count - len(documents)
                    if filtered_count > 0:
                        logger.info(f"Filtered out {filtered_count} documents already processed in test phase")
                
                if not documents:
                    logger.info("All documents in batch already processed, moving to next batch")
                    current_batch += 1
                    current_start += batch_size
                    continue
                
                logger.info(f"Retrieved {len(documents)} documents from Solr")
                
                # Process documents
                batch_start_time = time.time()
                flat_docs = processor.process_documents_flat(
                    documents, 
                    entity_types,
                    use_compact_labels=use_compact_labels,
                    include_label_stats=(current_batch == 0 and include_label_stats)
                )
                
                # Apply decimal precision if specified
                if decimal_precision is not None:
                    for doc in flat_docs:
                        if "c" in doc:
                            doc["c"] = [
                                round(c, decimal_precision) if c >= 0 else c 
                                for c in doc["c"]
                            ]
                
                # Save results
                processor.save_results(
                    flat_docs, cache_dir, current_start, jsonl_prefix,
                    save_label_mapping=(current_batch == 0)
                )
                
                # Update counters
                batch_time = time.time() - batch_start_time
                batch_entities = sum(len(doc.get("t", [])) for doc in flat_docs)
                
                # Count actual documents processed (not the ones we retrieved)
                actual_docs_processed = len([doc for doc in flat_docs if len(doc.get("t", [])) >= 0])
                total_docs += len(documents)  # Count all documents we attempted to process
                total_entities += batch_entities
                
                # Update progress
                pbar.update(1)
                pbar.set_postfix({
                    'docs': total_docs,
                    'entities': total_entities,
                    'batch_time': f'{batch_time:.2f}s'
                })
                
                logger.info(f"Batch {current_batch + 1}: {len(documents)} docs, "
                           f"{batch_entities} entities, {batch_time:.2f}s")
                
                # Memory cleanup every 5 batches
                if current_batch % 5 == 0:
                    GPUMemoryManager.clear_cache()
                
                # Check if we're done (got fewer documents than requested)
                if len(documents) < batch_size:
                    logger.info("Completed collection (fewer documents than batch size)")
                    break
                
                current_batch += 1
                current_start += batch_size
    
    except KeyboardInterrupt:
        logger.info("Processing interrupted by user")
    except Exception as e:
        logger.error(f"Error during processing: {e}")
        import traceback
        logger.debug(f"Error traceback: {traceback.format_exc()}")
    finally:
        # Cleanup
        try:
            model.unload()
            logger.info("Model unloaded")
        except Exception as e:
            logger.warning(f"Error unloading model: {e}")
        
        # Final statistics
        session_time = time.time() - session_start_time
        
        logger.info(f"\n{'='*60}")
        logger.info(f"NER Processing Complete")
        logger.info(f"{'='*60}")
        logger.info(f"Model: {model_config.name} ({model_config.type})")
        logger.info(f"Documents processed: {total_docs}")
        logger.info(f"Total entities found: {total_entities}")
        logger.info(f"Processing time: {session_time:.2f}s")
        logger.info(f"Compact labels used: {use_compact_labels}")
        
        if total_docs > 0:
            logger.info(f"Average entities per document: {total_entities/total_docs:.2f}")
            logger.info(f"Throughput: {total_docs/session_time:.1f} docs/s")
        
        logger.info(f"Results cached in: {cache_dir}")
        
        if use_compact_labels:
            logger.info("Compact labels reduce file size by ~30-50%")
        
        # Upload command
        upload_collection = f"{collection}_ner"
        jsonl_pattern = str(cache_dir / "*.jsonl")
        upload_command = f'histtext-toolkit upload {upload_collection} "{jsonl_pattern}" --schema {schema_path}'
        
        logger.info(f"\nTo upload to Solr:")
        logger.info(f"  {upload_command}")
        logger.info(f"{'='*60}")
    
    return total_docs


def _create_flat_schema_with_compact_labels(schema_path: str, use_compact_labels: bool = True) -> None:
    """Create schema for flat NER format with compact labels documentation."""
    
    # Generate label documentation
    if use_compact_labels:
        from ..models.ner_labels import get_all_compact_labels
        compact_labels = get_all_compact_labels()
        label_doc = f"Compact labels: {', '.join([f'{k}={v}' for k, v in compact_labels.items()])}"
    else:
        label_doc = "Full entity labels"
    
    schema_content = {
        "add-field": [
            {
                "name": "doc_id",
                "type": "strings",
                "stored": True,
                "indexed": True,
                "multiValued": True,
                "docValues": True
            },
            {
                "name": "t", 
                "type": "text_general",
                "stored": True,
                "indexed": True,
                "multiValued": True,
                "docValues": False
            },
            {
                "name": "l",
                "type": "string", 
                "stored": True,
                "indexed": True,
                "multiValued": True,
                "docValues": True,
                "_comment": label_doc
            },
            {
                "name": "s",
                "type": "plongs",
                "stored": True, 
                "indexed": True,
                "multiValued": True,
                "docValues": True
            },
            {
                "name": "e",
                "type": "plongs",
                "stored": True,
                "indexed": True, 
                "multiValued": True,
                "docValues": True
            },
            {
                "name": "c",
                "type": "pdoubles",
                "stored": True,
                "indexed": True,
                "multiValued": True,
                "docValues": True
            }
        ]
    }
    
    import yaml
    os.makedirs(os.path.dirname(schema_path) or ".", exist_ok=True)
    
    with open(schema_path, 'w') as f:
        yaml.dump(schema_content, f, default_flow_style=False)
    
    # Also save the mapping as a separate YAML file for reference
    if use_compact_labels:
        mapping_path = schema_path.replace('.yaml', '_labels.yaml')
        from ..models.ner_labels import get_all_compact_labels
        
        mapping_content = {
            "label_mapping": {
                "description": "Compact NER label mappings",
                "format": "compact_code: full_label",
                "mappings": get_all_compact_labels()
            }
        }
        
        with open(mapping_path, 'w') as f:
            yaml.dump(mapping_content, f, default_flow_style=False)
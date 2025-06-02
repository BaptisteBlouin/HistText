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
from ..models.ner_registry import create_ner_model
from ..models.ner_base import EntitySpan, GPUMemoryManager
from ..solr.client import SolrClient

logger = get_logger(__name__)


class NERProcessor:
    """Simplified NER processor."""
    
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
    
    def process_documents_flat(self, documents: Dict[str, str], entity_types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Process documents and return flat format for Solr."""
        flat_docs = []
        total_entities = 0
        
        for doc_id, text in tqdm(documents.items(), desc="Processing documents"):
            try:
                if not text or text.isspace():
                    continue
                
                entities = self.model.extract_entities(text, entity_types)
                
                if entities:
                    total_entities += len(entities)
                    flat_doc = {
                        "doc_id": [doc_id] * len(entities),
                        "t": [entity.text for entity in entities],
                        "l": [entity.labels[0] if entity.labels else "UNK" for entity in entities],
                        "s": [self._convert_to_serializable(entity.start_pos) for entity in entities],
                        "e": [self._convert_to_serializable(entity.end_pos) for entity in entities],
                        "c": [self._convert_to_serializable(entity.confidence) for entity in entities]
                    }
                    flat_docs.append(flat_doc)
            
            except Exception as e:
                logger.error(f"Error processing document {doc_id}: {e}")
        
        logger.info(f"Processed {len(documents)} documents, found {total_entities} entities")
        return flat_docs
    
    def save_results(self, flat_docs: List[Dict[str, Any]], cache_dir: Path, start: int, jsonl_prefix: Optional[str] = None):
        """Save results to cache."""
        if not flat_docs:
            return
        
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        jsonl_filename = f"batch_{start:08d}.jsonl"
        if jsonl_prefix:
            jsonl_filename = f"{jsonl_prefix}_{jsonl_filename}"
        
        jsonl_path = cache_dir / jsonl_filename
        
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            for doc in flat_docs:
                f.write(json.dumps(doc, ensure_ascii=False) + '\n')
        
        total_entities = sum(len(doc.get("t", [])) for doc in flat_docs)
        logger.debug(f"Saved {len(flat_docs)} documents with {total_entities} entities to {jsonl_path}")


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
) -> int:
    """Simplified NER precomputation."""
    
    logger.info(f"Starting NER precomputation...")
    logger.info(f"Model: {model_config.name} ({model_config.type})")
    logger.info(f"Collection: {collection}")
    logger.info(f"Text Field: {text_field}")
    logger.info(f"Format: {format_type}")
    
    if entity_types:
        logger.info(f"Entity Types: {entity_types}")
    
    # Create model
    model = create_ner_model(model_config)
    if not model:
        logger.error("Failed to create model")
        return 0
    
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0
    
    # Setup directories
    cache_dir = Path(cache_root) / model_name / collection / text_field
    schema_path = Path(cache_root) / f"{collection}_ner.yaml"
    
    # Create schema
    _create_flat_schema(str(schema_path))
    logger.info(f"Schema file: {schema_path}")
    logger.info(f"Cache directory: {cache_dir}")
    
    # Create processor
    processor = NERProcessor(model, cache_root)
    
    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0
    total_entities = 0
    session_start_time = time.time()
    
    try:
        with tqdm(desc="Processing batches", unit="batch") as pbar:
            while num_batches is None or current_batch < num_batches:
                logger.debug(f"Processing batch {current_batch + 1}")
                
                # Get documents
                documents = await solr_client.get_document_batch(
                    collection, text_field, current_start, batch_size, filter_query
                )
                
                if not documents:
                    logger.info("No more documents found")
                    break
                
                # Process documents
                batch_start_time = time.time()
                flat_docs = processor.process_documents_flat(documents, entity_types)
                
                # Apply decimal precision
                if decimal_precision is not None:
                    for doc in flat_docs:
                        if "c" in doc:
                            doc["c"] = [round(c, decimal_precision) if c >= 0 else c for c in doc["c"]]
                
                # Save results
                processor.save_results(flat_docs, cache_dir, current_start, jsonl_prefix)
                
                batch_time = time.time() - batch_start_time
                batch_entities = sum(len(doc.get("t", [])) for doc in flat_docs)
                
                total_docs += len(documents)
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
                
                # Memory cleanup
                if current_batch % 5 == 0:
                    GPUMemoryManager.clear_cache()
                
                # Check completion
                if len(documents) < batch_size:
                    logger.info("Completed collection")
                    break
                
                current_batch += 1
                current_start += batch_size
    
    except KeyboardInterrupt:
        logger.info("Processing interrupted")
    except Exception as e:
        logger.error(f"Error during processing: {e}")
    finally:
        model.unload()
        
        # Final statistics
        session_time = time.time() - session_start_time
        
        logger.info(f"\n{'='*60}")
        logger.info(f"NER Processing Complete")
        logger.info(f"{'='*60}")
        logger.info(f"Model: {model_config.name} ({model_config.type})")
        logger.info(f"Documents processed: {total_docs}")
        logger.info(f"Total entities found: {total_entities}")
        logger.info(f"Processing time: {session_time:.2f}s")
        
        if total_docs > 0:
            logger.info(f"Average entities per document: {total_entities/total_docs:.2f}")
            logger.info(f"Throughput: {total_docs/session_time:.1f} docs/s")
        
        logger.info(f"Results cached in: {cache_dir}")
        
        # Upload command
        upload_collection = f"{collection}_ner"
        jsonl_pattern = str(cache_dir / "*.jsonl")
        upload_command = f'python -m histtext_toolkit.main upload {upload_collection} "{jsonl_pattern}" --schema {schema_path}'
        
        logger.info(f"\nTo upload to Solr:")
        logger.info(f"  {upload_command}")
        logger.info(f"{'='*60}")
    
    return total_docs


def _create_flat_schema(schema_path: str) -> None:
    """Create schema for flat NER format."""
    schema_content = {
        "add-field": [
            {
                "name": "doc_id",
                "type": "strings",
                "stored": True,
                "indexed": True,
                "multiValued": True
            },
            {
                "name": "t", 
                "type": "text_general",
                "stored": True,
                "indexed": True,
                "multiValued": True
            },
            {
                "name": "l",
                "type": "string", 
                "stored": True,
                "indexed": True,
                "multiValued": True
            },
            {
                "name": "s",
                "type": "plongs",
                "stored": True, 
                "indexed": True,
                "multiValued": True
            },
            {
                "name": "e",
                "type": "plongs",
                "stored": True,
                "indexed": True, 
                "multiValued": True
            },
            {
                "name": "c",
                "type": "pdoubles",
                "stored": True,
                "indexed": True,
                "multiValued": True
            }
        ]
    }
    
    import yaml
    os.makedirs(os.path.dirname(schema_path) or ".", exist_ok=True)
    
    with open(schema_path, 'w') as f:
        yaml.dump(schema_content, f, default_flow_style=False)
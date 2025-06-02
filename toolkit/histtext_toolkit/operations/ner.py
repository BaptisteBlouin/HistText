"""Unified NER operations module."""

import os
import time
import json
from typing import Any, Optional, List, Dict
from pathlib import Path

from ..cache.manager import get_cache_manager
from ..core.config import ModelConfig
from ..core.logging import get_logger
from ..models.base import EntitySpan, NERModel, ProcessingStats, GPUMemoryManager
from ..models.registry import create_ner_model
from ..solr.client import SolrClient

logger = get_logger(__name__)


class UnifiedNERProcessor:
    """Unified processor for all NER model types."""

    def __init__(self, model: NERModel, cache_root: Optional[str] = None):
        """Initialize the unified NER processor."""
        self.model = model
        self.cache_root = cache_root
        self._stats = ProcessingStats()
        self._entity_cache = {}

    def extract_entities(self, text: str, entity_types: Optional[List[str]] = None) -> List[EntitySpan]:
        """Extract entities with unified interface."""
        if not text or not text.strip():
            return []

        # Handle long documents
        if len(text) > 30000:
            return self._extract_entities_chunked(text, entity_types)
        else:
            return self.model.extract_entities(text, entity_types)

    def _extract_entities_chunked(self, text: str, entity_types: Optional[List[str]]) -> List[EntitySpan]:
        """Handle long documents by chunking."""
        chunk_size = 25000
        overlap = 500
        chunks = []
        
        start = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            
            # Try to break at sentence boundary
            if end < len(text):
                for i in range(end - overlap, end):
                    if i > start and text[i] in '.!?\n':
                        end = i + 1
                        break
            
            chunk = text[start:end]
            chunks.append((chunk, start))
            
            if end >= len(text):
                break
            start = end - overlap

        # Process chunks
        all_entities = []
        for chunk_text, offset in chunks:
            chunk_entities = self.model.extract_entities(chunk_text, entity_types)
            
            # Adjust positions
            for entity in chunk_entities:
                entity.start_pos += offset
                entity.end_pos += offset
                all_entities.append(entity)

        # Remove duplicates
        return self._deduplicate_entities(all_entities)

    def _deduplicate_entities(self, entities: List[EntitySpan]) -> List[EntitySpan]:
        """Remove duplicate entities from overlapping chunks."""
        if not entities:
            return []

        entities.sort(key=lambda x: x.start_pos)
        deduplicated = []

        for entity in entities:
            is_duplicate = False
            
            for existing in deduplicated:
                # Check for overlap
                overlap_start = max(entity.start_pos, existing.start_pos)
                overlap_end = min(entity.end_pos, existing.end_pos)
                overlap_length = max(0, overlap_end - overlap_start)
                
                entity_length = entity.end_pos - entity.start_pos
                
                if overlap_length > 0.7 * entity_length:
                    if entity.confidence <= existing.confidence:
                        is_duplicate = True
                        break
                    else:
                        deduplicated.remove(existing)
                        break
            
            if not is_duplicate:
                deduplicated.append(entity)

        return deduplicated

    def process_documents(self, documents: dict[str, str], entity_types: Optional[List[str]] = None) -> dict[str, list[dict[str, Any]]]:
        """Process a batch of documents."""
        results = {}
        errors = {}

        from tqdm import tqdm

        for doc_id, text in tqdm(documents.items(), desc="Extracting entities", leave=False):
            try:
                if not text or text.isspace():
                    logger.debug(f"Skipping empty document: {doc_id}")
                    continue

                entities = self.extract_entities(text, entity_types)

                if entities:
                    results[doc_id] = [
                        {
                            "text": entity.text,
                            "labels": entity.labels,
                            "start_pos": entity.start_pos,
                            "end_pos": entity.end_pos,
                            "confidence": entity.confidence,
                        }
                        for entity in entities
                    ]
            except Exception as e:
                logger.error(f"Error processing document {doc_id}: {e}")
                errors[doc_id] = str(e)

        if errors:
            logger.warning(f"Encountered errors in {len(errors)} documents")

        return results

    def process_documents_flat_format(self, documents: dict[str, str], entity_types: Optional[List[str]] = None) -> List[dict[str, Any]]:
        """Process documents and return in flat format optimized for Solr."""
        flat_docs = []
        total_entities = 0  # Add counter
        
        from tqdm import tqdm

        for doc_id, text in tqdm(documents.items(), desc="Processing flat format", leave=False):
            try:
                if not text or text.isspace():
                    continue

                entities = self.extract_entities(text, entity_types)

                if entities:
                    total_entities += len(entities)  # Count entities properly
                    # Create flat document
                    flat_doc = {
                        "doc_id": [doc_id] * len(entities),
                        "t": [entity.text for entity in entities],
                        "l": [entity.labels[0] if entity.labels else "UNK" for entity in entities],
                        "s": [entity.start_pos for entity in entities],
                        "e": [entity.end_pos for entity in entities],
                        "c": [entity.confidence for entity in entities]
                    }
                    flat_docs.append(flat_doc)

            except Exception as e:
                logger.error(f"Error processing document {doc_id}: {e}")

        logger.info(f"Processed {len(documents)} documents, found {total_entities} entities")
        return flat_docs

    async def process_and_cache(
        self,
        documents: dict[str, str],
        model_name: str,
        collection: str,
        field: str,
        entity_types: Optional[List[str]] = None,
        decimal_precision: Optional[int] = None,
        jsonl_prefix: Optional[str] = None,
        start: int = 0,
        format_type: str = "flat",
    ) -> list[str]:
        """Process documents and cache the results."""
        if not self.cache_root:
            logger.warning("Cache root not specified, results will not be cached")
            return []

        # Process documents based on format
        if format_type == "flat":
            processed_docs = self.process_documents_flat_format(documents, entity_types)
            
            # Count total entities properly
            total_entities = sum(len(doc.get("t", [])) for doc in processed_docs)
            
            # Apply decimal precision if specified
            if decimal_precision is not None:
                for doc in processed_docs:
                    if "c" in doc:
                        doc["c"] = [round(c, decimal_precision) if c >= 0 else c for c in doc["c"]]
            
            # Cache flat format results
            if processed_docs:
                cache_manager = get_cache_manager(self.cache_root)
                
                # Save as JSONL
                cache_dir = Path(self.cache_root) / model_name / collection / field
                cache_dir.mkdir(parents=True, exist_ok=True)
                
                jsonl_filename = f"batch_{start:08d}.jsonl"
                if jsonl_prefix:
                    jsonl_filename = f"{jsonl_prefix}_{jsonl_filename}"
                
                jsonl_path = cache_dir / jsonl_filename
                
                with open(jsonl_path, 'w', encoding='utf-8') as f:
                    for doc in processed_docs:
                        f.write(json.dumps(doc, ensure_ascii=False) + '\n')
                
                logger.debug(f"Saved {len(processed_docs)} flat documents with {total_entities} entities to {jsonl_path}")
                
                return [str(total_entities)]  # Return entity count
        
        
            else:
                # Standard format
                entities = self.process_documents(documents, entity_types)
                
                # Apply decimal precision if specified
                if decimal_precision is not None:
                    for _doc_id, doc_entities in entities.items():
                        for entity in doc_entities:
                            if "confidence" in entity and entity["confidence"] >= 0:
                                entity["confidence"] = round(entity["confidence"], decimal_precision)

                # Cache results
                cache_manager = get_cache_manager(self.cache_root)
                cache_manager.save_annotations(
                    model_name,
                    collection,
                    field,
                    entities,
                    jsonl_prefix,
                    start,
                    format_type,
                )

                return list(entities.keys())


async def precompute_ner(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    cache_root: str,
    model_name: str,
    start: int = 0,
    batch_size: int = 10000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    entity_types: Optional[List[str]] = None,
    jsonl_prefix: Optional[str] = None,
    decimal_precision: Optional[int] = None,
    format_type: str = "flat",
) -> int:
    """Unified NER precomputation for all model types."""
    
    logger.info(f"Starting unified NER precomputation...")
    logger.info(f"Model: {model_config.name} ({model_config.type})")
    logger.info(f"Collection: {collection}")
    logger.info(f"Text Field: {text_field}")
    logger.info(f"Format: {format_type}")
    
    if entity_types:
        logger.info(f"Entity Types: {entity_types}")

    # Create unified model
    model = create_ner_model(model_config)
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0

    # Create processor
    processor = UnifiedNERProcessor(model, cache_root)

    # Setup cache directory and schema
    cache_dir = Path(cache_root) / model_name / collection / text_field
    cache_dir.mkdir(parents=True, exist_ok=True)

    # Create schema for flat format
    schema_path = ""
    if format_type == "flat":
        schema_path = str(Path(cache_root) / f"{collection}_ner.yaml")
        _create_flat_schema(schema_path)
        logger.info(f"Schema file: {schema_path}")

    logger.info(f"Cache directory: {cache_dir}")

    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0
    total_entities = 0
    session_start_time = time.time()

    from tqdm import tqdm

    try:
        with tqdm(desc="Processing batches", unit="batch") as pbar:
            while num_batches is None or current_batch < num_batches:
                logger.debug(f"Processing batch {current_batch + 1} "
                           f"(docs {current_start}-{current_start + batch_size - 1})")

                # Get documents from Solr
                documents = await solr_client.get_document_batch(
                    collection, text_field, current_start, batch_size, filter_query
                )

                if not documents:
                    logger.info("No more documents found")
                    break

                # Process documents
                batch_start_time = time.time()
                
                doc_ids = await processor.process_and_cache(
                    documents,
                    model_name,
                    collection,
                    text_field,
                    entity_types,
                    decimal_precision,
                    jsonl_prefix,
                    current_start,
                    format_type,
                )

                batch_time = time.time() - batch_start_time
                batch_docs = len(documents)
                
                # For flat format, doc_ids contains count
                if format_type == "flat" and doc_ids:
                    batch_entities = int(doc_ids[0]) if doc_ids[0].isdigit() else 0
                else:
                    batch_entities = len(doc_ids)

                total_docs += batch_docs
                total_entities += batch_entities

                # Update progress
                pbar.update(1)
                pbar.set_postfix({
                    'docs': total_docs,
                    'entities': total_entities,
                    'batch_time': f'{batch_time:.2f}s'
                })

                logger.info(f"Batch {current_batch + 1}: {batch_docs} docs, "
                           f"{batch_entities} entities, {batch_time:.2f}s")

                # Memory management
                if current_batch % 5 == 0:
                    GPUMemoryManager.clear_cache()

                # Check for completion
                if len(documents) < batch_size:
                    logger.info("Completed collection - no more documents")
                    break

                current_batch += 1
                current_start += batch_size

    except KeyboardInterrupt:
        logger.info("Processing interrupted by user")
    except Exception as e:
        logger.error(f"Error during NER processing: {e}")

    finally:
        # Unload model
        model.unload()

        # Final statistics
        session_time = time.time() - session_start_time
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Unified NER Processing Complete")
        logger.info(f"{'='*60}")
        logger.info(f"Model: {model_config.name} ({model_config.type})")
        logger.info(f"Documents processed: {total_docs}")
        logger.info(f"Total entities found: {total_entities}")
        logger.info(f"Processing time: {session_time:.2f}s")
        
        if total_docs > 0:
            logger.info(f"Average entities per document: {total_entities/total_docs:.2f}")
            logger.info(f"Throughput: {total_docs/session_time:.1f} docs/s")
        
        logger.info(f"Results cached in: {cache_dir}")
        logger.info(f"Format: {format_type}")

        # Generate upload command
        upload_collection = f"{collection}_ner"
        jsonl_pattern = str(cache_dir / "*.jsonl")
        
        upload_command = f"python -m histtext_toolkit.main upload {upload_collection} \"{jsonl_pattern}\""
        if schema_path:
            upload_command += f" --schema {schema_path}"
        
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


async def extract_entities_from_solr(
   solr_client: SolrClient,
   collection: str,
   doc_id: str,
   text_field: str,
   model_config: ModelConfig,
   cache_root: Optional[str] = None,
   entity_types: Optional[List[str]] = None,
) -> Optional[list[dict[str, Any]]]:
   """Extract entities from a document in Solr using unified interface."""
   
   # Check cache first
   if cache_root:
       cache_manager = get_cache_manager(cache_root)
       cached = cache_manager.get_annotation(model_config.name, collection, text_field, doc_id)
       if cached:
           return cached

   # Get document from Solr
   doc = await solr_client.get_document(collection, doc_id)
   if not doc:
       logger.error(f"Document not found: {doc_id}")
       return None

   # Create unified model
   model = create_ner_model(model_config)
   if not model.load():
       logger.error(f"Failed to load model {model_config.name}")
       return None

   # Create processor
   processor = UnifiedNERProcessor(model, cache_root)

   # Extract entities
   text = doc.get(text_field, "")
   if not text:
       logger.warning(f"Empty text field '{text_field}' for document {doc_id}")
       return []

   try:
       entities = processor.extract_entities(text, entity_types)
       
       return [
           {
               "text": entity.text,
               "labels": entity.labels,
               "start_pos": entity.start_pos,
               "end_pos": entity.end_pos,
               "confidence": entity.confidence,
           }
           for entity in entities
       ]
   
   finally:
       # Unload model
       model.unload()
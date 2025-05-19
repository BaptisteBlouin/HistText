"""NER operations module.

This module provides functionality for Named Entity Recognition operations,
including precomputing and caching annotations.
"""

import os
from typing import Any, Optional

from ..cache.manager import get_cache_manager
from ..core.config import ModelConfig
from ..core.logging import get_logger
from ..models.base import Entity, NERModel
from ..models.registry import create_ner_model
from ..solr.client import SolrClient

logger = get_logger(__name__)


def split_long_document(doc: str, max_length: int = 30_000) -> list[str]:
    """Split a long document into smaller chunks.

    Splits text at natural boundaries (newlines) while respecting the
    maximum chunk length.

    Args:
        doc: Document text to split
        max_length: Maximum length of each chunk

    Returns:
        List[str]: List of document chunks

    """
    splits = doc.split("\n")
    doc_splits: list[str] = []
    cur = ""

    for split in splits:
        if len(cur) + len(split) + 1 <= max_length:
            cur += "\n" + split
        else:
            doc_splits.append(cur)
            cur = "\n" + split

    if cur:
        doc_splits.append(cur)

    return doc_splits


class NERProcessor:
    """Processor for Named Entity Recognition operations.

    Provides methods for extracting entities from text and processing documents
    in various formats.
    """

    def __init__(self, model: NERModel, cache_root: Optional[str] = None):
        """Initialize the NER processor.

        Args:
            model: NER model to use for entity extraction
            cache_root: Optional root directory for caches

        """
        self.model = model
        self.cache_root = cache_root

    def extract_entities(self, text: str) -> list[Entity]:
        """Extract entities from text.

        Handles empty text and long documents by splitting them into
        manageable chunks.

        Args:
            text: Input text

        Returns:
            List[Entity]: Extracted entities

        """
        # Handle empty text
        if not text:
            return []

        # Handle long documents by splitting
        if len(text) > 30_000:
            entities = []
            splits = split_long_document(text)

            offset = 0
            for split in splits:
                split_entities = self.model.extract_entities(split)

                # Adjust offsets
                for entity in split_entities:
                    entity.start_pos += offset
                    entity.end_pos += offset

                entities.extend(split_entities)
                offset += len(split)

            return entities
        else:
            return self.model.extract_entities(text)

    def process_documents(self, documents: dict[str, str]) -> dict[str, list[dict[str, Any]]]:
        """Process a batch of documents.

        Extracts entities from multiple documents with progress tracking
        and error handling.

        Args:
            documents: Dictionary mapping document IDs to text

        Returns:
            Dict[str, List[Dict[str, Any]]]: Dictionary mapping document IDs to entities

        """
        results = {}
        errors = {}

        from tqdm import tqdm

        for doc_id, text in tqdm(documents.items(), desc="Extracting entities", leave=False):
            try:
                if not text or text.isspace():
                    # Skip empty documents
                    logger.debug(f"Skipping empty document: {doc_id}")
                    continue

                entities = self.extract_entities(text)

                if entities:  # Only include documents with entities
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

    def process_documents_short_format(self, documents: dict[str, str]) -> dict[str, list[dict[str, Any]]]:
        """Process a batch of documents and return entities in short format.

        Uses more compact field names suitable for storage in Solr.

        Args:
            documents: Dictionary mapping document IDs to text

        Returns:
            Dict[str, List[Dict[str, Any]]]: Dictionary mapping document IDs to entities in short format

        """
        results = {}

        for doc_id, text in documents.items():
            entities = self.extract_entities(text)
            results[doc_id] = self.model.short_format(entities)

        return results

    async def process_and_cache(
        self,
        documents: dict[str, str],
        model_name: str,
        collection: str,
        field: str,
        shorten: bool = False,
        decimal_precision: Optional[int] = None,
        jsonl_prefix: Optional[str] = None,
        start: int = 0,
        format_type: str = "default",
    ) -> list[str]:
        """Process documents and cache the results.

        Extracts entities from documents and saves them to the cache
        with the specified formatting options.

        Args:
            documents: Dictionary mapping document IDs to text
            model_name: Name of the model
            collection: Name of the collection
            field: Field name
            shorten: Whether to use shortened field names
            decimal_precision: Number of decimal places for confidence values
            jsonl_prefix: Prefix for the JSONL file name
            start: Start index
            format_type: Format type ('default' or 'flat')

        Returns:
            List[str]: List of processed document IDs

        """
        if not self.cache_root:
            logger.warning("Cache root not specified, results will not be cached")
            return []

        # Process documents
        if shorten:
            entities = self.process_documents_short_format(documents)
        else:
            entities = self.process_documents(documents)

        # Apply decimal precision if specified
        if decimal_precision is not None:
            for _doc_id, doc_entities in entities.items():
                for entity in doc_entities:
                    if "confidence" in entity and entity["confidence"] >= 0:
                        entity["confidence"] = round(entity["confidence"], decimal_precision)
                    elif "c" in entity and entity["c"] >= 0:
                        entity["c"] = round(entity["c"], decimal_precision)

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
            shorten,
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
    batch_size: int = 10_000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    jsonl_prefix: Optional[str] = None,
    shorten: bool = False,
    decimal_precision: Optional[int] = None,
    format_type: str = "flat",
) -> int:
    """Precompute NER annotations for a collection.

    Processes documents from a Solr collection in batches, extracting entities
    and caching the results for later use.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        text_field: Field containing the text
        model_config: Model configuration
        cache_root: Root directory for caches
        model_name: Name to use for the model in the cache hierarchy
        start: Start index
        batch_size: Number of documents per batch
        num_batches: Maximum number of batches to process
        filter_query: Optional filter query
        jsonl_prefix: Prefix for the JSONL file name
        shorten: Whether to use shortened field names
        decimal_precision: Number of decimal places for confidence values
        format_type: Format type ('default' or 'flat')

    Returns:
        int: Number of documents processed

    """
    from tqdm import tqdm

    # Create model
    model = create_ner_model(model_config)
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0

    # Create processor
    processor = NERProcessor(model, cache_root)

    # Calculate and display cache directory path
    cache_dir = os.path.join(cache_root, model_name, collection, text_field)
    os.makedirs(cache_dir, exist_ok=True)

    # If format is 'flat', create schema YAML file
    schema_path = ""
    if format_type == "flat":
        schema_path = os.path.join(cache_root, f"{collection}.yaml")
        os.makedirs(
            os.path.dirname(schema_path) if os.path.dirname(schema_path) else ".",
            exist_ok=True,
        )

        if not os.path.exists(schema_path):
            from ..solr.schema import create_schema_dict, write_schema_to_file

            fields = {
                "c": {"type": "pdoubles", "multivalued": True},
                "doc_id": {"type": "text_general", "multivalued": True},
                "e": {"type": "plongs", "multivalued": True},
                "l": {"type": "text_general", "multivalued": True},
                "s": {"type": "plongs", "multivalued": True},
                "t": {"type": "text_general", "multivalued": True},
            }

            schema_dict = create_schema_dict(fields)
            try:
                write_schema_to_file(schema_dict, schema_path)
                logger.info(f"Created schema file {schema_path}")
                logger.info(f"Cache directory: {cache_dir}")
            except Exception as e:
                logger.error(f"Error writing schema file: {e}")

    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0
    skipped_docs = 0
    error_docs = 0

    logger.info(f"Starting precomputation ({format_type} mode)...")

    # Determine total number of documents for progress bar
    total_count = float("inf")
    if num_batches is not None:
        total_count = num_batches * batch_size

    with tqdm(total=total_count, desc="Processing documents", unit="docs") as pbar:
        while num_batches is None or current_batch < num_batches:
            # Break long line into multiple lines
            logger.debug(f"Processing batch {current_batch + 1} " f"(docs {current_start} - {current_start + batch_size - 1})")

            # Get documents from Solr
            documents = await solr_client.get_document_batch(collection, text_field, current_start, batch_size, filter_query)

            if not documents:
                logger.info("No more documents found")
                break

            # Update progress bar total if needed
            if pbar.total == float("inf") and documents:
                # Try to get total document count for more accurate progress
                try:
                    count_response = await solr_client.collection_select(collection, {"q": "*:*", "rows": 0})
                    if count_response and "response" in count_response:
                        total_doc_count = count_response["response"].get("numFound", float("inf"))
                        if total_doc_count != float("inf"):
                            pbar.total = total_doc_count
                except Exception as e:
                    logger.debug(f"Could not determine total document count: {e}")

            # Process documents
            pbar.set_description(f"Processing batch {current_batch + 1}")
            doc_ids = await processor.process_and_cache(
                documents,
                model_name,
                collection,
                text_field,
                shorten,
                decimal_precision,
                jsonl_prefix,
                current_start,
                format_type,
            )

            total_docs += len(doc_ids)
            skipped_docs += len(documents) - len(doc_ids)

            # Update progress bar
            pbar.update(len(documents))
            pbar.set_postfix(total=total_docs, skipped=skipped_docs, batch=current_batch + 1)

            if len(doc_ids) < batch_size:
                logger.info("Completed collection - no more docs")
                break

            current_batch += 1
            current_start += batch_size

    # Unload model
    model.unload()

    # Generate upload command for user's convenience
    upload_collection = f"{collection}-ner"
    jsonl_path = os.path.join(cache_dir, "*.jsonl")

    # Create a command that includes the connection parameters
    upload_command = "python -m histtext_toolkit.main"

    # Add connection parameters
    if hasattr(solr_client, "host") and hasattr(solr_client, "port"):
        upload_command += f" --solr-host {solr_client.host} --solr-port {solr_client.port}"

    # Add the upload command with schema
    upload_command += f" upload {upload_collection} {jsonl_path}"
    if schema_path:
        upload_command += f" --schema {schema_path}"
        # Add a note about the importance of the schema
        schema_note = "# The schema file is required for proper field definitions"
    else:
        schema_note = "# No schema file was generated - you may need to create the " "collection manually"

    # Split long log messages into multiple lines
    logger.info(f"Processed {total_docs} documents, skipped {skipped_docs}, " f"encountered errors in {error_docs}")
    logger.info("\n" + "-" * 80)
    logger.info(f"Annotations cached in: {cache_dir}")
    logger.info("To upload these annotations to Solr, run:")
    logger.info(f"> {upload_command}  {schema_note}")
    logger.info("-" * 80)

    return total_docs


async def extract_entities_from_solr(
    solr_client: SolrClient,
    collection: str,
    doc_id: str,
    text_field: str,
    model_config: ModelConfig,
    cache_root: Optional[str] = None,
) -> Optional[list[dict[str, Any]]]:
    """Extract entities from a document in Solr.

    First checks the cache, then falls back to extracting entities from the
    document text if not cached.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        doc_id: Document ID
        text_field: Field containing the text
        model_config: Model configuration
        cache_root: Optional root directory for caches

    Returns:
        Optional[List[Dict[str, Any]]]: Extracted entities if successful, None otherwise

    """
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

    # Create model
    model = create_ner_model(model_config)
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return None

    # Create processor
    processor = NERProcessor(model, cache_root)

    # Extract entities
    text = doc.get(text_field, "")
    if not text:
        logger.warning(f"Empty text field '{text_field}' for document {doc_id}")
        return []

    entities = processor.extract_entities(text)

    # Unload model
    model.unload()

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

"""Embeddings operations module.

This module provides functionality for generating and working with text embeddings,
including computing embeddings for documents in Solr collections.
"""

import json
import os
import signal
import time
import traceback
from typing import Any, Optional

import numpy as np
from tqdm import tqdm

from ..core.config import ModelConfig
from ..core.errors import (
    EmbeddingError,
    ModelError,
    ResourceError,
    SolrError,
    get_memory_info,
    retry_with_backoff,
    safe_embed,
)
from ..core.logging import get_logger
from ..models.base import EmbeddingsModel
from ..models.registry import create_embeddings_model
from ..solr.client import SolrClient

logger = get_logger(__name__)

# Try to import HanziConv for Chinese text conversion
try:
    from hanziconv import HanziConv

    HANZICONV_AVAILABLE = True
except ImportError:
    logger.warning("HanziConv not available. Install with `pip install hanziconv`")
    HANZICONV_AVAILABLE = False


class EmbeddingsProcessor:
    """Processor for embeddings operations with enhanced error handling."""

    def __init__(self, model: EmbeddingsModel, cache_root: Optional[str] = None):
        """Initialize the embeddings processor.

        Args:
            model: Embeddings model to use for generating embeddings
            cache_root: Optional root directory for caches

        """
        self.model = model
        self.cache_root = cache_root
        self._embeddings_cache = {}  # Cache for generated embeddings
        self.error_count = 0
        self.success_count = 0
        self.max_retries = 3

    @safe_embed(logger)
    def compute_embedding(self, text: str) -> Optional[np.ndarray]:
        """Compute embedding for a text with error recovery.

        Includes caching, error handling, and recovery strategies.

        Args:
            text: Input text to embed

        Returns:
            Optional[np.ndarray]: Embedding vector or None if failed

        """
        # Check cache first
        if text in self._embeddings_cache:
            return self._embeddings_cache[text]

        # Handle empty text
        if not text or text.isspace():
            logger.debug("Empty text provided. Returning zero vector.")
            dim = self.model.get_dimension()
            return np.zeros(dim)

        # Try to compute embedding with retries
        for retry in range(self.max_retries):
            try:
                # Compute embedding
                embedding = self.model.embed_text(text)

                # Cache the result
                if embedding is not None:
                    self._embeddings_cache[text] = embedding
                    self.success_count += 1
                    return embedding
                else:
                    logger.warning("Model returned None embedding for text")
                    break

            except EmbeddingError as e:
                logger.warning(f"Embedding error (attempt {retry+1}/{self.max_retries}): {e.message}")

                # If this is the last retry, log more details
                if retry == self.max_retries - 1:
                    logger.error(f"Failed to embed text after {self.max_retries} attempts")
                    self.error_count += 1

                # Try to recover from potential memory issues
                try:
                    import gc

                    gc.collect()
                    import torch

                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                except ImportError:
                    pass

                # Short delay before retrying
                time.sleep(0.5 * (retry + 1))

            except Exception as e:
                logger.error(f"Unexpected error embedding text: {e}")
                logger.debug(traceback.format_exc())
                self.error_count += 1
                break

        # If we get here, all retries failed
        dim = self.model.get_dimension()
        return np.zeros(dim)

    def compute_embeddings_batch(self, documents: dict[str, str]) -> dict[str, np.ndarray]:
        """Compute embeddings for a batch of documents with adaptive processing.

        Processes documents in batches, with error handling and recovery.

        Args:
            documents: Dictionary mapping document IDs to text content

        Returns:
            Dict[str, np.ndarray]: Dictionary mapping document IDs to embeddings

        """
        results = {}
        errors = {}

        # Extract texts and document IDs
        doc_ids = list(documents.keys())
        texts = list(documents.values())

        # Filter out empty texts
        valid_indices = []
        valid_texts = []

        for i, text in enumerate(texts):
            if text and not text.isspace():
                valid_indices.append(i)
                valid_texts.append(text)
            else:
                # Add zero vector for empty texts
                dim = self.model.get_dimension()
                results[doc_ids[i]] = np.zeros(dim)

        # Optimize batch processing based on available memory and previous success rate
        try:
            memory_info = get_memory_info()
            available_memory = memory_info.get("gpu_available_gb") if memory_info.get("gpu_available_gb") else memory_info.get("ram_available_gb")

            # Adjust batch size based on available memory and error rate
            adaptive_batch_size = self._determine_batch_size(valid_texts, available_memory)

            logger.debug(f"Using adaptive batch size: {adaptive_batch_size}")
        except Exception as e:
            logger.debug(f"Could not determine adaptive batch size: {e}")
            adaptive_batch_size = 50  # Default fallback

        # Compute embeddings in batches
        if valid_texts:
            try:
                # Process in small batches to improve error recovery
                for start_idx in range(0, len(valid_texts), adaptive_batch_size):
                    end_idx = min(start_idx + adaptive_batch_size, len(valid_texts))
                    batch_texts = valid_texts[start_idx:end_idx]
                    batch_indices = valid_indices[start_idx:end_idx]

                    # Try to use batch processing if available
                    if hasattr(self.model, "embed_batch"):
                        try:
                            batch_embeddings = self.model.embed_batch(batch_texts)

                            # Map embeddings back to document IDs
                            for i, embedding in zip(batch_indices, batch_embeddings):
                                if embedding is not None:
                                    results[doc_ids[i]] = embedding
                                else:
                                    # Zero vector for failed embeddings
                                    dim = self.model.get_dimension()
                                    results[doc_ids[i]] = np.zeros(dim)
                                    errors[doc_ids[i]] = "Model returned None embedding"
                        except Exception as e:
                            logger.warning(f"Batch embedding failed, falling back to individual processing: {e}")

                            # Fallback to individual processing
                            for i in batch_indices:
                                try:
                                    embedding = self.compute_embedding(texts[i])
                                    if embedding is not None:
                                        results[doc_ids[i]] = embedding
                                    else:
                                        dim = self.model.get_dimension()
                                        results[doc_ids[i]] = np.zeros(dim)
                                        errors[doc_ids[i]] = "Model returned None embedding"
                                except Exception as e:
                                    logger.error(f"Error computing embedding for document {doc_ids[i]}: {e}")
                                    errors[doc_ids[i]] = str(e)
                                    dim = self.model.get_dimension()
                                    results[doc_ids[i]] = np.zeros(dim)
                    else:
                        # Individual processing with progress bar
                        for i in tqdm(
                            batch_indices,
                            desc=f"Computing embeddings {start_idx}-{end_idx}",
                        ):
                            try:
                                embedding = self.compute_embedding(texts[i])
                                if embedding is not None:
                                    results[doc_ids[i]] = embedding
                                else:
                                    dim = self.model.get_dimension()
                                    results[doc_ids[i]] = np.zeros(dim)
                                    errors[doc_ids[i]] = "Model returned None embedding"
                            except Exception as e:
                                logger.error(f"Error computing embedding for document {doc_ids[i]}: {e}")
                                errors[doc_ids[i]] = str(e)
                                dim = self.model.get_dimension()
                                results[doc_ids[i]] = np.zeros(dim)
            except Exception as e:
                logger.error(f"Error computing batch embeddings: {e}")
                # Fallback to individual processing
                for i in tqdm(valid_indices, desc="Computing embeddings (fallback mode)"):
                    try:
                        embedding = self.compute_embedding(texts[i])
                        if embedding is not None:
                            results[doc_ids[i]] = embedding
                        else:
                            dim = self.model.get_dimension()
                            results[doc_ids[i]] = np.zeros(dim)
                            errors[doc_ids[i]] = "Model returned None embedding"
                    except Exception as e:
                        logger.error(f"Error computing embedding for document {doc_ids[i]}: {e}")
                        errors[doc_ids[i]] = str(e)
                        dim = self.model.get_dimension()
                        results[doc_ids[i]] = np.zeros(dim)

        if errors:
            total_errors = len(errors)
            max_to_show = 5
            logger.warning(f"Encountered errors in {total_errors} documents")

            # Show a sample of errors
            for _i, (doc_id, error) in enumerate(list(errors.items())[:max_to_show]):
                logger.warning(f"  Error for document {doc_id}: {error}")

            if total_errors > max_to_show:
                logger.warning(f"  ... and {total_errors - max_to_show} more errors")

        # Log success/failure rates
        total_processed = len(documents)
        success_rate = (total_processed - len(errors)) / total_processed if total_processed > 0 else 0
        logger.info(f"Successfully embedded {total_processed - len(errors)}/{total_processed} documents ({success_rate:.1%})")

        return results

    def _determine_batch_size(self, texts: list[str], available_memory_gb: Optional[float] = None) -> int:
        """Determine optimal batch size based on text lengths and available memory.

        Args:
            texts: List of texts to embed
            available_memory_gb: Available memory in GB

        Returns:
            int: Optimal batch size

        """
        if not texts:
            return 16  # Default batch size for empty list

        # Compute average text length
        avg_length = sum(len(text) for text in texts) / len(texts)

        # Default batch sizes based on text length
        if avg_length > 10000:
            batch_size = 4  # Very long texts
        elif avg_length > 5000:
            batch_size = 8  # Long texts
        elif avg_length > 1000:
            batch_size = 16  # Medium texts
        elif avg_length > 500:
            batch_size = 32  # Short texts
        else:
            batch_size = 64  # Very short texts

        # Adjust based on available memory if provided
        if available_memory_gb is not None:
            memory_factor = 1.0

            if available_memory_gb < 2:
                memory_factor = 0.25  # Very limited memory
            elif available_memory_gb < 4:
                memory_factor = 0.5  # Limited memory
            elif available_memory_gb < 8:
                memory_factor = 0.75  # Moderate memory
            elif available_memory_gb > 16:
                memory_factor = 1.5  # Abundant memory

            batch_size = max(1, int(batch_size * memory_factor))

        # Adjust based on error rate
        if hasattr(self, "error_count") and hasattr(self, "success_count"):
            total = self.error_count + self.success_count
            if total > 100:  # Only adjust if we have a significant sample
                error_rate = self.error_count / total if total > 0 else 0

                if error_rate > 0.2:
                    # High error rate, reduce batch size significantly
                    batch_size = max(1, batch_size // 4)
                elif error_rate > 0.1:
                    # Moderate error rate, reduce batch size
                    batch_size = max(1, batch_size // 2)
                elif error_rate > 0.05:
                    # Low error rate, reduce batch size slightly
                    batch_size = max(1, int(batch_size * 0.75))
                elif error_rate < 0.01 and batch_size < 128:
                    # Very low error rate, consider increasing batch size
                    batch_size = min(128, batch_size * 2)

        return batch_size

    def save_embeddings(
        self,
        embeddings: dict[str, np.ndarray],
        output_path: str,
        format: str = "vec",
        metadata: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Save embeddings to a file with error handling.

        Args:
            embeddings: Dictionary mapping text/ID to embedding vector
            output_path: Path to save the embeddings
            format: Format to save in ('vec', 'txt', 'binary', 'json')
            metadata: Optional metadata to include in the saved file

        Returns:
            bool: True if successful, False otherwise

        """
        if not embeddings:
            logger.warning("No embeddings to save")
            return False

        try:
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

            # Convert dictionary to list of tuples
            embedding_tuples = [(text, vector) for text, vector in embeddings.items()]

            # Add format-specific extension if not already present
            if not output_path.endswith(f".{format}"):
                if format == "binary":
                    output_path = f"{output_path}.npz"
                else:
                    output_path = f"{output_path}.{format}"

            # Get dimension from first vector
            dim = next(iter(embeddings.values())).shape[0]

            # Save to temporary file first to prevent data loss on failure
            temp_path = f"{output_path}.tmp"

            if format.lower() == "vec" or format.lower() == "txt":
                # FastText .vec or Word2Vec text format
                with open(temp_path, "w", encoding="utf-8") as f:
                    # Write header with vocabulary size and dimension
                    f.write(f"{len(embeddings)} {dim}\n")

                    # Write each embedding
                    for text, vector in embedding_tuples:
                        vector_str = " ".join(map(str, vector.tolist()))
                        f.write(f"{text} {vector_str}\n")

                # Rename to final path
                os.replace(temp_path, output_path)
                logger.info(f"Saved {len(embeddings)} embeddings to {output_path}")
                return True

            elif format.lower() == "binary":
                # Numpy binary format
                texts = [text for text, _ in embedding_tuples]
                vectors = np.array([vector for _, vector in embedding_tuples])

                # Include metadata if provided
                save_dict = {"texts": texts, "vectors": vectors}
                if metadata:
                    for key, value in metadata.items():
                        save_dict[key] = value

                np.savez(temp_path, **save_dict)

                # Rename to final path
                os.replace(temp_path, output_path)
                logger.info(f"Saved {len(embeddings)} embeddings to {output_path}")
                return True

            elif format.lower() == "json":
                # JSON format (less efficient but more readable/compatible)
                json_data = {
                    "metadata": metadata or {},
                    "dimension": dim,
                    "count": len(embeddings),
                    "embeddings": {text: vector.tolist() for text, vector in embedding_tuples},
                }

                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=2)

                # Rename to final path
                os.replace(temp_path, output_path)
                logger.info(f"Saved {len(embeddings)} embeddings to {output_path}")
                return True

            else:
                logger.error(f"Unsupported format: {format}")
                return False

        except Exception as e:
            logger.error(f"Error saving embeddings: {e}")
            logger.debug(traceback.format_exc())
            return False


# Helper function to load embeddings from a file
def load_embeddings(file_path: str, format: str) -> dict[str, np.ndarray]:
    """Load embeddings from a file.

    Args:
        file_path: Path to the embeddings file
        format: Format of the embeddings file ('vec', 'txt', 'binary', 'json')

    Returns:
        Dict[str, np.ndarray]: Dictionary mapping text/ID to embedding vector

    Raises:
        ResourceError: If there's an error loading the embeddings

    """
    embeddings = {}

    try:
        if format.lower() in ["vec", "txt"]:
            with open(file_path, encoding="utf-8") as f:
                # Skip header
                header = f.readline().strip().split()
                # Using _ to indicate unused variable
                _, dim = int(header[0]), int(header[1])

                # Read each line
                for line in f:
                    parts = line.strip().split(" ", 1)
                    if len(parts) != 2:
                        continue

                    text, vector_str = parts
                    vector_values = vector_str.split()

                    if len(vector_values) != dim:
                        continue

                    try:
                        vector = np.array([float(val) for val in vector_values])
                        embeddings[text] = vector
                    except ValueError:
                        continue

        elif format.lower() == "binary":
            data = np.load(file_path)
            texts = data.get("texts")
            vectors = data.get("vectors")

            if texts is not None and vectors is not None:
                for text, vector in zip(texts, vectors):
                    embeddings[text] = vector

        elif format.lower() == "json":
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)

            if "embeddings" in data:
                for text, vector in data["embeddings"].items():
                    embeddings[text] = np.array(vector)

        else:
            raise ValueError(f"Unsupported format: {format}")

    except Exception as e:
        raise ResourceError(f"Error loading embeddings: {e}", "file", file_path) from e

    return embeddings


def get_default_params() -> dict[str, Any]:
    """Return default parameters for word embedding models.

    Returns:
        Dict[str, Any]: Dictionary of default parameters

    """
    return {"dim": 100, "window": 5, "min_count": 5, "method": "word2vec", "workers": 4}


async def compute_embeddings(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    output_path: str,
    start: int = 0,
    batch_size: int = 1000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    output_format: str = "vec",
    simplify_chinese: bool = False,
    cache_root: Optional[str] = None,
) -> int:
    """Compute embeddings for documents in a Solr collection with robust error handling.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        text_field: Field containing the text
        model_config: Model configuration
        output_path: Path to save the embeddings
        start: Start index
        batch_size: Number of documents per batch
        num_batches: Maximum number of batches to process
        filter_query: Optional filter query
        output_format: Format to save embeddings ('vec', 'txt', 'binary', 'json')
        simplify_chinese: Whether to convert traditional Chinese to simplified
        cache_root: Optional root directory for caches

    Returns:
        int: Number of documents processed

    Raises:
        ValueError: If required parameters are empty

    """
    # Validate input parameters
    if not collection:
        raise ValueError("Collection name cannot be empty")

    if not text_field:
        raise ValueError("Text field cannot be empty")

    if not output_path:
        raise ValueError("Output path cannot be empty")

    # Create model
    try:
        model = create_embeddings_model(model_config)
        load_success = model.load()
        if not load_success:
            raise ModelError(
                f"Failed to load model {model_config.name}",
                model_name=model_config.name,
                model_type=model_config.type,
            )
    except Exception as e:
        if isinstance(e, ModelError):
            logger.error(f"Model error: {e.message}")
            return 0
        else:
            logger.error(f"Error creating model: {e}")
            return 0

    # Create processor
    processor = EmbeddingsProcessor(model, cache_root)

    # Check if Chinese simplification is requested but not available
    if simplify_chinese and not HANZICONV_AVAILABLE:
        logger.warning("HanziConv not available, Chinese simplification disabled")
        simplify_chinese = False

    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0
    skipped_docs = 0
    error_docs = 0
    all_embeddings = {}

    logger.info(f"Starting embeddings computation for collection '{collection}'...")

    # Determine total number of documents for progress bar
    total_count = float("inf")
    if num_batches is not None:
        total_count = num_batches * batch_size

    # Check if collection exists first
    try:
        exists = await solr_client.collection_exists(collection)
        if not exists:
            raise SolrError(f"Collection '{collection}' does not exist", collection=collection)
    except Exception as e:
        if isinstance(e, SolrError):
            logger.error(f"Solr error: {e.message}")
        else:
            logger.error(f"Error checking collection: {e}")
        model.unload()
        return 0

    # Create checkpoint system for graceful recovery
    checkpoint_file = f"{output_path}.checkpoint.json"
    checkpoint_data = {
        "collection": collection,
        "text_field": text_field,
        "model": model_config.name,
        "progress": {
            "current_start": current_start,
            "current_batch": current_batch,
            "total_docs": total_docs,
            "skipped_docs": skipped_docs,
            "error_docs": error_docs,
        },
        "doc_ids_processed": [],
    }

    # Check for existing checkpoint
    if os.path.exists(checkpoint_file):
        try:
            with open(checkpoint_file) as f:
                checkpoint = json.load(f)

            # Only resume if collection and model match
            if (
                checkpoint.get("collection") == collection
                and checkpoint.get("text_field") == text_field
                and checkpoint.get("model") == model_config.name
            ):
                progress = checkpoint.get("progress", {})

                # Resume from checkpoint
                current_start = progress.get("current_start", start)
                current_batch = progress.get("current_batch", 0)
                total_docs = progress.get("total_docs", 0)
                skipped_docs = progress.get("skipped_docs", 0)
                error_docs = progress.get("error_docs", 0)

                # Load previously computed embeddings if they exist
                temp_embedding_file = f"{output_path}.partial.{output_format}"
                if os.path.exists(temp_embedding_file):
                    try:
                        all_embeddings = load_embeddings(temp_embedding_file, output_format)
                        logger.info(f"Resumed from checkpoint with {len(all_embeddings)} embeddings")
                    except Exception as e:
                        logger.warning(f"Could not load partial embeddings from checkpoint: {e}")
                        all_embeddings = {}

                logger.info(f"Resuming from batch {current_batch}, position {current_start}")
        except Exception as e:
            logger.warning(f"Error loading checkpoint (starting from scratch): {e}")

    # Save checkpoint function
    def save_checkpoint():
        checkpoint_data["progress"] = {
            "current_start": current_start,
            "current_batch": current_batch,
            "total_docs": total_docs,
            "skipped_docs": skipped_docs,
            "error_docs": error_docs,
        }
        checkpoint_data["doc_ids_processed"] = list(all_embeddings.keys())

        try:
            with open(checkpoint_file, "w") as f:
                json.dump(checkpoint_data, f, indent=2)

            # Save partial embeddings
            temp_embedding_file = f"{output_path}.partial.{output_format}"
            processor.save_embeddings(
                all_embeddings,
                temp_embedding_file,
                output_format,
                {"partial": True, "timestamp": time.time()},
            )
        except Exception as e:
            logger.warning(f"Error saving checkpoint: {e}")

    # Setup signal handler for graceful interruption
    running = True

    def signal_handler(sig, frame):
        nonlocal running
        logger.info("Received interrupt signal. Saving checkpoint and shutting down...")
        running = False

    # Register signal handler
    original_handler = signal.signal(signal.SIGINT, signal_handler)

    try:
        with tqdm(total=total_count, desc="Processing documents", unit="docs") as pbar:
            while running and (num_batches is None or current_batch < num_batches):
                logger.debug(f"Processing batch {current_batch + 1} " f"(docs {current_start} - {current_start + batch_size - 1})")

                # Get documents from Solr with retries
                documents = {}
                try:

                    async def fetch_documents(current_start=current_start):
                        return await solr_client.get_document_batch(
                            collection,
                            text_field,
                            current_start,
                            batch_size,
                            filter_query,
                        )

                    documents = await retry_with_backoff(fetch_documents, max_retries=3, base_delay=2.0, logger=logger)

                    if not documents:
                        logger.info("No more documents found")
                        break

                except Exception as e:
                    logger.error(f"Error retrieving documents after retries: {e}")
                    error_docs += batch_size  # Approximate the error count

                    # Save checkpoint before continuing
                    save_checkpoint()

                    # Move to next batch
                    current_batch += 1
                    current_start += batch_size
                    pbar.update(batch_size)
                    continue

                # Update progress bar total if needed
                if pbar.total == float("inf") and documents:
                    try:
                        count_response = await solr_client.collection_select(collection, {"q": "*:*", "rows": 0})
                        if count_response and "response" in count_response:
                            total_doc_count = count_response["response"].get("numFound", float("inf"))
                            if total_doc_count != float("inf"):
                                pbar.total = total_doc_count
                    except Exception as e:
                        logger.debug(f"Could not determine total document count: {e}")

                # Apply Chinese simplification if requested
                if simplify_chinese and HANZICONV_AVAILABLE:
                    try:
                        simplified_documents = {}
                        for doc_id, text in documents.items():
                            simplified_documents[doc_id] = HanziConv.toSimplified(text)
                        documents = simplified_documents
                    except Exception as e:
                        logger.warning(f"Error during Chinese simplification: {e}")

                # Filter out already processed documents if resuming
                if checkpoint_data.get("doc_ids_processed"):
                    original_count = len(documents)
                    documents = {doc_id: text for doc_id, text in documents.items() if doc_id not in checkpoint_data["doc_ids_processed"]}
                    if original_count > len(documents):
                        logger.debug(f"Skipped {original_count - len(documents)} " "already processed documents")

                # Compute embeddings with improved error handling
                batch_embeddings = {}
                try:
                    # Process in smaller sub-batches to avoid memory issues
                    sub_batch_size = 50  # Smaller batches for better error recovery
                    doc_ids = list(documents.keys())

                    for sub_batch_start in range(0, len(doc_ids), sub_batch_size):
                        if not running:
                            logger.info("Stopping processing due to interrupt")
                            break

                        sub_batch_end = min(sub_batch_start + sub_batch_size, len(doc_ids))
                        sub_batch_ids = doc_ids[sub_batch_start:sub_batch_end]
                        sub_batch_docs = {doc_id: documents[doc_id] for doc_id in sub_batch_ids}

                        try:
                            sub_batch_embeddings = processor.compute_embeddings_batch(sub_batch_docs)
                            batch_embeddings.update(sub_batch_embeddings)

                            # Update error and skipped counts
                            processed_count = len(sub_batch_embeddings)
                            skipped_in_sub_batch = len(sub_batch_docs) - processed_count
                            skipped_docs += skipped_in_sub_batch

                            # Periodically save checkpoint for long-running jobs
                            if total_docs > 0 and total_docs % 1000 == 0:
                                save_checkpoint()
                                logger.info(f"Saved checkpoint at {total_docs} documents")

                        except Exception as e:
                            # Log error and continue with next sub-batch
                            logger.error(f"Error processing sub-batch: {e}")
                            error_docs += len(sub_batch_docs)

                            # Try to free memory
                            try:
                                import gc

                                gc.collect()
                                import torch

                                if torch.cuda.is_available():
                                    torch.cuda.empty_cache()
                            except ImportError:
                                pass

                except Exception as e:
                    logger.error(f"Error in batch processing: {e}")
                    error_docs += len(documents)

                    # Try to save what we have so far
                    save_checkpoint()

                # Add to overall embeddings
                all_embeddings.update(batch_embeddings)

                # Update counters
                total_docs += len(batch_embeddings)

                # Update progress bar
                pbar.update(len(documents))
                pbar.set_postfix(
                    total=total_docs,
                    skipped=skipped_docs,
                    errors=error_docs,
                    batch=current_batch + 1,
                )

                if len(documents) < batch_size:
                    logger.info("Completed collection - no more docs")
                    break

                # Check if we should continue (if interrupted)
                if not running:
                    logger.info("Processing interrupted. Saving progress...")
                    break

                current_batch += 1
                current_start += batch_size

                # Save checkpoint every 5 batches or after processing a significant number of docs
                if current_batch % 5 == 0 or total_docs >= 10000:
                    save_checkpoint()

    except Exception as e:
        logger.error(f"Unexpected error during processing: {e}")
        logger.debug(traceback.format_exc())

    finally:
        # Restore original signal handler
        signal.signal(signal.SIGINT, original_handler)

        # Save final checkpoint
        save_checkpoint()

        # Save embeddings
        if all_embeddings:
            # Prepare metadata
            metadata = {
                "collection": collection,
                "text_field": text_field,
                "model": model_config.name,
                "model_type": model_config.type,
                "dimension": model.get_dimension(),
                "document_count": total_docs,
                "completed": running,  # Flag to indicate if processing completed normally
                "timestamp": time.time(),
                "documents_processed": total_docs,
                "documents_skipped": skipped_docs,
                "documents_error": error_docs,
            }

            # Save to file
            try:
                success = processor.save_embeddings(all_embeddings, output_path, output_format, metadata)

                if success:
                    logger.info(f"Saved {len(all_embeddings)} embeddings to {output_path}")

                    # Clean up checkpoint and partial files if successful
                    if os.path.exists(checkpoint_file):
                        try:
                            os.remove(checkpoint_file)
                        except Exception:
                            pass

                    temp_file = f"{output_path}.partial.{output_format}"
                    if os.path.exists(temp_file):
                        try:
                            os.remove(temp_file)
                        except Exception:
                            pass
                else:
                    logger.error(f"Failed to save embeddings to {output_path}")
            except Exception as e:
                logger.error(f"Error saving embeddings: {e}")
        else:
            logger.warning("No embeddings were computed")

        # Unload model
        try:
            model.unload()
        except Exception as e:
            logger.warning(f"Error unloading model: {e}")

        logger.info(f"Processed {total_docs} documents, skipped {skipped_docs}, " f"errors {error_docs}")

    # Return final processed count
    return total_docs


async def auto_configure_embedding_params(solr_client: SolrClient, collection: str, text_field: str, sample_size: int = 10000) -> dict[str, Any]:
    """Automatically configure word embedding parameters based on collection characteristics.

    Analyzes the collection content to determine optimal parameters.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        text_field: Field containing the text
        sample_size: Number of documents to sample

    Returns:
        Dict[str, Any]: Optimal parameters for word embeddings

    """
    # Sample documents
    docs = await solr_client.get_document_batch(collection, text_field, 0, min(sample_size, 10000))

    if not docs:
        logger.warning(f"No documents found in collection '{collection}'")
        return get_default_params()

    # 1. Analyze language characteristics
    texts = list(docs.values())

    # 2. Calculate statistics
    total_words = 0
    vocab_size = set()
    avg_doc_length = 0

    for text in texts:
        words = text.lower().split()
        total_words += len(words)
        vocab_size.update(words)
        avg_doc_length += len(words)

    avg_doc_length /= len(texts) if texts else 1
    vocab_diversity = len(vocab_size) / total_words if total_words > 0 else 0

    # 3. Detect language
    try:
        import langdetect

        # Sample a few documents
        sample_text = " ".join(texts[: min(10, len(texts))])
        language = langdetect.detect(sample_text)
    except Exception:
        language = "unknown"

    logger.info(f"Collection analysis: {len(texts)} docs, avg length: {avg_doc_length:.1f} words")
    logger.info(f"Vocabulary: {len(vocab_size)} unique words, diversity: {vocab_diversity:.4f}")
    logger.info(f"Detected language: {language}")

    # 4. Configure parameters
    params = {}

    # Dimension: Based on vocab size and document count
    if len(vocab_size) > 50000 or len(texts) > 100000:
        params["dim"] = 300  # Large corpus
    elif len(vocab_size) > 10000 or len(texts) > 10000:
        params["dim"] = 200  # Medium corpus
    else:
        params["dim"] = 100  # Small corpus

    # Window size: Based on language and average document length
    if language in ["zh", "ja", "ko"]:  # East Asian languages
        params["window"] = 3  # Smaller window for character-based languages
    elif avg_doc_length > 100:
        params["window"] = 7  # Larger window for lengthy documents
    else:
        params["window"] = 5  # Default

    # Min count: Based on corpus size and vocabulary diversity
    if len(texts) < 100:
        params["min_count"] = 2  # Small corpus, keep more words
    elif vocab_diversity < 0.1:  # Low diversity, many repeated words
        params["min_count"] = 10
    else:
        params["min_count"] = 5  # Default

    # Method: Choose based on language and corpus characteristics
    if language in ["zh", "ja", "ko"] or vocab_diversity > 0.4:
        params["method"] = "fasttext"  # Better for morphologically rich languages
    else:
        params["method"] = "word2vec"

    # Workers: Based on available CPU cores
    import os

    params["workers"] = max(1, min(8, os.cpu_count() or 4))

    logger.info(f"Auto-configured parameters: {params}")
    return params


async def compute_word_embeddings(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    output_path: str,
    batch_size: int = 1000,
    filter_query: Optional[str] = None,
    output_format: str = "txt",
    simplify_chinese: bool = False,
    include_header: bool = False,
) -> bool:
    """Compute word embeddings from a Solr collection.

    Trains a word embedding model on text from a Solr collection and saves the results.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        text_field: Field containing the text
        model_config: Model configuration
        output_path: Path to save the word embeddings
        batch_size: Number of documents per batch
        filter_query: Optional filter query
        output_format: Format to save word embeddings ('txt', 'vec', 'bin', 'gensim')
        simplify_chinese: Whether to convert traditional Chinese to simplified
        include_header: Whether to include the vocabulary size and dimension header

    Returns:
        bool: True if successful, False otherwise

    Raises:
        ValueError: If required parameters are empty

    """
    # Validate input parameters
    if not collection:
        raise ValueError("Collection name cannot be empty")

    if not text_field:
        raise ValueError("Text field cannot be empty")

    if not output_path:
        raise ValueError("Output path cannot be empty")

    # Create model
    try:
        # Import model class here to avoid circular imports
        from ..models.word_embeddings_model import CollectionWordEmbeddingsModel

        model = CollectionWordEmbeddingsModel(
            method=model_config.additional_params.get("method", "word2vec"),
            dim=model_config.additional_params.get("dim", 100),
            window=model_config.additional_params.get("window", 5),
            min_count=model_config.additional_params.get("min_count", 5),
            workers=model_config.additional_params.get("workers", 4),
        )

        if not model.load():
            logger.error("Failed to initialize word embeddings model")
            return False
    except Exception as e:
        logger.error(f"Error initializing word embeddings model: {e}")
        logger.debug(traceback.format_exc())
        return False

    # Check if collection exists
    try:
        exists = await solr_client.collection_exists(collection)
        if not exists:
            alias_targets = await solr_client.resolve_alias(collection)
            if alias_targets:
                # Use the first target if it's an alias
                collection = alias_targets[0]
                logger.info(f"Resolved alias '{collection}' to collection '{collection}'")
            else:
                raise SolrError(
                    f"Collection or alias '{collection}' does not exist",
                    collection=collection,
                )

    except Exception as e:
        if isinstance(e, SolrError):
            logger.error(f"Solr error: {e.message}")
        else:
            logger.error(f"Error checking collection: {e}")
        model.unload()
        return False

    # Fetch documents from Solr
    logger.info(f"Fetching documents from collection '{collection}'...")

    all_texts = []
    start = 0
    max_docs = 1000000  # Cap to prevent memory issues
    current_batch = 0

    with tqdm(total=max_docs, desc="Fetching documents") as pbar:
        while len(all_texts) < max_docs:
            try:
                # Use retry for robustness
                async def fetch_documents(start=start):
                    return await solr_client.get_document_batch(collection, text_field, start, batch_size, filter_query)

                # Fetch with retry
                documents = await retry_with_backoff(fetch_documents, max_retries=3, base_delay=2.0, logger=logger)

                if not documents:
                    logger.info("No more documents found")
                    break

                # Apply Chinese simplification if requested
                if simplify_chinese and HANZICONV_AVAILABLE:
                    try:
                        for _doc_id, text in documents.items():
                            if text:  # Skip empty texts
                                all_texts.append(HanziConv.toSimplified(text))
                    except Exception as e:
                        logger.warning(f"Error during Chinese simplification: {e}")
                        # Fallback to original texts
                        all_texts.extend([text for text in documents.values() if text])
                else:
                    all_texts.extend([text for text in documents.values() if text])

                pbar.update(len(documents))
                pbar.set_postfix(total=len(all_texts), batch=current_batch + 1)

                start += batch_size
                current_batch += 1

                if len(documents) < batch_size:
                    logger.info("Completed collection - no more docs")
                    break

                # Save checkpoint for very large collections
                if len(all_texts) % 10000 == 0:
                    logger.info(f"Checkpoint: Fetched {len(all_texts)} documents so far")

            except Exception as e:
                logger.error(f"Error fetching documents: {e}")
                logger.debug(traceback.format_exc())
                break

    if not all_texts:
        logger.error("No documents found or all documents were empty")
        model.unload()
        return False

    # Log memory usage before training
    try:
        import psutil

        process = psutil.Process()
        memory_info = process.memory_info()
        logger.info(f"Memory usage before training: {memory_info.rss / (1024**2):.2f} MB")
    except ImportError:
        pass

    # Train word embeddings
    logger.info(f"Training word embeddings on {len(all_texts)} documents...")
    if not model.train_word_embeddings(all_texts):
        logger.error("Failed to train word embeddings")
        model.unload()
        return False

    # Log memory usage after training
    try:
        import psutil

        process = psutil.Process()
        memory_info = process.memory_info()
        logger.info(f"Memory usage after training: {memory_info.rss / (1024**2):.2f} MB")
    except ImportError:
        pass

    # Add file extension if not already present
    if not output_path.endswith(f".{output_format}"):
        output_path = f"{output_path}.{output_format}"

    # Save word vectors
    logger.info(f"Saving word vectors to {output_path}...")
    success = model.save_word_vectors(output_path, output_format, include_header=include_header)

    if success:
        # Get number of words and dimension for logging
        word_vectors = model.get_word_vectors()
        num_words = len(word_vectors)
        dimension = model.get_dimension()

        logger.info(f"Successfully saved {num_words} word vectors with dimension {dimension} to {output_path}")

        # Sample some words to show as examples
        try:
            sample_words = list(word_vectors.keys())[:5]
            logger.info(f"Sample words: {', '.join(sample_words)}")
        except Exception:
            pass
    else:
        logger.error(f"Failed to save word vectors to {output_path}")

    # Unload model to free memory
    try:
        model.unload()
        logger.info("Unloaded word embeddings model")
    except Exception as e:
        logger.warning(f"Error unloading model: {e}")

    return success


async def build_embedding_index(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    index_path: str,
    start: int = 0,
    batch_size: int = 1000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    simplify_chinese: bool = False,
    add_to_solr: bool = False,
) -> bool:
    """Build a vector index for documents in a Solr collection.

    Computes embeddings and optionally adds them back to Solr documents.

    Args:
        solr_client: Solr client instance
        collection: Name of the collection
        text_field: Field containing the text
        model_config: Model configuration
        index_path: Path to save the index
        start: Start index
        batch_size: Number of documents per batch
        num_batches: Maximum number of batches to process
        filter_query: Optional filter query
        simplify_chinese: Whether to convert traditional Chinese to simplified
        add_to_solr: Whether to add embeddings to Solr document fields

    Returns:
        bool: True if successful, False otherwise

    """
    try:
        # First compute embeddings
        total_docs = await compute_embeddings(
            solr_client,
            collection,
            text_field,
            model_config,
            index_path,
            start,
            batch_size,
            num_batches,
            filter_query,
            "binary",
            simplify_chinese,
        )

        if total_docs == 0:
            logger.error("No embeddings computed")
            return False

        # Optionally add embeddings to Solr documents
        if add_to_solr:
            try:
                # Load the computed embeddings
                embeddings = load_embeddings(f"{index_path}.npz", "binary")

                if not embeddings:
                    logger.error("No embeddings found in index")
                    return False

                # Create a new field in Solr for embeddings if it doesn't exist
                embedding_field = f"{text_field}_embedding"

                # Check if the field exists
                try:
                    # Try to create the field
                    logger.info(f"Adding embedding field '{embedding_field}' to collection '{collection}'")
                    await solr_client.add_field(collection, embedding_field, "string", True, True, False)
                except Exception as e:
                    # Field might already exist
                    logger.debug(f"Error adding field (may already exist): {e}")

                # Upload embeddings to Solr documents in batches
                logger.info("Uploading embeddings to Solr documents...")

                docs_to_update = []
                update_count = 0

                for doc_id, embedding in tqdm(embeddings.items(), desc="Updating Solr documents"):
                    # Convert embedding to a compressed string representation
                    # We use base64 encoding to make it compact
                    import base64
                    import zlib

                    # Compress the embedding
                    compressed = zlib.compress(embedding.tobytes())
                    encoded = base64.b64encode(compressed).decode("ascii")

                    # Create document update
                    docs_to_update.append({"id": doc_id, embedding_field: {"set": encoded}})

                    # Upload in batches
                    if len(docs_to_update) >= 100:
                        try:
                            success = await solr_client.upload_documents(collection, docs_to_update)
                            if success:
                                update_count += len(docs_to_update)
                                logger.debug(f"Updated {update_count} documents")
                            else:
                                logger.error("Failed to update batch")
                        except Exception as e:
                            logger.error(f"Error updating documents: {e}")

                        docs_to_update = []

                # Upload any remaining documents
                if docs_to_update:
                    try:
                        success = await solr_client.upload_documents(collection, docs_to_update)
                        if success:
                            update_count += len(docs_to_update)
                        else:
                            logger.error("Failed to update final batch")
                    except Exception as e:
                        logger.error(f"Error updating documents: {e}")

                logger.info(f"Added embeddings to {update_count} Solr documents")

            except Exception as e:
                logger.error(f"Error adding embeddings to Solr: {e}")
                logger.debug(traceback.format_exc())
                return False

        return True

    except Exception as e:
        logger.error(f"Error building embedding index: {e}")
        logger.debug(traceback.format_exc())
        return False

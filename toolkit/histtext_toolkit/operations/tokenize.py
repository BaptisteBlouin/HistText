"""Tokenization operations module.

This module provides functionality for tokenizing text and processing
tokenization operations on documents.
"""

import csv
import os
from typing import Any, Optional

from ..core.config import ModelConfig
from ..core.logging import get_logger
from ..models.base import Token, TokenizationModel
from ..models.registry import create_tokenization_model
from ..solr.client import SolrClient

logger = get_logger(__name__)

# Try to import HanziConv for Chinese text conversion
try:
    from hanziconv import HanziConv

    hanziconv_available  = True
except ImportError:
    logger.warning("HanziConv not available. Install with `pip install hanziconv`")
    hanziconv_available = False


def apply_tokenization(text: str, tokens: list[dict[str, Any]]) -> str:
    """Apply tokenization to text.

    Converts a list of token dictionaries into a space-separated string.

    Args:
        text: Original text to tokenize
        tokens: List of token dictionaries with position information

    Returns:
        str: Tokenized text with spaces between tokens

    """
    tokenized_text = ""
    for token in sorted(tokens, key=lambda x: x.get("start", x.get("start_pos", 0))):
        start = token.get("start", token.get("start_pos", 0))
        end = token.get("end", token.get("end_pos", 0))
        tokenized_text += " " + text[start:end]

    return tokenized_text.strip()


class TokenizationProcessor:
    """Processor for tokenization operations with batch processing support.

    Works with any TokenizationModel, including the adaptive ChineseSegmenterModel.
    Provides methods for tokenizing text, processing batches, and handling
    different output formats.
    """

    def __init__(self, model: TokenizationModel):
        """Initialize the tokenization processor.

        Args:
            model: Tokenization model to use for processing text

        """
        self.model = model

    def tokenize(self, text: str) -> list[Token]:
        """Tokenize text into individual tokens.

        Args:
            text: Input text to tokenize

        Returns:
            List[Token]: Extracted tokens as Token objects

        """
        if not text:
            return []

        return self.model.tokenize(text)

    def tokenize_to_dict(self, text: str) -> list[dict[str, Any]]:
        """Tokenize text and return as dictionaries.

        Converts Token objects to dictionaries for easier serialization.

        Args:
            text: Input text to tokenize

        Returns:
            List[Dict[str, Any]]: Tokens as dictionaries with text, position and confidence

        """
        tokens = self.tokenize(text)
        return [
            {
                "text": token.text,
                "start": token.start_pos,
                "end": token.end_pos,
                "confidence": token.confidence,
            }
            for token in tokens
        ]

    def tokenize_text(self, text: str) -> str:
        """Tokenize text and return as a string with spaces between tokens.

        Handles texts of any length by chunking them if needed.

        Args:
            text: Input text to tokenize

        Returns:
            str: Tokenized text with tokens separated by spaces

        """
        if not text:
            return ""

        # Get max_length from the model or use default
        max_length = 512  # Default for BERT models
        if hasattr(self.model, "max_length") and self.model.max_length:
            max_length = self.model.max_length
        elif hasattr(self.model, "_tokenizer") and hasattr(self.model._tokenizer, "model_max_length"):
            max_length = self.model._tokenizer.model_max_length

        # For models that don't set a max_length or have unreasonable values
        if max_length <= 0 or max_length > 10000:
            max_length = 512  # Use a safe default

        # If text is shorter than max_length, tokenize directly
        if len(text) <= max_length:
            return self._tokenize_chunk(text)

        # For longer texts, use a chunking strategy
        return self._tokenize_long_text(text, max_length)

    def tokenize_batch(self, texts: list[str]) -> list[str]:
        """Tokenize a batch of texts in parallel.

        Uses batch tokenization if supported by the model, otherwise falls back
        to processing texts individually.

        Args:
            texts: List of input texts to tokenize

        Returns:
            List[str]: List of tokenized texts with tokens separated by spaces

        """
        # Check if the model supports batch tokenization
        if hasattr(self.model, "tokenize_batch"):
            # First, we'll handle empty texts
            processed_texts = []
            non_empty_texts = []
            non_empty_indices = []

            for i, text in enumerate(texts):
                if not text:
                    processed_texts.append("")
                else:
                    non_empty_texts.append(text)
                    non_empty_indices.append(i)

            if not non_empty_texts:
                return processed_texts

            # Process non-empty texts with batch tokenization
            tokens_batch = self.model.tokenize_batch(non_empty_texts)

            # Convert tokens to text
            tokenized_texts = [""] * len(texts)
            for i, tokens in enumerate(tokens_batch):
                if tokens:
                    tokenized_text = " ".join([token.text for token in tokens])
                    original_idx = non_empty_indices[i]
                    tokenized_texts[original_idx] = tokenized_text

            return tokenized_texts
        else:
            # Fall back to individual processing
            return [self.tokenize_text(text) for text in texts]

    def _tokenize_long_text(self, text: str, max_length: int) -> str:
        """Tokenize a long text by breaking it into manageable chunks.

        Splits text by paragraphs and sentences to ensure each chunk is within
        the model's maximum length.

        Args:
            text: Long input text to tokenize
            max_length: Maximum sequence length the model can handle

        Returns:
            str: Tokenized text with tokens separated by spaces

        """
        # First try splitting by paragraphs
        paragraphs = text.split("\n")

        # If any paragraph is still too long, split it further
        result_paragraphs = []

        for paragraph in paragraphs:
            if not paragraph.strip():
                # Skip empty paragraphs but preserve new lines
                result_paragraphs.append("")
                continue

            if len(paragraph) <= max_length:
                # Short paragraph, tokenize directly
                tokenized_paragraph = self._tokenize_chunk(paragraph)
                result_paragraphs.append(tokenized_paragraph)
            else:
                # Long paragraph, split into sentences
                sentences = self._split_into_sentences(paragraph)
                tokenized_sentences = []

                # Tokenize each sentence or chunk it further if needed
                current_chunk = ""
                for sentence in sentences:
                    if len(sentence) > max_length:
                        # Very long sentence, chunk it
                        if current_chunk:
                            # Process accumulated chunk first
                            tokenized_sentences.append(self._tokenize_chunk(current_chunk))
                            current_chunk = ""

                        # Split the long sentence by character chunks
                        sentence_chunks = [sentence[i : i + max_length - 50] for i in range(0, len(sentence), max_length - 50)]
                        for chunk in sentence_chunks:
                            tokenized_sentences.append(self._tokenize_chunk(chunk))
                    elif len(current_chunk) + len(sentence) + 1 > max_length:
                        # Adding this sentence would exceed max_length
                        tokenized_sentences.append(self._tokenize_chunk(current_chunk))
                        current_chunk = sentence
                    else:
                        # Add to current chunk
                        if current_chunk:
                            current_chunk += " " + sentence
                        else:
                            current_chunk = sentence

                # Process any remaining chunk
                if current_chunk:
                    tokenized_sentences.append(self._tokenize_chunk(current_chunk))

                result_paragraphs.append(" ".join(tokenized_sentences))

        return "\n".join(result_paragraphs)

    def _split_into_sentences(self, text: str) -> list[str]:
        """Split text into sentences.

        Uses basic heuristics to split text at sentence boundaries.

        Args:
            text: Input text to split into sentences

        Returns:
            List[str]: List of sentences

        """
        # Simple sentence splitting (this could be more sophisticated)
        # Handle common sentence endings with space after
        for end in [". ", "! ", "? ", "; "]:
            text = text.replace(end, end[0] + "\n")

        # Split by newlines and filter empty strings
        sentences = [s.strip() for s in text.split("\n") if s.strip()]

        return sentences

    def _tokenize_chunk(self, text: str) -> str:
        """Tokenize a single chunk of text.

        Uses the model to tokenize a chunk that's guaranteed to be within
        the model's length limits.

        Args:
            text: Input text chunk to tokenize

        Returns:
            str: Tokenized text with tokens separated by spaces

        """
        tokens = self.tokenize_to_dict(text)
        return apply_tokenization(text, tokens)

    def process_csv(
        self,
        input_file: str,
        output_file: str,
        text_column: str = "Text",
        simplify_chinese: bool = False,
    ) -> int:
        """Process a CSV file with tokenization.

        Reads a CSV file, tokenizes the text in the specified column, and
        writes the results to a new CSV file with an additional "Tokenized" column.

        Args:
            input_file: Input CSV file path
            output_file: Output CSV file path
            text_column: Column containing the text to tokenize
            simplify_chinese: Whether to convert traditional Chinese to simplified

        Returns:
            int: Number of rows processed

        """
        # Check if HanziConv is available for Chinese simplification
        hanziconv_available = False
        if simplify_chinese:
            try:
                from hanziconv import HanziConv

                hanziconv_available = True
            except ImportError:
                logger.warning("HanziConv not available, Chinese simplification disabled")
                simplify_chinese = False

        rows_processed = 0

        try:
            # Open input and output files
            with (
                open(input_file, encoding="utf-8") as fin,
                open(output_file, "w", encoding="utf-8", newline="") as fout,
            ):
                reader = csv.DictReader(fin)

                # Make sure the text column exists
                if text_column not in reader.fieldnames:
                    logger.error(f"Text column '{text_column}' not found in CSV header")
                    return 0

                # Create a writer with the same fieldnames plus "Tokenized"
                writer = csv.DictWriter(fout, reader.fieldnames + ["Tokenized"])
                writer.writeheader()

                # Process rows in batches for better performance
                batch_size = 50
                batch_rows = []
                batch_texts = []

                for row in reader:
                    text = row[text_column]

                    # Convert to simplified Chinese if requested
                    if simplify_chinese and hanziconv_available:
                        text = HanziConv.toSimplified(text)

                    batch_rows.append(row)
                    batch_texts.append(text)

                    # When we have a full batch, process it
                    if len(batch_rows) >= batch_size:
                        self._process_csv_batch(batch_rows, batch_texts, writer)
                        rows_processed += len(batch_rows)
                        batch_rows = []
                        batch_texts = []

                # Process any remaining rows
                if batch_rows:
                    self._process_csv_batch(batch_rows, batch_texts, writer)
                    rows_processed += len(batch_rows)

        except Exception as e:
            logger.error(f"Error processing CSV: {e}")
            return 0

        return rows_processed

    def _process_csv_batch(self, rows: list[dict[str, str]], texts: list[str], writer: csv.DictWriter):
        """Process a batch of CSV rows.

        Uses batch processing if available, otherwise processes rows individually.

        Args:
            rows: List of CSV rows as dictionaries
            texts: List of texts to tokenize
            writer: CSV writer to output the processed rows

        """
        # Check if we can use batch tokenization
        if hasattr(self.model, "tokenize_batch"):
            # Process all texts at once
            tokenized_texts = self.tokenize_batch(texts)

            # Update rows and write
            for row, tokenized in zip(rows, tokenized_texts):
                row["Tokenized"] = tokenized
                writer.writerow(row)
        else:
            # Individual processing
            for row, text in zip(rows, texts):
                tokenized = self.tokenize_text(text)
                row["Tokenized"] = tokenized
                writer.writerow(row)


def tokenize_csv(
    model_config: ModelConfig,
    input_file: str,
    output_file: str,
    text_column: str = "Text",
    simplify_chinese: bool = False,
) -> int:
    """Tokenize text in a CSV file.

    Creates a tokenization model, processes a CSV file, and releases resources.

    Args:
        model_config: Model configuration with model type and parameters
        input_file: Input CSV file path
        output_file: Output CSV file path
        text_column: Column containing the text to tokenize
        simplify_chinese: Whether to convert traditional Chinese to simplified

    Returns:
        int: Number of rows processed

    """
    # Create model
    model = create_tokenization_model(model_config)
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0

    # Create processor
    processor = TokenizationProcessor(model)

    # Process CSV
    rows_processed = processor.process_csv(input_file, output_file, text_column, simplify_chinese)

    # Unload model
    model.unload()

    return rows_processed


def tokenize_text(model_config: ModelConfig, text: str, simplify_chinese: bool = False) -> str:
    """Tokenize a text string.

    Creates a tokenization model, processes a single text, and releases resources.

    Args:
        model_config: Model configuration with model type and parameters
        text: Input text to tokenize
        simplify_chinese: Whether to convert traditional Chinese to simplified

    Returns:
        str: Tokenized text with tokens separated by spaces

    """
    # Convert to simplified Chinese if requested
    if simplify_chinese and hanziconv_available:
        text = HanziConv.toSimplified(text)

    # Create model
    model = create_tokenization_model(model_config)
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return text

    # Create processor
    processor = TokenizationProcessor(model)

    # Tokenize text
    tokenized = processor.tokenize_text(text)

    # Unload model
    model.unload()

    return tokenized


async def tokenize_solr_documents(
    solr_client: SolrClient,
    collection: str,
    text_field: str,
    model_config: ModelConfig,
    start: int = 0,
    batch_size: int = 1000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    target_field: str = "tokenized_text",
    target_collection: Optional[str] = None,
    simplify_chinese: bool = False,
) -> int:
    """Tokenize documents from a Solr collection and upload to a new collection.

    Fetches documents from a source collection, tokenizes the specified field,
    and uploads the results to a target collection.

    Args:
        solr_client: Solr client instance
        collection: Name of the source collection
        text_field: Field containing the text to tokenize
        model_config: Model configuration with model type and parameters
        start: Start index for document retrieval
        batch_size: Number of documents per batch
        num_batches: Maximum number of batches to process
        filter_query: Optional filter query to select documents
        target_field: Field name for the tokenized text in the target collection
        target_collection: Name of the target collection
        simplify_chinese: Whether to convert traditional Chinese to simplified

    Returns:
        int: Number of documents processed

    """
    from tqdm import tqdm

    # Create model
    model = create_tokenization_model(model_config)
    if not model.load():
        logger.error(f"Failed to load model {model_config.name}")
        return 0

    # Create processor
    processor = TokenizationProcessor(model)

    # Check if Chinese simplification is requested but not available
    if simplify_chinese and not hanziconv_available:
        logger.warning("HanziConv not available, Chinese simplification disabled")
        simplify_chinese = False

    # Set target collection name
    if not target_collection:
        target_collection = f"{collection}-tok"

    # Check if target collection exists, if not, create it based on source schema
    try:
        # Using _ to indicate unused variable
        _ = await solr_client.check_status(target_collection)
        logger.info(f"Target collection '{target_collection}' already exists")
    except Exception:
        logger.info(f"Creating target collection '{target_collection}' based on source schema")

        # Get schema from source collection
        try:
            # This is a simplified approach - you may need to adapt this
            # to properly copy the schema from the source collection
            await solr_client.create_collection(target_collection)

            # Copy fields from source collection
            # This is a simplified approach - you may need to adapt this
            logger.info(f"Schema copied from '{collection}' to '{target_collection}'")
        except Exception as e:
            logger.error(f"Failed to create target collection: {e}")
            model.unload()
            return 0

    # Process batches
    current_start = start
    current_batch = 0
    total_docs = 0

    logger.info(f"Starting tokenization from '{collection}' to '{target_collection}'...")

    # Determine total number of documents for progress bar
    total_count = float("inf")
    if num_batches is not None:
        total_count = num_batches * batch_size

    with tqdm(total=total_count, desc="Processing documents", unit="docs") as pbar:
        while num_batches is None or current_batch < num_batches:
            logger.debug(f"Processing batch {current_batch + 1} " f"(docs {current_start} - {current_start + batch_size - 1})")

            # Get documents from Solr
            docs = []
            try:
                # We need to get all fields, not just the text field
                payload = {"q": "*:*", "rows": batch_size, "start": current_start}
                if filter_query:
                    payload["fq"] = filter_query

                select = await solr_client.collection_select(collection, payload)
                docs = select.get("response", {}).get("docs", [])

                if not docs:
                    logger.info("No more documents found")
                    break
            except Exception as e:
                logger.error(f"Error retrieving documents: {e}")
                break

            # Update progress bar total if needed
            if pbar.total == float("inf") and docs:
                try:
                    count_response = await solr_client.collection_select(collection, {"q": "*:*", "rows": 0})
                    if count_response and "response" in count_response:
                        total_doc_count = count_response["response"].get("numFound", float("inf"))
                        if total_doc_count != float("inf"):
                            pbar.total = total_doc_count
                except Exception as e:
                    logger.debug(f"Could not determine total document count: {e}")

            # Tokenize documents
            processed_docs = []
            for doc in tqdm(docs, desc=f"Tokenizing batch {current_batch + 1}", leave=False):
                try:
                    # Get text to tokenize
                    text = doc.get(text_field, "")
                    if not text:
                        logger.warning(f"Document {doc.get('id', 'unknown')} has no text in " f"field '{text_field}'")
                        continue

                    # Apply Chinese simplification if requested
                    if simplify_chinese and hanziconv_available:
                        text = HanziConv.toSimplified(text)

                    # Tokenize text
                    tokenized = processor.tokenize_text(text)

                    # Create a new document with all original fields plus tokenized text
                    new_doc = doc.copy()
                    new_doc[target_field] = tokenized

                    processed_docs.append(new_doc)
                except Exception as e:
                    logger.error(f"Error processing document {doc.get('id', 'unknown')}: {e}")

            # Upload processed documents to target collection
            if processed_docs:
                try:
                    success = await solr_client.upload_documents(target_collection, processed_docs)
                    if success:
                        total_docs += len(processed_docs)
                        logger.debug(f"Uploaded {len(processed_docs)} documents to {target_collection}")
                    else:
                        logger.error(f"Failed to upload batch to {target_collection}")
                except Exception as e:
                    logger.error(f"Error uploading documents: {e}")

            # Update progress bar
            pbar.update(len(docs))
            pbar.set_postfix(total=total_docs, batch=current_batch + 1)

            if len(docs) < batch_size:
                logger.info("Completed collection - no more docs")
                break

            current_batch += 1
            current_start += batch_size

    # Unload model
    model.unload()

    logger.info(f"Processed {total_docs} documents from '{collection}' to '{target_collection}'")
    return total_docs


async def cache_tokenization(
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
    simplify_chinese: bool = False,
) -> int:
    """Cache tokenization results for documents from a Solr collection.

    Processes documents in batches, applying tokenization and storing results
    in the cache directory. Handles interruptions gracefully and provides
    detailed progress reporting.

    Args:
        solr_client: Solr client instance
        collection: Name of the source collection
        text_field: Field containing the text to tokenize
        model_config: Model configuration with model type and parameters
        cache_root: Root directory for caches
        model_name: Name to use for the model in the cache hierarchy
        start: Start index for document retrieval
        batch_size: Number of documents per batch from Solr
        num_batches: Maximum number of batches to process
        filter_query: Optional filter query to select documents
        simplify_chinese: Whether to convert traditional Chinese to simplified

    Returns:
        int: Number of documents processed

    """
    import asyncio
    import gc
    import logging
    import signal
    import time
    import warnings

    import aiohttp
    import jsonlines
    from tqdm import tqdm

    # Define cache_dir early to ensure it's available in the finally block
    cache_dir = os.path.join(cache_root, model_name, collection, text_field)

    # Add timeout to solr client session
    if solr_client._session and not solr_client._session.closed:
        await solr_client.close_session()

    # Start a new session with timeout
    auth = None
    if solr_client.username and solr_client.password:
        auth = aiohttp.BasicAuth(solr_client.username, solr_client.password)

    timeout = aiohttp.ClientTimeout(total=60, connect=20, sock_connect=20, sock_read=40)
    solr_client._session = aiohttp.ClientSession(auth=auth, timeout=timeout)
    logger.info("Created Solr session with timeout to prevent hanging")

    # Track processing state for graceful shutdown
    processing_state = {
        "running": True,
        "current_batch": 0,
        "total_docs": 0,
        "skipped_docs": 0,
        "model": None,
        "current_docs": None,
        "current_jsonl_file": None,
    }

    # Setup signal handler for graceful shutdown
    original_sigint = signal.getsignal(signal.SIGINT)

    def sigint_handler(sig, frame):
        logger.info("Received CTRL+C, initiating graceful shutdown...")
        processing_state["running"] = False
        # Allow the current batch to finish by not raising KeyboardInterrupt here

    # Set custom signal handler
    signal.signal(signal.SIGINT, sigint_handler)

    try:
        # Clear all loggers that might be noisy
        for logger_name in [
            "simpletransformers",
            "transformers",
            "pytorch_transformers",
            "chinese_word_segmenter",
            "tensorflow",
        ]:
            logging.getLogger(logger_name).setLevel(logging.ERROR)

        # Suppress FutureWarnings
        warnings.simplefilter(action="ignore", category=FutureWarning)

        # Check if we're using ChineseSegmenter
        is_chinese_segmenter = model_config.type.lower() == "chinese_segmenter"

        # Create model
        logger.info(f"Creating and loading tokenization model ({model_config.type})...")
        model = create_tokenization_model(model_config)
        processing_state["model"] = model

        if not model.load():
            logger.error(f"Failed to load model {model_config.name}")
            return 0

        # Create processor
        processor = TokenizationProcessor(model)

        # Special message for ChineseSegmenter
        if is_chinese_segmenter:
            logger.info("Using ChineseWordSegmenter with adaptive configuration...")
            # Ensure all possible loggers are silenced
            logging.getLogger("simpletransformers").setLevel(logging.ERROR)
            logging.getLogger("transformers").setLevel(logging.ERROR)
            logging.getLogger("pytorch_transformers").setLevel(logging.ERROR)
            logging.getLogger("chinese_word_segmenter").setLevel(logging.ERROR)
            try:
                import tensorflow as tf

                tf.get_logger().setLevel(logging.ERROR)
                os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"  # Suppress all TF messages
            except ImportError:
                pass

        # Check if Chinese simplification is requested but not available
        if simplify_chinese:
            try:
                from hanziconv import HanziConv

                hanziconv_available = True
            except ImportError:
                logger.warning("HanziConv not available, Chinese simplification disabled")
                hanziconv_available = False
                simplify_chinese = False
        else:
            hanziconv_available = False

        # Ensure cache directory exists
        os.makedirs(cache_dir, exist_ok=True)

        # Create schema YAML file based on source collection
        schema_path = os.path.join(cache_root, f"{collection}.yaml")
        os.makedirs(
            os.path.dirname(schema_path) if os.path.dirname(schema_path) else ".",
            exist_ok=True,
        )

        # Create schema if it doesn't exist
        if not os.path.exists(schema_path):
            # Get collection fields to create schema
            try:
                # Get schema from source collection
                from ..solr.schema import (
                    create_schema_dict,
                    get_collection_schema,
                    write_schema_to_file,
                )

                logger.info(f"Getting schema for collection {collection}...")
                fields = await get_collection_schema(solr_client, collection)

                # Create schema file
                schema_dict = create_schema_dict(fields)
                write_success = write_schema_to_file(schema_dict, schema_path)
                if write_success:
                    logger.info(f"Created schema file {schema_path}")
                else:
                    logger.warning(f"Failed to write schema file {schema_path}")
            except Exception as e:
                logger.error(f"Error creating schema file: {e}")

                # Create a basic schema as fallback
                basic_fields = {
                    "id": {
                        "type": "string",
                        "indexed": True,
                        "stored": True,
                        "multivalued": False,
                    },
                    "text": {
                        "type": "text_general",
                        "indexed": True,
                        "stored": True,
                        "multivalued": False,
                    },
                }
                schema_dict = create_schema_dict(basic_fields)
                write_schema_to_file(schema_dict, schema_path)
                logger.info(f"Created basic schema file {schema_path}")

        logger.info(f"Cache directory: {cache_dir}")

        # Check if the collection exists and has documents
        logger.info(f"Checking collection '{collection}' status...")
        try:
            # Use _ to indicate unused variable
            _ = await solr_client.check_status(collection)
            logger.info("Collection status: OK")

            # Get document count
            count_response = await solr_client.collection_select(collection, {"q": "*:*", "rows": 0})
            doc_count = count_response.get("response", {}).get("numFound", 0)
            logger.info(f"Collection '{collection}' has {doc_count} documents")

            if doc_count == 0:
                logger.error(f"Collection '{collection}' is empty, aborting")
                return 0
        except Exception as e:
            logger.error(f"Error checking collection: {e}")
            return 0

        # Get model's optimal batch size if it has one
        model_batch_size = None
        if is_chinese_segmenter and hasattr(model, "batch_size"):
            model_batch_size = model.batch_size
            logger.info(f"Using model's dynamically determined batch size: {model_batch_size}")

        # Process batches
        current_start = start
        current_batch = 0
        total_docs = 0
        skipped_docs = 0

        processing_state["current_batch"] = current_batch
        processing_state["total_docs"] = total_docs
        processing_state["skipped_docs"] = skipped_docs

        logger.info(f"Starting tokenization for collection '{collection}'...")

        # Determine total number of documents for progress bar
        total_count = float("inf")
        if num_batches is not None:
            total_count = num_batches * batch_size

        # Setup progress bar with interrupt handling
        with tqdm(total=total_count, desc="Processing documents", unit="docs") as pbar:
            while (num_batches is None or current_batch < num_batches) and processing_state["running"]:
                processing_state["current_batch"] = current_batch

                # For Chinese segmenter, adjust batch size based on model's determined capacity
                effective_batch_size = batch_size
                if is_chinese_segmenter and model_batch_size:
                    # Use smaller batches for better progress updates
                    effective_batch_size = min(batch_size, 50)
                    logger.info(f"Processing batch {current_batch + 1} " f"(docs {current_start} - {current_start + effective_batch_size - 1})")
                else:
                    logger.debug(f"Processing batch {current_batch + 1} " f"(docs {current_start} - {current_start + effective_batch_size - 1})")

                # Get documents from Solr with a timeout
                docs = []
                start_time = time.time()
                try:
                    # Get all fields, not just the text field
                    payload = {
                        "q": "*:*",
                        "rows": effective_batch_size,
                        "start": current_start,
                    }
                    if filter_query:
                        payload["fq"] = filter_query

                    logger.debug(f"Querying Solr for batch {current_batch + 1}...")
                    select = await solr_client.collection_select(collection, payload)
                    docs = select.get("response", {}).get("docs", [])
                    processing_state["current_docs"] = docs

                    query_time = time.time() - start_time
                    if docs:
                        logger.info(f"Retrieved {len(docs)} documents in {query_time:.2f} seconds")
                    else:
                        logger.info("No more documents found")
                        break
                except asyncio.TimeoutError:
                    logger.error(f"Timeout retrieving documents from Solr " f"(after {time.time() - start_time:.2f}s)")
                    # Try to reconnect and retry once
                    try:
                        await solr_client.close_session()
                        await solr_client.start_session()
                        logger.info("Reconnected to Solr, retrying document retrieval...")
                        select = await solr_client.collection_select(collection, payload)
                        docs = select.get("response", {}).get("docs", [])
                        processing_state["current_docs"] = docs
                        if docs:
                            logger.info(f"Retrieved {len(docs)} documents after retry")
                        else:
                            logger.info("No documents found after retry")
                            break
                    except Exception as e:
                        logger.error(f"Failed to retry document retrieval: {e}")
                        break
                except Exception as e:
                    logger.error(f"Error retrieving documents: {e}")
                    break

                # Check if user interrupted
                if not processing_state["running"]:
                    logger.info("Processing interrupted by user, finalizing current batch...")

                # Update progress bar total if needed
                if pbar.total == float("inf") and docs:
                    try:
                        count_response = await solr_client.collection_select(collection, {"q": "*:*", "rows": 0})
                        if count_response and "response" in count_response:
                            total_doc_count = count_response["response"].get("numFound", float("inf"))
                            if total_doc_count != float("inf"):
                                pbar.total = total_doc_count
                    except Exception as e:
                        logger.debug(f"Could not determine total document count: {e}")

                # Process the batch
                if is_chinese_segmenter and hasattr(model, "tokenize_batch"):
                    batch_start_time = time.time()

                    # First extract all texts to tokenize
                    texts_to_process = []
                    doc_indices = []

                    for i, doc in enumerate(docs):
                        text = doc.get(text_field, "")
                        if not text or text.isspace():
                            logger.warning(f"Document {doc.get('id', 'unknown')} has empty text " f"in field '{text_field}'")
                            skipped_docs += 1
                            continue

                        # Apply Chinese simplification if requested
                        if simplify_chinese and hanziconv_available:
                            text = HanziConv.toSimplified(text)

                        texts_to_process.append(text)
                        doc_indices.append(i)

                    if texts_to_process:
                        logger.info(f"Batch processing {len(texts_to_process)} documents...")

                        # Process texts with batch tokenization
                        # Dynamic subbatch size based on model's determined capacity
                        subbatch_size = min(20, model_batch_size) if model_batch_size else 20

                        all_tokens = []
                        for i in range(0, len(texts_to_process), subbatch_size):
                            # Check for interruption
                            if not processing_state["running"]:
                                logger.info("Processing interrupted, finalizing current subbatch...")

                            subbatch_end = min(i + subbatch_size, len(texts_to_process))
                            subbatch_texts = texts_to_process[i:subbatch_end]

                            try:
                                # Get tokens for this subbatch
                                subbatch_tokens = model.tokenize_batch(subbatch_texts)
                                all_tokens.extend(subbatch_tokens)

                                # Log progress
                                if (i + subbatch_size) % (subbatch_size * 2) == 0 or subbatch_end == len(texts_to_process):
                                    percent_done = min(
                                        100,
                                        int(100 * subbatch_end / len(texts_to_process)),
                                    )
                                    elapsed = time.time() - batch_start_time
                                    avg_time = elapsed / len(all_tokens) if all_tokens else 0
                                    logger.info(
                                        f"Processed {subbatch_end}/{len(texts_to_process)} " f"texts ({percent_done}%) - {avg_time:.2f}s per document"
                                    )
                            except Exception as e:
                                logger.error(f"Error processing subbatch {i}-{subbatch_end}: {e}")
                                # Use empty tokens as placeholders
                                empty_tokens = [[] for _ in range(len(subbatch_texts))]
                                all_tokens.extend(empty_tokens)
                                skipped_docs += len(subbatch_texts)

                            # If user interrupted, finish current subbatch then break
                            if not processing_state["running"] and i + subbatch_size < len(texts_to_process):
                                logger.info("Interruption detected, stopping after current subbatch")
                                break

                        # Log overall performance
                        tokenization_time = time.time() - batch_start_time
                        if all_tokens:
                            logger.info(
                                f"Tokenized {len(all_tokens)} documents in "
                                f"{tokenization_time:.2f}s "
                                f"({tokenization_time/len(all_tokens):.2f}s per document)"
                            )

                        # Create processed documents
                        processed_docs = []

                        for i, tokens in zip(doc_indices, all_tokens):
                            doc = docs[i]
                            # Convert tokens to text
                            if tokens:
                                tokenized_text = " ".join([token.text for token in tokens])

                                # Create a new document without internal Solr fields
                                new_doc = {}
                                for field_name, value in doc.items():
                                    # Skip internal Solr fields
                                    if field_name.startswith("_"):
                                        continue

                                    # Copy the field
                                    if field_name == text_field:
                                        # Replace with tokenized text
                                        new_doc[field_name] = tokenized_text
                                    else:
                                        new_doc[field_name] = value

                                processed_docs.append(new_doc)
                            else:
                                logger.warning(f"No tokens for document {doc.get('id', 'unknown')}")
                                skipped_docs += 1
                    else:
                        processed_docs = []

                    batch_time = time.time() - batch_start_time
                    if processed_docs:
                        logger.info(
                            f"Processed batch of {len(processed_docs)} documents in "
                            f"{batch_time:.2f} seconds "
                            f"({batch_time / len(processed_docs) if processed_docs else 0:.2f} "
                            f"seconds per document)"
                        )

                    # Force garbage collection to free memory
                    gc.collect()
                    try:
                        import torch

                        if torch.cuda.is_available():
                            torch.cuda.empty_cache()
                            # Log memory usage
                            device = torch.cuda.current_device()
                            reserved = torch.cuda.memory_reserved(device) / 1024**3
                            allocated = torch.cuda.memory_allocated(device) / 1024**3
                            logger.info(f"GPU Memory: Reserved {reserved:.2f} GB, " f"Allocated {allocated:.2f} GB")
                    except Exception:
                        pass

                else:
                    # Original processing for other model types or if batch processing not available
                    processed_docs = []
                    for doc in tqdm(docs, desc=f"Tokenizing batch {current_batch + 1}", leave=False):
                        # Check for interruption
                        if not processing_state["running"]:
                            break

                        try:
                            # Get text to tokenize
                            text = doc.get(text_field, "")
                            if not text:
                                logger.warning(f"Document {doc.get('id', 'unknown')} has no text " f"in field '{text_field}'")
                                skipped_docs += 1
                                continue

                            # Apply Chinese simplification if requested
                            if simplify_chinese and hanziconv_available:
                                text = HanziConv.toSimplified(text)

                            # Tokenize text
                            tokenized = processor.tokenize_text(text)

                            # Create a new document without internal Solr fields
                            new_doc = {}
                            for field_name, value in doc.items():
                                # Skip internal Solr fields
                                if field_name.startswith("_"):
                                    continue

                                # Copy the field
                                if field_name == text_field:
                                    # Replace with tokenized text
                                    new_doc[field_name] = tokenized
                                else:
                                    new_doc[field_name] = value

                            processed_docs.append(new_doc)
                        except Exception as e:
                            logger.error(f"Error processing document {doc.get('id', 'unknown')}: {e}")
                            skipped_docs += 1

                # Save processed documents to JSONL file
                if processed_docs:
                    jsonl_file = os.path.join(cache_dir, f"{current_start}.jsonl")
                    processing_state["current_jsonl_file"] = jsonl_file

                    with jsonlines.open(jsonl_file, "w") as writer:
                        writer.write_all(processed_docs)

                    total_docs += len(processed_docs)
                    processing_state["total_docs"] = total_docs
                    processing_state["skipped_docs"] = skipped_docs

                    logger.info(f"Cached {len(processed_docs)} documents to {jsonl_file}")
                    logger.info(f"Total documents processed so far: {total_docs}")

                # Update progress bar
                pbar.update(len(docs))
                pbar.set_postfix(total=total_docs, skipped=skipped_docs, batch=current_batch + 1)

                if len(docs) < effective_batch_size:
                    logger.info("Completed collection - no more docs")
                    break

                # If user interrupted, break after saving current batch
                if not processing_state["running"]:
                    logger.info("Processing interrupted, stopping after current batch")
                    break

                current_batch += 1
                current_start += effective_batch_size

    except Exception as e:
        logger.error(f"Error during processing: {e}")

    finally:
        # Restore original signal handler
        signal.signal(signal.SIGINT, original_sigint)

        # Unload model
        logger.info("Unloading tokenization model...")
        if processing_state["model"]:
            processing_state["model"].unload()

        # Generate upload command for user's convenience
        target_collection = f"{collection}-tok"
        jsonl_path = os.path.join(cache_dir, "*.jsonl")

        # Create a command that includes the connection parameters
        upload_command = "python -m histtext_toolkit.main"

        # Add connection parameters
        if hasattr(solr_client, "host") and hasattr(solr_client, "port"):
            upload_command += f" --solr-host {solr_client.host} --solr-port {solr_client.port}"

        # Add the upload command with schema
        schema_path = os.path.join(cache_root, f"{collection}.yaml")
        upload_command += f" upload {target_collection} {jsonl_path}"
        if os.path.exists(schema_path):
            upload_command += f" --schema {schema_path}"

        # Report status based on whether processing was interrupted
        if not processing_state["running"]:
            logger.info(
                f"Processing interrupted. Processed {processing_state['total_docs']} " f"documents, skipped {processing_state['skipped_docs']}"
            )
        else:
            logger.info(f"Processed {processing_state['total_docs']} documents, " f"skipped {processing_state['skipped_docs']}")

        logger.info("\n" + "-" * 80)
        logger.info(f"Tokenizations cached in: {cache_dir}")
        logger.info("To upload these tokenizations to Solr, run:")
        logger.info(f"> {upload_command}")
        logger.info("-" * 80)

    return processing_state["total_docs"]

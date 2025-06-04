# toolkit/histtext_fastapi/app/services/tokenize_service.py
"""Enhanced tokenization service with maximum performance and comprehensive logging."""

import asyncio
import uuid
import time
import traceback
import logging
import io
import re
import os
import threading
import queue
import gc
import warnings
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import BackgroundTasks
from concurrent.futures import ThreadPoolExecutor

from ..core.config import get_settings
from ..schemas.tokenize import TokenizeRequest


class RealTimeLogHandler(logging.Handler):
    """Custom log handler that captures logs in real-time for web interface."""
    
    def __init__(self, task_id: str, task_status: Dict[str, Any], log_queue: queue.Queue):
        super().__init__()
        self.task_id = task_id
        self.task_status = task_status
        self.log_queue = log_queue
        self.logs = []
        self._lock = threading.Lock()
        
    def emit(self, record):
        """Emit log record to both queue and internal storage."""
        try:
            formatted_message = self.format(record)
            
            with self._lock:
                # Add to internal logs
                self.logs.append(formatted_message)
                if len(self.logs) > 150:  # Keep last 150 logs
                    self.logs = self.logs[-150:]
                
                # Add to queue for real-time updates
                try:
                    self.log_queue.put_nowait(formatted_message)
                except queue.Full:
                    pass  # Don't block if queue is full
                
                # Extract statistics
                self._extract_statistics(formatted_message)
                
        except Exception as e:
            # Don't let logging errors break the process, but print to console for debugging
            print(f"Logging error in task {self.task_id}: {e}")
            pass
    
    def _extract_statistics(self, message: str):
        """Extract statistics from log messages for real-time updates."""
        try:
            # Extract batch information
            if "Processing batch" in message:
                batch_match = re.search(r'Processing batch (\d+)', message)
                if batch_match:
                    batch_num = int(batch_match.group(1))
                    progress = min(40 + (batch_num * 45 / max(1, batch_num)), 90)
                    self.task_status.update({
                        "current_batch": batch_num,
                        "progress": progress,
                        "message": f"🔄 Processing batch {batch_num}..."
                    })
            
            # Extract document processing info
            if "Retrieved" in message and "documents" in message:
                docs_match = re.search(r'Retrieved (\d+) documents', message)
                if docs_match:
                    docs_in_batch = int(docs_match.group(1))
                    self.task_status["documents_in_current_batch"] = docs_in_batch
                    if docs_in_batch == 0:
                        self.task_status.update({
                            "progress": 95,
                            "message": "🏁 No more documents to process"
                        })
            
            # Extract total documents processed
            if "Total documents processed so far:" in message:
                total_match = re.search(r'Total documents processed so far: (\d+)', message)
                if total_match:
                    total_docs = int(total_match.group(1))
                    self.task_status["total_docs"] = total_docs
            
            # Extract processing speed
            if "Tokenized" in message and "documents in" in message and "seconds" in message:
                speed_match = re.search(r'Tokenized (\d+) documents in ([\d.]+)s', message)
                if speed_match:
                    docs, time_taken = speed_match.groups()
                    docs = int(docs)
                    time_taken = float(time_taken)
                    if time_taken > 0:
                        speed = docs / time_taken
                        self.task_status["processing_speed"] = speed
            
            # Extract final completion
            if "Processed" in message and "documents, skipped" in message:
                final_match = re.search(r'Processed (\d+) documents, skipped (\d+)', message)
                if final_match:
                    total_docs, skipped = final_match.groups()
                    self.task_status.update({
                        "progress": 100,
                        "total_docs": int(total_docs),
                        "skipped_docs": int(skipped),
                        "message": "✅ Tokenization complete"
                    })
            
            # Model loading stages
            if "Creating and loading tokenization model" in message:
                self.task_status.update({"progress": 25, "message": "🤖 Loading tokenization model..."})
            elif "Model loaded successfully" in message or "Final configuration:" in message:
                self.task_status.update({"progress": 35, "message": "✅ Model loaded and configured"})
            elif "Starting tokenization for collection" in message:
                self.task_status.update({"progress": 40, "message": "🚀 Starting tokenization process..."})
            elif "Using ChineseWordSegmenter" in message:
                self.task_status.update({"progress": 30, "message": "🇨🇳 Initializing Chinese segmenter..."})
            elif "Models warmed up" in message:
                self.task_status.update({"progress": 38, "message": "🔥 Models warmed up"})
            elif "Unloading tokenization model" in message:
                self.task_status.update({"progress": 98, "message": "🧹 Cleaning up models..."})
                
        except Exception as e:
            # Don't let statistics extraction break logging
            print(f"Statistics extraction error: {e}")
            pass
    
    def get_logs(self, last_n: int = -1) -> List[str]:
        """Get logs thread-safely."""
        with self._lock:
            if last_n == -1:
                return self.logs.copy()
            return self.logs[-last_n:] if self.logs else []


async def signal_free_cache_tokenization(
    solr_client,
    collection: str,
    text_field: str,
    model_config,
    cache_root: str,
    model_name: str,
    start: int = 0,
    batch_size: int = 1000,
    num_batches: Optional[int] = None,
    filter_query: Optional[str] = None,
    simplify_chinese: bool = False,
    logger = None
) -> int:
    """
    Signal-free version of cache_tokenization that completely avoids all signal handling.
    
    This is a reimplementation of the core functionality from the original cache_tokenization
    function but without any signal handling code.
    """
    import aiohttp
    import jsonlines
    from tqdm import tqdm

    # Define cache_dir early
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
    
    if logger:
        logger.info("Created Solr session with timeout to prevent hanging")

    # Track processing state (NO SIGNAL HANDLING)
    processing_state = {
        "current_batch": 0,
        "total_docs": 0,
        "skipped_docs": 0,
        "model": None,
        "current_docs": None,
        "current_jsonl_file": None,
        "running": True  # Simple boolean flag instead of signal handling
    }

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
        if logger:
            logger.info(f"Creating and loading tokenization model ({model_config.type})...")
        
        from histtext_toolkit.models.registry import create_tokenization_model
        from histtext_toolkit.operations.tokenize import TokenizationProcessor
        
        model = create_tokenization_model(model_config)
        processing_state["model"] = model

        if not model.load():
            if logger:
                logger.error(f"Failed to load model {model_config.name}")
            return 0

        # Create processor
        processor = TokenizationProcessor(model)

        # Special message for ChineseSegmenter
        if is_chinese_segmenter:
            if logger:
                logger.info("Using ChineseWordSegmenter with adaptive configuration...")
            
            # Ensure all possible loggers are silenced
            logging.getLogger("simpletransformers").setLevel(logging.ERROR)
            logging.getLogger("transformers").setLevel(logging.ERROR)
            logging.getLogger("pytorch_transformers").setLevel(logging.ERROR)
            logging.getLogger("chinese_word_segmenter").setLevel(logging.ERROR)
            try:
                import tensorflow as tf
                tf.get_logger().setLevel(logging.ERROR)
                os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
            except ImportError:
                pass

        # Check if Chinese simplification is requested but not available
        hanziconv_available = False
        if simplify_chinese:
            try:
                from hanziconv import HanziConv
                hanziconv_available = True
            except ImportError:
                if logger:
                    logger.warning("HanziConv not available, Chinese simplification disabled")
                simplify_chinese = False

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
            try:
                from histtext_toolkit.solr.schema import (
                    create_schema_dict,
                    get_collection_schema,
                    write_schema_to_file,
                )

                if logger:
                    logger.info(f"Getting schema for collection {collection}...")
                    
                fields = await get_collection_schema(solr_client, collection)
                schema_dict = create_schema_dict(fields)
                write_success = write_schema_to_file(schema_dict, schema_path)
                
                if write_success and logger:
                    logger.info(f"Created schema file {schema_path}")
                elif logger:
                    logger.warning(f"Failed to write schema file {schema_path}")
                    
            except Exception as e:
                if logger:
                    logger.error(f"Error creating schema file: {e}")

                # Create a basic schema as fallback
                from histtext_toolkit.solr.schema import create_schema_dict, write_schema_to_file
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
                if logger:
                    logger.info(f"Created basic schema file {schema_path}")

        if logger:
            logger.info(f"Cache directory: {cache_dir}")

        # Check if the collection exists and has documents
        if logger:
            logger.info(f"Checking collection '{collection}' status...")
            
        try:
            _ = await solr_client.check_status(collection)
            if logger:
                logger.info("Collection status: OK")

            # Get document count
            count_response = await solr_client.collection_select(collection, {"q": "*:*", "rows": 0})
            doc_count = count_response.get("response", {}).get("numFound", 0)
            
            if logger:
                logger.info(f"Collection '{collection}' has {doc_count} documents")

            if doc_count == 0:
                if logger:
                    logger.error(f"Collection '{collection}' is empty, aborting")
                return 0
                
        except Exception as e:
            if logger:
                logger.error(f"Error checking collection: {e}")
            return 0

        # Get model's optimal batch size if it has one
        model_batch_size = None
        if is_chinese_segmenter and hasattr(model, "batch_size"):
            model_batch_size = model.batch_size
            if logger:
                logger.info(f"Using model's dynamically determined batch size: {model_batch_size}")

        # Process batches
        current_start = start
        current_batch = 0
        total_docs = 0
        skipped_docs = 0

        processing_state["current_batch"] = current_batch
        processing_state["total_docs"] = total_docs
        processing_state["skipped_docs"] = skipped_docs

        if logger:
            logger.info(f"Starting tokenization for collection '{collection}'...")

        # Determine total number of documents for progress bar
        total_count = float("inf")
        if num_batches is not None:
            total_count = num_batches * batch_size

        # Setup progress bar (no signal handling, just use context manager)
        with tqdm(total=total_count, desc="Processing documents", unit="docs") as pbar:
            while (num_batches is None or current_batch < num_batches) and processing_state["running"]:
                processing_state["current_batch"] = current_batch

                # For Chinese segmenter, adjust batch size based on model's determined capacity
                effective_batch_size = batch_size
                if is_chinese_segmenter and model_batch_size:
                    effective_batch_size = min(batch_size, 50)
                    if logger:
                        logger.info(f"Processing batch {current_batch + 1} " 
                                   f"(docs {current_start} - {current_start + effective_batch_size - 1})")
                else:
                    if logger:
                        logger.debug(f"Processing batch {current_batch + 1} " 
                                    f"(docs {current_start} - {current_start + effective_batch_size - 1})")

                # Get documents from Solr with a timeout
                docs = []
                start_time = time.time()
                try:
                    payload = {
                        "q": "*:*",
                        "rows": effective_batch_size,
                        "start": current_start,
                    }
                    if filter_query:
                        payload["fq"] = filter_query

                    if logger:
                        logger.debug(f"Querying Solr for batch {current_batch + 1}...")
                        
                    select = await solr_client.collection_select(collection, payload)
                    docs = select.get("response", {}).get("docs", [])
                    processing_state["current_docs"] = docs

                    query_time = time.time() - start_time
                    if docs and logger:
                        logger.info(f"Retrieved {len(docs)} documents in {query_time:.2f} seconds")
                    elif logger:
                        logger.info("No more documents found")
                        break
                        
                except asyncio.TimeoutError:
                    if logger:
                        logger.error(f"Timeout retrieving documents from Solr " 
                                    f"(after {time.time() - start_time:.2f}s)")
                    # Try to reconnect and retry once
                    try:
                        await solr_client.close_session()
                        await solr_client.start_session()
                        if logger:
                            logger.info("Reconnected to Solr, retrying document retrieval...")
                            
                        select = await solr_client.collection_select(collection, payload)
                        docs = select.get("response", {}).get("docs", [])
                        processing_state["current_docs"] = docs
                        
                        if docs and logger:
                            logger.info(f"Retrieved {len(docs)} documents after retry")
                        elif logger:
                            logger.info("No documents found after retry")
                            break
                            
                    except Exception as e:
                        if logger:
                            logger.error(f"Failed to retry document retrieval: {e}")
                        break
                        
                except Exception as e:
                    if logger:
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
                        if logger:
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
                            if logger:
                                logger.warning(f"Document {doc.get('id', 'unknown')} has empty text " 
                                              f"in field '{text_field}'")
                            skipped_docs += 1
                            continue

                        # Apply Chinese simplification if requested
                        if simplify_chinese and hanziconv_available:
                            from hanziconv import HanziConv
                            text = HanziConv.toSimplified(text)

                        texts_to_process.append(text)
                        doc_indices.append(i)

                    if texts_to_process:
                        if logger:
                            logger.info(f"Batch processing {len(texts_to_process)} documents...")

                        # Process texts with batch tokenization
                        subbatch_size = min(20, model_batch_size) if model_batch_size else 20

                        all_tokens = []
                        for i in range(0, len(texts_to_process), subbatch_size):
                            subbatch_end = min(i + subbatch_size, len(texts_to_process))
                            subbatch_texts = texts_to_process[i:subbatch_end]

                            try:
                                # Get tokens for this subbatch
                                subbatch_tokens = model.tokenize_batch(subbatch_texts)
                                all_tokens.extend(subbatch_tokens)

                                # Log progress
                                if (i + subbatch_size) % (subbatch_size * 2) == 0 or subbatch_end == len(texts_to_process):
                                    percent_done = min(100, int(100 * subbatch_end / len(texts_to_process)))
                                    elapsed = time.time() - batch_start_time
                                    avg_time = elapsed / len(all_tokens) if all_tokens else 0
                                    if logger:
                                        logger.info(
                                            f"Processed {subbatch_end}/{len(texts_to_process)} " 
                                            f"texts ({percent_done}%) - {avg_time:.2f}s per document"
                                        )
                                        
                            except Exception as e:
                                if logger:
                                    logger.error(f"Error processing subbatch {i}-{subbatch_end}: {e}")
                                # Use empty tokens as placeholders
                                empty_tokens = [[] for _ in range(len(subbatch_texts))]
                                all_tokens.extend(empty_tokens)
                                skipped_docs += len(subbatch_texts)

                        # Log overall performance
                        tokenization_time = time.time() - batch_start_time
                        if all_tokens and logger:
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
                                if logger:
                                    logger.warning(f"No tokens for document {doc.get('id', 'unknown')}")
                                skipped_docs += 1
                    else:
                        processed_docs = []

                    batch_time = time.time() - batch_start_time
                    if processed_docs and logger:
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
                            if logger:
                                logger.info(f"GPU Memory: Reserved {reserved:.2f} GB, " 
                                           f"Allocated {allocated:.2f} GB")
                    except Exception:
                        pass

                else:
                    # Original processing for other model types or if batch processing not available
                    processed_docs = []
                    for doc in tqdm(docs, desc=f"Tokenizing batch {current_batch + 1}", leave=False):
                        try:
                            # Get text to tokenize
                            text = doc.get(text_field, "")
                            if not text:
                                if logger:
                                    logger.warning(f"Document {doc.get('id', 'unknown')} has no text " 
                                                  f"in field '{text_field}'")
                                skipped_docs += 1
                                continue

                            # Apply Chinese simplification if requested
                            if simplify_chinese and hanziconv_available:
                                from hanziconv import HanziConv
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
                            if logger:
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

                    if logger:
                        logger.info(f"Cached {len(processed_docs)} documents to {jsonl_file}")
                        logger.info(f"Total documents processed so far: {total_docs}")

                # Update progress bar
                pbar.update(len(docs))
                pbar.set_postfix(total=total_docs, skipped=skipped_docs, batch=current_batch + 1)

                if len(docs) < effective_batch_size:
                    if logger:
                        logger.info("Completed collection - no more docs")
                    break

                current_batch += 1
                current_start += effective_batch_size

    except Exception as e:
        if logger:
            logger.error(f"Error during processing: {e}")

    finally:
        # Unload model
        if logger:
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

        if logger:
            logger.info(f"Processed {processing_state['total_docs']} documents, " 
                       f"skipped {processing_state['skipped_docs']}")
            logger.info("\n" + "-" * 80)
            logger.info(f"Tokenizations cached in: {cache_dir}")
            logger.info("To upload these tokenizations to Solr, run:")
            logger.info(f"> {upload_command}")
            logger.info("-" * 80)

    return processing_state["total_docs"]


class TokenizeService:
    """Maximum performance tokenization service with comprehensive logging."""
    
    def __init__(self):
        self.settings = get_settings()
        self._task_status: Dict[str, Dict[str, Any]] = {}
        self._log_handlers: Dict[str, RealTimeLogHandler] = {}
        self._log_queues: Dict[str, queue.Queue] = {}
        self._log_monitor_threads: Dict[str, threading.Thread] = {}
        # Use thread pool for maximum performance
        self._thread_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tokenize_worker")
    
    async def tokenize_collection_async(self, request: TokenizeRequest, background_tasks: BackgroundTasks) -> str:
        """Start tokenization as a background task with real-time logging."""
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        self._task_status[task_id] = {
            "status": "starting",
            "progress": 0,
            "message": "🔧 Initializing tokenization...",
            "started_at": time.time(),
            "collection": request.collection,
            "model_name": request.model_name,
            "model_type": request.model_type,
            "logs": [],
            "current_batch": 0,
            "total_docs": 0,
            "skipped_docs": 0,
            "processing_speed": 0.0,
            "debug_info": {}
        }
        
        # Setup logging infrastructure
        self._setup_task_logging(task_id)
        
        # Start tokenization task
        asyncio.create_task(self._run_tokenize_processing(task_id, request))
        
        return task_id
    
    def _setup_task_logging(self, task_id: str):
        """Setup comprehensive logging for a task."""
        # Create log queue for this task
        log_queue = queue.Queue(maxsize=500)
        self._log_queues[task_id] = log_queue
        
        # Create log handler
        log_handler = RealTimeLogHandler(task_id, self._task_status[task_id], log_queue)
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', datefmt='%H:%M:%S')
        log_handler.setFormatter(formatter)
        log_handler.setLevel(logging.INFO)
        self._log_handlers[task_id] = log_handler
        
        # Start log monitoring thread
        def monitor_logs():
            """Monitor log queue and update task status."""
            while True:
                try:
                    # Get log message with timeout
                    log_message = log_queue.get(timeout=1.0)
                    if log_message == "STOP_LOGGING":
                        break
                    
                    # Update task logs
                    if task_id in self._task_status:
                        current_logs = self._task_status[task_id].get("logs", [])
                        current_logs.append(log_message)
                        
                        # Keep only last 50 logs for web interface
                        if len(current_logs) > 50:
                            current_logs = current_logs[-50:]
                        
                        self._task_status[task_id]["logs"] = current_logs
                        # Also print to console for debugging
                        print(f"[{task_id}] {log_message}")
                        
                except queue.Empty:
                    # Check if task is still running
                    if task_id not in self._task_status:
                        break
                    continue
                except Exception as e:
                    print(f"Log monitoring error for task {task_id}: {e}")
                    break
       
        monitor_thread = threading.Thread(target=monitor_logs, daemon=True, name=f"log_monitor_{task_id}")
        monitor_thread.start()
        self._log_monitor_threads[task_id] = monitor_thread
  
    async def _run_tokenize_processing(self, task_id: str, request: TokenizeRequest):
      """Run tokenization with maximum performance and comprehensive logging."""
      
      def tokenize_in_thread():
          """Thread function that runs tokenization without signal handlers."""
          import asyncio
          import logging
          
          async def async_tokenize():
              log_handler = self._log_handlers.get(task_id)
              
              try:
                  # Add debug info to task status
                  debug_info = {
                      "thread_id": threading.get_ident(),
                      "request_data": {
                          "collection": request.collection,
                          "model_type": request.model_type,
                          "model_name": request.model_name,
                          "text_field": request.text_field,
                          "batch_size": request.batch_size,
                          "start": request.start,
                          "num_batches": request.num_batches,
                          "filter_query": request.filter_query,
                          "simplify_chinese": request.simplify_chinese
                      }
                  }
                  self._task_status[task_id]["debug_info"] = debug_info
                  
                  # Update initial status
                  self._update_task_status(task_id, {
                      "status": "running",
                      "progress": 5,
                      "message": "📚 Loading configuration..."
                  })
                  
                  # Print debug info to console immediately
                  print(f"[{task_id}] DEBUG: Starting signal-free tokenization task")
                  print(f"[{task_id}] DEBUG: Collection = {request.collection}")
                  print(f"[{task_id}] DEBUG: Model = {request.model_name} ({request.model_type})")
                  print(f"[{task_id}] DEBUG: Text field = {request.text_field}")
                  print(f"[{task_id}] DEBUG: Batch size = {request.batch_size}")
                  
                  # Import required modules
                  from histtext_toolkit.core.config import ModelConfig, get_config
                  from histtext_toolkit.solr.client import SolrClient
                  
                  # Setup logging for this thread - ONLY ONCE
                  if log_handler:
                      # Create a single logger instance to prevent duplication
                      logger = logging.getLogger(f'histtext_tokenize_{task_id}')
                      logger.handlers = []  # Clear any existing handlers
                      logger.addHandler(log_handler)
                      logger.setLevel(logging.INFO)
                      logger.propagate = False  # Prevent propagation to root logger
                      
                      logger.info("="*70)
                      logger.info("🚀 STARTING SIGNAL-FREE TOKENIZATION")
                      logger.info("="*70)
                      logger.info(f"📋 Task ID: {task_id}")
                      logger.info(f"📂 Collection: {request.collection}")
                      logger.info(f"🤖 Model Type: {request.model_type}")
                      logger.info(f"📝 Text Field: {request.text_field}")
                      logger.info(f"📦 Batch Size: {request.batch_size}")
                      if request.num_batches:
                          logger.info(f"🔢 Max Batches: {request.num_batches}")
                      if request.filter_query:
                          logger.info(f"🔍 Filter Query: {request.filter_query}")
                  else:
                      logger = None
                  
                  # Load configuration
                  try:
                      cfg = get_config()
                      self._update_task_status(task_id, {
                          "progress": 10,
                          "message": f"⚙️ Configuration loaded"
                      })
                      if logger:
                          logger.info(f"⚙️ Configuration loaded - Cache: {cfg.cache.root_dir}")
                          
                      # Add config info to debug
                      debug_info["config"] = {
                          "cache_root": cfg.cache.root_dir,
                          "cache_enabled": cfg.cache.enabled,
                          "solr_host": cfg.solr.host,
                          "solr_port": cfg.solr.port
                      }
                      
                  except Exception as e:
                      cfg = None
                      self._update_task_status(task_id, {
                          "progress": 10,
                          "message": "⚠️ Using default configuration"
                      })
                      if logger:
                          logger.warning(f"⚠️ Using default configuration: {e}")
                          
                      debug_info["config"] = {"error": str(e), "using_defaults": True}
                  
                  # Setup model configuration
                  self._update_task_status(task_id, {
                      "progress": 15,
                      "message": f"🔧 Configuring {request.model_type} model..."
                  })
                  
                  if request.model_type == "chinese_segmenter":
                      model_config = ModelConfig(
                          name="chinese_segmenter",
                          path="",
                          type=request.model_type,
                          max_length=request.max_length
                      )
                      model_name_for_cache = "chinese_segmenter"
                      if logger:
                          logger.info("🇨🇳 Configured Chinese Word Segmenter")
                  else:
                      model_config = ModelConfig(
                          name=request.model_name,
                          path=request.model_name,
                          type=request.model_type,
                          max_length=request.max_length
                      )
                      model_name_for_cache = request.model_name
                      if logger:
                          logger.info(f"🤖 Configured {request.model_type}: {request.model_name}")
                  
                  # Setup connection parameters
                  if cfg:
                      solr_host = cfg.solr.host
                      solr_port = cfg.solr.port
                      solr_username = cfg.solr.username
                      solr_password = cfg.solr.password
                      cache_root_dir = cfg.cache.root_dir
                      cache_enabled = cfg.cache.enabled
                  else:
                      solr_host = self.settings.default_solr_host
                      solr_port = self.settings.default_solr_port
                      solr_username = None
                      solr_password = None
                      cache_root_dir = str(self.settings.default_cache_dir)
                      cache_enabled = True
                  
                  if not cache_enabled:
                      raise Exception("❌ Cache is not enabled in configuration")
                  
                  # Connect to Solr
                  self._update_task_status(task_id, {
                      "progress": 20,
                      "message": f"🔗 Connecting to Solr..."
                  })
                  
                  solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
                  await solr_client.start_session()
                  
                  try:
                      # Verify collection exists
                      if logger:
                          logger.info(f"Checking if collection '{request.collection}' exists...")
                          
                      collections = await solr_client.get_collections()
                      debug_info["available_collections"] = collections
                      
                      if request.collection not in collections:
                          raise Exception(f"Collection '{request.collection}' not found. Available collections: {collections}")
                      
                      # Check collection has documents
                      count_response = await solr_client.collection_select(request.collection, {"q": "*:*", "rows": 0})
                      doc_count = count_response.get("response", {}).get("numFound", 0)
                      debug_info["collection_doc_count"] = doc_count
                      
                      if logger:
                          logger.info(f"Collection '{request.collection}' has {doc_count} documents")
                      
                      if doc_count == 0:
                          raise Exception(f"Collection '{request.collection}' is empty (0 documents)")
                      
                      # Test field exists by sampling a document
                      sample_response = await solr_client.collection_select(request.collection, {"q": "*:*", "rows": 1})
                      sample_docs = sample_response.get("response", {}).get("docs", [])
                      
                      if sample_docs:
                          sample_doc = sample_docs[0]
                          debug_info["sample_doc_fields"] = list(sample_doc.keys())
                          
                          if request.text_field not in sample_doc:
                              available_fields = list(sample_doc.keys())
                              raise Exception(f"Text field '{request.text_field}' not found in documents. Available fields: {available_fields}")
                          
                          sample_text = sample_doc.get(request.text_field, "")
                          debug_info["sample_text_length"] = len(sample_text) if sample_text else 0
                          
                          if logger:
                              logger.info(f"Text field '{request.text_field}' found. Sample text length: {len(sample_text) if sample_text else 0}")
                      
                      self._update_task_status(task_id, {
                          "progress": 25,
                          "message": f"✅ Connected to Solr - Collection verified"
                      })
                      
                      if logger:
                          logger.info(f"✅ Connected to Solr at {solr_host}:{solr_port}")
                          logger.info(f"📂 Collection '{request.collection}' verified ({doc_count} documents)")
                      
                      # Start tokenization using our signal-free function
                      self._update_task_status(task_id, {
                          "progress": 30,
                          "message": f"🚀 Starting tokenization..."
                      })
                      
                      if logger:
                          logger.info(f"🚀 Starting signal-free tokenization process...")
                      
                      start_time = time.time()
                      
                      # Use our signal-free cache tokenization function
                      total_docs = await signal_free_cache_tokenization(
                          solr_client=solr_client,
                          collection=request.collection,
                          text_field=request.text_field,
                          model_config=model_config,
                          cache_root=cache_root_dir,
                          model_name=model_name_for_cache,
                          start=request.start,
                          batch_size=request.batch_size,
                          num_batches=request.num_batches,
                          filter_query=request.filter_query,
                          simplify_chinese=request.simplify_chinese,
                          logger=logger  # Pass logger for consistent logging
                      )
                      
                      end_time = time.time()
                      processing_time = end_time - start_time
                      
                      # Final status update
                      self._update_task_status(task_id, {
                          "status": "completed",
                          "progress": 100,
                          "message": f"🎉 Completed! {total_docs:,} docs in {processing_time:.1f}s",
                          "processed_docs": total_docs,
                          "completed_at": time.time(),
                          "processing_time": processing_time
                      })
                      
                      if logger:
                          logger.info("="*70)
                          logger.info("🎉 SIGNAL-FREE TOKENIZATION COMPLETED")
                          logger.info(f"📊 Total documents: {total_docs:,}")
                          logger.info(f"⏱️ Processing time: {processing_time:.2f} seconds")
                          if total_docs > 0:
                              logger.info(f"⚡ Average speed: {total_docs/processing_time:.2f} docs/sec")
                          logger.info("="*70)
                      
                      print(f"[{task_id}] SUCCESS: Processed {total_docs} documents in {processing_time:.1f}s")
                      
                      return total_docs
                      
                  finally:
                      await solr_client.close_session()
                      if logger:
                          logger.info("🔌 Solr connection closed")
                      
              except Exception as e:
                  error_details = traceback.format_exc()
                  error_message = str(e)
                  
                  # Add error to debug info
                  debug_info["error"] = {
                      "message": error_message,
                      "details": error_details
                  }
                  
                  self._update_task_status(task_id, {
                      "status": "failed",
                      "progress": 0,
                      "message": f"❌ Failed: {error_message}",
                      "error": error_message,
                      "error_details": error_details,
                      "completed_at": time.time()
                  })
                  
                  if logger:
                      logger.error(f"❌ SIGNAL-FREE TOKENIZATION FAILED: {error_message}")
                      logger.debug(f"💥 Error details:\n{error_details}")
                  
                  print(f"[{task_id}] ERROR: {error_message}")
                  print(f"[{task_id}] DEBUG INFO: {debug_info}")
              
              finally:
                  # Cleanup logging
                  if log_handler:
                      task_logger = logging.getLogger(f'histtext_tokenize_{task_id}')
                      task_logger.removeHandler(log_handler)
                      task_logger.handlers = []
          
          # Run async function in thread with new event loop
          try:
              loop = asyncio.new_event_loop()
              asyncio.set_event_loop(loop)
              return loop.run_until_complete(async_tokenize())
          except Exception as e:
              self._update_task_status(task_id, {
                  "status": "failed",
                  "progress": 0,
                  "message": f"💥 Thread failed: {str(e)}",
                  "error": str(e),
                  "completed_at": time.time()
              })
              print(f"[{task_id}] THREAD ERROR: {str(e)}")
              return None
          finally:
              try:
                  loop.close()
              except:
                  pass
      
      # Execute in thread pool
      try:
          await asyncio.get_event_loop().run_in_executor(
              self._thread_executor, tokenize_in_thread
          )
      except Exception as e:
          self._update_task_status(task_id, {
              "status": "failed",
              "progress": 0,
              "message": f"💥 Execution failed: {str(e)}",
              "error": str(e),
              "completed_at": time.time()
          })
          print(f"[{task_id}] EXECUTOR ERROR: {str(e)}")
      finally:
          # Cleanup task resources
          self._cleanup_task(task_id)
  
    def _update_task_status(self, task_id: str, updates: Dict[str, Any]):
      """Update task status thread-safely."""
      if task_id in self._task_status:
          self._task_status[task_id].update(updates)
  
    def _cleanup_task(self, task_id: str):
      """Clean up task resources."""
      # Stop log monitoring
      if task_id in self._log_queues:
          try:
              self._log_queues[task_id].put_nowait("STOP_LOGGING")
          except:
              pass
          del self._log_queues[task_id]
      
      # Wait for log monitor thread to finish
      if task_id in self._log_monitor_threads:
          try:
              self._log_monitor_threads[task_id].join(timeout=1.0)
          except:
              pass
          del self._log_monitor_threads[task_id]
  
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
      """Get comprehensive task status."""
      if task_id not in self._task_status:
          raise ValueError(f"Task {task_id} not found")
      
      return self._task_status[task_id].copy()
  
    async def get_task_logs(self, task_id: str, last_n: int = 100) -> List[str]:
      """Get detailed logs for a task."""
      log_handler = self._log_handlers.get(task_id)
      if log_handler:
          return log_handler.get_logs(last_n)
      
      # Fallback to task status logs
      task_logs = self._task_status.get(task_id, {}).get("logs", [])
      if last_n == -1:
          return task_logs
      return task_logs[-last_n:] if task_logs else []
  
    def __del__(self):
      """Cleanup resources."""
      if hasattr(self, '_thread_executor'):
          self._thread_executor.shutdown(wait=False)
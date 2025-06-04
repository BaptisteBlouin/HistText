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
from pathlib import Path
from typing import Dict, Any, List
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
                
        except Exception:
            # Don't let logging errors break the process
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
            if "Retrieved" in message and "documents in" in message:
                docs_match = re.search(r'Retrieved (\d+) documents', message)
                if docs_match:
                    docs_in_batch = int(docs_match.group(1))
                    if docs_in_batch == 0:
                        self.task_status.update({
                            "progress": 95,
                            "message": "🏁 Finalizing tokenization..."
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
                
        except Exception:
            # Don't let statistics extraction break logging
            pass
    
    def get_logs(self, last_n: int = -1) -> List[str]:
        """Get logs thread-safely."""
        with self._lock:
            if last_n == -1:
                return self.logs.copy()
            return self.logs[-last_n:] if self.logs else []


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
            "processing_speed": 0.0
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
                        
                except queue.Empty:
                    # Check if task is still running
                    if task_id not in self._task_status:
                        break
                    continue
                except Exception:
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
            import sys
            import signal
            
            # Disable signal handling in this thread to avoid conflicts
            def dummy_signal_handler(signum, frame):
                pass
            
            # Override signal handlers in thread
            try:
                signal.signal(signal.SIGINT, dummy_signal_handler)
                signal.signal(signal.SIGTERM, dummy_signal_handler)
            except ValueError:
                # Signals can only be set in main thread, which is fine
                pass
            
            async def async_tokenize():
                log_handler = self._log_handlers.get(task_id)
                logger = None
                
                try:
                    # Update initial status
                    self._update_task_status(task_id, {
                        "status": "running",
                        "progress": 5,
                        "message": "📚 Loading configuration..."
                    })
                    
                    # Import required modules
                    from histtext_toolkit.core.config import ModelConfig, get_config
                    from histtext_toolkit.solr.client import SolrClient
                    
                    # Setup logging for this thread
                    if log_handler:
                        logger = logging.getLogger('histtext_toolkit.operations.tokenize')
                        logger.addHandler(log_handler)
                        logger.setLevel(logging.INFO)
                        
                        # Also add handler to other relevant loggers
                        for logger_name in ['histtext_toolkit.models.chinese_segmenter', 
                                          'histtext_toolkit.operations', 
                                          'histtext_toolkit.models']:
                            sub_logger = logging.getLogger(logger_name)
                            sub_logger.addHandler(log_handler)
                            sub_logger.setLevel(logging.INFO)
                        
                        logger.info("="*70)
                        logger.info("🚀 STARTING TOKENIZATION - HIGH PERFORMANCE MODE")
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
                    
                    # Load configuration
                    try:
                        cfg = get_config()
                        self._update_task_status(task_id, {
                            "progress": 10,
                            "message": f"⚙️ Configuration loaded"
                        })
                        if logger:
                            logger.info(f"⚙️ Configuration loaded - Cache: {cfg.cache.root_dir}")
                    except Exception as e:
                        cfg = None
                        self._update_task_status(task_id, {
                            "progress": 10,
                            "message": "⚠️ Using default configuration"
                        })
                        if logger:
                            logger.warning(f"⚠️ Using default configuration: {e}")
                    
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
                        # Verify collection
                        collections = await solr_client.get_collections()
                        if request.collection not in collections:
                            raise Exception(f"Collection '{request.collection}' not found. Available: {collections}")
                        
                        self._update_task_status(task_id, {
                            "progress": 25,
                            "message": f"✅ Connected to Solr"
                        })
                        
                        if logger:
                            logger.info(f"✅ Connected to Solr at {solr_host}:{solr_port}")
                            logger.info(f"📂 Collection '{request.collection}' verified")
                        
                        # Import and run tokenization with a custom wrapper that doesn't set signal handlers
                        from histtext_toolkit.operations.tokenize import cache_tokenization
                        
                        # Start tokenization
                        self._update_task_status(task_id, {
                            "progress": 30,
                            "message": f"🚀 Starting tokenization..."
                        })
                        
                        if logger:
                            logger.info(f"🚀 Starting tokenization process...")
                        
                        start_time = time.time()
                        
                        # Run tokenization with periodic yielding
                        total_docs = await self._run_tokenization_with_yielding(
                            cache_tokenization=cache_tokenization,
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
                            task_id=task_id
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
                            logger.info("🎉 TOKENIZATION COMPLETED SUCCESSFULLY")
                            logger.info(f"📊 Total documents: {total_docs:,}")
                            logger.info(f"⏱️ Processing time: {processing_time:.2f} seconds")
                            logger.info(f"⚡ Average speed: {total_docs/processing_time:.2f} docs/sec")
                            logger.info("="*70)
                        
                        return total_docs
                        
                    finally:
                        await solr_client.close_session()
                        if logger:
                            logger.info("🔌 Solr connection closed")
                        
                except Exception as e:
                    error_details = traceback.format_exc()
                    error_message = str(e)
                    
                    self._update_task_status(task_id, {
                        "status": "failed",
                        "progress": 0,
                        "message": f"❌ Failed: {error_message}",
                        "error": error_message,
                        "error_details": error_details,
                        "completed_at": time.time()
                    })
                    
                    if logger:
                        logger.error(f"❌ TOKENIZATION FAILED: {error_message}")
                        logger.debug(f"💥 Error details:\n{error_details}")
                
                finally:
                    # Cleanup logging
                    if log_handler and logger:
                        logger.removeHandler(log_handler)
                        for logger_name in ['histtext_toolkit.models.chinese_segmenter', 
                                          'histtext_toolkit.operations', 
                                          'histtext_toolkit.models']:
                            sub_logger = logging.getLogger(logger_name)
                            try:
                                sub_logger.removeHandler(log_handler)
                            except:
                                pass
            
            # Run async function in thread
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
        finally:
            # Cleanup task resources
            self._cleanup_task(task_id)
    
    async def _run_tokenization_with_yielding(self, cache_tokenization, **kwargs):
        """Run tokenization with periodic yielding to maintain responsiveness."""
        task_id = kwargs.get('task_id')
        
        # Remove task_id from kwargs as it's not needed by cache_tokenization
        clean_kwargs = {k: v for k, v in kwargs.items() if k != 'task_id'}
        
        # Store original batch processing to add yielding
        original_time = time.time()
        batch_count = 0
        
        # Add a simple yielding mechanism by patching logging
        original_logger = logging.getLogger('histtext_toolkit.operations.tokenize')
        original_info = original_logger.info
        
        def yielding_info(message):
            nonlocal batch_count
            original_info(message)
            
            # Yield periodically during processing
            if "Processing batch" in message:
                batch_count += 1
                if batch_count % 2 == 0:  # Yield every 2 batches
                    # Small delay to yield control
                    import asyncio
                    try:
                        loop = asyncio.get_running_loop()
                        # Schedule a tiny delay to yield control
                        def schedule_yield():
                            pass
                        loop.call_soon(schedule_yield)
                    except:
                        pass
        
        # Temporarily replace the info method
        original_logger.info = yielding_info
        
        try:
            # Run the original cache_tokenization function
            return await cache_tokenization(**clean_kwargs)
        finally:
            # Restore original logging
            original_logger.info = original_info
    
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
        
        # Keep log handler for a while so logs can still be retrieved
        # Don't immediately delete it
    
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
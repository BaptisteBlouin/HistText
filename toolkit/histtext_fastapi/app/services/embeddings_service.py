# toolkit/histtext_fastapi/app/services/embeddings_service.py
"""Enhanced embeddings service with background task support."""

import asyncio
import uuid
import time
import traceback
import logging
import io
import re
from pathlib import Path
from typing import Dict, Any, List
from fastapi import BackgroundTasks

from ..core.config import get_settings
from ..schemas.embeddings import EmbeddingsRequest, WordEmbeddingsRequest


class EmbeddingsLogCapture:
    """Log capture for embeddings processing with statistics extraction."""
    
    def __init__(self, task_id: str, task_status: Dict[str, Any]):
        self.task_id = task_id
        self.task_status = task_status
        self.logs = []
        self.log_stream = io.StringIO()
        self.handler = None
        
    def setup_log_capture(self):
        """Setup log capture for embeddings processing."""
        class StatisticsCapturingHandler(logging.StreamHandler):
            def __init__(self, log_capture_instance):
                super().__init__(log_capture_instance.log_stream)
                self.log_capture = log_capture_instance
                
            def emit(self, record):
                super().emit(record)
                self.log_capture.extract_statistics(record.getMessage())
        
        self.handler = StatisticsCapturingHandler(self)
        self.handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', 
                                    datefmt='%H:%M:%S')
        self.handler.setFormatter(formatter)
        
        # Add handler to embeddings logger
        embeddings_logger = logging.getLogger('histtext_toolkit.operations.embeddings')
        embeddings_logger.addHandler(self.handler)
        embeddings_logger.setLevel(logging.INFO)
        
        return embeddings_logger
    
    def extract_statistics(self, message: str):
        """Extract statistics from log messages."""
        try:
            # Extract batch information for embeddings
            batch_match = re.search(r'Batch (\d+): (\d+) docs processed', message)
            if batch_match:
                batch_num, docs = batch_match.groups()
                self.task_status.update({
                    "current_batch": int(batch_num),
                    "total_docs": int(docs),
                })
            
            # Extract processing speed
            speed_match = re.search(r'Processing speed: ([\d.]+) docs/s', message)
            if speed_match:
                self.task_status["processing_speed"] = float(speed_match.group(1))
            
            # Extract progress indicators
            if "Computing embeddings" in message:
                self.task_status.update({"progress": 40, "message": "Computing embeddings..."})
            elif "Model loaded" in message:
                self.task_status.update({"progress": 35, "message": "Model loaded successfully"})
            elif "Embeddings computed" in message:
                self.task_status.update({"progress": 100, "message": "Embeddings computation complete"})
                
        except Exception as e:
            pass
    
    def get_recent_logs(self, last_n: int = 20) -> List[str]:
        """Get recent log messages."""
        log_content = self.log_stream.getvalue()
        if log_content:
            lines = log_content.strip().split('\n')
            return lines[-last_n:] if lines else []
        return []
    
    def get_all_logs(self) -> List[str]:
        """Get all log messages."""
        log_content = self.log_stream.getvalue()
        if log_content:
            return log_content.strip().split('\n')
        return []
    
    def cleanup(self):
        """Clean up log capture."""
        if self.handler:
            embeddings_logger = logging.getLogger('histtext_toolkit.operations.embeddings')
            embeddings_logger.removeHandler(self.handler)
            self.handler.close()


class EmbeddingsService:
    """Enhanced service for embeddings operations with background task support."""
    
    def __init__(self):
        self.settings = get_settings()
        self._task_status: Dict[str, Dict[str, Any]] = {}
        self._log_captures: Dict[str, EmbeddingsLogCapture] = {}
    
    async def compute_embeddings_async(self, request: EmbeddingsRequest, background_tasks: BackgroundTasks) -> str:
        """Start embeddings computation as a background task."""
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        self._task_status[task_id] = {
            "status": "starting",
            "progress": 0,
            "message": "Initializing embeddings computation...",
            "started_at": time.time(),
            "collection": request.collection,
            "model_name": request.model_name,
            "model_type": request.model_type,
            "output_path": request.output_path,
            "logs": [],
            "current_batch": 0,
            "total_docs": 0,
            "processing_speed": 0.0
        }
        
        # Setup log capture
        log_capture = EmbeddingsLogCapture(task_id, self._task_status[task_id])
        self._log_captures[task_id] = log_capture
        
        # Add background task
        background_tasks.add_task(self._run_embeddings_processing, task_id, request)
        
        return task_id
    
    async def _run_embeddings_processing(self, task_id: str, request: EmbeddingsRequest):
        """Run embeddings computation in background with detailed progress."""
        log_capture = self._log_captures.get(task_id)
        
        try:
            # Update status to loading configuration
            self._update_task_status(task_id, {
                "status": "running",
                "progress": 5,
                "message": "Loading toolkit configuration..."
            })
            
            # Import modules
            try:
                from histtext_toolkit.core.config import ModelConfig, get_config
                from histtext_toolkit.solr.client import SolrClient
                from histtext_toolkit.operations.embeddings import compute_embeddings
            except ImportError as e:
                raise Exception(f"Failed to import histtext_toolkit modules: {str(e)}")
            
            # Setup log capture
            if log_capture:
                logger = log_capture.setup_log_capture()
                logger.info("="*60)
                logger.info("Starting Embeddings computation via FastAPI Web Interface")
                logger.info("="*60)
            
            # Setup configuration
            try:
                cfg = get_config()
                self._update_task_status(task_id, {
                    "progress": 10,
                    "message": f"Configuration loaded. Cache dir: {cfg.cache.root_dir}"
                })
            except Exception as e:
                self._update_task_status(task_id, {
                    "progress": 10,
                    "message": "No configuration found, using defaults"
                })
                cfg = None
            
            # Create model config
            self._update_task_status(task_id, {
                "progress": 15,
                "message": f"Setting up {request.model_type} model: {request.model_name}..."
            })
            
            additional_params = {}
            if request.dim:
                additional_params["dim"] = request.dim
            
            model_config = ModelConfig(
                name=request.model_name,
                path=request.model_name,
                type=request.model_type,
                max_length=request.max_length,
                additional_params=additional_params
            )
            
            # Setup Solr connection
            self._update_task_status(task_id, {
                "progress": 25,
                "message": "Setting up Solr connection..."
            })
            
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
            
            solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
            await solr_client.start_session()
            
            try:
                self._update_task_status(task_id, {
                    "progress": 30,
                    "message": f"Connected to Solr at {solr_host}:{solr_port}"
                })
                
                # Run embeddings computation
                self._update_task_status(task_id, {
                    "progress": 35,
                    "message": f"Starting embeddings computation on collection '{request.collection}'..."
                })
                
                total_docs = await compute_embeddings(
                    solr_client=solr_client,
                    collection=request.collection,
                    text_field=request.text_field,
                    model_config=model_config,
                    output_path=request.output_path,
                    start=request.start,
                    batch_size=request.batch_size,
                    num_batches=request.num_batches,
                    filter_query=request.filter_query,
                    output_format=request.output_format,
                    simplify_chinese=request.simplify_chinese,
                    cache_dir=cache_root_dir if cache_enabled else None
                )
                
                # Update final status
                processing_time = time.time() - self._task_status[task_id]["started_at"]
                
                self._update_task_status(task_id, {
                    "status": "completed",
                    "progress": 100,
                    "message": f"Successfully computed embeddings for {total_docs} documents",
                    "processed_docs": total_docs,
                    "completed_at": time.time(),
                    "processing_time": processing_time
                })
                
            finally:
                await solr_client.close_session()
                
        except Exception as e:
            error_details = traceback.format_exc()
            error_message = str(e)
            
            self._update_task_status(task_id, {
                "status": "failed",
                "progress": 0,
                "message": f"Embeddings computation failed: {error_message}",
                "error": error_message,
                "error_details": error_details,
                "completed_at": time.time()
            })
            
        finally:
            if log_capture:
                log_capture.cleanup()
    
    def _update_task_status(self, task_id: str, updates: Dict[str, Any]):
        """Update task status and capture recent logs."""
        if task_id in self._task_status:
            self._task_status[task_id].update(updates)
            
            # Capture recent logs
            log_capture = self._log_captures.get(task_id)
            if log_capture:
                recent_logs = log_capture.get_recent_logs(15)
                self._task_status[task_id]["logs"] = recent_logs
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of an embeddings processing task."""
        if task_id not in self._task_status:
            raise ValueError(f"Task {task_id} not found")
        
        # Update logs one more time
        log_capture = self._log_captures.get(task_id)
        if log_capture:
            recent_logs = log_capture.get_recent_logs(20)
            self._task_status[task_id]["logs"] = recent_logs
        
        return self._task_status[task_id]
    
    async def get_task_logs(self, task_id: str, last_n: int = 100) -> List[str]:
        """Get detailed logs for a task."""
        log_capture = self._log_captures.get(task_id)
        if log_capture:
            if last_n == -1:
                return log_capture.get_all_logs()
            return log_capture.get_recent_logs(last_n)
        return []

    # Legacy method for backward compatibility
    async def compute_embeddings(self, request: EmbeddingsRequest) -> Dict[str, Any]:
        """Legacy compute embeddings method (synchronous)."""
        # This is kept for compatibility but should be deprecated
        from histtext_toolkit.core.config import ModelConfig, get_config
        from histtext_toolkit.solr.client import SolrClient
        from histtext_toolkit.operations.embeddings import compute_embeddings
        
        cfg = get_config()
        
        additional_params = {}
        if request.dim:
            additional_params["dim"] = request.dim
        
        model_config = ModelConfig(
            name=request.model_name,
            path=request.model_name,
            type=request.model_type,
            max_length=request.max_length,
            additional_params=additional_params
        )
        
        solr_client = SolrClient(
            cfg.solr.host, 
            cfg.solr.port, 
            cfg.solr.username, 
            cfg.solr.password
        )
        
        await solr_client.start_session()
        
        try:
            total_docs = await compute_embeddings(
                solr_client=solr_client,
                collection=request.collection,
                text_field=request.text_field,
                model_config=model_config,
                output_path=request.output_path,
                start=request.start,
                batch_size=request.batch_size,
                num_batches=request.num_batches,
                filter_query=request.filter_query,
                output_format=request.output_format,
                simplify_chinese=request.simplify_chinese,
                cache_dir=cfg.cache.root_dir if cfg.cache.enabled else None
            )
            
            return {
                "status": "success",
                "computed_docs": total_docs,
                "output_path": request.output_path,
                "model_name": request.model_name,
                "message": f"Successfully computed embeddings for {total_docs} documents"
            }
        finally:
            await solr_client.close_session()


    async def compute_word_embeddings_async(self, request: WordEmbeddingsRequest, background_tasks: BackgroundTasks) -> str:
        """Start word embeddings computation as a background task."""
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        self._task_status[task_id] = {
            "status": "starting",
            "progress": 0,
            "message": "Initializing word embeddings training...",
            "started_at": time.time(),
            "collection": request.collection,
            "method": request.method,
            "dim": request.dim,
            "output_path": request.output_path,
            "logs": [],
            "total_docs": 0,
            "vocab_size": 0,
            "current_epoch": 0,
            "loss": 0.0,
            "auto_configure": request.auto_configure
        }
        
        # Setup log capture
        log_capture = EmbeddingsLogCapture(task_id, self._task_status[task_id])
        self._log_captures[task_id] = log_capture
        
        # Add background task
        background_tasks.add_task(self._run_word_embeddings_processing, task_id, request)
        
        return task_id

    async def _run_word_embeddings_processing(self, task_id: str, request: WordEmbeddingsRequest):
        """Run word embeddings computation in background."""
        log_capture = self._log_captures.get(task_id)
        
        try:
            # Update status to loading configuration
            self._update_task_status(task_id, {
                "status": "running",
                "progress": 5,
                "message": "Loading toolkit configuration..."
            })
            
            # Import modules
            try:
                from histtext_toolkit.core.config import ModelConfig, get_config
                from histtext_toolkit.solr.client import SolrClient
                from histtext_toolkit.operations.embeddings import compute_word_embeddings, auto_configure_embedding_params
            except ImportError as e:
                raise Exception(f"Failed to import histtext_toolkit modules: {str(e)}")
            
            # Setup log capture
            if log_capture:
                logger = log_capture.setup_log_capture()
                logger.info("="*60)
                logger.info("Starting Word Embeddings Training via FastAPI Web Interface")
                logger.info("="*60)
            
            # Setup configuration
            try:
                cfg = get_config()
                self._update_task_status(task_id, {
                    "progress": 10,
                    "message": f"Configuration loaded. Using {request.method} method"
                })
            except Exception as e:
                self._update_task_status(task_id, {
                    "progress": 10,
                    "message": "No configuration found, using defaults"
                })
                cfg = None
            
            # Setup Solr connection
            self._update_task_status(task_id, {
                "progress": 15,
                "message": "Setting up Solr connection..."
            })
            
            if cfg:
                solr_host = cfg.solr.host
                solr_port = cfg.solr.port
                solr_username = cfg.solr.username
                solr_password = cfg.solr.password
            else:
                solr_host = self.settings.default_solr_host
                solr_port = self.settings.default_solr_port
                solr_username = None
                solr_password = None
            
            solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
            await solr_client.start_session()
            
            try:
                self._update_task_status(task_id, {
                    "progress": 20,
                    "message": f"Connected to Solr at {solr_host}:{solr_port}"
                })
                
                # Auto-configure parameters if requested
                method_local = request.method
                dim_local = request.dim
                window_local = request.window
                min_count_local = request.min_count
                workers_local = request.workers

                if request.auto_configure:
                    self._update_task_status(task_id, {
                        "progress": 25,
                        "message": "Auto-configuring word embedding parameters..."
                    })
                    
                    try:
                        params = await auto_configure_embedding_params(
                            solr_client, request.collection, request.text_field
                        )
                        
                        # Override with auto-configured values
                        method_local = params.get('method', method_local)
                        dim_local = params.get('dim', dim_local)
                        window_local = params.get('window', window_local)
                        min_count_local = params.get('min_count', min_count_local)
                        workers_local = params.get('workers', workers_local)
                        
                        self._update_task_status(task_id, {
                            "progress": 30,
                            "message": f"Auto-configured: method={method_local}, dim={dim_local}, window={window_local}"
                        })
                        
                        if log_capture:
                            logger.info(f"Auto-configuration complete:")
                            logger.info(f"  Method: {method_local}")
                            logger.info(f"  Dimensions: {dim_local}")
                            logger.info(f"  Window: {window_local}")
                            logger.info(f"  Min count: {min_count_local}")
                            logger.info(f"  Workers: {workers_local}")
                            
                    except Exception as e:
                        if log_capture:
                            logger.warning(f"Auto-configuration failed, using manual parameters: {str(e)}")
                        self._update_task_status(task_id, {
                            "progress": 30,
                            "message": "Auto-configuration failed, using manual parameters"
                        })
                
                # Create model config for word embeddings
                model_config = ModelConfig(
                    name="word_embeddings",
                    path="",
                    type="word_embeddings",
                    additional_params={
                        "method": method_local,
                        "dim": dim_local,
                        "window": window_local,
                        "min_count": min_count_local,
                        "workers": workers_local,
                    }
                )
                
                # Run word embeddings computation
                self._update_task_status(task_id, {
                    "progress": 35,
                    "message": f"Starting {method_local} training on collection '{request.collection}'..."
                })
                
                success = await compute_word_embeddings(
                    solr_client=solr_client,
                    collection=request.collection,
                    text_field=request.text_field,
                    model_config=model_config,
                    output_path=request.output_path,
                    batch_size=request.batch_size,
                    filter_query=request.filter_query,
                    output_format=request.output_format,
                    simplify_chinese=request.simplify_chinese,
                    include_header=not request.no_header
                )
                
                # Update final status
                processing_time = time.time() - self._task_status[task_id]["started_at"]
                
                if success:
                    self._update_task_status(task_id, {
                        "status": "completed",
                        "progress": 100,
                        "message": f"Successfully trained {method_local} word embeddings",
                        "completed_at": time.time(),
                        "processing_time": processing_time
                    })
                else:
                    self._update_task_status(task_id, {
                        "status": "failed",
                        "progress": 0,
                        "message": "Word embeddings training failed",
                        "completed_at": time.time()
                    })
                
            finally:
                await solr_client.close_session()
                
        except Exception as e:
            error_details = traceback.format_exc()
            error_message = str(e)
            
            self._update_task_status(task_id, {
                "status": "failed",
                "progress": 0,
                "message": f"Word embeddings training failed: {error_message}",
                "error": error_message,
                "error_details": error_details,
                "completed_at": time.time()
            })
            
        finally:
            if log_capture:
                log_capture.cleanup()

    async def get_word_embeddings_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of a word embeddings task."""
        if task_id not in self._task_status:
            raise ValueError(f"Task {task_id} not found")
        
        # Update logs one more time
        log_capture = self._log_captures.get(task_id)
        if log_capture:
            recent_logs = log_capture.get_recent_logs(20)
            self._task_status[task_id]["logs"] = recent_logs
        
        return self._task_status[task_id]

    async def get_word_embeddings_task_logs(self, task_id: str, last_n: int = 100) -> List[str]:
        """Get detailed logs for a word embeddings task."""
        log_capture = self._log_captures.get(task_id)
        if log_capture:
            if last_n == -1:
                return log_capture.get_all_logs()
            return log_capture.get_recent_logs(last_n)
        return []
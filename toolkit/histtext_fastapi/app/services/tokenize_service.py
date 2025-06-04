# toolkit/histtext_fastapi/app/services/tokenize_service.py
"""Enhanced tokenization service with background task support."""

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
from ..schemas.tokenize import TokenizeRequest


class TokenizeLogCapture:
    """Log capture for tokenization processing with statistics extraction."""
    
    def __init__(self, task_id: str, task_status: Dict[str, Any]):
        self.task_id = task_id
        self.task_status = task_status
        self.logs = []
        self.log_stream = io.StringIO()
        self.handler = None
        
    def setup_log_capture(self):
        """Setup log capture for tokenization processing."""
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
        
        # Add handler to tokenization logger
        tokenize_logger = logging.getLogger('histtext_toolkit.operations.tokenize')
        tokenize_logger.addHandler(self.handler)
        tokenize_logger.setLevel(logging.INFO)
        
        return tokenize_logger
    
    def extract_statistics(self, message: str):
        """Extract statistics from log messages."""
        try:
            # Extract batch information for tokenization
            batch_match = re.search(r'Batch (\d+): (\d+) docs tokenized', message)
            if batch_match:
                batch_num, docs = batch_match.groups()
                self.task_status.update({
                    "current_batch": int(batch_num),
                    "total_docs": int(docs),
                })
            
            # Extract processing speed
            speed_match = re.search(r'Tokenization speed: ([\d.]+) docs/s', message)
            if speed_match:
                self.task_status["processing_speed"] = float(speed_match.group(1))
            
            # Extract progress indicators
            if "Starting tokenization" in message:
                self.task_status.update({"progress": 40, "message": "Starting tokenization..."})
            elif "Model loaded" in message:
                self.task_status.update({"progress": 35, "message": "Tokenization model loaded"})
            elif "Tokenization complete" in message:
                self.task_status.update({"progress": 100, "message": "Tokenization complete"})
                
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
            tokenize_logger = logging.getLogger('histtext_toolkit.operations.tokenize')
            tokenize_logger.removeHandler(self.handler)
            self.handler.close()


class TokenizeService:
    """Enhanced service for tokenization operations with background task support."""
    
    def __init__(self):
        self.settings = get_settings()
        self._task_status: Dict[str, Dict[str, Any]] = {}
        self._log_captures: Dict[str, TokenizeLogCapture] = {}
    
    async def tokenize_collection_async(self, request: TokenizeRequest, background_tasks: BackgroundTasks) -> str:
        """Start tokenization as a background task."""
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        self._task_status[task_id] = {
            "status": "starting",
            "progress": 0,
            "message": "Initializing tokenization...",
            "started_at": time.time(),
            "collection": request.collection,
            "model_name": request.model_name,
            "model_type": request.model_type,
            "logs": [],
            "current_batch": 0,
            "total_docs": 0,
            "processing_speed": 0.0
        }
        
        # Setup log capture
        log_capture = TokenizeLogCapture(task_id, self._task_status[task_id])
        self._log_captures[task_id] = log_capture
        
        # Add background task
        background_tasks.add_task(self._run_tokenize_processing, task_id, request)
        
        return task_id
    
    async def _run_tokenize_processing(self, task_id: str, request: TokenizeRequest):
        """Run tokenization in background with detailed progress."""
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
                from histtext_toolkit.operations.tokenize import cache_tokenization
            except ImportError as e:
                raise Exception(f"Failed to import histtext_toolkit modules: {str(e)}")
            
            # Setup log capture
            if log_capture:
                logger = log_capture.setup_log_capture()
                logger.info("="*60)
                logger.info("Starting Tokenization via FastAPI Web Interface")
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
            
            model_config = ModelConfig(
                name=request.model_name,
                path=request.model_name,
                type=request.model_type,
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
                
                if not cache_enabled:
                    raise Exception("Cache is not enabled in the configuration")
                
                # Run tokenization
                self._update_task_status(task_id, {
                    "progress": 35,
                    "message": f"Starting tokenization on collection '{request.collection}'..."
                })
                
                total_docs = await cache_tokenization(
                    solr_client=solr_client,
                    collection=request.collection,
                    text_field=request.text_field,
                    model_config=model_config,
                    cache_root=cache_root_dir,
                    model_name=request.model_name,
                    start=request.start,
                    batch_size=request.batch_size,
                    num_batches=request.num_batches,
                    filter_query=request.filter_query,
                    simplify_chinese=request.simplify_chinese
                )
                
                # Update final status
                processing_time = time.time() - self._task_status[task_id]["started_at"]
                
                self._update_task_status(task_id, {
                    "status": "completed",
                    "progress": 100,
                    "message": f"Successfully tokenized {total_docs} documents",
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
                "message": f"Tokenization failed: {error_message}",
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
        """Get status of a tokenization task."""
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
    async def tokenize_collection(self, request: TokenizeRequest) -> Dict[str, Any]:
        """Legacy tokenize collection method (synchronous)."""
        from histtext_toolkit.core.config import ModelConfig, get_config
        from histtext_toolkit.solr.client import SolrClient
        from histtext_toolkit.operations.tokenize import cache_tokenization
        
        cfg = get_config()
        
        model_config = ModelConfig(
            name=request.model_name,
            path=request.model_name,
            type=request.model_type,
        )
        
        solr_client = SolrClient(
            cfg.solr.host, 
            cfg.solr.port, 
            cfg.solr.username, 
            cfg.solr.password
        )
        
        await solr_client.start_session()
        
        try:
            total_docs = await cache_tokenization(
                solr_client=solr_client,
                collection=request.collection,
                text_field=request.text_field,
                model_config=model_config,
                cache_dir=cfg.cache.root_dir,
                model_name=request.model_name,
                start=request.start,
                batch_size=request.batch_size,
                num_batches=request.num_batches,
                filter_query=request.filter_query,
                simplify_chinese=request.simplify_chinese
            )
            
            return {
                "status": "success",
                "tokenized_docs": total_docs,
                "collection": request.collection,
                "model_name": request.model_name,
                "message": f"Successfully tokenized {total_docs} documents"
            }
        finally:
            await solr_client.close_session()
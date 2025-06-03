"""NER processing service with proper statistics capture."""

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
from ..schemas.ner import NERRequest, NERTestRequest


class LogCapture:
    """Enhanced log capture with statistics extraction."""
    
    def __init__(self, task_id: str, task_status: Dict[str, Any]):
        self.task_id = task_id
        self.task_status = task_status
        self.logs = []
        self.log_stream = io.StringIO()
        self.handler = None
        
    def setup_log_capture(self):
        """Setup log capture for the NER processing."""
        # Create a custom handler that captures logs and extracts statistics
        class StatisticsCapturingHandler(logging.StreamHandler):
            def __init__(self, log_capture_instance):
                super().__init__(log_capture_instance.log_stream)
                self.log_capture = log_capture_instance
                
            def emit(self, record):
                super().emit(record)
                # Extract statistics from log messages
                self.log_capture.extract_statistics(record.getMessage())
        
        self.handler = StatisticsCapturingHandler(self)
        self.handler.setLevel(logging.INFO)
        
        # Format logs nicely
        formatter = logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', 
                                    datefmt='%H:%M:%S')
        self.handler.setFormatter(formatter)
        
        # Add handler to the histtext logger
        ner_logger = logging.getLogger('histtext_toolkit.operations.ner')
        ner_logger.addHandler(self.handler)
        ner_logger.setLevel(logging.INFO)
        
        return ner_logger
    
    def extract_statistics(self, message: str):
        """Extract statistics from log messages."""
        try:
            # Extract batch information: "Batch 1: 358 docs, 1247 entities, 0.85s"
            batch_match = re.search(r'Batch (\d+): (\d+) docs, (\d+) entities, ([\d.]+)s', message)
            if batch_match:
                batch_num, docs, entities, batch_time = batch_match.groups()
                self.task_status.update({
                    "current_batch": int(batch_num),
                    "total_docs": int(docs),
                    "total_entities": int(entities),
                    "processing_speed": int(docs) / float(batch_time) if float(batch_time) > 0 else 0
                })
            
            # Extract final statistics: "Documents processed: 358"
            docs_match = re.search(r'Documents processed: (\d+)', message)
            if docs_match:
                self.task_status["total_docs"] = int(docs_match.group(1))
            
            # Extract final entities: "Total entities found: 1247"
            entities_match = re.search(r'Total entities found: (\d+)', message)
            if entities_match:
                self.task_status["total_entities"] = int(entities_match.group(1))
            
            # Extract throughput: "Throughput: 152.9 docs/s"
            throughput_match = re.search(r'Throughput: ([\d.]+) docs/s', message)
            if throughput_match:
                self.task_status["processing_speed"] = float(throughput_match.group(1))
            
            # Extract progress indicators
            if "Testing model with sample data" in message:
                self.task_status.update({"progress": 40, "message": "Testing model with sample data..."})
            elif "Processing batch" in message and "Retrieved" not in message:
                batch_match = re.search(r'Processing batch (\d+)', message)
                if batch_match:
                    batch_num = int(batch_match.group(1))
                    # Estimate progress based on batch number (assuming 10 batches max if not specified)
                    progress = min(50 + (batch_num * 40 / 10), 90)
                    self.task_status.update({
                        "progress": progress,
                        "message": f"Processing batch {batch_num}..."
                    })
            elif "Model loaded successfully" in message:
                self.task_status.update({"progress": 35, "message": "Model loaded successfully"})
            elif "NER Processing Complete" in message:
                self.task_status.update({"progress": 100, "message": "Processing complete"})
                
        except Exception as e:
            # Don't let statistics extraction break the logging
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
            ner_logger = logging.getLogger('histtext_toolkit.operations.ner')
            ner_logger.removeHandler(self.handler)
            self.handler.close()


class NERService:
    """Service for handling NER operations with enhanced logging and statistics."""
    
    def __init__(self):
        self.settings = get_settings()
        self._task_status: Dict[str, Dict[str, Any]] = {}
        self._log_captures: Dict[str, LogCapture] = {}
    
    async def process_ner_async(self, request: NERRequest, background_tasks: BackgroundTasks) -> str:
        """Start NER processing as a background task."""
        task_id = str(uuid.uuid4())
        
        # Initialize task status
        self._task_status[task_id] = {
            "status": "starting",
            "progress": 0,
            "message": "Initializing NER processing...",
            "started_at": time.time(),
            "collection": request.collection,
            "model_name": request.model_name,
            "model_type": request.model_type,
            "logs": [],
            "current_batch": 0,
            "total_docs": 0,
            "total_entities": 0,
            "processing_speed": 0.0
        }
        
        # Setup log capture
        log_capture = LogCapture(task_id, self._task_status[task_id])
        self._log_captures[task_id] = log_capture
        
        # Add background task
        background_tasks.add_task(self._run_ner_processing, task_id, request)
        
        return task_id
    
    async def _run_ner_processing(self, task_id: str, request: NERRequest):
        """Run NER processing in background with detailed progress and log capture."""
        log_capture = self._log_captures.get(task_id)
        
        try:
            # Update status to loading configuration
            self._update_task_status(task_id, {
                "status": "running",
                "progress": 5,
                "message": "Loading toolkit configuration..."
            })
            
            # Import here to avoid import errors at startup
            try:
                from histtext_toolkit.core.config import ModelConfig, get_config
                from histtext_toolkit.solr.client import SolrClient
                from histtext_toolkit.operations.ner import precompute_ner
            except ImportError as e:
                raise Exception(f"Failed to import histtext_toolkit modules: {str(e)}")
            
            # Setup log capture EARLY
            if log_capture:
                logger = log_capture.setup_log_capture()
                logger.info("="*60)
                logger.info("Starting NER processing via FastAPI Web Interface")
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
            
            try:
                additional_params = {}
                if request.threshold != 0.5:
                    additional_params["threshold"] = request.threshold
                if request.use_gpu:
                    additional_params["use_gpu"] = True
                if request.optimization_level != 1:
                    additional_params["optimization_level"] = request.optimization_level
                
                model_config = ModelConfig(
                    name=request.model_name,
                    path=request.model_name,
                    type=request.model_type,
                    max_length=request.max_length,
                    additional_params=additional_params
                )
                
                self._update_task_status(task_id, {
                    "progress": 20,
                    "message": f"Model config created for {request.model_type} model"
                })
                
            except Exception as e:
                raise Exception(f"Failed to create model config: {str(e)}")
            
            # Setup Solr connection
            self._update_task_status(task_id, {
                "progress": 25,
                "message": "Setting up Solr connection..."
            })
            
            try:
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
                
                self._update_task_status(task_id, {
                    "progress": 30,
                    "message": f"Connected to Solr at {solr_host}:{solr_port}"
                })
                
            except Exception as e:
                raise Exception(f"Failed to connect to Solr: {str(e)}")
            
            try:
                # Update status to starting processing
                self._update_task_status(task_id, {
                    "progress": 35,
                    "message": f"Starting NER processing on collection '{request.collection}'..."
                })
                
                if not cache_enabled:
                    raise Exception("Cache is not enabled in the configuration")
                
                # Run NER processing - this will generate all the detailed logs
                total_docs = await precompute_ner(
                    solr_client,                    
                    request.collection,             
                    request.text_field,             
                    model_config,                   
                    cache_root_dir,                 
                    request.model_name,             
                    request.start,                  
                    request.batch_size,             
                    request.num_batches,            
                    request.filter_query,           
                    request.entity_types or None,   
                    None,                           
                    None,                           
                    "flat",                         
                    request.compact_labels,         
                    request.label_stats             
                )
                
                # Update final status with captured statistics
                processing_time = time.time() - self._task_status[task_id]["started_at"]
                final_entities = self._task_status[task_id].get("total_entities", 0)
                
                self._update_task_status(task_id, {
                    "status": "completed",
                    "progress": 100,
                    "message": f"Successfully processed {total_docs} documents with {final_entities:,} entities",
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
                "message": f"NER processing failed: {error_message}",
                "error": error_message,
                "error_details": error_details,
                "completed_at": time.time()
            })
            
            print(f"NER Processing Error for task {task_id}:")
            print(f"Error: {error_message}")
            print(f"Full traceback:\n{error_details}")
        
        finally:
            # Cleanup log capture
            if log_capture:
                log_capture.cleanup()
                # Keep the log capture for a while so we can access logs after completion
                # Don't delete immediately: del self._log_captures[task_id]
    
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
        """Get status of a processing task with logs."""
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
            if last_n == -1:  # Get all logs
                return log_capture.get_all_logs()
            return log_capture.get_recent_logs(last_n)
        return []
    
    async def get_available_models(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get available NER models organized by type."""
        return {
            "transformers": [
                {"name": "xlm-roberta-large-finetuned-conll03-english", "display_name": "XLM-RoBERTa Large (CoNLL-03)"},
                {"name": "xlm-roberta-base-finetuned-conll03-english", "display_name": "XLM-RoBERTa Base (CoNLL-03)"},
                {"name": "bert-base-cased", "display_name": "BERT Base Cased"},
                {"name": "bert-base-multilingual-cased", "display_name": "BERT Multilingual"},
                {"name": "dbmdz/bert-base-historic-multilingual-cased", "display_name": "BERT Historic Multilingual"}
            ],
            "gliner": [
                {"name": "urchade/gliner_mediumv2.1", "display_name": "GLiNER Medium v2.1"},
                {"name": "urchade/gliner_largev2.1", "display_name": "GLiNER Large v2.1"},
                {"name": "urchade/gliner_small-v2.1", "display_name": "GLiNER Small v2.1"},
                {"name": "numind/NuNerZero", "display_name": "NuNER Zero"}
            ],
            "spacy": [
                {"name": "en_core_web_sm", "display_name": "spaCy English Small"},
                {"name": "en_core_web_md", "display_name": "spaCy English Medium"},
                {"name": "en_core_web_lg", "display_name": "spaCy English Large"},
                {"name": "zh_core_web_sm", "display_name": "spaCy Chinese"},
                {"name": "xx_core_web_sm", "display_name": "spaCy Multilingual"}
            ],
            "flair": [
                {"name": "ner", "display_name": "Flair NER English"},
                {"name": "ner-large", "display_name": "Flair NER Large"},
                {"name": "ner-ontonotes", "display_name": "Flair OntoNotes"},
                {"name": "ner-multi", "display_name": "Flair Multilingual"}
            ],
            "stanza": [
                {"name": "en", "display_name": "Stanza English"},
                {"name": "zh-hans", "display_name": "Stanza Chinese Simplified"},
                {"name": "de", "display_name": "Stanza German"},
                {"name": "fr", "display_name": "Stanza French"}
            ]
        }
    
    async def test_ner(self, request: NERTestRequest) -> Dict[str, Any]:
        """Test NER with sample text."""
        start_time = time.time()
        
        try:
            # Import required modules
            from histtext_toolkit.core.config import ModelConfig
            
            # Create a simple model config for testing
            model_config = ModelConfig(
                name=request.model_name,
                path=request.model_name,
                type=request.model_type,
                additional_params={}
            )
            
            # For now, return mock results with helpful info about the model
            entities = []
            
            # Add some mock entities based on common patterns
            text_lower = request.text.lower()
            words = request.text.split()
            
            # Simple pattern matching for demo
            for i, word in enumerate(words):
                if word.lower() in ['john', 'mary', 'smith', 'johnson', 'brown']:
                    entities.append({
                        "text": word,
                        "label": "PERSON",
                        "start_pos": request.text.find(word),
                        "end_pos": request.text.find(word) + len(word),
                        "confidence": 0.85
                    })
                elif word.lower() in ['london', 'paris', 'new york', 'tokyo', 'berlin']:
                    entities.append({
                        "text": word,
                        "label": "LOCATION", 
                        "start_pos": request.text.find(word),
                        "end_pos": request.text.find(word) + len(word),
                        "confidence": 0.92
                    })
                elif word.lower() in ['microsoft', 'google', 'apple', 'amazon', 'tesla']:
                    entities.append({
                        "text": word,
                        "label": "ORGANIZATION",
                        "start_pos": request.text.find(word),
                        "end_pos": request.text.find(word) + len(word),
                        "confidence": 0.88
                    })
            
            processing_time = time.time() - start_time
            
            return {
                "entities": entities,
                "processing_time": processing_time,
                "model_info": {
                    "name": request.model_name,
                    "type": request.model_type,
                    "note": "This is a demo response. Real NER will use the actual model."
                }
            }
            
        except Exception as e:
            processing_time = time.time() - start_time
            return {
                "entities": [],
                "processing_time": processing_time,
                "model_info": {
                    "name": request.model_name,
                    "type": request.model_type,
                    "error": str(e)
                }
            }
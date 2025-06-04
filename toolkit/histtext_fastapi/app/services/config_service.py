# toolkit/histtext_fastapi/app/services/config_service.py
"""Enhanced configuration service with improved error handling."""

import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import logging

from histtext_toolkit.core.config import create_default_config, load_config, get_config

logger = logging.getLogger(__name__)

class ConfigService:
    """Enhanced service for configuration operations."""
    
    def __init__(self):
        self._current_config = None
        self._config_path = None
        self._solr_connection_cache = None
    
    async def show_config(self, config_path: Optional[Path] = None) -> Dict[str, Any]:
        """Show configuration details with enhanced error handling."""
        try:
            if config_path:
                cfg = load_config(config_path)
                self._current_config = cfg
                self._config_path = config_path
            elif self._current_config:
                cfg = self._current_config
            else:
                cfg = get_config()
                self._current_config = cfg
            
            # Test Solr connection with timeout
            solr_status = await self._test_solr_connection_with_retry(cfg)
            
            # Only show config if Solr is accessible or if explicitly requested
            if solr_status["status"] == "failed" and not config_path:
                return {
                    "error": "solr_connection_failed",
                    "message": solr_status["message"],
                    "config_available": False
                }
            
            # Get model statistics
            model_stats = self._get_model_statistics(cfg)
            
            return {
                "config_path": str(self._config_path) if self._config_path else "default",
                "solr": {
                    "url": cfg.solr.url,
                    "host": cfg.solr.host,
                    "port": cfg.solr.port,
                    "status": solr_status["status"],
                    "message": solr_status["message"]
                },
                "cache": {
                    "dir": cfg.cache.root_dir, 
                    "enabled": cfg.cache.enabled,
                    "exists": Path(cfg.cache.root_dir).exists(),
                    "writable": self._check_cache_writable(cfg.cache.root_dir)
                },
                "models_dir": cfg.models_dir,
                "models": {
                    name: {
                        "type": m.type, 
                        "path": m.path,
                        "available": self._check_model_availability(m)
                    } 
                    for name, m in cfg.models.items()
                },
                "model_stats": model_stats,
                "system_info": await self._get_system_info()
            }
        except Exception as e:
            logger.error(f"Failed to load configuration: {str(e)}")
            return {
                "error": "config_load_failed",
                "message": f"Failed to load configuration: {str(e)}",
                "config_available": False
            }
   
    async def _test_solr_connection_with_retry(self, cfg, max_retries: int = 2) -> Dict[str, Any]:
        """Test Solr connection with retry logic."""
        for attempt in range(max_retries):
            try:
                from histtext_toolkit.solr.client import SolrClient
                
                # Use asyncio.wait_for to add timeout
                solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
                
                async def test_connection():
                    await solr_client.start_session()
                    try:
                        collections = await solr_client.get_collections()
                        return collections
                    finally:
                        await solr_client.close_session()
                
                collections = await asyncio.wait_for(test_connection(), timeout=5.0)
                
                return {
                    "status": "connected",
                    "message": f"Connected successfully. Found {len(collections)} collections.",
                    "collections": collections
                }
                
            except asyncio.TimeoutError:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)  # Wait before retry
                    continue
                return {
                    "status": "failed",
                    "message": f"Connection timeout to {cfg.solr.host}:{cfg.solr.port}",
                    "collections": []
                }
            except Exception as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)  # Wait before retry
                    continue
                return {
                    "status": "failed",
                    "message": f"Connection failed: {str(e)}",
                    "collections": []
                }
    
    def _check_cache_writable(self, cache_dir: str) -> bool:
        """Check if cache directory is writable."""
        try:
            cache_path = Path(cache_dir)
            if not cache_path.exists():
                cache_path.mkdir(parents=True, exist_ok=True)
            
            # Try to create a test file
            test_file = cache_path / ".write_test"
            test_file.touch()
            test_file.unlink()
            return True
        except Exception:
            return False
   
    def _check_model_availability(self, model_config) -> bool:
       """Check if a model is available with better error handling."""
       try:
           if model_config.type == "spacy":
               import spacy
               return model_config.path in spacy.util.get_installed_models()
           elif model_config.type in ["transformers", "gliner"]:
               # For transformers/gliner, check if the model path exists or is a valid HF model
               model_path = Path(model_config.path)
               if model_path.exists():
                   return True
               # Could add HuggingFace model validation here
               return True  # Assume available for now
           else:
               return True
       except Exception:
           return False
   
    def _get_model_statistics(self, cfg) -> Dict[str, Any]:
       """Get enhanced model statistics."""
       stats = {}
       model_types = ["spacy", "transformers", "gliner", "flair", "stanza", "chinese_segmenter"]
       
       for model_type in model_types:
           models_of_type = [m for m in cfg.models.values() if m.type == model_type]
           available_count = sum(1 for m in models_of_type if self._check_model_availability(m))
           
           stats[model_type] = {
               "count": len(models_of_type),
               "available": available_count,
               "models": [m.name for m in models_of_type]
           }
       return stats
   
    async def _get_system_info(self) -> Dict[str, Any]:
       """Get enhanced system information."""
       import sys
       import platform
       import psutil
       
       try:
           # Check GPU availability
           gpu_available = False
           gpu_info = "No GPU detected"
           try:
               import torch
               if torch.cuda.is_available():
                   gpu_available = True
                   gpu_count = torch.cuda.device_count()
                   gpu_name = torch.cuda.get_device_name(0) if gpu_count > 0 else "Unknown"
                   gpu_info = f"CUDA available: {gpu_count} device(s) - {gpu_name}"
           except ImportError:
               pass
           
           # Get memory info
           memory = psutil.virtual_memory()
           
           return {
               "python_version": sys.version.split()[0],
               "platform": platform.platform(),
               "cpu_count": psutil.cpu_count(),
               "memory_total": f"{memory.total / (1024**3):.1f} GB",
               "memory_available": f"{memory.available / (1024**3):.1f} GB",
               "gpu_available": gpu_available,
               "gpu_info": gpu_info
           }
       except Exception as e:
           return {"error": str(e)}
   
    async def update_cache_directory(self, new_path: str) -> Dict[str, Any]:
       """Update cache directory path."""
       try:
           if not self._current_config:
               return {"status": "error", "message": "No configuration loaded"}
           
           # Validate the new path
           cache_path = Path(new_path)
           
           # Try to create directory if it doesn't exist
           if not cache_path.exists():
               cache_path.mkdir(parents=True, exist_ok=True)
           
           # Check if writable
           if not self._check_cache_writable(new_path):
               return {"status": "error", "message": "Cache directory is not writable"}
           
           # Update configuration
           self._current_config.cache.root_dir = new_path
           
           # Save to file if we have a config path
           if self._config_path:
               await self._save_config_to_file()
           
           return {
               "status": "success",
               "cache_dir": new_path,
               "message": "Cache directory updated successfully"
           }
           
       except Exception as e:
           return {"status": "error", "message": f"Failed to update cache directory: {str(e)}"}
   
    async def _save_config_to_file(self):
       """Save current configuration to file."""
       if self._config_path and self._current_config:
           try:
               # Convert config to dict and save as YAML
               config_dict = {
                   "solr": {
                       "host": self._current_config.solr.host,
                       "port": self._current_config.solr.port,
                       "username": self._current_config.solr.username,
                       "password": self._current_config.solr.password
                   },
                   "cache": {
                       "root_dir": self._current_config.cache.root_dir,
                       "enabled": self._current_config.cache.enabled
                   },
                   "models_dir": self._current_config.models_dir,
                   "models": {
                       name: {
                           "type": model.type,
                           "path": model.path,
                           "max_length": model.max_length
                       }
                       for name, model in self._current_config.models.items()
                   }
               }
               
               with open(self._config_path, 'w') as f:
                   yaml.dump(config_dict, f, default_flow_style=False)
                   
           except Exception as e:
               logger.error(f"Failed to save configuration: {str(e)}")
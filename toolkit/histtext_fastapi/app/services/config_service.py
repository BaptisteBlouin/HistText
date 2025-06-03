# toolkit/histtext_fastapi/app/services/config_service.py
"""Enhanced configuration service with real-time updates."""

from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import asyncio

from histtext_toolkit.core.config import create_default_config, load_config, get_config


class ConfigService:
    """Enhanced service for configuration operations with real-time updates."""
    
    def __init__(self):
        self._current_config = None
        self._config_path = None
    
    async def create_default_config(self, config_path: Path) -> Dict[str, Any]:
        """Create a default configuration file."""
        try:
            config = create_default_config(config_path)
            self._current_config = config
            self._config_path = config_path
            
            return {
                "config_path": str(config_path),
                "solr_url": config.solr.url,
                "cache_dir": config.cache.root_dir,
                "models": list(config.models.keys()),
                "message": "Configuration created successfully"
            }
        except Exception as e:
            raise Exception(f"Failed to create configuration: {str(e)}")
    
    async def show_config(self, config_path: Optional[Path] = None) -> Dict[str, Any]:
        """Show configuration details with enhanced information."""
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
            
            # Test Solr connection
            solr_status = await self._test_solr_connection(cfg)
            
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
                    "exists": Path(cfg.cache.root_dir).exists()
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
            raise Exception(f"Failed to load configuration: {str(e)}")
   
    async def _test_solr_connection(self, cfg) -> Dict[str, Any]:
       """Test Solr connection."""
       try:
           from histtext_toolkit.solr.client import SolrClient
           
           solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
           await solr_client.start_session()
           
           try:
               collections = await solr_client.get_collections()
               await solr_client.close_session()
               return {
                   "status": "connected",
                   "message": f"Connected successfully. Found {len(collections)} collections.",
                   "collections": collections
               }
           except Exception as e:
               await solr_client.close_session()
               return {
                   "status": "error",
                   "message": f"Connected but failed to get collections: {str(e)}",
                   "collections": []
               }
       except Exception as e:
           return {
               "status": "failed",
               "message": f"Connection failed: {str(e)}",
               "collections": []
           }
   
    def _check_model_availability(self, model_config) -> bool:
       """Check if a model is available."""
       try:
           if model_config.type == "spacy":
               import spacy
               return model_config.path in spacy.util.get_installed_models()
           elif model_config.type in ["transformers", "gliner"]:
               # For transformers/gliner, we'd need to check if the model exists
               # This is a simplified check
               return True  # Assume available for now
           else:
               return True
       except Exception:
           return False
   
    def _get_model_statistics(self, cfg) -> Dict[str, Any]:
       """Get model statistics."""
       stats = {}
       for model_type in ["spacy", "transformers", "gliner", "flair", "stanza"]:
           models_of_type = [m for m in cfg.models.values() if m.type == model_type]
           stats[model_type] = {
               "count": len(models_of_type),
               "models": [m.name for m in models_of_type]
           }
       return stats
   
    async def _get_system_info(self) -> Dict[str, Any]:
       """Get system information."""
       import sys
       import platform
       
       try:
           # Check GPU availability
           gpu_available = False
           gpu_info = "No GPU detected"
           try:
               import torch
               if torch.cuda.is_available():
                   gpu_available = True
                   gpu_info = f"CUDA available: {torch.cuda.device_count()} devices"
           except ImportError:
               pass
           
           return {
               "python_version": sys.version,
               "platform": platform.platform(),
               "gpu_available": gpu_available,
               "gpu_info": gpu_info
           }
       except Exception as e:
           return {"error": str(e)}
   
    async def validate_config(self, config_path: Path) -> Dict[str, Any]:
       """Validate a configuration file with detailed feedback."""
       try:
           cfg = load_config(config_path)
           
           validation_results = {
               "valid": True,
               "config_path": str(config_path),
               "errors": [],
               "warnings": [],
               "checks": {}
           }
           
           # Check cache directory
           cache_dir = Path(cfg.cache.root_dir)
           if not cache_dir.exists():
               validation_results["warnings"].append(f"Cache directory does not exist: {cache_dir}")
               validation_results["checks"]["cache_dir"] = "warning"
           else:
               validation_results["checks"]["cache_dir"] = "ok"
           
           # Check Solr connection
           solr_status = await self._test_solr_connection(cfg)
           if solr_status["status"] != "connected":
               validation_results["warnings"].append(f"Solr connection issue: {solr_status['message']}")
               validation_results["checks"]["solr"] = "warning"
           else:
               validation_results["checks"]["solr"] = "ok"
           
           # Check models
           model_issues = []
           for name, model in cfg.models.items():
               if not self._check_model_availability(model):
                   model_issues.append(f"Model '{name}' ({model.type}) may not be available")
           
           if model_issues:
               validation_results["warnings"].extend(model_issues)
               validation_results["checks"]["models"] = "warning"
           else:
               validation_results["checks"]["models"] = "ok"
           
           return validation_results
           
       except Exception as e:
           return {
               "valid": False,
               "config_path": str(config_path),
               "errors": [str(e)],
               "warnings": [],
               "checks": {}
           }
   
    async def update_solr_config(self, host: str, port: int) -> Dict[str, Any]:
       """Update Solr configuration and test connection."""
       try:
           if self._current_config:
               # Update current config
               self._current_config.solr.host = host
               self._current_config.solr.port = port
               
               # Test new connection
               solr_status = await self._test_solr_connection(self._current_config)
               
               # Save to file if we have a config path
               if self._config_path:
                   await self._save_config_to_file()
               
               return {
                   "status": "updated",
                   "solr_host": host,
                   "solr_port": port,
                   "connection_test": solr_status,
                   "message": "Solr configuration updated successfully"
               }
           else:
               return {
                   "status": "error",
                   "message": "No configuration loaded to update"
               }
       except Exception as e:
           return {
               "status": "error",
               "message": f"Failed to update Solr configuration: {str(e)}"
           }
   
    async def _save_config_to_file(self):
       """Save current configuration to file."""
       if self._config_path and self._current_config:
           # This would require implementing a config serializer
           # For now, we'll skip the actual file writing
           pass
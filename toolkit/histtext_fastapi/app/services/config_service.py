"""Configuration service."""

from pathlib import Path
from typing import Dict, Any
from histtext_toolkit.core.config import create_default_config, load_config


class ConfigService:
    """Service for configuration operations."""
    
    async def create_default_config(self, config_path: Path) -> Dict[str, Any]:
        """Create a default configuration file."""
        try:
            config = create_default_config(config_path)
            return {
                "config_path": str(config_path),
                "solr_url": config.solr.url,
                "cache_dir": config.cache.root_dir,
                "models": list(config.models.keys()),
                "message": "Configuration created successfully"
            }
        except Exception as e:
            raise Exception(f"Failed to create configuration: {str(e)}")
    
    async def show_config(self, config_path: Path) -> Dict[str, Any]:
        """Show configuration details."""
        try:
            cfg = load_config(config_path)
            return {
                "solr": cfg.solr.url,
                "cache": {
                    "dir": cfg.cache.root_dir, 
                    "enabled": cfg.cache.enabled
                },
                "models_dir": cfg.models_dir,
                "models": {
                    name: {"type": m.type, "path": m.path} 
                    for name, m in cfg.models.items()
                }
            }
        except Exception as e:
            raise Exception(f"Failed to load configuration: {str(e)}")
    
    async def validate_config(self, config_path: Path) -> bool:
        """Validate a configuration file."""
        try:
            load_config(config_path)
            return True
        except Exception:
            return False
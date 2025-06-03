"""Models service."""

from typing import Dict, Any, List
from histtext_toolkit.models.registry import get_available_model_types
from histtext_toolkit.core.config import get_config


class ModelsService:
    """Service for model operations."""
    
    async def list_models(self) -> Dict[str, Any]:
        """List available and configured models."""
        try:
            # Get available model types
            available_types = get_available_model_types()
            
            # Get configured models
            try:
                cfg = get_config()
                configured_models = {
                    name: {"type": m.type, "path": m.path} 
                    for name, m in cfg.models.items()
                }
            except:
                configured_models = {}
            
            return {
                "available_types": available_types,
                "configured_models": configured_models,
                "total_available": len(available_types),
                "total_configured": len(configured_models)
            }
        except Exception as e:
            raise Exception(f"Failed to list models: {str(e)}")
    
    async def get_supported_model_types(self) -> List[str]:
        """Get list of supported model types."""
        try:
            available_types = get_available_model_types()
            return list(available_types.keys())
        except Exception as e:
            raise Exception(f"Failed to get model types: {str(e)}")
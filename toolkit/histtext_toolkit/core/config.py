"""Pydantic-based configuration module.

This module provides functionality for loading, accessing, and saving configuration
settings for the toolkit with support for Solr, caching, and model configurations.
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import yaml
from pydantic import BaseModel, Field, validator

from .logging import get_logger

logger = get_logger(__name__)


class SolrConfig(BaseModel):
    """Configuration for Solr connection.

    Handles connection details for Apache Solr, including authentication
    parameters if needed.
    """
    host: str = Field(default="localhost", description="Hostname or IP address of the Solr server")
    port: int = Field(default=8983, description="Port number for the Solr server")
    username: Optional[str] = Field(default=None, description="Username for authentication")
    password: Optional[str] = Field(default=None, description="Password for authentication")
    
    @validator('port')
    def validate_port(cls, v):
        if not 1 <= v <= 65535:
            raise ValueError('Port must be between 1 and 65535')
        return v
    
    @property
    def url(self) -> str:
        """Get the Solr URL."""
        return f"http://{self.host}:{self.port}/solr"


class CacheConfig(BaseModel):
    """Configuration for caching mechanism.

    Controls where and whether cached data is stored to improve performance.
    """
    root_dir: str = Field(default="./cache", description="Root directory for storing cache files")
    enabled: bool = Field(default=True, description="Whether caching is enabled")
    
    @validator('root_dir')
    def validate_root_dir(cls, v):
        # Expand user home directory and environment variables
        expanded = os.path.expanduser(os.path.expandvars(v))
        return expanded


class ModelConfig(BaseModel):
    """Configuration for a model.

    Defines parameters for loading and using NLP models like
    named entity recognizers, tokenizers, and embedding models.
    """
    name: str = Field(description="Unique identifier for the model")
    path: str = Field(description="Path or name of the model")
    type: str = Field(default="transformers", description="Type of model (e.g., 'transformers', 'spacy')")
    max_length: Optional[int] = Field(default=None, description="Maximum sequence length for tokenization")
    aggregation_strategy: Optional[str] = Field(default=None, description="Strategy for aggregating tokens")
    dim: Optional[int] = Field(default=None, description="Dimension of embeddings for embedding models")
    binary: Optional[bool] = Field(default=None, description="Whether the model uses binary format (Word2Vec)")
    use_precomputed: Optional[bool] = Field(default=None, description="Whether to use precomputed vectors (FastText)")
    additional_params: Dict[str, Any] = Field(default_factory=dict, description="Additional model-specific parameters")
    
    @validator('max_length')
    def validate_max_length(cls, v):
        if v is not None and v <= 0:
            raise ValueError('max_length must be positive')
        return v
    
    @validator('dim')
    def validate_dim(cls, v):
        if v is not None and v <= 0:
            raise ValueError('dim must be positive')
        return v


class EnhancedModelConfig(ModelConfig):
    """Enhanced model configuration with modern features."""
    processing_mode: str = Field(default="batch", description="Processing mode")
    optimization_level: int = Field(default=1, description="Optimization level (0-2)")
    entity_types: Optional[List[str]] = Field(default=None, description="Supported entity types")
    enable_caching: bool = Field(default=True, description="Enable model caching")
    gpu_memory_fraction: float = Field(default=0.8, description="GPU memory fraction to use")
    use_fp16: bool = Field(default=True, description="Use 16-bit floating point")
    enable_compilation: bool = Field(default=True, description="Enable model compilation")
    
    @validator('optimization_level')
    def validate_optimization_level(cls, v):
        if not 0 <= v <= 2:
            raise ValueError('optimization_level must be between 0 and 2')
        return v
    
    @validator('gpu_memory_fraction')
    def validate_gpu_memory_fraction(cls, v):
        if not 0.1 <= v <= 1.0:
            raise ValueError('gpu_memory_fraction must be between 0.1 and 1.0')
        return v


class Config(BaseModel):
    """Main configuration for the toolkit.

    Contains all configuration settings including Solr connection,
    models, and caching parameters.
    """
    solr: SolrConfig = Field(default_factory=SolrConfig, description="Solr connection configuration")
    models_dir: str = Field(default="./models", description="Directory containing model files")
    cache: CacheConfig = Field(default_factory=CacheConfig, description="Cache configuration")
    models: Dict[str, ModelConfig] = Field(default_factory=dict, description="Dictionary of model configurations")
    
    class Config:
        extra = "allow"  # Allow additional fields for extensibility
    
    @validator('models_dir')
    def validate_models_dir(cls, v):
        # Expand user home directory and environment variables
        expanded = os.path.expanduser(os.path.expandvars(v))
        return expanded
    
    def get_model_config(self, model_name: str) -> Optional[ModelConfig]:
        """Get model configuration by name."""
        return self.models.get(model_name)
    
    def add_model_config(self, model_name: str, model_config: ModelConfig) -> None:
        """Add or update model configuration."""
        self.models[model_name] = model_config
    
    def save_to_file(self, config_path: Union[str, Path]) -> bool:
        """Save configuration to a YAML file."""
        try:
            config_path = Path(config_path)
            config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Convert to dict and write to YAML
            config_dict = self.dict()
            
            with open(config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config_dict, f, default_flow_style=False, allow_unicode=True)
            
            logger.info(f"Saved configuration to {config_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving configuration: {e}")
            return False


# Singleton instance
_config: Optional[Config] = None


def load_config(config_path: Union[str, Path]) -> Config:
    """Load configuration from a YAML file.

    Args:
        config_path: Path to the configuration YAML file

    Returns:
        Config: Loaded configuration object

    Raises:
        FileNotFoundError: If the configuration file does not exist
        yaml.YAMLError: If the configuration file contains invalid YAML
        ValueError: If the configuration is invalid
    """
    global _config

    try:
        config_path = Path(config_path)
        
        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config_dict = yaml.safe_load(f)
        
        if config_dict is None:
            config_dict = {}
        
        # Parse models section specially to handle different model types
        if 'models' in config_dict:
            models = {}
            for model_name, model_dict in config_dict['models'].items():
                # Make a copy to avoid modifying the original
                model_data = model_dict.copy()
                
                # Ensure the name is set correctly - remove if it exists in dict to avoid conflict
                if 'name' in model_data:
                    # Use the name from the dict if it exists, otherwise use the key
                    actual_name = model_data.pop('name')
                else:
                    actual_name = model_name
                
                # Set the name explicitly
                model_data['name'] = actual_name
                
                # Determine if this should be an enhanced model config
                enhanced_fields = ['processing_mode', 'optimization_level', 'entity_types', 
                                 'enable_caching', 'gpu_memory_fraction', 'use_fp16', 'enable_compilation']
                
                if any(field in model_data for field in enhanced_fields):
                    models[model_name] = EnhancedModelConfig(**model_data)
                else:
                    models[model_name] = ModelConfig(**model_data)
            
            config_dict['models'] = models
        
        # Create configuration object
        _config = Config(**config_dict)
        
        logger.info(f"Loaded configuration from {config_path}")
        logger.debug(f"Solr: {_config.solr.host}:{_config.solr.port}")
        logger.debug(f"Cache: {_config.cache.root_dir} (enabled: {_config.cache.enabled})")
        logger.debug(f"Models: {len(_config.models)}")
        
        return _config

    except FileNotFoundError:
        logger.error(f"Configuration file not found: {config_path}")
        raise
    except yaml.YAMLError as e:
        logger.error(f"Invalid YAML in configuration file: {e}")
        raise
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        raise


def get_config() -> Config:
    """Get the current configuration.

    Returns the current configuration, or creates a default
    configuration if none has been loaded.

    Returns:
        Config: Current configuration object
    """
    global _config

    if _config is None:
        logger.warning("No configuration loaded, using defaults")
        _config = Config()

    return _config


def create_default_config(config_path: Union[str, Path]) -> Config:
    """Create a default configuration file.

    Args:
        config_path: Path where to save the default configuration

    Returns:
        Config: Default configuration object
    """
    config = Config()
    
    # Add some example models
    config.models = {
        "spacy_en": ModelConfig(
            name="spacy_en",
            path="en_core_web_sm",
            type="spacy"
        ),
        "bert_ner": ModelConfig(
            name="bert_ner",
            path="dbmdz/bert-large-cased-finetuned-conll03-english",
            type="transformers",
            max_length=512,
            aggregation_strategy="simple"
        ),
        "gliner_medium": EnhancedModelConfig(
            name="gliner_medium",
            path="urchade/gliner_mediumv2.1",
            type="gliner",
            optimization_level=1,
            entity_types=["Person", "Organization", "Location"],
            additional_params={"threshold": 0.5}
        )
    }
    
    # Save to file
    config.save_to_file(config_path)
    return config


def reset_config() -> None:
    """Reset the global configuration instance."""
    global _config
    _config = None
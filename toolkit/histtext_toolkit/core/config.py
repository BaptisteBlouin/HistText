"""Configuration module.

This module provides functionality for loading, accessing, and saving configuration
settings for the toolkit with support for Solr, caching, and model configurations.
"""

import os
from typing import Any, Optional

import yaml

from .logging import get_logger

logger = get_logger(__name__)


class SolrConfig:
    """Configuration for Solr connection.

    Handles connection details for Apache Solr, including authentication
    parameters if needed.

    Attributes:
        host (str): Hostname or IP address of the Solr server
        port (int): Port number for the Solr server
        username (Optional[str]): Username for authentication
        password (Optional[str]): Password for authentication

    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8983,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        """Initialize Solr configuration.

        Args:
            host: Solr host address (default: "localhost")
            port: Solr port number (default: 8983)
            username: Optional username for authentication
            password: Optional password for authentication

        """
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        



class CacheConfig:
    """Configuration for caching mechanism.

    Controls where and whether cached data is stored to improve performance.

    Attributes:
        root_dir (str): Root directory for storing cache files
        enabled (bool): Whether caching is enabled

    """

    def __init__(self, root_dir: str = "./cache", enabled: bool = True):
        """Initialize cache configuration.

        Args:
            root_dir: Root directory for cache files (default: "./cache")
            enabled: Whether caching is enabled (default: True)

        """
        self.root_dir = root_dir
        self.enabled = enabled


class ModelConfig:
    """Configuration for a model.

    Defines parameters for loading and using NLP models like
    named entity recognizers, tokenizers, and embedding models.

    Attributes:
        name (str): Unique identifier for the model
        path (str): Path or name of the model
        type (str): Type of model (e.g., "transformers", "spacy")
        max_length (Optional[int]): Maximum sequence length for tokenization
        aggregation_strategy (Optional[str]): Strategy for aggregating tokens
        dim (Optional[int]): Dimension of embeddings for embedding models
        binary (Optional[bool]): Whether the model uses binary format (Word2Vec)
        use_precomputed (Optional[bool]): Whether to use precomputed vectors (FastText)
        additional_params (Dict[str, Any]): Additional model-specific parameters

    """

    def __init__(
        self,
        name: str,
        path: str,
        type: str = "transformers",
        max_length: Optional[int] = None,
        aggregation_strategy: Optional[str] = None,
        dim: Optional[int] = None,
        binary: Optional[bool] = None,
        use_precomputed: Optional[bool] = None,
        additional_params: Optional[dict[str, Any]] = None,
    ):
        """Initialize model configuration.

        Args:
            name: Unique identifier for the model
            path: Path or name of the model to load
            type: Type of model (default: "transformers")
            max_length: Maximum sequence length for tokenization
            aggregation_strategy: Strategy for aggregating tokens
            dim: Dimension of embeddings for embedding models
            binary: Whether the model uses binary format (for Word2Vec)
            use_precomputed: Whether to use precomputed vectors (for FastText)
            additional_params: Additional model-specific parameters

        """
        self.name = name
        self.path = path
        self.type = type
        self.max_length = max_length
        self.aggregation_strategy = aggregation_strategy
        self.dim = dim
        self.binary = binary
        self.use_precomputed = use_precomputed
        self.additional_params = additional_params or {}

class EnhancedModelConfig(ModelConfig):
    """Enhanced model configuration with modern features."""
    
    def __init__(
        self,
        name: str,
        path: str,
        type: str = "transformers",
        max_length: Optional[int] = None,
        aggregation_strategy: Optional[str] = None,
        dim: Optional[int] = None,
        binary: Optional[bool] = None,
        use_precomputed: Optional[bool] = None,
        additional_params: Optional[Dict[str, Any]] = None,
        # Enhanced parameters
        processing_mode: str = "batch",
        optimization_level: int = 1,
        entity_types: Optional[List[str]] = None,
        enable_caching: bool = True,
        gpu_memory_fraction: float = 0.8,
        use_fp16: bool = True,
        enable_compilation: bool = True
    ):
        super().__init__(
            name, path, type, max_length, aggregation_strategy,
            dim, binary, use_precomputed, additional_params
        )
        
        self.processing_mode = processing_mode
        self.optimization_level = optimization_level
        self.entity_types = entity_types
        self.enable_caching = enable_caching
        self.gpu_memory_fraction = gpu_memory_fraction
        self.use_fp16 = use_fp16
        self.enable_compilation = enable_compilation

class Config:
    """Main configuration for the toolkit.

    Contains all configuration settings including Solr connection,
    models, and caching parameters.

    Attributes:
        solr (SolrConfig): Solr connection configuration
        models_dir (str): Directory containing model files
        cache (CacheConfig): Cache configuration
        models (Dict[str, ModelConfig]): Dictionary of model configurations

    """

    def __init__(
        self,
        solr: SolrConfig,
        models_dir: str = "./models",
        cache: Optional[CacheConfig] = None,
        models: Optional[dict[str, ModelConfig]] = None,
    ):
        """Initialize toolkit configuration.

        Args:
            solr: Solr connection configuration
            models_dir: Directory containing model files (default: "./models")
            cache: Cache configuration (default: CacheConfig())
            models: Dictionary mapping model names to configurations

        """
        self.solr = solr
        self.models_dir = models_dir
        self.cache = cache or CacheConfig()
        self.models = models or {}


# Singleton instance
_config: Optional[Config] = None


def load_config(config_path: str) -> Config:
    """Load configuration from a YAML file.

    Reads the configuration from a YAML file and initializes the
    global configuration object.

    Args:
        config_path: Path to the configuration YAML file

    Returns:
        Config: Loaded configuration object

    Raises:
        FileNotFoundError: If the configuration file does not exist
        yaml.YAMLError: If the configuration file contains invalid YAML

    Example:
        >>> config = load_config("config.yaml")
        >>> print(f"Using Solr at {config.solr.host}:{config.solr.port}")

    """
    global _config

    try:
        with open(config_path) as f:
            config_dict = yaml.safe_load(f)

        # Load Solr configuration
        solr_dict = config_dict.get("solr", {})
        solr_config = SolrConfig(
            host=solr_dict.get("host", "localhost"),
            port=solr_dict.get("port", 8983),
            username=solr_dict.get("username"),
            password=solr_dict.get("password"),
        )

        # Load cache configuration
        cache_dict = config_dict.get("cache", {})
        cache_config = CacheConfig(
            root_dir=cache_dict.get("root_dir", "./cache"),
            enabled=cache_dict.get("enabled", True),
        )

        # Load models
        models = {}
        for name, model_dict in config_dict.get("models", {}).items():
            models[name] = ModelConfig(
                name=name,
                path=model_dict.get("path", name),
                type=model_dict.get("type", "transformers"),
                max_length=model_dict.get("max_length"),
                aggregation_strategy=model_dict.get("aggregation_strategy"),
                dim=model_dict.get("dim"),
                binary=model_dict.get("binary"),
                use_precomputed=model_dict.get("use_precomputed"),
                additional_params=model_dict.get("additional_params"),
            )

        # Create configuration
        _config = Config(
            solr=solr_config,
            models_dir=config_dict.get("models_dir", "./models"),
            cache=cache_config,
            models=models,
        )

        logger.info(f"Loaded configuration from {config_path}")
        logger.debug(f"Solr: {solr_config.host}:{solr_config.port}")
        logger.debug(f"Cache: {cache_config.root_dir} (enabled: {cache_config.enabled})")
        logger.debug(f"Models: {len(models)}")

        return _config

    except FileNotFoundError:
        logger.error(f"Configuration file not found: {config_path}")
        raise

    except yaml.YAMLError as e:
        logger.error(f"Invalid YAML in configuration file: {e}")
        raise


def get_config() -> Config:
    """Get the current configuration.

    Returns the current configuration, or creates a default
    configuration if none has been loaded.

    Returns:
        Config: Current configuration object

    Example:
        >>> config = get_config()
        >>> solr_url = f"http://{config.solr.host}:{config.solr.port}/solr/"

    """
    global _config

    if _config is None:
        logger.warning("No configuration loaded, using defaults")
        _config = Config(solr=SolrConfig(), cache=CacheConfig())

    return _config


def save_config(config: Config, config_path: str) -> bool:
    """Save configuration to a YAML file.

    Serializes the configuration object to YAML format and saves
    it to the specified file path.

    Args:
        config: Configuration object to save
        config_path: Path where to save the configuration

    Returns:
        bool: True if successful, False if an error occurred

    Example:
        >>> config = get_config()
        >>> config.models_dir = "/new/models/path"
        >>> save_config(config, "updated_config.yaml")

    """
    try:
        # Create dictionary representation
        config_dict = {}

        # Solr configuration
        config_dict["solr"] = {"host": config.solr.host, "port": config.solr.port}

        if config.solr.username:
            config_dict["solr"]["username"] = config.solr.username
            config_dict["solr"]["password"] = config.solr.password

        # Cache configuration
        if config.cache:
            config_dict["cache"] = {
                "root_dir": config.cache.root_dir,
                "enabled": config.cache.enabled,
            }

        # Models directory
        config_dict["models_dir"] = config.models_dir

        # Models
        config_dict["models"] = {}
        for name, model in config.models.items():
            model_dict = {"path": model.path, "type": model.type}

            if model.max_length is not None:
                model_dict["max_length"] = model.max_length

            if model.aggregation_strategy is not None:
                model_dict["aggregation_strategy"] = model.aggregation_strategy

            if model.dim is not None:
                model_dict["dim"] = model.dim

            if model.binary is not None:
                model_dict["binary"] = model.binary

            if model.use_precomputed is not None:
                model_dict["use_precomputed"] = model.use_precomputed

            if model.additional_params:
                model_dict["additional_params"] = model.additional_params

            config_dict["models"][name] = model_dict

        # Ensure directory exists
        os.makedirs(os.path.dirname(config_path) or ".", exist_ok=True)

        # Save to file
        with open(config_path, "w") as f:
            yaml.dump(config_dict, f, default_flow_style=False)

        logger.info(f"Saved configuration to {config_path}")

        return True

    except Exception as e:
        logger.error(f"Error saving configuration: {e}")
        return False

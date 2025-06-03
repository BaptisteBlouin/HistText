"""Application configuration management."""

from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Application settings
    app_name: str = "HistText Toolkit Web UI"
    version: str = "2.1.0"
    debug: bool = True
    environment: str = "development"
    
    # Default Solr settings
    default_solr_host: str = "localhost"
    default_solr_port: int = 8983
    
    # Default cache settings
    default_cache_dir: Optional[Path] = Path("./cache")
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_prefix = "HISTTEXT_"


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings."""
    return Settings()
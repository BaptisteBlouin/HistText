"""Configuration schemas."""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from pathlib import Path


class ConfigCreateRequest(BaseModel):
    """Request schema for creating configuration."""
    config_path: str = Field(..., description="Path where to create the configuration file")


class ConfigCreateResponse(BaseModel):
    """Response schema for configuration creation."""
    config_path: str
    solr_url: str
    cache_dir: str
    models: List[str]
    message: str = "Configuration created successfully"


class ConfigShowRequest(BaseModel):
    """Request schema for showing configuration."""
    config_path: str = Field(..., description="Path to the configuration file")


class ConfigShowResponse(BaseModel):
    """Response schema for showing configuration."""
    solr: str
    cache: Dict[str, Any]
    models_dir: str
    models: Dict[str, Dict[str, str]]


class ConfigValidationResponse(BaseModel):
    """Response schema for configuration validation."""
    valid: bool
    config_path: str
    errors: List[str] = []
    warnings: List[str] = []
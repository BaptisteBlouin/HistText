"""Models schemas."""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional


class ModelListResponse(BaseModel):
    """Model list response schema."""
    available_types: Dict[str, List[str]]
    configured_models: Dict[str, Dict[str, str]]
    total_available: int
    total_configured: int


class ModelInfo(BaseModel):
    """Individual model information."""
    name: str
    type: str
    path: str
    description: Optional[str] = None
    supported_tasks: List[str] = []
    parameters: Optional[Dict[str, Any]] = None
    is_loaded: bool = False
    memory_usage: Optional[str] = None


class ModelTestRequest(BaseModel):
    """Model testing request."""
    model_name: str = Field(..., description="Model name to test")
    model_type: str = Field(..., description="Model type")
    test_input: str = Field(..., description="Test input text")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Additional parameters")


class ModelTestResponse(BaseModel):
    """Model testing response."""
    model_name: str
    model_type: str
    test_input: str
    result: Any
    processing_time: float
    success: bool
    error_message: Optional[str] = None
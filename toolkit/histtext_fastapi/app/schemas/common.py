"""Common Pydantic schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class BaseResponse(BaseModel):
    """Base response schema."""
    status: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.now)


class ErrorResponse(BaseResponse):
    """Error response schema."""
    status: str = "error"
    error_code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseResponse):
    """Success response schema."""
    status: str = "success"
    data: Optional[Dict[str, Any]] = None


class TaskStatus(BaseModel):
    """Task status schema."""
    task_id: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    progress: int = Field(ge=0, le=100)
    message: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


class ModelInfo(BaseModel):
    """Model information schema."""
    name: str
    type: str
    path: str
    description: Optional[str] = None
    supported_tasks: List[str] = []
    parameters: Optional[Dict[str, Any]] = None
    is_available: bool = True
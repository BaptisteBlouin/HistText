"""Upload schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional


class UploadRequest(BaseModel):
    """Base upload request schema."""
    collection: str = Field(..., description="Target Solr collection")
    batch_size: int = Field(default=1000, ge=1, le=10000)


class JSONLUploadRequest(UploadRequest):
    """JSONL upload request schema."""
    schema: Optional[str] = Field(None, description="Optional schema file path")


class NERUploadRequest(UploadRequest):
    """NER upload request schema."""
    model_name: str = Field(..., description="Name of the NER model")
    solr_collection: str = Field(..., description="Source Solr collection")
    field: str = Field(..., description="Text field name")


class UploadResponse(BaseModel):
    """Upload response schema."""
    status: str = "success"
    uploaded_docs: int
    collection: str
    processing_time: Optional[float] = None
    message: str = "Upload completed successfully"
    errors: List[str] = []
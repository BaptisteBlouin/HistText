"""Embeddings schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List


class EmbeddingsRequest(BaseModel):
    """Embeddings computation request."""
    collection: str = Field(..., description="Solr collection to process")
    output_path: str = Field(..., description="Output file path")
    model_name: str = Field(..., description="Embeddings model name")
    text_field: str = Field(default="text", description="Field containing text")
    model_type: str = Field(default="fasttext", description="Type of embeddings model")
    dim: Optional[int] = Field(None, description="Embedding dimensions")
    max_length: Optional[int] = Field(None, description="Maximum sequence length")
    output_format: str = Field(default="vec", description="Output format")
    start: int = Field(default=0, ge=0, description="Starting document index")
    batch_size: int = Field(default=1000, ge=1, le=10000, description="Batch size")
    num_batches: Optional[int] = Field(None, ge=1, description="Maximum number of batches")
    filter_query: Optional[str] = Field(None, description="Solr filter query")
    simplify_chinese: bool = Field(default=False, description="Convert traditional to simplified Chinese")


class EmbeddingsResponse(BaseModel):
    """Embeddings computation response."""
    status: str = "success"
    computed_docs: int
    output_path: str
    model_name: str
    dimensions: Optional[int] = None
    processing_time: Optional[float] = None
    message: str = "Embeddings computation completed successfully"
    errors: List[str] = []


class WordEmbeddingsRequest(BaseModel):
    """Word embeddings computation request."""
    collection: str = Field(..., description="Solr collection to process")
    output_path: str = Field(..., description="Output file path")
    text_field: str = Field(default="text", description="Field containing text")
    method: str = Field(default="word2vec", description="Word embedding method")
    dim: int = Field(default=100, ge=50, le=1000, description="Embedding dimensions")
    window: int = Field(default=5, ge=1, le=20, description="Context window size")
    min_count: int = Field(default=5, ge=1, description="Minimum word count")
    workers: int = Field(default=4, ge=1, le=16, description="Number of worker threads")
    output_format: str = Field(default="txt", description="Output format")
    batch_size: int = Field(default=1000, ge=1, le=10000, description="Batch size")
    filter_query: Optional[str] = Field(None, description="Solr filter query")
    simplify_chinese: bool = Field(default=False, description="Convert traditional to simplified Chinese")
    auto_configure: bool = Field(default=False, description="Auto-configure parameters")
    no_header: bool = Field(default=False, description="Exclude header from output")
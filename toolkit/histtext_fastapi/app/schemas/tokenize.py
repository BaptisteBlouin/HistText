"""Tokenization schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List


class TokenizeRequest(BaseModel):
    """Tokenization request schema."""
    collection: str = Field(..., description="Solr collection to tokenize")
    model_name: str = Field(..., description="Tokenization model name")
    text_field: str = Field(default="text", description="Field containing text")
    model_type: str = Field(default="transformers", description="Type of tokenization model")
    max_length: Optional[int] = Field(None, description="Maximum sequence length")
    start: int = Field(default=0, ge=0, description="Starting document index")
    batch_size: int = Field(default=1000, ge=1, le=10000, description="Batch size")
    num_batches: Optional[int] = Field(None, ge=1, description="Maximum number of batches")
    filter_query: Optional[str] = Field(None, description="Solr filter query")
    simplify_chinese: bool = Field(default=False, description="Convert traditional to simplified Chinese")


class TokenizeResponse(BaseModel):
    """Tokenization response schema."""
    status: str = "success"
    tokenized_docs: int
    collection: str
    model_name: str
    processing_time: Optional[float] = None
    message: str = "Tokenization completed successfully"
    errors: List[str] = []


class TokenInfo(BaseModel):
    """Token information schema."""
    text: str
    start_pos: int
    end_pos: int
    token_type: Optional[str] = None
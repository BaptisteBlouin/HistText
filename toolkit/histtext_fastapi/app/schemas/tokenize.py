"""Tokenization schemas."""

from pydantic import BaseModel, Field, model_validator
from typing import Optional, List


class TokenizeRequest(BaseModel):
    """Tokenization request schema."""
    collection: str = Field(..., description="Solr collection to tokenize")
    model_name: Optional[str] = Field(None, description="Tokenization model name (optional for Chinese segmenter)")
    text_field: str = Field(default="text", description="Field containing text")
    model_type: str = Field(default="transformers", description="Type of tokenization model")
    max_length: Optional[int] = Field(None, description="Maximum sequence length")
    start: int = Field(default=0, ge=0, description="Starting document index")
    batch_size: int = Field(default=1000, ge=1, le=10000, description="Batch size")
    num_batches: Optional[int] = Field(None, ge=1, description="Maximum number of batches")
    filter_query: Optional[str] = Field(None, description="Solr filter query")
    simplify_chinese: bool = Field(default=False, description="Convert traditional to simplified Chinese")

    @model_validator(mode='after')
    def validate_model_name_with_type(self):
        """Validate model_name based on model_type after all fields are set."""
        model_type = self.model_type
        model_name = self.model_name
        
        # For Chinese segmenter, model_name can be None or empty
        if model_type == 'chinese_segmenter':
            # Ensure model_name is None for Chinese segmenter
            self.model_name = None
            return self
            
        # For other model types, model_name is required
        if not model_name or (isinstance(model_name, str) and not model_name.strip()):
            raise ValueError(f"model_name is required for model_type '{model_type}'")
            
        # Clean up the model name
        if isinstance(model_name, str):
            self.model_name = model_name.strip()
            
        return self


class TokenizeResponse(BaseModel):
    """Tokenization response schema."""
    status: str = "success"
    tokenized_docs: int
    collection: str
    model_name: Optional[str] = None
    processing_time: Optional[float] = None
    message: str = "Tokenization completed successfully"
    errors: List[str] = []


class TokenInfo(BaseModel):
    """Token information schema."""
    text: str
    start_pos: int
    end_pos: int
    token_type: Optional[str] = None
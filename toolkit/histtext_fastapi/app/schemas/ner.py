"""NER schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class NERRequest(BaseModel):
    """NER processing request."""
    collection: str = Field(..., description="Solr collection to process")
    model_name: str = Field(..., description="NER model name")
    model_type: str = Field(default="transformers", description="Type of NER model")
    text_field: str = Field(default="text", description="Field containing text to process")
    entity_types: List[str] = Field(default=[], description="Entity types to extract")
    max_length: Optional[int] = Field(None, description="Maximum sequence length")
    aggregation_strategy: str = Field(default="simple", description="Token aggregation strategy")
    threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Confidence threshold")
    start: int = Field(default=0, ge=0, description="Starting document index")
    batch_size: int = Field(default=10000, ge=1, le=100000, description="Batch size for processing")
    num_batches: Optional[int] = Field(None, ge=1, description="Maximum number of batches")
    filter_query: Optional[str] = Field(None, description="Solr filter query")
    use_gpu: bool = Field(default=False, description="Use GPU acceleration")
    optimization_level: int = Field(default=1, ge=0, le=2, description="Optimization level")
    compact_labels: bool = Field(default=True, description="Use compact label format")
    label_stats: bool = Field(default=False, description="Generate label statistics")


class NERResponse(BaseModel):
    """NER processing response."""
    status: str
    task_id: Optional[str] = None
    message: str
    processed_docs: Optional[int] = None
    entities_found: Optional[int] = None
    processing_time: Optional[float] = None
    errors: List[str] = []


class NERTestRequest(BaseModel):
    """NER testing request."""
    model_name: str = Field(..., description="NER model name")
    model_type: str = Field(default="transformers", description="Type of NER model")
    text: str = Field(..., description="Text to analyze")
    entity_types: List[str] = Field(default=[], description="Entity types to extract")


class NERTestResponse(BaseModel):
    """NER testing response."""
    entities: List[Dict[str, Any]]
    processing_time: float
    model_info: Dict[str, Any]


class EntityResult(BaseModel):
    """Individual entity result."""
    text: str
    label: str
    start_pos: int
    end_pos: int
    confidence: float


class NERModelInfo(BaseModel):
    """NER model information."""
    name: str
    type: str
    supported_entity_types: List[str] = []
    description: Optional[str] = None
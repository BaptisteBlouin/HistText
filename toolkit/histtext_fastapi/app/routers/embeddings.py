"""Embeddings router."""

from fastapi import APIRouter, HTTPException, Form
from typing import Optional

from ..schemas.embeddings import EmbeddingsRequest, EmbeddingsResponse
from ..services.embeddings_service import EmbeddingsService

router = APIRouter()
embeddings_service = EmbeddingsService()


@router.post("/compute", response_model=EmbeddingsResponse)
async def compute_embeddings(
    collection: str = Form(...),
    output_path: str = Form(...),
    model_name: str = Form(...),
    text_field: str = Form("text"),
    model_type: str = Form("fasttext"),
    dim: Optional[int] = Form(None),
    max_length: Optional[int] = Form(None),
    output_format: str = Form("vec"),
    start: int = Form(0),
    batch_size: int = Form(1000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    simplify_chinese: bool = Form(False)
):
    """Compute embeddings for documents in a collection."""
    try:
        request_data = EmbeddingsRequest(
            collection=collection,
            output_path=output_path,
            model_name=model_name,
            text_field=text_field,
            model_type=model_type,
            dim=dim,
            max_length=max_length,
            output_format=output_format,
            start=start,
            batch_size=batch_size,
            num_batches=num_batches,
            filter_query=filter_query,
            simplify_chinese=simplify_chinese
        )
        
        result = await embeddings_service.compute_embeddings(request_data)
        return EmbeddingsResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/supported-models")
async def get_supported_embeddings_models():
    """Get list of supported embeddings model types."""
    return {
        "model_types": [
            "fasttext",
            "word2vec", 
            "sentence_transformers"
        ],
        "output_formats": [
            "vec",
            "txt",
            "binary",
            "json"
        ]
    }
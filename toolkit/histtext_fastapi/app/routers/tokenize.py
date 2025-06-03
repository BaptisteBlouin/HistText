"""Tokenization router."""

from fastapi import APIRouter, HTTPException, Form
from typing import Optional

from ..schemas.tokenize import TokenizeRequest, TokenizeResponse
from ..services.tokenize_service import TokenizeService

router = APIRouter()
tokenize_service = TokenizeService()


@router.post("/process", response_model=TokenizeResponse)
async def tokenize_collection(
    collection: str = Form(...),
    model_name: str = Form(...),
    text_field: str = Form("text"),
    model_type: str = Form("transformers"),
    max_length: Optional[int] = Form(None),
    start: int = Form(0),
    batch_size: int = Form(1000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    simplify_chinese: bool = Form(False)
):
    """Tokenize documents in a collection."""
    try:
        request_data = TokenizeRequest(
            collection=collection,
            model_name=model_name,
            text_field=text_field,
            model_type=model_type,
            max_length=max_length,
            start=start,
            batch_size=batch_size,
            num_batches=num_batches,
            filter_query=filter_query,
            simplify_chinese=simplify_chinese
        )
        
        result = await tokenize_service.tokenize_collection(request_data)
        return TokenizeResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/supported-models")
async def get_supported_tokenize_models():
    """Get list of supported tokenization model types."""
    return {
        "model_types": [
            "transformers",
            "spacy", 
            "chinese_segmenter"
        ]
    }
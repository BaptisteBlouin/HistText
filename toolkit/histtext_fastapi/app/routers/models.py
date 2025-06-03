"""Models router."""

from fastapi import APIRouter, HTTPException

from ..schemas.models import ModelListResponse
from ..services.models_service import ModelsService

router = APIRouter()
models_service = ModelsService()


@router.get("/list", response_model=ModelListResponse)
async def list_models():
    """List available and configured models."""
    try:
        result = await models_service.list_models()
        return ModelListResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def get_model_types():
    """Get list of supported model types."""
    try:
        model_types = await models_service.get_supported_model_types()
        return {"model_types": model_types}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
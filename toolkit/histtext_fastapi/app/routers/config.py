"""Configuration management endpoints."""

from fastapi import APIRouter, HTTPException, Form
from pathlib import Path
from typing import Dict, Any

from ..schemas.config import ConfigCreateResponse, ConfigShowResponse
from ..services.config_service import ConfigService

router = APIRouter()
config_service = ConfigService()


@router.post("/create", response_model=ConfigCreateResponse)
async def create_config(config_path: str = Form(...)):
    """Create a default configuration file."""
    try:
        result = await config_service.create_default_config(Path(config_path))
        return ConfigCreateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/show", response_model=ConfigShowResponse)
async def show_config(config_path: str = Form(...)):
    """Show configuration details."""
    try:
        result = await config_service.show_config(Path(config_path))
        return ConfigShowResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/validate/{config_path:path}")
async def validate_config(config_path: str):
    """Validate a configuration file."""
    try:
        is_valid = await config_service.validate_config(Path(config_path))
        return {"valid": is_valid, "config_path": config_path}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
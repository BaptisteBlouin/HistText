"""Upload operations router."""

from fastapi import APIRouter, HTTPException, Form, UploadFile, File
from typing import List, Optional
from pathlib import Path
import tempfile

from ..schemas.upload import UploadResponse
from ..services.upload_service import UploadService

router = APIRouter()
upload_service = UploadService()


@router.post("/jsonl", response_model=UploadResponse)
async def upload_jsonl_files(
    collection: str = Form(...),
    jsonl_files: List[UploadFile] = File(...),
    schema: Optional[str] = Form(None),
    batch_size: int = Form(1000),
):
    """Upload JSONL files to Solr collection."""
    try:
        # Save uploaded files temporarily
        tmp_dir = tempfile.TemporaryDirectory()
        file_paths = []
        
        for file in jsonl_files:
            if not file.filename.endswith('.jsonl'):
                raise HTTPException(status_code=400, detail=f"File {file.filename} must be a JSONL file")
            
            file_path = Path(tmp_dir.name) / file.filename
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            file_paths.append(str(file_path))
        
        # Process upload
        result = await upload_service.upload_jsonl_files(
            collection=collection,
            file_paths=file_paths,
            schema=schema,
            batch_size=batch_size
        )
        
        # Cleanup
        tmp_dir.cleanup()
        
        return UploadResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ner", response_model=UploadResponse)
async def upload_ner_annotations(
    collection: str = Form(...),
    model_name: str = Form(...),
    solr_collection: str = Form(...),
    field: str = Form(...),
    batch_size: int = Form(1000),
):
    """Upload precomputed NER annotations to Solr."""
    try:
        result = await upload_service.upload_ner_annotations(
            collection=collection,
            model_name=model_name,
            solr_collection=solr_collection,
            field=field,
            batch_size=batch_size
        )
        
        return UploadResponse(**result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
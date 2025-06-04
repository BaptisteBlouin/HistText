# toolkit/histtext_fastapi/app/routers/upload.py (updated)
"""Enhanced upload operations router."""

from fastapi import APIRouter, HTTPException, Form, UploadFile, File
from fastapi.responses import HTMLResponse
from typing import List, Optional
from pathlib import Path
import tempfile
import os

from ..schemas.upload import UploadResponse
from ..services.upload_service import UploadService

router = APIRouter()
upload_service = UploadService()

@router.post("/jsonl")
async def upload_jsonl_files(
    collection: str = Form(...),
    jsonl_files: List[UploadFile] = File(...),
    schema: Optional[UploadFile] = File(None),
    batch_size: int = Form(1000),
):
    """Enhanced JSONL files upload with schema validation."""
    temp_dirs = []
    
    try:
        # Validate files
        for file in jsonl_files:
            if not file.filename.endswith('.jsonl'):
                return HTMLResponse(content=f"""
                <div class="bg-error-50 border border-error-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-error-800 mb-2">❌ Invalid File Type</h4>
                    <div class="text-sm text-error-700">File {file.filename} must be a JSONL file (.jsonl extension)</div>
                </div>
                """)
        
        # Save uploaded files temporarily
        tmp_dir = tempfile.TemporaryDirectory()
        temp_dirs.append(tmp_dir)
        file_paths = []
        
        for file in jsonl_files:
            file_path = Path(tmp_dir.name) / file.filename
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            file_paths.append(str(file_path))
        
        # Handle schema file
        schema_path = None
        if schema and schema.filename:
            if not schema.filename.endswith(('.yaml', '.yml', '.json')):
                return HTMLResponse(content=f"""
                <div class="bg-error-50 border border-error-200 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-error-800 mb-2">❌ Invalid Schema File</h4>
                    <div class="text-sm text-error-700">Schema file must be YAML (.yaml/.yml) or JSON (.json)</div>
                </div>
                """)
            
            schema_tmp_dir = tempfile.TemporaryDirectory()
            temp_dirs.append(schema_tmp_dir)
            schema_path = Path(schema_tmp_dir.name) / schema.filename
            
            with open(schema_path, "wb") as f:
                schema_content = await schema.read()
                f.write(schema_content)
            schema_path = str(schema_path)
        
        # Process upload with enhanced service
        result = await upload_service.upload_jsonl_files_with_schema(
            collection=collection,
            file_paths=file_paths,
            schema_path=schema_path,
            batch_size=batch_size
        )
        
        # Generate response HTML
        if result["status"] == "success":
            return HTMLResponse(content=f"""
            <div class="bg-success-50 border border-success-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-success-800 mb-2">✅ Upload Successful</h4>
                <div class="text-sm text-success-700 space-y-1">
                    <p><strong>Collection:</strong> {result["collection"]}</p>
                    <p><strong>Documents Uploaded:</strong> {result["uploaded_docs"]:,}</p>
                    <p><strong>Files Processed:</strong> {result["files_processed"]}</p>
                    <p><strong>Schema Validation:</strong> {'Enabled' if result["schema_used"] else 'Disabled'}</p>
                    <p><strong>Batch Size:</strong> {batch_size:,}</p>
                </div>
            </div>
            """)
        else:
            error_details = ""
            if "validation_errors" in result:
                error_details = "<div class='mt-2'><strong>Validation Errors:</strong><ul class='list-disc ml-4'>"
                for error in result["validation_errors"]:
                    if isinstance(error, dict) and "file" in error:
                        error_details += f"<li><strong>{error['file']}:</strong><ul class='list-disc ml-4'>"
                        for file_error in error.get("errors", []):
                            error_details += f"<li class='text-xs'>{file_error}</li>"
                        error_details += "</ul></li>"
                error_details += "</ul></div>"
            
            return HTMLResponse(content=f"""
            <div class="bg-error-50 border border-error-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-error-800 mb-2">❌ Upload Failed</h4>
                <div class="text-sm text-error-700">
                    <p>{result["message"]}</p>
                    {error_details}
                </div>
            </div>
            """)
        
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="bg-error-50 border border-error-200 rounded-lg p-4">
            <h4 class="text-sm font-medium text-error-800 mb-2">❌ Upload Error</h4>
            <div class="text-sm text-error-700">An unexpected error occurred: {str(e)}</div>
        </div>
        """)
    
    finally:
        # Cleanup temporary files
        for tmp_dir in temp_dirs:
            try:
                tmp_dir.cleanup()
            except:
                pass
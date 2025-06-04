# toolkit/histtext_fastapi/app/services/upload_service.py
"""Enhanced upload service with schema validation."""

import json
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional
import asyncio
import logging

from histtext_toolkit.solr.client import SolrClient
from histtext_toolkit.operations.upload import upload_jsonl_files
from ..core.config import get_settings

logger = logging.getLogger(__name__)

class UploadService:
    """Enhanced service for upload operations."""
    
    def __init__(self):
        self.settings = get_settings()
    
    async def upload_jsonl_files_with_schema(
        self, 
        collection: str, 
        file_paths: List[str], 
        schema_path: Optional[str] = None, 
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """Upload JSONL files with optional schema validation."""
        try:
            # Load and validate schema if provided
            schema = None
            if schema_path:
                schema = await self._load_schema(schema_path)
                if not schema:
                    return {
                        "status": "error",
                        "message": "Failed to load or parse schema file",
                        "uploaded_docs": 0
                    }
            
            # Validate files before upload
            validation_result = await self._validate_jsonl_files(file_paths, schema)
            if not validation_result["valid"]:
                return {
                    "status": "error",
                    "message": f"File validation failed: {validation_result['message']}",
                    "uploaded_docs": 0,
                    "validation_errors": validation_result.get("errors", [])
                }
            
            # Proceed with upload
            solr_client = SolrClient(
                self.settings.default_solr_host,
                self.settings.default_solr_port,
                None,
                None
            )
            
            await solr_client.start_session()
            
            try:
                total_docs = await upload_jsonl_files(
                    solr_client, collection, file_paths, schema_path, batch_size
                )
                
                return {
                    "status": "success",
                    "uploaded_docs": total_docs,
                    "collection": collection,
                    "files_processed": len(file_paths),
                    "schema_used": schema_path is not None,
                    "message": f"Successfully uploaded {total_docs} documents to {collection}"
                }
            finally:
                await solr_client.close_session()
                
        except Exception as e:
            logger.error(f"Upload failed: {str(e)}")
            return {
                "status": "error", 
                "message": f"Upload failed: {str(e)}",
                "uploaded_docs": 0
            }
    
    async def _load_schema(self, schema_path: str) -> Optional[Dict[str, Any]]:
        """Load schema file (YAML or JSON)."""
        try:
            schema_file = Path(schema_path)
            if not schema_file.exists():
                return None
            
            with open(schema_file, 'r', encoding='utf-8') as f:
                if schema_file.suffix.lower() in ['.yaml', '.yml']:
                    return yaml.safe_load(f)
                elif schema_file.suffix.lower() == '.json':
                    return json.load(f)
                else:
                    return None
        except Exception as e:
            logger.error(f"Failed to load schema: {str(e)}")
            return None
    
    async def _validate_jsonl_files(self, file_paths: List[str], schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Validate JSONL files structure and content."""
        errors = []
        total_lines = 0
        
        try:
            for file_path in file_paths:
                file_errors = []
                line_count = 0
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        line = line.strip()
                        if not line:
                            continue
                        
                        try:
                            doc = json.loads(line)
                            line_count += 1
                            
                            # Basic validation
                            if not isinstance(doc, dict):
                                file_errors.append(f"Line {line_num}: Document must be a JSON object")
                                continue
                            
                            # Schema validation if provided
                            if schema:
                                schema_errors = self._validate_document_against_schema(doc, schema)
                                if schema_errors:
                                    file_errors.extend([f"Line {line_num}: {error}" for error in schema_errors])
                        
                        except json.JSONDecodeError as e:
                            file_errors.append(f"Line {line_num}: Invalid JSON - {str(e)}")
                
                total_lines += line_count
                
                if file_errors:
                    errors.append({
                        "file": file_path,
                        "errors": file_errors
                    })
            
            return {
                "valid": len(errors) == 0,
                "message": f"Validated {total_lines} documents in {len(file_paths)} files",
                "errors": errors,
                "total_documents": total_lines
            }
            
        except Exception as e:
            return {
                "valid": False,
                "message": f"Validation failed: {str(e)}",
                "errors": [{"general": str(e)}]
            }
    
    def _validate_document_against_schema(self, doc: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
        """Validate a single document against schema."""
        errors = []
        
        # Check required fields
        required_fields = schema.get("required", [])
        for field in required_fields:
            if field not in doc:
                errors.append(f"Missing required field: {field}")
        
        # Check field types
        field_types = schema.get("properties", {})
        for field, type_def in field_types.items():
            if field in doc:
                expected_type = type_def.get("type")
                if expected_type and not self._check_field_type(doc[field], expected_type):
                    errors.append(f"Field '{field}' has incorrect type (expected {expected_type})")
        
        return errors
    
    def _check_field_type(self, value: Any, expected_type: str) -> bool:
        """Check if value matches expected type."""
        type_mapping = {
            "string": str,
            "integer": int,
            "number": (int, float),
            "boolean": bool,
            "array": list,
            "object": dict
        }
        
        expected_python_type = type_mapping.get(expected_type)
        if expected_python_type:
            return isinstance(value, expected_python_type)
        
        return True  # Unknown type, assume valid
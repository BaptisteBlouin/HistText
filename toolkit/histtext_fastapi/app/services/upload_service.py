"""Upload service."""

from typing import Dict, Any, List, Optional
from histtext_toolkit.solr.client import SolrClient
from histtext_toolkit.operations.upload import upload_jsonl_files, upload_precomputed_ner
from ..core.config import get_settings


class UploadService:
    """Service for upload operations."""
    
    def __init__(self):
        self.settings = get_settings()
    
    async def upload_jsonl_files(
        self, 
        collection: str, 
        file_paths: List[str], 
        schema: Optional[str] = None, 
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """Upload JSONL files to Solr."""
        solr_client = SolrClient(
            self.settings.default_solr_host,
            self.settings.default_solr_port,
            None,
            None
        )
        
        await solr_client.start_session()
        
        try:
            total_docs = await upload_jsonl_files(
                solr_client, collection, file_paths, schema, batch_size
            )
            
            return {
                "status": "success",
                "uploaded_docs": total_docs,
                "collection": collection,
                "message": f"Successfully uploaded {total_docs} documents"
            }
        finally:
            await solr_client.close_session()
    
    async def upload_ner_annotations(
        self,
        collection: str,
        model_name: str,
        solr_collection: str,
        field: str,
        batch_size: int = 1000
    ) -> Dict[str, Any]:
        """Upload precomputed NER annotations."""
        solr_client = SolrClient(
            self.settings.default_solr_host,
            self.settings.default_solr_port,
            None,
            None
        )
        
        await solr_client.start_session()
        
        try:
            cache_dir = str(self.settings.default_cache_dir)
            total_docs = await upload_precomputed_ner(
                solr_client, collection, cache_dir, model_name, 
                solr_collection, field, batch_size
            )
            
            return {
                "status": "success",
                "uploaded_docs": total_docs,
                "collection": collection,
                "message": f"Successfully uploaded {total_docs} NER annotations"
            }
        finally:
            await solr_client.close_session()
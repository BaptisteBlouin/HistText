"""Embeddings service."""

from typing import Dict, Any
from histtext_toolkit.core.config import ModelConfig, get_config
from histtext_toolkit.solr.client import SolrClient
from histtext_toolkit.operations.embeddings import compute_embeddings
from ..schemas.embeddings import EmbeddingsRequest


class EmbeddingsService:
    """Service for embeddings operations."""
    
    async def compute_embeddings(self, request: EmbeddingsRequest) -> Dict[str, Any]:
        """Compute embeddings for documents in a collection."""
        cfg = get_config()
        
        additional_params = {}
        if request.dim:
            additional_params["dim"] = request.dim
        
        model_config = ModelConfig(
            name=request.model_name,
            path=request.model_name,
            type=request.model_type,
            max_length=request.max_length,
            additional_params=additional_params
        )
        
        solr_client = SolrClient(
            cfg.solr.host, 
            cfg.solr.port, 
            cfg.solr.username, 
            cfg.solr.password
        )
        
        await solr_client.start_session()
        
        try:
            total_docs = await compute_embeddings(
                solr_client=solr_client,
                collection=request.collection,
                text_field=request.text_field,
                model_config=model_config,
                output_path=request.output_path,
                start=request.start,
                batch_size=request.batch_size,
                num_batches=request.num_batches,
                filter_query=request.filter_query,
                output_format=request.output_format,
                simplify_chinese=request.simplify_chinese,
                cache_dir=cfg.cache.root_dir if cfg.cache.enabled else None
            )
            
            return {
                "status": "success",
                "computed_docs": total_docs,
                "output_path": request.output_path,
                "model_name": request.model_name,
                "message": f"Successfully computed embeddings for {total_docs} documents"
            }
        finally:
            await solr_client.close_session()
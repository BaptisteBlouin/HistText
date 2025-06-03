"""Tokenization service."""

from typing import Dict, Any
from histtext_toolkit.core.config import ModelConfig, get_config
from histtext_toolkit.solr.client import SolrClient
from histtext_toolkit.operations.tokenize import cache_tokenization
from ..schemas.tokenize import TokenizeRequest


class TokenizeService:
    """Service for tokenization operations."""
    
    async def tokenize_collection(self, request: TokenizeRequest) -> Dict[str, Any]:
        """Tokenize documents in a collection."""
        cfg = get_config()
        
        model_config = ModelConfig(
            name=request.model_name,
            path=request.model_name,
            type=request.model_type,
            max_length=request.max_length
        )
        
        solr_client = SolrClient(
            cfg.solr.host, 
            cfg.solr.port, 
            cfg.solr.username, 
            cfg.solr.password
        )
        
        await solr_client.start_session()
        
        try:
            total_docs = await cache_tokenization(
                solr_client=solr_client,
                collection=request.collection,
                text_field=request.text_field,
                model_config=model_config,
                cache_dir=cfg.cache.root_dir,
                model_name=request.model_name,
                start=request.start,
                batch_size=request.batch_size,
                num_batches=request.num_batches,
                filter_query=request.filter_query,
                simplify_chinese=request.simplify_chinese
            )
            
            return {
                "status": "success",
                "tokenized_docs": total_docs,
                "collection": request.collection,
                "model_name": request.model_name,
                "message": f"Successfully tokenized {total_docs} documents"
            }
        finally:
            await solr_client.close_session()
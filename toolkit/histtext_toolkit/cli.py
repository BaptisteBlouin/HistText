"""Click-based CLI interface for the HistText Toolkit."""

import asyncio
import sys
from pathlib import Path
from typing import List, Optional

import click

from .core.config import Config, get_config, load_config, create_default_config
from .core.logging import setup_logging, get_logger

logger = get_logger(__name__)


# Common options that can be reused across commands
def common_options(f):
    """Decorator for common CLI options."""
    f = click.option(
        '-c', '--config',
        type=click.Path(exists=True, path_type=Path),
        help='Path to the configuration file'
    )(f)
    f = click.option(
        '-l', '--log-level',
        type=click.Choice(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']),
        default='INFO',
        help='Logging level'
    )(f)
    f = click.option(
        '--solr-host',
        default='localhost',
        help='Solr host (overrides config)'
    )(f)
    f = click.option(
        '--solr-port',
        type=int,
        default=8983,
        help='Solr port (overrides config)'
    )(f)
    f = click.option(
        '--cache-dir',
        type=click.Path(path_type=Path),
        help='Cache directory (overrides config)'
    )(f)
    return f


def setup_config_and_logging(config_path: Optional[Path], log_level: str, 
                            solr_host: str, solr_port: int, cache_dir: Optional[Path]) -> Config:
    """Setup configuration and logging for CLI commands."""
    # Setup logging first
    setup_logging(log_level)
    
    # Load or create configuration
    if config_path:
        config = load_config(config_path)
    else:
        config = get_config()
    
    # Override with CLI parameters if provided
    if solr_host != 'localhost' or solr_port != 8983:
        config.solr.host = solr_host
        config.solr.port = solr_port
        logger.info(f"Using Solr at {solr_host}:{solr_port}")
    
    if cache_dir:
        config.cache.root_dir = str(cache_dir)
        logger.info(f"Using cache directory: {cache_dir}")
    
    return config


# Main CLI group
@click.group()
@click.version_option(version="1.1.0", prog_name="histtext-toolkit")
@click.pass_context
def cli(ctx):
    """HistText Toolkit - A toolkit for working with historical texts in Apache Solr."""
    ctx.ensure_object(dict)


# Config management commands
@cli.group()
def config():
    """Configuration management commands."""
    pass


@config.command()
@click.argument('config_path', type=click.Path(path_type=Path))
def create(config_path: Path):
    """Create a default configuration file."""
    try:
        config = create_default_config(config_path)
        click.echo(f"Created default configuration at {config_path}")
        click.echo(f"Solr URL: {config.solr.url}")
        click.echo(f"Cache directory: {config.cache.root_dir}")
        click.echo(f"Models configured: {len(config.models)}")
    except Exception as e:
        click.echo(f"Error creating configuration: {e}", err=True)
        sys.exit(1)


@config.command()
@click.option('-c', '--config', type=click.Path(exists=True, path_type=Path), required=True)
def show(config: Path):
    """Show current configuration."""
    try:
        cfg = load_config(config)
        click.echo("Configuration:")
        click.echo(f"  Solr: {cfg.solr.url}")
        click.echo(f"  Cache: {cfg.cache.root_dir} (enabled: {cfg.cache.enabled})")
        click.echo(f"  Models directory: {cfg.models_dir}")
        click.echo(f"  Models ({len(cfg.models)}):")
        for name, model in cfg.models.items():
            click.echo(f"    {name}: {model.type} ({model.path})")
    except Exception as e:
        click.echo(f"Error loading configuration: {e}", err=True)
        sys.exit(1)


# Upload commands
@cli.command()
@common_options
@click.argument('collection')
@click.argument('jsonl_files', nargs=-1, required=True)
@click.option('--schema', type=click.Path(exists=True, path_type=Path), help='Path to the schema file')
@click.option('-b', '--batch-size', type=int, default=1000, help='Number of documents per batch')
def upload(config, log_level, solr_host, solr_port, cache_dir, collection, jsonl_files, schema, batch_size):
    """Upload JSONL files to Solr collection."""
    async def _upload():
        from .operations.upload import upload_jsonl_files
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            total_docs = await upload_jsonl_files(
                solr_client, collection, list(jsonl_files), str(schema) if schema else None, batch_size
            )
            click.echo(f"Successfully uploaded {total_docs} documents to {collection}")
        finally:
            await solr_client.close_session()
    
    asyncio.run(_upload())


@cli.command()
@common_options
@click.argument('collection')
@click.argument('model_name')
@click.argument('solr_collection')
@click.argument('field')
@click.option('-b', '--batch-size', type=int, default=1000, help='Number of documents per batch')
def upload_ner(config, log_level, solr_host, solr_port, cache_dir, collection, model_name, solr_collection, field, batch_size):
    """Upload precomputed NER annotations to Solr."""
    async def _upload_ner():
        from .operations.upload import upload_precomputed_ner
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        if not cfg.cache.enabled:
            click.echo("Cache is not enabled in the configuration", err=True)
            sys.exit(1)
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            total_docs = await upload_precomputed_ner(
                solr_client, collection, cfg.cache.root_dir, model_name, solr_collection, field, batch_size
            )
            click.echo(f"Successfully uploaded {total_docs} NER annotations to {collection}")
        finally:
            await solr_client.close_session()
    
    asyncio.run(_upload_ner())


# NER commands
@cli.command()
@common_options
@click.argument('collection')
@click.option('--model-name', required=True, help='Name or path of the model to use')
@click.option('--model-type', 
              type=click.Choice(['transformers', 'gliner', 'spacy', 'flair', 'nuner', 
                               'llm_ner', 'llama_ner', 'mistral_ner', 'qwen_ner', 'stanza',
                               'fastnlp', 'fasthan', 'lac', 'multilingual']),
              default='transformers', help='Type of model')
@click.option('--text-field', default='text', help='Field containing the text')
@click.option('--entity-types', multiple=True, help='Entity types to extract')
@click.option('--max-length', type=int, help='Maximum sequence length for the model')
@click.option('--aggregation-strategy', 
              type=click.Choice(['none', 'simple', 'first', 'max', 'average']),
              default='simple', help='Aggregation strategy for tokens')
@click.option('--threshold', type=float, default=0.5, help='Confidence threshold')
@click.option('--start', type=int, default=0, help='Start index')
@click.option('-b', '--batch-size', type=int, default=10000, help='Number of documents per batch')
@click.option('-n', '--num-batches', type=int, help='Maximum number of batches to process')
@click.option('-f', '--filter-query', help='Filter query')
@click.option('-p', '--jsonl-prefix', help='Prefix for the JSONL file name')
@click.option('-d', '--decimal-precision', type=int, help='Number of decimal places for confidence values')
@click.option('--format', type=click.Choice(['flat', 'standard']), default='flat', help='Output format type')
@click.option('--use-gpu', is_flag=True, help='Force GPU usage')
@click.option('--optimization-level', type=click.IntRange(0, 2), default=1, help='Optimization level')
@click.option('--compact-labels/--full-labels', default=True, help='Use compact labels')
@click.option('--label-stats', is_flag=True, help='Show label distribution statistics')
def ner(config, log_level, solr_host, solr_port, cache_dir, collection, model_name, model_type,
        text_field, entity_types, max_length, aggregation_strategy, threshold, start, batch_size,
        num_batches, filter_query, jsonl_prefix, decimal_precision, format, use_gpu,
        optimization_level, compact_labels, label_stats):
    """Run Named Entity Recognition on a collection."""
    async def _ner():
        from .operations.ner import precompute_ner
        from .core.config import ModelConfig
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        if not cfg.cache.enabled:
            click.echo("Cache is not enabled in the configuration", err=True)
            sys.exit(1)
        
        # Create model config - AVOID DUPLICATE PARAMETERS
        additional_params = {}
        
        # Only add parameters that aren't already in the ModelConfig constructor
        if threshold != 0.5:
            additional_params["threshold"] = threshold
        if use_gpu:
            additional_params["use_gpu"] = True
        if optimization_level != 1:
            additional_params["optimization_level"] = optimization_level
        
        # Create model config with explicit parameters
        model_config = ModelConfig(
            name=model_name,
            path=model_name,
            type=model_type,
            max_length=max_length,
            additional_params=additional_params  # Don't include aggregation_strategy here
        )
        
        # Fix entity_types - convert empty list to None
        entity_types_list = list(entity_types) if entity_types else None
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            total_docs = await precompute_ner(
                solr_client, collection, text_field, model_config, cfg.cache.root_dir,
                model_name, start, batch_size, num_batches, filter_query, entity_types_list,
                jsonl_prefix, decimal_precision, format, compact_labels, label_stats
            )
            click.echo(f"Processed {total_docs} documents for NER")
        finally:
            await solr_client.close_session()
        
    asyncio.run(_ner())


@cli.command()
@common_options
@click.option('--model-name', required=True, help='Model to test')
@click.option('--model-type', default='transformers', help='Type of model')
@click.option('--text', help='Text to analyze')
@click.option('--entity-types', multiple=True, help='Entity types to extract')
def test_ner(config, log_level, solr_host, solr_port, cache_dir, model_name, model_type, text, entity_types):
    """Test NER with sample text."""
    async def _test_ner():
        from .main import test_ner_command
        import argparse
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        # Create args namespace for compatibility
        args = argparse.Namespace(
            model_name=model_name,
            model_type=model_type,
            text=text,
            entity_types=list(entity_types) if entity_types else None
        )
        
        await test_ner_command(args)
    
    asyncio.run(_test_ner())


# Tokenization commands
@cli.command()
@common_options
@click.argument('collection')
@click.option('--model-name', help='Name or path of the model to use')
@click.option('--text-field', default='text', help='Field containing the text to tokenize')
@click.option('--model-type', 
              type=click.Choice(['spacy', 'transformers', 'chinese_segmenter']),
              default='transformers', help='Type of model')
@click.option('--max-length', type=int, help='Override maximum sequence length for the model')
@click.option('--start', type=int, default=0, help='Start index')
@click.option('-b', '--batch-size', type=int, default=1000, help='Number of documents per batch')
@click.option('-n', '--num-batches', type=int, help='Maximum number of batches to process')
@click.option('-f', '--filter-query', help='Filter query')
@click.option('--simplify-chinese', is_flag=True, help='Convert traditional Chinese to simplified')
def tokenize_solr(config, log_level, solr_host, solr_port, cache_dir, collection, model_name,
                  text_field, model_type, max_length, start, batch_size, num_batches,
                  filter_query, simplify_chinese):
    """Tokenize documents from a Solr collection and cache results."""
    async def _tokenize():
        from .operations.tokenize import cache_tokenization
        from .core.config import ModelConfig
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        if not model_name:
            click.echo("Model name is required", err=True)
            sys.exit(1)
        
        model_config = ModelConfig(
            name=model_name,
            path=model_name,
            type=model_type,
            max_length=max_length
        )
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            total_docs = await cache_tokenization(
                solr_client, collection, text_field, model_config, cfg.cache.root_dir,
                model_name, start, batch_size, num_batches, filter_query, simplify_chinese
            )
            click.echo(f"Tokenized {total_docs} documents")
        finally:
            await solr_client.close_session()
    
    asyncio.run(_tokenize())


# Embeddings commands group
@cli.group()
def embeddings():
    """Text embedding operations."""
    pass


@embeddings.command(name='compute')
@common_options
@click.argument('collection')
@click.argument('output_path', type=click.Path(path_type=Path))
@click.option('--model-name', help='Name or path of the model to use')
@click.option('--text-field', default='text', help='Field containing the text to embed')
@click.option('--model-type', 
              type=click.Choice(['fasttext', 'word2vec', 'sentence_transformers']),
              default='fasttext', help='Type of model')
@click.option('--dim', type=int, help='Dimension of embeddings (for models that need it)')
@click.option('--max-length', type=int, help='Maximum sequence length for the model')
@click.option('--output-format', 
              type=click.Choice(['vec', 'txt', 'binary', 'json']),
              default='vec', help='Format to save embeddings')
@click.option('--start', type=int, default=0, help='Start index')
@click.option('-b', '--batch-size', type=int, default=1000, help='Number of documents per batch')
@click.option('-n', '--num-batches', type=int, help='Maximum number of batches to process')
@click.option('-f', '--filter-query', help='Filter query')
@click.option('--simplify-chinese', is_flag=True, help='Convert traditional Chinese to simplified')
def compute_embeddings(config, log_level, solr_host, solr_port, cache_dir, collection, output_path,
                      model_name, text_field, model_type, dim, max_length, output_format,
                      start, batch_size, num_batches, filter_query, simplify_chinese):
    """Compute embeddings for documents in a Solr collection."""
    async def _compute():
        from .operations.embeddings import compute_embeddings
        from .core.config import ModelConfig
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        if not model_name:
            click.echo("Model name is required", err=True)
            sys.exit(1)
        
        # Create model config
        additional_params = {}
        if dim:
            additional_params["dim"] = dim
        
        model_config = ModelConfig(
            name=model_name,
            path=model_name,
            type=model_type,
            max_length=max_length,
            additional_params=additional_params
        )
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            total_docs = await compute_embeddings(
                solr_client, collection, text_field, model_config, str(output_path),
                start, batch_size, num_batches, filter_query, output_format, simplify_chinese,
                cfg.cache.root_dir if cfg.cache.enabled else None
            )
            click.echo(f"Computed embeddings for {total_docs} documents")
            click.echo(f"Saved to: {output_path}")
        finally:
            await solr_client.close_session()
    
    asyncio.run(_compute())


@embeddings.command(name='compute-word')
@common_options
@click.argument('collection')
@click.argument('output_path', type=click.Path(path_type=Path))
@click.option('--text-field', default='text', help='Field containing the text')
@click.option('--method', 
              type=click.Choice(['word2vec', 'fasttext']),
              default='word2vec', help='Word embedding method')
@click.option('--dim', type=int, default=100, help='Dimension of word embeddings')
@click.option('--window', type=int, default=5, help='Context window size')
@click.option('--min-count', type=int, default=5, help='Minimum word count')
@click.option('--workers', type=int, default=4, help='Number of worker threads')
@click.option('--output-format', 
              type=click.Choice(['txt', 'vec', 'bin', 'gensim']),
              default='txt', help='Format to save word embeddings')
@click.option('--batch-size', type=int, default=1000, help='Number of documents per batch')
@click.option('-f', '--filter-query', help='Filter query')
@click.option('--simplify-chinese', is_flag=True, help='Convert traditional Chinese to simplified')
@click.option('--auto-configure', is_flag=True, help='Automatically configure parameters based on collection characteristics')
@click.option('--no-header', is_flag=True, default=False, help='Exclude vocabulary size and dimension header from text output formats')
def compute_word_embeddings(config, log_level, solr_host, solr_port, cache_dir, collection, output_path,
                           text_field, method, dim, window, min_count, workers, output_format,
                           batch_size, filter_query, simplify_chinese, auto_configure, no_header):
    """Compute word embeddings from a Solr collection."""
    async def _compute_word():
        from .operations.embeddings import compute_word_embeddings, auto_configure_embedding_params
        from .core.config import ModelConfig
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            # Auto-configure parameters if requested
            method_local = method
            dim_local = dim
            window_local = window
            min_count_local = min_count
            workers_local = workers

            if auto_configure:
                click.echo("Auto-configuring word embedding parameters...")
                params = await auto_configure_embedding_params(solr_client, collection, text_field)
                # Override with auto-configured values
                method_local = params.get('method', method_local)
                dim_local = params.get('dim', dim_local)
                window_local = params.get('window', window_local)
                min_count_local = params.get('min_count', min_count_local)
                workers_local = params.get('workers', workers_local)
                click.echo(f"Auto-configured: method={method_local}, dim={dim_local}, window={window_local}, min_count={min_count_local}, workers={workers_local}")

            
            # Create model config for word embeddings
            model_config = ModelConfig(
                name="word_embeddings",
                path="",
                type="word_embeddings",
                additional_params={
                    "method": method,
                    "dim": dim,
                    "window": window,
                    "min_count": min_count,
                    "workers": workers,
                }
            )
            
            success = await compute_word_embeddings(
                solr_client, collection, text_field, model_config, str(output_path),
                batch_size, filter_query, output_format, simplify_chinese, not no_header
            )
            
            if success:
                click.echo(f"Successfully computed word embeddings")
                click.echo(f"Saved to: {output_path}")
            else:
                click.echo("Failed to compute word embeddings", err=True)
                sys.exit(1)
                
        finally:
            await solr_client.close_session()
    
    asyncio.run(_compute_word())


@embeddings.command(name='semantic-search')
@common_options
@click.argument('collection')
@click.argument('query')
@click.option('--model-name', help='Name or path of the model to use')
@click.option('--text-field', default='text', help='Field containing the text to search')
@click.option('--model-type', 
              type=click.Choice(['fasttext', 'word2vec', 'sentence_transformers']),
              default='fasttext', help='Type of model')
@click.option('--top-k', type=int, default=10, help='Number of top results to return')
@click.option('-f', '--filter-query', help='Filter query')
@click.option('--simplify-chinese', is_flag=True, help='Convert traditional Chinese to simplified')
def semantic_search(config, log_level, solr_host, solr_port, cache_dir, collection, query,
                   model_name, text_field, model_type, top_k, filter_query, simplify_chinese):
    """Search documents in a collection using semantic similarity."""
    async def _search():
        from .operations.embeddings import compute_and_compare_embeddings
        from .core.config import ModelConfig
        from .solr.client import SolrClient
        
        cfg = setup_config_and_logging(config, log_level, solr_host, solr_port, cache_dir)
        
        if not model_name:
            click.echo("Model name is required", err=True)
            sys.exit(1)
        
        model_config = ModelConfig(
            name=model_name,
            path=model_name,
            type=model_type
        )
        
        solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
        await solr_client.start_session()
        
        try:
            results = await compute_and_compare_embeddings(
                solr_client, collection, query, text_field, model_config,
                top_k, filter_query, simplify_chinese
            )
            
            click.echo(f"Top {len(results)} documents similar to query:")
            for i, result in enumerate(results):
                click.echo(f"\n{i+1}. Document: {result['id']}")
                click.echo(f"   Similarity: {result['similarity']:.4f}")
                
                # Print a snippet of the text
                text = result["text"]
                max_snippet_length = 100
                snippet = text[:max_snippet_length] + "..." if len(text) > max_snippet_length else text
                click.echo(f"   Text: {snippet}")
                
        finally:
            await solr_client.close_session()
    
    asyncio.run(_search())


# Utility commands
@cli.command()
def list_models():
    """List available model types."""
    try:
        from .models.registry import get_available_model_types
        
        models = get_available_model_types()
        
        click.echo("Available model types and tasks:")
        for model_type, tasks in models.items():
            click.echo(f"  {model_type}: {', '.join(tasks)}")
        
        # Show configured models if config is available
        try:
            cfg = get_config()
            if cfg.models:
                click.echo("\nConfigured models:")
                for model_name, model_config in cfg.models.items():
                    click.echo(f"  {model_name} ({model_config.type}): {model_config.path}")
        except:
            pass
            
    except Exception as e:
        click.echo(f"Error listing models: {e}", err=True)


def main_cli():
    """Entry point for the command-line interface."""
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    cli()


if __name__ == "__main__":
    main_cli()
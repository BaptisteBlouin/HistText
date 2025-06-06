"""Main entry point for the HistText Toolkit.

This module provides a command-line interface for the toolkit.
"""

import argparse
import asyncio
import glob
import sys

from .core.config import (
    CacheConfig,
    Config,
    ModelConfig,
    SolrConfig,
    get_config,
    load_config,
)
from .core.logging import get_logger, setup_logging

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        argparse.Namespace: Parsed arguments.

    """
    parser = argparse.ArgumentParser(description="HistText Toolkit - A toolkit for working with historical texts in Apache Solr")

    # Global options
    parser.add_argument("-c", "--config", help="Path to the configuration file")
    parser.add_argument(
        "-l",
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging level",
    )
    parser.add_argument("--solr-host", default="localhost", help="Solr host")
    parser.add_argument("--solr-port", type=int, default=8983, help="Solr port")
    parser.add_argument("--cache-dir", default="./cache", help="Cache directory")

    # Subcommands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    examine_parser = subparsers.add_parser("examine-jsonl", help="Examine the content of JSONL files")
    examine_parser.add_argument("files", nargs="+", help="JSONL files to examine")
    examine_parser.add_argument("-n", "--num-docs", type=int, default=1, help="Number of documents to examine")

    # Upload command
    upload_parser = subparsers.add_parser("upload", help="Upload documents to Solr")
    upload_parser.add_argument("collection", help="Name of the collection")
    upload_parser.add_argument("jsonl_files", nargs="+", help="JSONL files to upload (glob patterns supported)")
    upload_parser.add_argument("--schema", help="Path to the schema file")
    upload_parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=1000,
        help="Number of documents per batch",
    )

    # Upload precomputed NER command
    upload_ner_parser = subparsers.add_parser("upload-ner", help="Upload precomputed NER annotations to Solr")
    upload_ner_parser.add_argument("collection", help="Name of the target collection")
    upload_ner_parser.add_argument("model_name", help="Name of the model")
    upload_ner_parser.add_argument("solr_collection", help="Name of the source collection")
    upload_ner_parser.add_argument("field", help="Field name")
    upload_ner_parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=1000,
        help="Number of documents per batch",
    )

    # Precompute NER command
    precompute_parser = subparsers.add_parser("precompute-ner", help="Precompute NER annotations for a collection")
    precompute_parser.add_argument("collection", help="Name of the collection")
    precompute_parser.add_argument("--model-name", help="Name or path of the model to use")
    precompute_parser.add_argument("--cache-model-name", help="Name to use for the model in the cache hierarchy")
    precompute_parser.add_argument("--text-field", default="text", help="Field containing the text")
    precompute_parser.add_argument(
        "--model-type",
        default="transformers",
        choices=["spacy", "transformers", "gliner"],
        help="Type of model",
    )
    precompute_parser.add_argument("--max-length", type=int, help="Maximum sequence length for the model")
    precompute_parser.add_argument(
        "--aggregation-strategy",
        default="FIRST",
        choices=["NONE", "SIMPLE", "FIRST", "MAX", "AVERAGE"],
        help="Aggregation strategy for tokens",
    )
    precompute_parser.add_argument("--start", type=int, default=0, help="Start index")
    precompute_parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=10000,
        help="Number of documents per batch",
    )
    precompute_parser.add_argument("-n", "--num-batches", type=int, help="Maximum number of batches to process")
    precompute_parser.add_argument("-f", "--filter-query", help="Filter query")
    precompute_parser.add_argument("-p", "--jsonl-prefix", help="Prefix for the JSONL file name")
    precompute_parser.add_argument("-s", "--shorten", action="store_true", help="Use shortened field names")
    precompute_parser.add_argument(
        "-d",
        "--decimal-precision",
        type=int,
        help="Number of decimal places for confidence values",
    )
    precompute_parser.add_argument(
        "--format",
        default="flat",
        choices=["default", "flat"],
        help="Format type ('default' or 'flat')",
    )

    # Tokenize CSV command
    tokenize_csv_parser = subparsers.add_parser("tokenize-csv", help="Tokenize text in a CSV file")
    tokenize_csv_parser.add_argument("model_name", help="Name of the model")
    tokenize_csv_parser.add_argument("input_file", help="Input CSV file path")
    tokenize_csv_parser.add_argument("output_file", help="Output CSV file path")
    tokenize_csv_parser.add_argument("--text-column", default="Text", help="Column containing the text")
    tokenize_csv_parser.add_argument(
        "--simplify-chinese",
        action="store_true",
        help="Convert traditional Chinese to simplified",
    )

    # Tokenize text command
    tokenize_text_parser = subparsers.add_parser("tokenize-text", help="Tokenize a text string")
    tokenize_text_parser.add_argument("model_name", help="Name of the model")
    tokenize_text_parser.add_argument("text", help="Text to tokenize")
    tokenize_text_parser.add_argument(
        "--simplify-chinese",
        action="store_true",
        help="Convert traditional Chinese to simplified",
    )

    # Tokenize Solr command
    tokenize_solr_parser = subparsers.add_parser(
        "tokenize-solr",
        help="Tokenize documents from a Solr collection and cache results",
    )
    tokenize_solr_parser.add_argument("collection", help="Name of the source collection")
    tokenize_solr_parser.add_argument("--model-name", help="Name or path of the model to use")
    tokenize_solr_parser.add_argument("--text-field", default="text", help="Field containing the text to tokenize")
    tokenize_solr_parser.add_argument(
        "--model-type",
        default="transformers",
        choices=["spacy", "transformers", "chinese_segmenter"],
        help="Type of model",
    )
    tokenize_solr_parser.add_argument("--max-length", type=int, help="Override maximum sequence length for the model")
    tokenize_solr_parser.add_argument("--start", type=int, default=0, help="Start index")
    tokenize_solr_parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=1000,
        help="Number of documents per batch",
    )
    tokenize_solr_parser.add_argument("-n", "--num-batches", type=int, help="Maximum number of batches to process")
    tokenize_solr_parser.add_argument("-f", "--filter-query", help="Filter query")
    tokenize_solr_parser.add_argument(
        "--simplify-chinese",
        action="store_true",
        help="Convert traditional Chinese to simplified",
    )

    # Compute embeddings command
    compute_embeddings_parser = subparsers.add_parser(
        "compute-embeddings",
        help="Compute embeddings for documents in a Solr collection",
    )
    compute_embeddings_parser.add_argument("collection", help="Name of the source collection")
    compute_embeddings_parser.add_argument("output_path", help="Path to save the embeddings file")
    compute_embeddings_parser.add_argument("--model-name", help="Name or path of the model to use")
    compute_embeddings_parser.add_argument("--text-field", default="text", help="Field containing the text to embed")
    compute_embeddings_parser.add_argument(
        "--model-type",
        default="fasttext",
        choices=["fasttext", "word2vec", "sentence_transformers"],
        help="Type of model",
    )
    compute_embeddings_parser.add_argument("--dim", type=int, help="Dimension of embeddings (for models that need it)")
    compute_embeddings_parser.add_argument("--max-length", type=int, help="Maximum sequence length for the model")
    compute_embeddings_parser.add_argument(
        "--output-format",
        default="vec",
        choices=["vec", "txt", "binary", "json"],
        help="Format to save embeddings",
    )
    compute_embeddings_parser.add_argument("--start", type=int, default=0, help="Start index")
    compute_embeddings_parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=1000,
        help="Number of documents per batch",
    )
    compute_embeddings_parser.add_argument("-n", "--num-batches", type=int, help="Maximum number of batches to process")
    compute_embeddings_parser.add_argument("-f", "--filter-query", help="Filter query")
    compute_embeddings_parser.add_argument(
        "--simplify-chinese",
        action="store_true",
        help="Convert traditional Chinese to simplified",
    )

    # Semantic search command
    semantic_search_parser = subparsers.add_parser(
        "semantic-search",
        help="Search documents in a collection using semantic similarity",
    )
    semantic_search_parser.add_argument("collection", help="Name of the collection")
    semantic_search_parser.add_argument("query", help="Query text")
    semantic_search_parser.add_argument("--model-name", help="Name or path of the model to use")
    semantic_search_parser.add_argument("--text-field", default="text", help="Field containing the text to search")
    semantic_search_parser.add_argument(
        "--model-type",
        default="fasttext",
        choices=["fasttext", "word2vec", "sentence_transformers"],
        help="Type of model",
    )
    semantic_search_parser.add_argument("--top-k", type=int, default=10, help="Number of top results to return")
    semantic_search_parser.add_argument("-f", "--filter-query", help="Filter query")
    semantic_search_parser.add_argument(
        "--simplify-chinese",
        action="store_true",
        help="Convert traditional Chinese to simplified",
    )

    # Compute word embeddings command
    compute_word_embeddings_parser = subparsers.add_parser("compute-word-embeddings", help="Compute word embeddings from a Solr collection")
    compute_word_embeddings_parser.add_argument("collection", help="Name of the source collection")
    compute_word_embeddings_parser.add_argument("output_path", help="Path to save the word embeddings file")
    compute_word_embeddings_parser.add_argument("--text-field", default="text", help="Field containing the text")
    compute_word_embeddings_parser.add_argument(
        "--method",
        default="word2vec",
        choices=["word2vec", "fasttext"],
        help="Word embedding method",
    )
    compute_word_embeddings_parser.add_argument("--dim", type=int, default=100, help="Dimension of word embeddings")
    compute_word_embeddings_parser.add_argument("--window", type=int, default=5, help="Context window size")
    compute_word_embeddings_parser.add_argument("--min-count", type=int, default=5, help="Minimum word count")
    compute_word_embeddings_parser.add_argument("--workers", type=int, default=4, help="Number of worker threads")
    compute_word_embeddings_parser.add_argument(
        "--output-format",
        default="txt",
        choices=["txt", "vec", "bin", "gensim"],
        help="Format to save word embeddings",
    )
    compute_word_embeddings_parser.add_argument("--batch-size", type=int, default=1000, help="Number of documents per batch")
    compute_word_embeddings_parser.add_argument("-f", "--filter-query", help="Filter query")
    compute_word_embeddings_parser.add_argument(
        "--simplify-chinese",
        action="store_true",
        help="Convert traditional Chinese to simplified",
    )
    compute_word_embeddings_parser.add_argument(
        "--auto-configure",
        action="store_true",
        help="Automatically configure parameters based on collection characteristics",
    )
    compute_word_embeddings_parser.add_argument(
        "--no-header",
        action="store_true",
        default=False,
        help="Exclude the vocabulary size and dimension header from text output formats",
    )

    # Store list_models_parser but don't use it (fixing the F841 warning)
    subparsers.add_parser("list-models", help="List available model types and tasks")

    args = parser.parse_args()
    logger.debug(f"Parsed command: {args.command}")
    return args


async def main():
    """Run the main entry point for the HistText Toolkit.

    Parses command-line arguments, sets up configuration, and executes
    the requested command. Handles errors and resource cleanup.
    """
    # Parse arguments
    args = parse_args()

    # Set up logging
    setup_logging(args.log_level)

    # Initialize solr_client as None to avoid reference errors
    solr_client = None

    try:
        # Load or create configuration
        config = None

        if args.config:
            # Load from config file
            load_config(args.config)
            config = get_config()
        else:
            # Create a new config object directly
            solr_config = SolrConfig(host=args.solr_host, port=args.solr_port)
            cache_config = CacheConfig(root_dir=args.cache_dir, enabled=True)
            config = Config(solr=solr_config, models_dir="./models", cache=cache_config, models={})

            # Set this config for modules that use get_config()
            import histtext_toolkit.core.config

            histtext_toolkit.core.config._config = config

            logger.info(f"Using Solr at {args.solr_host}:{args.solr_port}")
            logger.info(f"Using cache directory: {args.cache_dir}")

        # Make sure config.models is initialized
        if config.models is None:
            config.models = {}

        # Execute command based on args.command
        if args.command == "upload":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Expand glob patterns in jsonl_files
            expanded_files = []
            for pattern in args.jsonl_files:
                files = glob.glob(pattern)
                if files:
                    expanded_files.extend(files)
                else:
                    logger.warning(f"No files found matching pattern: {pattern}")

            if not expanded_files:
                logger.error("No files to upload")
                return

            # Import and call upload_jsonl_files
            from .operations.upload import upload_jsonl_files

            await upload_jsonl_files(
                solr_client,
                args.collection,
                expanded_files,
                args.schema,
                args.batch_size,
            )

        elif args.command == "upload-ner":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Check cache configuration
            if not config.cache or not config.cache.enabled:
                logger.error("Cache is not enabled in the configuration")
                return

            # Upload precomputed NER
            from .operations.upload import upload_precomputed_ner

            await upload_precomputed_ner(
                solr_client,
                args.collection,
                config.cache.root_dir,
                args.model_name,
                args.solr_collection,
                args.field,
                args.batch_size,
            )

        elif args.command == "precompute-ner":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Create on-the-fly model config if model_name is provided
            if args.model_name:
                # Check if model already exists in config
                model_exists = args.model_name in config.models

                if not model_exists:
                    # Create a model config from the command line arguments
                    model_config = ModelConfig(
                        name=args.model_name,
                        path=args.model_name,
                        type=args.model_type,
                        max_length=args.max_length,
                        aggregation_strategy=args.aggregation_strategy,
                    )

                    # Add to config
                    config.models[args.model_name] = model_config
                    logger.debug(f"Created on-the-fly model config for {args.model_name}")

            # Check cache configuration
            if not config.cache or not config.cache.enabled:
                logger.error("Cache is not enabled in the configuration")
                return

            # Choose model name
            model_name = args.model_name

            # Check if model exists in config
            if not model_name or model_name not in config.models:
                logger.error(f"Model '{model_name}' not found in configuration and no model parameters provided")
                return

            # Use cache_model_name if provided, otherwise use model_name
            cache_model_name = args.cache_model_name or model_name

            # Import and call precompute_ner
            from .operations.ner import precompute_ner

            await precompute_ner(
                solr_client,
                args.collection,
                args.text_field,
                config.models[model_name],
                config.cache.root_dir,
                cache_model_name,
                args.start,
                args.batch_size,
                args.num_batches,
                args.filter_query,
                args.jsonl_prefix,
                args.shorten,
                args.decimal_precision,
                args.format,
            )
        elif args.command == "compute-word-embeddings":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Check for auto-configure flag
            if args.auto_configure:
                from .operations.embeddings import auto_configure_embedding_params

                logger.info("Auto-configuring word embedding parameters...")
                params = await auto_configure_embedding_params(solr_client, args.collection, args.text_field)

                # Override command-line arguments with auto-configured values
                for param_name, value in params.items():
                    if hasattr(args, param_name):
                        setattr(args, param_name, value)
                        logger.info(f"Auto-configured {param_name} = {value}")

            # Create a model config for word embeddings
            model_config = ModelConfig(
                name="word_embeddings",
                path="",
                type="word_embeddings",
                additional_params={
                    "method": args.method,
                    "dim": args.dim,
                    "window": args.window,
                    "min_count": args.min_count,
                    "workers": args.workers,
                },
            )

            # Import and call compute_word_embeddings
            from .operations.embeddings import compute_word_embeddings

            await compute_word_embeddings(
                solr_client,
                args.collection,
                args.text_field,
                model_config,
                args.output_path,
                args.batch_size,
                args.filter_query,
                args.output_format,
                args.simplify_chinese,
                not args.no_header,
            )

        elif args.command == "compute-embeddings":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Create on-the-fly model config if model_name is provided
            if args.model_name:
                # Check if model already exists in config
                model_exists = args.model_name in config.models

                if not model_exists:
                    # Create a model config from the command line arguments
                    model_config = ModelConfig(
                        name=args.model_name,
                        path=args.model_name,
                        type=args.model_type,
                        max_length=args.max_length,
                        additional_params={"dim": args.dim} if args.dim else None,
                    )

                    # Add to config
                    config.models[args.model_name] = model_config
                    logger.debug(f"Created on-the-fly model config for {args.model_name}")

            # Choose model name
            model_name = args.model_name

            # Check if model exists in config
            if not model_name or model_name not in config.models:
                logger.error(f"Model '{model_name}' not found in configuration and no model parameters provided")
                return

            # Import and call compute_embeddings
            from .operations.embeddings import compute_embeddings

            await compute_embeddings(
                solr_client,
                args.collection,
                args.text_field,
                config.models[model_name],
                args.output_path,
                args.start,
                args.batch_size,
                args.num_batches,
                args.filter_query,
                args.output_format,
                args.simplify_chinese,
                (config.cache.root_dir if config.cache and config.cache.enabled else None),
            )

        elif args.command == "semantic-search":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Create on-the-fly model config if model_name is provided
            if args.model_name:
                # Check if model already exists in config
                model_exists = args.model_name in config.models

                if not model_exists:
                    # Create a model config from the command line arguments
                    model_config = ModelConfig(name=args.model_name, path=args.model_name, type=args.model_type)

                    # Add to config
                    config.models[args.model_name] = model_config
                    logger.debug(f"Created on-the-fly model config for {args.model_name}")

            # Choose model name
            model_name = args.model_name

            # Check if model exists in config
            if not model_name or model_name not in config.models:
                logger.error(f"Model '{model_name}' not found in configuration and no model parameters provided")
                return

            # Import and call compute_and_compare_embeddings
            from .operations.embeddings import compute_and_compare_embeddings

            results = await compute_and_compare_embeddings(
                solr_client,
                args.collection,
                args.query,
                args.text_field,
                config.models[model_name],
                args.top_k,
                args.filter_query,
                args.simplify_chinese,
            )

            # Print results
            print(f"Top {len(results)} documents similar to query:")
            for i, result in enumerate(results):
                print(f"\n{i+1}. Document: {result['id']}")
                print(f"   Similarity: {result['similarity']:.4f}")

                # Print a snippet of the text
                text = result["text"]
                max_snippet_length = 100
                snippet = text[:max_snippet_length] + "..." if len(text) > max_snippet_length else text
                print(f"   Text: {snippet}")

        elif args.command == "examine-jsonl":
            import json

            import jsonlines

            for file_path in args.files:
                logger.info(f"Examining file: {file_path}")
                try:
                    with jsonlines.open(file_path, "r") as reader:
                        for i, doc in enumerate(reader):
                            if i >= args.num_docs:
                                break

                            logger.info(f"Document {i+1}:")
                            logger.info(f"ID: {doc.get('id', 'N/A')}")
                            logger.info(f"Fields: {list(doc.keys())}")

                            # Pretty-print the document
                            print(json.dumps(doc, indent=2))

                            # Check for key fields
                            for field in ["id", "doc_id", "t", "l", "s", "e", "c"]:
                                if field in doc:
                                    value = doc[field]
                                    value_type = type(value).__name__
                                    value_sample = value
                                    if isinstance(value, list) and value:
                                        value_sample = value[:3]
                                    logger.info(f"  Field '{field}': {value_type}, value: {value_sample}")
                                else:
                                    logger.info(f"  Field '{field}': MISSING")
                except Exception as e:
                    logger.error(f"Error examining file: {e}")
        elif args.command == "tokenize-csv":
            # Check if model exists in config
            if args.model_name not in config.models:
                logger.error(f"Model '{args.model_name}' not found in configuration")
                return

            # Tokenize CSV
            from .operations.tokenize import tokenize_csv

            tokenize_csv(
                config.models[args.model_name],
                args.input_file,
                args.output_file,
                args.text_column,
                args.simplify_chinese,
            )

        elif args.command == "tokenize-text":
            # Check if model exists in config
            if args.model_name not in config.models:
                logger.error(f"Model '{args.model_name}' not found in configuration")
                return

            # Tokenize text
            from .operations.tokenize import tokenize_text

            tokenized = tokenize_text(config.models[args.model_name], args.text, args.simplify_chinese)

            # Print result
            print(tokenized)

        elif args.command == "tokenize-solr":
            # Create and start Solr client
            from .solr.client import SolrClient

            solr_client = SolrClient(
                config.solr.host,
                config.solr.port,
                config.solr.username,
                config.solr.password,
            )
            await solr_client.start_session()

            # Create on-the-fly model config if model_name is provided
            if args.model_name:
                # Check if model already exists in config
                model_exists = args.model_name in config.models

                if not model_exists:
                    # Create a model config from the command line arguments
                    model_config = ModelConfig(
                        name=args.model_name,
                        path=args.model_name,
                        type=args.model_type,
                        max_length=args.max_length,  # Optional override
                        aggregation_strategy="FIRST",  # Default value
                    )

                    # Add to config
                    config.models[args.model_name] = model_config
                    logger.debug(f"Created on-the-fly model config for {args.model_name}")

            # Choose model name
            model_name = args.model_name

            # Check if model exists in config
            if not model_name or model_name not in config.models:
                logger.error(f"Model '{model_name}' not found in configuration and no model parameters provided")
                return

            # Import and call cache_tokenization
            from .operations.tokenize import cache_tokenization

            await cache_tokenization(
                solr_client,
                args.collection,
                args.text_field,
                config.models[model_name],
                config.cache.root_dir,
                model_name,
                args.start,
                args.batch_size,
                args.num_batches,
                args.filter_query,
                args.simplify_chinese,
            )

        elif args.command == "list-models":
            # List available model types
            from .models.registry import get_available_model_types

            models = get_available_model_types()

            print("Available model types and tasks:")
            for model_type, tasks in models.items():
                print(f"  {model_type}: {', '.join(tasks)}")

            # List configured models
            print("\nConfigured models:")
            for model_name, model_config in config.models.items():
                print(f"  {model_name} ({model_config.type}): {model_config.path}")

        else:
            logger.error(f"Unknown command: {args.command}")

    except Exception as e:
        logger.error(f"An error occurred: {e}")
        if args.log_level == "DEBUG":
            logger.exception("Detailed error:")

    finally:
        # Close Solr client if it was created
        if solr_client is not None:
            await solr_client.close_session()


def main_cli():
    """Entry point for the command-line interface.

    This function is called when using the console script defined in setup.py.
    It handles platform-specific asyncio setup and runs the main async function.
    """
    if sys.platform == "win32":
        # Set up asyncio policy for Windows
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())

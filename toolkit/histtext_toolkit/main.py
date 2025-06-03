"""Simplified main entry point for the HistText Toolkit."""

import argparse
import asyncio
import time
from typing import Optional

from .core.config import ModelConfig
from .core.logging import get_logger
from .models.registry import create_ner_model

logger = get_logger(__name__)


async def test_ner_command(args):
    """Test NER functionality with sample text."""
    # Default test text
    test_text = args.text or "Apple Inc. was founded by Steve Jobs in Cupertino, California. Elon Musk is the CEO of Tesla."

    # Create model config
    model_config = ModelConfig(
        name=args.model_name,
        path=args.model_name,
        type=args.model_type,
        additional_params={"threshold": 0.5} if hasattr(args, 'threshold') else {}
    )

    print(f"Testing NER with model: {args.model_name} ({args.model_type})")
    print(f"Text: {test_text}")
    print("-" * 60)

    try:
        # Create and load model
        model = create_ner_model(model_config)
        if not model.load():
            print("❌ Failed to load model")
            return

        print("✅ Model loaded successfully")

        # Extract entities
        start_time = time.time()
        entities = model.extract_entities(test_text, args.entity_types)
        processing_time = time.time() - start_time

        print(f"✅ Found {len(entities)} entities in {processing_time:.3f}s")
        print()

        # Display results
        if entities:
            print("Entities found:")
            for i, entity in enumerate(entities, 1):
                labels_str = ", ".join(entity.labels)
                print(f"{i:2d}. {entity.text:20} | {labels_str:10} | {entity.confidence:.3f} | pos: {entity.start_pos}-{entity.end_pos}")
        else:
            print("No entities found")

        # Show supported entity types
        if hasattr(model, 'get_supported_entity_types'):
            supported_types = model.get_supported_entity_types()
            print(f"\nSupported entity types: {', '.join(supported_types[:10])}")
            if len(supported_types) > 10:
                print(f"... and {len(supported_types) - 10} more")

        # Unload model
        model.unload()

    except Exception as e:
        print(f"❌ Error during testing: {e}")
        logger.exception("Test error details:")


async def main():
    """Legacy main function for backward compatibility."""
    # This is kept for backward compatibility but the main functionality
    # has been moved to the Click CLI in cli.py
    
    # Simple argument parser for the test-ner functionality only
    parser = argparse.ArgumentParser(
        description="HistText Toolkit - Use 'histtext-toolkit --help' for full CLI"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Test NER command for backward compatibility
    test_parser = subparsers.add_parser("test-ner", help="Test NER with sample text")
    test_parser.add_argument("--model-name", required=True, help="Model to test")
    test_parser.add_argument("--model-type", default="transformers", help="Type of model")
    test_parser.add_argument("--text", help="Text to analyze")
    test_parser.add_argument("--entity-types", nargs="+", help="Entity types to extract")
    
    args = parser.parse_args()
    
    if args.command == "test-ner":
        await test_ner_command(args)
    else:
        print("HistText Toolkit")
        print("================")
        print()
        print("For full functionality, use the new CLI:")
        print("  histtext-toolkit --help")
        print()
        print("Available commands:")
        print("  config create <path>     - Create default configuration")
        print("  config show              - Show current configuration")
        print("  upload <collection>      - Upload JSONL files to Solr")
        print("  ner <collection>         - Run NER on collection")
        print("  tokenize-solr            - Tokenize Solr documents")
        print("  list-models              - List available models")
        print()
        print("Legacy test-ner command is still available in this interface.")


def main_cli():
    """Entry point for the command-line interface."""
    # Import and run the Click CLI
    from .cli import main_cli as click_main_cli
    click_main_cli()


if __name__ == "__main__":
    asyncio.run(main())
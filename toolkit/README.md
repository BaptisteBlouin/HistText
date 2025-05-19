# HistText Toolkit

HistText Toolkit is a Python command-line toolkit designed for ingesting, processing, and analyzing textual data with Apache Solr. It provides a comprehensive set of tools for natural language processing of historical and other text collections, with a focus on scalability, robustness, and performance.

## Key Features

- **JSONL ingestion and management** with automatic Solr schema creation, validation, and customization
- **Named Entity Recognition (NER)** precomputation, caching, and upload with support for multiple entity types and formats
- **Tokenization** for CSV files, plain text, and Solr collections with language-specific handling
- **Word and Document Embeddings** generation with multiple algorithms and output formats:
  - Document-level embeddings for semantic search
  - Custom word vectors trained on your collections
  - Support for FastText, Word2Vec, and Sentence Transformers
- **Chinese text processing** with specialized support for traditional/simplified conversion
- **Model registry** with pluggable architectures:
  - spaCy for NER and tokenization
  - Transformers (HuggingFace) for state-of-the-art NLP
  - GLiNER for specialized historical entity recognition
  - ChineseWordSegmenter for optimized Chinese tokenization
- **Configurable caching** of intermediate results for performance optimization
- **Checkpoint system** for resuming interrupted long-running operations
- **Rich logging and progress reporting** with detailed metrics
- **Robust error handling** with automatic recovery and detailed diagnostics

---

## Table of Contents

1. [Prerequisites](#prerequisites)  
2. [Installation](#installation)  
3. [Configuration](#configuration)  
4. [Usage](#usage)  
   - [Global Options](#global-options)  
   - [Commands Overview](#commands-overview)
   - [Document Management](#document-management)
   - [Text Processing](#text-processing)
   - [Named Entity Recognition](#named-entity-recognition)
   - [Embedding Operations](#embedding-operations)
   - [Utility Commands](#utility-commands)
5. [Embedding Features](#embedding-features)
   - [Document Embeddings](#document-embeddings)
   - [Semantic Search](#semantic-search)
   - [Word Embeddings](#word-embeddings)
   - [Supported Formats](#supported-formats)
   - [Performance Considerations](#performance-considerations)
6. [Caching & Directory Structure](#caching--directory-structure)  
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Architecture Overview](#architecture-overview)
9. [Advanced Configuration](#advanced-configuration)
10. [Contributing](#contributing)
11. [License](#license)

---

## Prerequisites

- **Python** 3.10+
- **Java** 8+ (for Apache Solr)
- **Apache Solr** instance (v8.0+ recommended) 
- **GPU** (optional, recommended for transformer models and large collections)
- **Memory** requirements vary by model:
  - Basic operations: 4GB+ RAM
  - NER with transformers: 8GB+ RAM
  - Word embeddings training: 4GB+ RAM recommended for large collections
  - GPU memory: 4GB+ for transformer models (8GB+ recommended)

---

## Installation

### Basic Installation

```bash
git clone https://github.com/BaptisteBlouin/hisstext.git
cd histtext/toolkit
pip install .
```

### Install with Specific Features

The toolkit uses optional dependencies to keep the base installation lightweight. Install only what you need:

```bash
# spaCy support for NER and tokenization
pip install .[spacy]

# Hugging Face Transformers (includes PyTorch)
pip install .[transformers]

# GLiNER for specialized historical entity recognition
pip install .[gliner]

# Chinese text processing
pip install .[chinese]
pip install git+https://github.com/hhhuang/ChineseWordSegmenter.git

# Document embeddings and semantic search
pip install .[embeddings]

# Word embeddings generation
pip install .[word_embeddings]

# All features (includes all dependencies)
pip install .[all]
```

### Dependencies

**Core dependencies** (installed automatically):

* `aiohttp>=3.8.0` - Asynchronous HTTP client/server
* `jsonlines>=2.0.0` - JSON lines file format handling
* `pyyaml>=6.0` - YAML configuration parsing
* `tqdm>=4.62.0` - Progress bar for long-running operations
* `numpy>=1.20.0` - Numerical operations for embeddings

**Optional dependencies** by feature:

* **spacy**: NER and tokenization models
* **transformers**: State-of-the-art models from HuggingFace
* **gliner**: Historical entity recognition
* **chinese**: Chinese text segmentation and conversion
* **embeddings**: Document-level embeddings and semantic search
* **word_embeddings**: Custom word vector training

### Development Installation

For development, install in editable mode with development extras:

```bash
pip install -e .[all,dev]
```

---

## Configuration

The toolkit uses YAML configuration files to manage settings for Solr connections, caching, and models.

### Configuration File

By default, the toolkit looks for a `config.yaml` in the working directory. You can specify a different file with the `--config` option.

### Example Configuration

```yaml
# Solr connection settings
solr:
  host: localhost          # Solr host
  port: 8983               # Solr port
  username: solr_user      # optional
  password: solr_pass      # optional
  timeout: 30              # Connection timeout in seconds (optional)

# Cache settings
cache:
  root_dir: ./cache        # Directory for caching
  enabled: true            # Enable/disable caching
  max_size_gb: 10          # Maximum cache size in GB (optional)

# Logging settings (optional)
logging:
  level: INFO              # Default log level
  file: logs/histtext.log  # Log file path (optional)
  
# Model definitions
models:
  # Transformer model for NER and tokenization
  bert-base:
    path: bert-base-uncased
    type: transformers
    max_length: 512
    aggregation_strategy: FIRST
    
  # spaCy model
  spacy-en:
    path: en_core_web_sm
    type: spacy
    
  # Chinese segmentation model
  zh-segmenter:
    path: chinese_segmenter
    type: chinese_segmenter
    
  # Word2Vec model for embeddings
  word2vec-model:
    path: /path/to/word2vec/model.bin
    type: word2vec
    binary: true
    dim: 300
    
  # FastText model
  fasttext-en:
    path: cc.en.300.bin
    type: fasttext
    dim: 300
    
  # Sentence Transformer model
  sentence-transformer:
    path: all-MiniLM-L6-v2
    type: sentence_transformers
    max_length: 256
    
  # GLiNER model for historical entities
  gliner-hist:
    path: /path/to/gliner/model
    type: gliner
```

### Configuration Hierarchy

Settings are applied in the following order of precedence:

1. Command-line arguments (highest priority)
2. Environment variables (prefixed with `HISTTEXT_`)
3. Configuration file
4. Default values (lowest priority)

### Environment Variables

All configuration options can also be set via environment variables:

```bash
# Set Solr connection
export HISTTEXT_SOLR_HOST=localhost
export HISTTEXT_SOLR_PORT=8983

# Set cache directory
export HISTTEXT_CACHE_DIR=./my_cache
```

---

## Usage

### Basic Usage

Invoke the toolkit via the console script or directly as a module:

```bash
# Using the installed console script
python -m histtext_toolkit.main [GLOBAL OPTIONS] <command> [COMMAND OPTIONS]

# Or with Python's module flag (useful in development or virtual environments)
python -m histtext_toolkit.main [GLOBAL OPTIONS] <command> [COMMAND OPTIONS]
```

### Global Options

Global options must be specified **before** the subcommand:

* `-c, --config <file>` – Path to YAML configuration file
* `-l, --log-level <LEVEL>` – Set logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`)
* `--solr-host <host>` – Solr hostname (default: `localhost`)
* `--solr-port <port>` – Solr port (default: `8983`)
* `--solr-user <username>` - Solr username for authentication (optional)
* `--solr-pass <password>` - Solr password for authentication (optional)
* `--cache-dir <dir>` – Cache directory (default: `./cache`)
* `--cache-disabled` – Disable caching (overrides config)
* `--verbose` – Enable verbose output with more detailed progress information

### Commands Overview

The toolkit provides commands in several categories:

#### Document Management

* `upload` - Upload JSONL files to a Solr collection
* `upload-ner` - Upload precomputed NER annotations to Solr
* `examine-jsonl` - Examine the content of JSONL files

#### Text Processing

* `tokenize-csv` - Tokenize text in a CSV file
* `tokenize-text` - Tokenize a text string
* `tokenize-solr` - Tokenize documents from a Solr collection

#### Named Entity Recognition

* `precompute-ner` - Precompute NER annotations for a collection

#### Embedding Operations

* `compute-embeddings` - Compute document embeddings for a collection
* `semantic-search` - Search documents using semantic similarity
* `compute-word-embeddings` - Generate word embeddings from collection texts
* `build-embedding-index` - Build a vector index for a collection

#### Utility Commands

* `list-models` - List available model types and tasks
* `verify-solr` - Check Solr connection and collection status
* `clear-cache` - Clear the cache directory

### Example Command Structure

```bash
python -m histtext_toolkit.main \
  --solr-host localhost --solr-port 8983 \
  upload test-collection ./data/*.jsonl --schema ./schemas/test.yaml
```

### Document Management

#### Upload Documents

Upload JSONL files to a Solr collection:

```bash
python -m histtext_toolkit.main upload my-collection ./data/*.jsonl --schema schema.yaml --batch-size 500
```

**Options:**
* `collection` - Name of the target collection
* `jsonl_files` - JSONL files to upload (glob patterns supported)
* `--schema` - Path to schema file (optional)
* `-b, --batch-size` - Number of documents per batch (default: 1000)

#### Upload Precomputed NER

Upload precomputed NER annotations to a Solr collection:

```bash
python -m histtext_toolkit.main upload-ner target-collection model-name source-collection text-field
```

**Options:**
* `collection` - Name of the target collection
* `model_name` - Name of the model used for NER
* `solr_collection` - Name of the source collection
* `field` - Field name containing text
* `-b, --batch-size` - Documents per batch (default: 1000)

#### Examine JSONL Files

Inspect the content of JSONL files:

```bash
python -m histtext_toolkit.main examine-jsonl ./cache/model/collection/field/*.jsonl -n 3
```

**Options:**
* `files` - JSONL files to examine
* `-n, --num-docs` - Number of documents to show (default: 1)

### Text Processing

#### Tokenize CSV

Tokenize text in a CSV file:

```bash
python -m histtext_toolkit.main tokenize-csv bert-base input.csv output.csv --text-column "Text"
```

**Options:**
* `model_name` - Name of the model to use
* `input_file` - Input CSV file
* `output_file` - Output CSV file
* `--text-column` - Column containing text (default: "Text")
* `--simplify-chinese` - Convert traditional Chinese to simplified

#### Tokenize Text

Tokenize a text string:

```bash
python -m histtext_toolkit.main tokenize-text bert-base "This is a sample text to tokenize."
```

**Options:**
* `model_name` - Name of the model to use
* `text` - Text to tokenize
* `--simplify-chinese` - Convert traditional Chinese to simplified

#### Tokenize Solr Collection

Tokenize documents from a Solr collection and cache the results:

```bash
python -m histtext_toolkit.main tokenize-solr my-collection --model-name bert-base --text-field text
```

**Options:**
* `collection` - Name of the source collection
* `--model-name` - Name of the model to use
* `--text-field` - Field containing text (default: "text")
* `--model-type` - Type of model (default: "transformers")
* `--start` - Start index (default: 0)
* `-b, --batch-size` - Number of documents per batch (default: 1000)
* `-n, --num-batches` - Maximum number of batches to process
* `-f, --filter-query` - Filter query
* `--simplify-chinese` - Convert traditional Chinese to simplified

### Named Entity Recognition

#### Precompute NER

Precompute NER annotations for a collection:

```bash
python -m histtext_toolkit.main precompute-ner my-collection --model-name spacy-en --text-field text
```

**Options:**
* `collection` - Name of the collection
* `--model-name` - Name of the model to use
* `--text-field` - Field containing text (default: "text")
* `--model-type` - Type of model (default: "transformers")
* `--aggregation-strategy` - Strategy for aggregating tokens (default: "FIRST")
* `--start` - Start index (default: 0)
* `-b, --batch-size` - Number of documents per batch (default: 10000)
* `-n, --num-batches` - Maximum number of batches to process
* `-f, --filter-query` - Filter query
* `-s, --shorten` - Use shortened field names
* `--format` - Format type (default: "flat")

### Embedding Operations

See the [Embedding Features](#embedding-features) section for detailed information.

#### Compute Document Embeddings

```bash
python -m histtext_toolkit.main compute-embeddings my-collection output/embeddings \
  --model-name all-MiniLM-L6-v2 --model-type sentence_transformers \
  --text-field content --output-format binary
```

#### Perform Semantic Search

```bash
python -m histtext_toolkit.main semantic-search research-papers "climate change mitigation strategies" \
  --model-name all-mpnet-base-v2 --model-type sentence_transformers \
  --text-field abstract --top-k 15
```

#### Generate Word Embeddings

```bash
python -m histtext_toolkit.main compute-word-embeddings historical-texts embeddings/word-vectors \
  --text-field full_text --method word2vec --dim 200 --window 10
```

#### Build Embedding Index

```bash
python -m histtext_toolkit.main build-embedding-index my-collection embeddings-index \
  --model-name sentence-transformer --text-field content
```

### Utility Commands

#### List Available Models

```bash
python -m histtext_toolkit.main list-models
```

#### Verify Solr Connection

```bash
python -m histtext_toolkit.main verify-solr my-collection
```

#### Clear Cache

```bash
python -m histtext_toolkit.main clear-cache --model bert-base --collection my-collection
```

---

## Embedding Features

The HistText Toolkit provides comprehensive support for working with embeddings at both the document and word level.

### Document Embeddings

Document embeddings represent entire texts as dense vectors, enabling semantic search and document similarity analysis. The toolkit supports multiple embedding models:

#### Supported Models

1. **FastText** - Efficient word embeddings with subword information
   ```bash
   python -m histtext_toolkit.main compute-embeddings collection output/embeddings \
     --model-name cc.en.300.bin --model-type fasttext --text-field text
   ```

2. **Word2Vec** - Classic word embeddings model (via Gensim)
   ```bash
   python -m histtext_toolkit.main compute-embeddings collection output/embeddings \
     --model-name word2vec-google-news-300 --model-type word2vec --text-field text
   ```

3. **Sentence Transformers** - State-of-the-art semantic representations
   ```bash
   python -m histtext_toolkit.main compute-embeddings collection output/embeddings \
     --model-name all-MiniLM-L6-v2 --model-type sentence_transformers --text-field text
   ```

#### Key Options

- `--output-format` - Format to save embeddings (vec, txt, binary, json)
- `--batch-size` - Number of documents per batch
- `--filter-query` - Solr filter query to select specific documents
- `--start` - Starting document index
- `--num-batches` - Maximum number of batches to process
- `--simplify-chinese` - Convert traditional Chinese to simplified

### Semantic Search

Perform semantic search within a collection using embeddings:

```bash
python -m histtext_toolkit.main semantic-search collection "query text" \
  --model-name all-mpnet-base-v2 --model-type sentence_transformers \
  --text-field abstract --top-k 10
```

This computes the embedding for the query text and finds the most similar documents in the collection based on cosine similarity.

#### Key Options

- `--model-name` - Name of the model to use
- `--model-type` - Type of model (fasttext, word2vec, sentence_transformers)
- `--text-field` - Field containing text to compare
- `--top-k` - Number of top results to return (default: 10)
- `--filter-query` - Solr filter query to restrict search scope

### Word Embeddings

The toolkit can generate custom word embeddings directly from your text collections:

```bash
python -m histtext_toolkit.main compute-word-embeddings collection output/word-vectors \
  --text-field content --method word2vec --dim 200 --window 8 \
  --min-count 5 --output-format txt
```

#### Word Embedding Methods

1. **Word2Vec** - Classic word embedding algorithm (via Gensim)
   - Fast training, good for general purposes
   - Options for window size and dimensionality

2. **FastText** - Enhanced word embeddings with subword information
   - Better handling of out-of-vocabulary words
   - Good for morphologically rich languages

#### Key Options

- `--method` - Word embedding method (word2vec, fasttext)
- `--dim` - Dimension of word embeddings (default: 100)
- `--window` - Context window size (default: 5)
- `--min-count` - Minimum word count (default: 5)
- `--workers` - Number of worker threads (default: 4)
- `--output-format` - Format to save word vectors (txt, vec, bin, gensim)

### Supported Formats

The toolkit supports multiple formats for saving embeddings:

1. **txt / vec** - Text format compatible with Word2Vec and FastText
   - First line: `<vocab_size> <dimension>`
   - Subsequent lines: `<word> <v1> <v2> ... <vn>`

2. **bin** - Binary format for faster loading
   - More compact storage
   - Faster to load but not human-readable

3. **gensim** - Gensim's native format (for word embeddings only)
   - Preserves more model information
   - Only loadable with Gensim

4. **json** - JSON format for compatibility
   - Human-readable and easily parsed
   - Includes metadata

### Performance Considerations

When working with embeddings, consider these performance factors:

- **Memory Usage**: Embedding operations can be memory-intensive, especially for large collections
- **GPU Acceleration**: Transformer-based models benefit significantly from GPU acceleration
- **Batch Size**: Adjust batch size based on available memory and model complexity
- **Checkpointing**: Long-running operations automatically create checkpoints for recovery
- **Caching**: Intermediate results are cached to prevent redundant computation

For large collections, consider:
- Using a higher `--batch-size` for more efficient processing
- Enabling checkpointing to resume interrupted operations
- Using filter queries to process subsets of the collection in stages

---

## Caching & Directory Structure

The toolkit implements a comprehensive caching system to improve performance and enable incremental processing.

### Cache Structure

By default, all intermediate outputs are stored under the configured cache directory:

```
cache/
├── <model_name>/               # E.g., bert-base-chinese, gliner-model
│   └── <collection>/           # Solr collection name
│       └── <field>/            # Field name (e.g., text, content)
│           ├── 0.jsonl         # Batch starting at document 0
│           ├── 1000.jsonl      # Batch starting at document 1000
│           └── ...
├── <model_name_2>/
│   └── ...
└── embeddings/                 # Document and word embeddings
    ├── document/
    │   └── <collection>/
    │       ├── embeddings.vec
    │       └── embeddings.bin
    └── word/
        └── <collection>/
            ├── word_vectors.txt
            └── word_vectors.bin
```

Each cached file contains processed data such as tokenized text, NER annotations, or embeddings.

### Cache Management

The toolkit automatically manages the cache:

- **Creation**: Directories are created as needed
- **Reuse**: Cached results are reused when available
- **Invalidation**: Cache can be cleared with the `clear-cache` command
- **Checkpointing**: Partial results are saved during long operations

### Cache Configuration

Configure caching behavior in `config.yaml`:

```yaml
cache:
  root_dir: ./cache        # Base cache directory
  enabled: true            # Enable/disable caching
  max_size_gb: 10          # Maximum cache size (optional)
  ttl_days: 30             # Time-to-live in days (optional)
```

Or via command-line options:

```bash
python -m histtext_toolkit.main --cache-dir ./my_cache upload collection data.jsonl
python -m histtext_toolkit.main --cache-disabled tokenize-solr collection
```

### Checkpoint System

For long-running operations, the toolkit creates checkpoints that allow:

- Resuming interrupted operations
- Recovering from errors
- Incrementally processing large collections

Checkpoint files are stored alongside the cached output with `.checkpoint.json` extension and contain progress information.

### File Formats

The toolkit uses these primary file formats:

- **JSONL** (.jsonl) - JSON Lines for document data
- **YAML** (.yaml) - Configuration and schema files
- **Vector formats** (.vec, .txt, .bin) - Embedding vectors
- **CSV** (.csv) - Structured tabular data

---

## Error Handling & Recovery

The HistText Toolkit implements error handling and recovery mechanisms to ensure reliability when processing large collections.

### Error Handling Features

- **Structured exceptions** with detailed error information
- **Automatic retries** for transient failures (network issues, timeouts)
- **Graceful degradation** when resources are constrained
- **Checkpoint system** for resuming interrupted operations
- **Signal handling** for graceful termination (e.g., CTRL+C)
- **Memory management** to prevent out-of-memory errors
- **Detailed logging** with context-specific information

### Error Recovery Strategies

The toolkit employs multiple strategies for error recovery:

1. **Exponential backoff** for Solr connection issues
2. **Batch size adaptation** based on failure patterns
3. **Partial result preservation** to avoid losing completed work
4. **Memory monitoring** with automatic resource adjustment
5. **Progress tracking** for transparent operation status

### Checkpoint System

For long-running operations like embedding generation and NER, the toolkit creates checkpoints:

- **Automatic saving** at regular intervals (e.g., every 5 batches)
- **Resumption capability** from the last completed batch
- **Document tracking** to avoid reprocessing
- **Metadata preservation** for consistent results

To resume an interrupted operation, simply run the same command again, and the toolkit will continue from the last checkpoint.

---

## Architecture Overview

### System Architecture

The HistText Toolkit follows a modular architecture for flexibility and extensibility:

```
                         ┌─────────────────┐
                         │  Command Line   │
                         │   Interface     │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │  Configuration  │
                         │   Management    │
                         └────────┬────────┘
                                  │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼─────────┐   ┌────────▼────────┐    ┌────────▼────────┐
│    Operations     │   │    Models       │    │   Solr Client   │
│    Framework      │   │    Registry     │    │    Interface    │
└─────────┬─────────┘   └────────┬────────┘    └────────┬────────┘
          │                      │                      │
          │              ┌───────▼────────┐             │
          │              │ Model Backends │             │
          │              └───────┬────────┘             │
          │                      │                      │
┌─────────▼──────────────────────▼──────────────────────▼─────────┐
│                       Caching & Persistence                      │
└─────────────────────────────────────────────────────────────────┘
```

### Core Modules

1. **CLI Entry Point**
   * `histtext_toolkit/main.py` — Argument parsing, config loading, command dispatch
   * `histtext_toolkit/cli.py` — Console script entry point

2. **Core Framework**
   * `core/config.py` — Configuration management
   * `core/logging.py` — Logging infrastructure
   * `core/errors.py` — Error handling system

3. **Operations**
   * `operations/ner.py` — NER processing
   * `operations/tokenize.py` — Tokenization operations
   * `operations/upload.py` — Solr document operations
   * `operations/embeddings.py` — Embedding and semantic search

4. **Model Abstractions**
   * `models/base.py` — Base classes for models
   * `models/registry.py` — Model discovery and instantiation

5. **Model Implementations**
   * `models/spacy_model.py` — spaCy integration
   * `models/transformers_model.py` — HuggingFace integration
   * `models/gliner_model.py` — GLiNER integration
   * `models/chinese_segmenter.py` — Chinese segmentation
   * `models/fasttext_model.py` — FastText/Word2Vec embeddings
   * `models/word_embeddings_model.py` — Word vector training

6. **Solr Integration**
   * `solr/client.py` — Communication with Solr
   * `solr/schema.py` — Schema management

7. **Caching System**
   * `cache/manager.py` — Cache organization and retrieval

### Model Registry

The model registry enables the toolkit to work with different model types using a consistent interface. The abstract base classes ensure that all model implementations support the required operations:

* **`NERModel`** — Named entity recognition
* **`TokenizationModel`** — Text tokenization
* **`EmbeddingsModel`** — Vector representations

When a command is executed, the registry selects the appropriate model implementation based on the configuration.

### Asynchronous Processing

The toolkit uses asynchronous I/O (via `asyncio` and `aiohttp`) for efficient communication with Solr, allowing:

* Non-blocking operations
* Concurrent requests
* Timeout management
* Connection pooling

### Pipeline Architecture

Operations are organized as pipelines, where each stage processes data and passes it to the next:

1. **Data Retrieval** — Fetch from Solr or load from files
2. **Preprocessing** — Normalize and prepare text
3. **Model Processing** — Apply NLP models
4. **Postprocessing** — Format and structure results
5. **Storage** — Cache or upload to Solr

This pipeline architecture enables efficient processing of large document collections.

---

## Advanced Configuration

### Model Configuration

Models can be configured with detailed options:

```yaml
models:
  bert-base:
    path: bert-base-uncased      # Model path or name
    type: transformers           # Model type
    max_length: 512              # Max sequence length
    aggregation_strategy: FIRST  # Token aggregation strategy
    additional_params:           # Model-specific parameters
      use_auth_token: false
      revision: main
```

### Tokenization Configuration

Fine-tune tokenization behavior:

```yaml
tokenization:
  default_model: bert-base-chinese
  batch_size: 100
  simplify_chinese: true
  preserve_whitespace: false
```

### NER Configuration

Configure NER processing:

```yaml
ner:
  default_model: spacy-en
  entity_types:
    - PERSON
    - ORGANIZATION
    - LOCATION
  confidence_threshold: 0.5
  format: flat  # or "default"
```

### Embedding Configuration

Control embedding behavior:

```yaml
embeddings:
  document:
    default_model: sentence-transformer
    dimension: 768
    batch_size: 32
  word:
    method: word2vec
    dimension: 300
    window: 5
    min_count: 5
```

### Solr Configuration

Fine-tune Solr connections:

```yaml
solr:
  host: localhost
  port: 8983
  username: solr
  password: SolrRocks
  timeout: 30
  connection_pool_size: 10
  retry_attempts: 3
```

### Advanced Schema Options

Create complex Solr schemas:

```yaml
schema:
  fields:
    id:
      type: string
      indexed: true
      stored: true
    text:
      type: text_general
      indexed: true
      stored: true
    ner_persons:
      type: string
      indexed: true
      stored: true
      multiValued: true
    embeddings:
      type: vector
      indexed: true
      stored: true
      vector_dimension: 768
  copy_fields:
    - source: text
      dest: text_en
    - source: text
      dest: text_stemmed
```

---


## Contributing

Contributions to HistText Toolkit are welcome! Here's how you can contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make your changes
5. Commit your changes (`git commit -m 'Add new feature'`)
6. Push to the branch (`git push origin feature/new-feature`)
7. Create a Pull Request

## License

See the LICENSE file in the root for details.

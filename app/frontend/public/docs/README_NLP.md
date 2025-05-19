# NLP MANAGEMENT

## CLI Tools

These scripts require the following Python libraries:

```bash
pip install \
  spacy torch transformers gliner jsonlines pyyaml tqdm
```

| Library        | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `spacy`        | Tokenization and spaCy-based NER pipelines        |
| `torch`        | Model backend for Hugging Face and GLiNER         |
| `transformers` | Hugging Face tokenizers and `AggregationStrategy` |
| `gliner`       | GLiNER-based NER processing                       |
| `jsonlines`    | Writing JSONL output files                        |
| `pyyaml`       | Emitting schema YAML                              |
| `tqdm`         | Global progress bars                              |

---

### 1. `precompute_ner.py` (v2.3.0)

Pre‑compute and cache NER annotations from a Solr collection, with global progress, customizable tokenization, and optional GLiNER support.

#### Usage

```bash
python -m histtext_api.tools.precompute_ner \
  [--solr-host HOST] [--solr-port PORT] \
  [--filter-query "<fq>"] [--collection-start N] [--collection-batch-size N] [--collection-nbatches N] \
  [-p PRECISION] [-s] [--model-max-length N] [--aggregation-strategy FIRST|MAX|MIN|SUM] \
  [--split-threshold N] [--format default|flat] [--compress] [--gliner-model HF_PATH] \
  [--dry-run] [--no-progress] [--spacy-gpu] [-l DEBUG|INFO|WARNING|ERROR|CRITICAL] \
  [--version] \
  <collection> <model_path_or_name> <histtext_model_name> <text_solr_field> <cache_output_dir>
```

#### Positional Arguments

| Argument              | Description                                                                         |
| --------------------- | ----------------------------------------------------------------------------------- |
| `collection`          | Solr collection name (alias)                                                        |
| `model_path_or_name`  | spaCy model path or HF model name/path _(mutually exclusive with `--gliner-model`)_ |
| `histtext_model_name` | Short name used inside the cache hierarchy                                          |
| `text_solr_field`     | Solr field containing the raw text to process                                       |
| `cache_output_dir`    | Root directory where generated JSONL files (and schema/index) will be cached        |

#### Tokenization & Splitting

- **`--model-max-length N`**: Overrides the tokenizer or model’s maximum input length.
- **`--split-threshold N`**: If a document’s text exceeds N characters, it’s split by paragraph boundaries into chunks ≤N, to avoid model truncation.
- Internally, `precompute_ner.py` uses:
  - **spaCy** for `.pipe()` tokenization when `model_path_or_name` refers to a spaCy model or directory.
  - **transformers** tokenizer (via `TransformerNER`) when using a HF model name.
  - **GLiNER** chunk-based tokenization for custom GLiNER checkpoints.

#### Common Options

| Option                    | Default                   | Description                                                     |
| ------------------------- | ------------------------- | --------------------------------------------------------------- |
| `--solr-host`             | `localhost`               | Solr host                                                       |
| `--solr-port`             | `8983`                    | Solr port                                                       |
| `--filter-query`          | _none_                    | Additional Solr `fq` to restrict documents                      |
| `--collection-start`      | `0`                       | Start offset in the Solr collection                             |
| `--collection-batch-size` | `10000`                   | Number of Solr documents per batch                              |
| `--collection-nbatches`   | _all_                     | Limit number of batches (omit for all)                          |
| `-p, --decimal-precision` | _none_                    | Round entity confidence scores to N decimal places              |
| `-s, --shorten`           | _off_                     | Use shortened keys (`t/l/s/e/c`) in per‑entity dicts            |
| `--aggregation-strategy`  | `FIRST`                   | HF aggregation strategy (`FIRST`, `MAX`, `MIN`, `SUM`)          |
| `--format`                | `default`                 | Output layout: `default` (nested) or `flat`                     |
| `--compress`              | _off_                     | Gzip‑compress the JSONL output                                  |
| `--gliner-model`          | `urchade/gliner_small-v1` | GLiNER checkpoint on HF (alt. to `model_path_or_name`)          |
| `--dry-run`               | _off_                     | Run NER pipeline without writing files                          |
| `--no-progress`           | _off_                     | Suppress the tqdm global progress bar                           |
| `--spacy-gpu`             | _off_                     | Force spaCy to run on GPU                                       |
| `-l, --logger`            | `INFO`                    | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`) |
| `--version`               | —                         | Show v2.3.0 and exit                                            |

---

### 2. `upload.py`

Upload JSONL files produced by `precompute_ner.py` into a new Solr collection.

#### Usage

```bash
python -m histtext_api.tools.upload \
  --solr-host HOST --solr-port PORT \
  -b BATCH_SIZE <collection>-ner \
  --schema <cache_output_dir>/<histtext_model_name>/<collection>_schema.yaml \
  --schema <cache_output_dir>/<histtext_model_name>/*.jsonl
```

#### Required Options

| Option             | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `--solr-host`      | Solr host                                                 |
| `--solr-port`      | Solr port                                                 |
| `-b, --batch-size` | Number of documents per batch                             |
| `<collection>-ner` | Target Solr collection name                               |
| `--schema`         | Path or glob to schema JSON/YAML or JSONL files to upload |

---

> **Tip:** Use `--dry-run` on `precompute_ner.py` to validate your arguments without generating files, and preview your schema JSON before uploading.

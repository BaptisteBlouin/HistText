from fastapi import FastAPI, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path
from typing import List, Optional
from app.deps import setup_config_and_logging

import os
import tempfile

app = FastAPI(
    title="HistText Toolkit Web UI",
    description="All toolkit commands available as a browser app.",
    version="2.0.0"
)

templates = Jinja2Templates(directory="app/templates")


# --- Home ---
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# --- Config Management ---
@app.post("/config/create", response_class=HTMLResponse)
async def config_create(request: Request, config_path: str = Form(...)):
    from histtext_toolkit.core.config import create_default_config
    try:
        config = create_default_config(Path(config_path))
        result = {
            "config_path": config_path,
            "solr_url": config.solr.url,
            "cache_dir": config.cache.root_dir,
            "models": list(config.models.keys())
        }
    except Exception as e:
        result = {"error": str(e)}
    return templates.TemplateResponse("index.html", {"request": request, "result_config_create": result})


@app.post("/config/show", response_class=HTMLResponse)
async def config_show(request: Request, config: str = Form(...)):
    from histtext_toolkit.core.config import load_config
    try:
        cfg = load_config(Path(config))
        result = {
            "solr": cfg.solr.url,
            "cache": {"dir": cfg.cache.root_dir, "enabled": cfg.cache.enabled},
            "models_dir": cfg.models_dir,
            "models": {name: {"type": m.type, "path": m.path} for name, m in cfg.models.items()}
        }
    except Exception as e:
        result = {"error": str(e)}
    return templates.TemplateResponse("index.html", {"request": request, "result_config_show": result})


# --- Upload JSONL Files ---
@app.post("/upload", response_class=HTMLResponse)
async def upload(
    request: Request,
    collection: str = Form(...),
    jsonl_files: List[UploadFile] = File(...),
    schema: Optional[str] = Form(None),
    batch_size: int = Form(1000),
):
    from histtext_toolkit.operations.upload import upload_jsonl_files
    from histtext_toolkit.solr.client import SolrClient

    tmp_dir = tempfile.TemporaryDirectory()
    paths = []
    for file in jsonl_files:
        p = Path(tmp_dir.name) / file.filename
        with open(p, "wb") as f:
            f.write(await file.read())
        paths.append(p)
    # Use default config, you may extend with user-selectable config
    cfg = setup_config_and_logging(None, "INFO", "localhost", 8983, None)
    solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
    await solr_client.start_session()
    try:
        total_docs = await upload_jsonl_files(solr_client, collection, [str(p) for p in paths], schema, batch_size)
        result = {"uploaded_docs": total_docs}
    except Exception as e:
        result = {"error": str(e)}
    finally:
        await solr_client.close_session()
        tmp_dir.cleanup()
    return templates.TemplateResponse("index.html", {"request": request, "result_upload": result})


# --- Upload NER ---
@app.post("/upload_ner", response_class=HTMLResponse)
async def upload_ner(
    request: Request,
    collection: str = Form(...),
    model_name: str = Form(...),
    solr_collection: str = Form(...),
    field: str = Form(...),
    batch_size: int = Form(1000),
):
    from histtext_toolkit.operations.upload import upload_precomputed_ner
    from histtext_toolkit.solr.client import SolrClient

    cfg = setup_config_and_logging(None, "INFO", "localhost", 8983, None)
    solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
    await solr_client.start_session()
    try:
        total_docs = await upload_precomputed_ner(
            solr_client, collection, cfg.cache.root_dir, model_name, solr_collection, field, batch_size
        )
        result = {"uploaded_ner_docs": total_docs}
    except Exception as e:
        result = {"error": str(e)}
    finally:
        await solr_client.close_session()
    return templates.TemplateResponse("index.html", {"request": request, "result_upload_ner": result})


# --- NER ---
@app.post("/ner", response_class=HTMLResponse)
async def ner(
    request: Request,
    collection: str = Form(...),
    model_name: str = Form(...),
    model_type: str = Form("transformers"),
    text_field: str = Form("text"),
    entity_types: Optional[str] = Form(""),
    max_length: Optional[int] = Form(None),
    aggregation_strategy: str = Form("simple"),
    threshold: float = Form(0.5),
    start: int = Form(0),
    batch_size: int = Form(10000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    jsonl_prefix: Optional[str] = Form(None),
    decimal_precision: Optional[int] = Form(None),
    format: str = Form("flat"),
    use_gpu: Optional[bool] = Form(False),
    optimization_level: int = Form(1),
    compact_labels: Optional[bool] = Form(True),
    label_stats: Optional[bool] = Form(False)
):
    from histtext_toolkit.operations.ner import precompute_ner
    from histtext_toolkit.core.config import ModelConfig
    from histtext_toolkit.solr.client import SolrClient

    cfg = setup_config_and_logging(None, "INFO", "localhost", 8983, None)

    model_config = ModelConfig(
        name=model_name, path=model_name, type=model_type, max_length=max_length,
        additional_params={"threshold": threshold, "use_gpu": use_gpu, "optimization_level": optimization_level}
    )

    entity_types_list = [e.strip() for e in entity_types.split(",") if e.strip()]

    solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
    await solr_client.start_session()
    try:
        total_docs = await precompute_ner(
            solr_client, collection, text_field, model_config, cfg.cache.root_dir,
            model_name, start, batch_size, num_batches, filter_query,
            entity_types_list or None, jsonl_prefix, decimal_precision, format, compact_labels, label_stats
        )
        result = {"processed_ner_docs": total_docs}
    except Exception as e:
        result = {"error": str(e)}
    finally:
        await solr_client.close_session()
    return templates.TemplateResponse("index.html", {"request": request, "result_ner": result})


# --- Tokenize ---
@app.post("/tokenize", response_class=HTMLResponse)
async def tokenize(
    request: Request,
    collection: str = Form(...),
    model_name: str = Form(...),
    text_field: str = Form("text"),
    model_type: str = Form("transformers"),
    max_length: Optional[int] = Form(None),
    start: int = Form(0),
    batch_size: int = Form(1000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    simplify_chinese: Optional[bool] = Form(False)
):
    from histtext_toolkit.operations.tokenize import cache_tokenization
    from histtext_toolkit.core.config import ModelConfig
    from histtext_toolkit.solr.client import SolrClient

    cfg = setup_config_and_logging(None, "INFO", "localhost", 8983, None)

    model_config = ModelConfig(
        name=model_name, path=model_name, type=model_type, max_length=max_length
    )

    solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
    await solr_client.start_session()
    try:
        total_docs = await cache_tokenization(
            solr_client, collection, text_field, model_config, cfg.cache.root_dir,
            model_name, start, batch_size, num_batches, filter_query, simplify_chinese
        )
        result = {"tokenized_docs": total_docs}
    except Exception as e:
        result = {"error": str(e)}
    finally:
        await solr_client.close_session()
    return templates.TemplateResponse("index.html", {"request": request, "result_tokenize": result})


# --- Embeddings ---
@app.post("/embeddings", response_class=HTMLResponse)
async def embeddings(
    request: Request,
    collection: str = Form(...),
    output_path: str = Form(...),
    model_name: str = Form(...),
    text_field: str = Form("text"),
    model_type: str = Form("fasttext"),
    dim: Optional[int] = Form(None),
    max_length: Optional[int] = Form(None),
    output_format: str = Form("vec"),
    start: int = Form(0),
    batch_size: int = Form(1000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    simplify_chinese: Optional[bool] = Form(False)
):
    from histtext_toolkit.operations.embeddings import compute_embeddings as histtext_compute_embeddings
    from histtext_toolkit.core.config import ModelConfig
    from histtext_toolkit.solr.client import SolrClient

    cfg = setup_config_and_logging(None, "INFO", "localhost", 8983, None)

    model_config = ModelConfig(
        name=model_name, path=model_name, type=model_type, max_length=max_length,
        additional_params={"dim": dim} if dim else {}
    )
    solr_client = SolrClient(cfg.solr.host, cfg.solr.port, cfg.solr.username, cfg.solr.password)
    await solr_client.start_session()
    try:
        total_docs = await histtext_compute_embeddings(
            solr_client, collection, text_field, model_config, output_path,
            start, batch_size, num_batches, filter_query, output_format, simplify_chinese,
            cfg.cache.root_dir if cfg.cache.enabled else None
        )
        result = {"computed_embeddings_docs": total_docs}
    except Exception as e:
        result = {"error": str(e)}
    finally:
        await solr_client.close_session()
    return templates.TemplateResponse("index.html", {"request": request, "result_embeddings": result})


# --- List Models ---
@app.post("/list_models", response_class=HTMLResponse)
async def list_models(request: Request):
    from histtext_toolkit.models.registry import get_available_model_types
    try:
        models = get_available_model_types()
        from histtext_toolkit.core.config import get_config
        cfg = get_config()
        configured = {name: {"type": m.type, "path": m.path} for name, m in cfg.models.items()}
        result = {"available": models, "configured": configured}
    except Exception as e:
        result = {"error": str(e)}
    return templates.TemplateResponse("index.html", {"request": request, "result_models_list": result})


"""Modern FastAPI application for HistText Toolkit Web UI."""

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from fastapi.responses import HTMLResponse 

from .routers import config, upload, ner, tokenize, embeddings, models
from .core.config import get_settings

# Get application settings
settings = get_settings()

# Create FastAPI application
app = FastAPI(
    title="HistText Toolkit Web UI",
    description="Modern web interface for HistText Toolkit operations",
    version="2.1.0",
    debug=settings.debug
)

# Setup static files and templates
static_dir = Path(__file__).parent / "static"
templates_dir = Path(__file__).parent / "templates"

if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

templates = Jinja2Templates(directory=str(templates_dir))

# Include routers
app.include_router(config.router, prefix="/api/config", tags=["Configuration"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(ner.router, prefix="/api/ner", tags=["NER"])
app.include_router(tokenize.router, prefix="/api/tokenize", tags=["Tokenization"])
app.include_router(embeddings.router, prefix="/api/embeddings", tags=["Embeddings"])
app.include_router(models.router, prefix="/api/models", tags=["Models"])

# Root endpoint for the web interface
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Main web interface."""
    return templates.TemplateResponse("index.html", {"request": request})

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.1.0"}
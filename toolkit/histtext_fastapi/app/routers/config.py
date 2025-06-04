# toolkit/histtext_fastapi/app/routers/config.py
"""Enhanced configuration management endpoints."""

from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import HTMLResponse
from pathlib import Path
from typing import Dict, Any, Optional
import json
from ..schemas.config import ConfigCreateResponse, ConfigShowResponse
from ..services.config_service import ConfigService

router = APIRouter()
config_service = ConfigService()


@router.post("/create", response_model=ConfigCreateResponse)
async def create_config(config_path: str = Form(...)):
    """Create a default configuration file."""
    try:
        result = await config_service.create_default_config(Path(config_path))
        return ConfigCreateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/show")
async def show_config(config_path: str = Form("")):
    """Show configuration with enhanced error handling."""
    try:
        path = Path(config_path) if config_path else None
        result = await config_service.show_config(path)
        
        # Handle Solr connection errors
        if result.get("error") == "solr_connection_failed":
            return HTMLResponse(content=f"""
            <div class="bg-error-50 border border-error-200 rounded-lg p-6">
                <div class="flex items-center mb-4">
                    <svg class="w-8 h-8 text-error-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <h4 class="text-lg font-medium text-error-800">Solr Connection Failed</h4>
                </div>
                <div class="text-error-700 space-y-2">
                    <p><strong>Error:</strong> {result["message"]}</p>
                    <p>Please check your Solr configuration and ensure Solr is running before viewing the full configuration.</p>
                    <div class="mt-4 p-4 bg-error-100 rounded">
                        <h5 class="font-medium mb-2">Troubleshooting Steps:</h5>
                        <ul class="list-disc ml-4 space-y-1 text-sm">
                            <li>Verify Solr is running on the configured host and port</li>
                            <li>Check network connectivity</li>
                            <li>Verify authentication credentials if required</li>
                            <li>Check firewall settings</li>
                        </ul>
                    </div>
                </div>
                <div class="mt-4">
                    <button onclick="testSolrConnection()" class="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors">
                        Test Connection Again
                    </button>
                </div>
            </div>
            """)
        
        # Handle other configuration errors
        if result.get("error") == "config_load_failed":
            return HTMLResponse(content=f"""
            <div class="bg-error-50 border border-error-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-error-800 mb-2">❌ Configuration Load Failed</h4>
                <div class="text-sm text-error-700">{result["message"]}</div>
            </div>
            """)
        
        # Generate successful configuration display
        return await _generate_config_display(result)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
async def _generate_config_display(result: dict) -> HTMLResponse:
    """Generate enhanced configuration display."""
    solr_status_color = "green" if result["solr"]["status"] == "connected" else "red"
    cache_status_color = "green" if result["cache"]["exists"] and result["cache"]["writable"] else "orange"
    
    html_content = f"""
    <div class="bg-white border border-secondary-200 rounded-lg p-6">
        <h4 class="text-lg font-medium text-secondary-900 mb-4">📋 Configuration Details</h4>
        
        <!-- Solr Configuration -->
        <div class="mb-6">
            <h5 class="font-medium text-secondary-800 mb-2 flex items-center">
                <span class="w-3 h-3 rounded-full bg-{solr_status_color}-500 mr-2"></span>
                Solr Configuration
            </h5>
            <div class="bg-secondary-50 rounded p-3 space-y-1">
                <p><strong>URL:</strong> {result["solr"]["url"]}</p>
                <p><strong>Host:</strong> {result["solr"]["host"]}</p>
                <p><strong>Port:</strong> {result["solr"]["port"]}</p>
                <p><strong>Status:</strong> 
                    <span class="px-2 py-1 text-xs rounded bg-{solr_status_color}-100 text-{solr_status_color}-800">
                        {result["solr"]["status"]}
                    </span>
                </p>
                <p><strong>Message:</strong> {result["solr"]["message"]}</p>
            </div>
        </div>
        
        <!-- Enhanced Cache Configuration -->
        <div class="mb-6">
            <h5 class="font-medium text-secondary-800 mb-2 flex items-center">
                <span class="w-3 h-3 rounded-full bg-{cache_status_color}-500 mr-2"></span>
                Cache Configuration
            </h5>
            <div class="bg-secondary-50 rounded p-3">
                <p><strong>Directory:</strong> {result["cache"]["dir"]}</p>
                <p><strong>Enabled:</strong> {'Yes' if result["cache"]["enabled"] else 'No'}</p>
                <p><strong>Exists:</strong> {'Yes' if result["cache"]["exists"] else 'No'}</p>
                <p><strong>Writable:</strong> {'Yes' if result["cache"]["writable"] else 'No'}</p>
                
                <!-- Cache Directory Update Form -->
                <div class="mt-3 p-3 bg-blue-50 rounded">
                    <h6 class="font-medium text-blue-800 mb-2">Update Cache Directory</h6>
                    <form hx-post="/api/config/update-cache-dir" hx-target="#cache-update-result" class="flex gap-2">
                        <input name="cache_dir" type="text" value="{result["cache"]["dir"]}" placeholder="/path/to/cache" 
                               class="flex-1 px-2 py-1 border rounded text-sm">
                        <button type="submit" class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                            Update Path
                        </button>
                    </form>
                    <div id="cache-update-result" class="mt-2"></div>
                </div>
            </div>
        </div>
        
        <!-- Enhanced System Information -->
        <div class="mb-4">
            <h5 class="font-medium text-secondary-800 mb-2">💻 System Information</h5>
            <div class="bg-secondary-50 rounded p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-2">
                <p><strong>Python:</strong> {result["system_info"].get("python_version", "Unknown")}</p>
                <p><strong>Platform:</strong> {result["system_info"].get("platform", "Unknown")}</p>
                <p><strong>CPU Cores:</strong> {result["system_info"].get("cpu_count", "Unknown")}</p>
                <p><strong>Memory:</strong> {result["system_info"].get("memory_total", "Unknown")} 
                   (Available: {result["system_info"].get("memory_available", "Unknown")})</p>
                <p class="md:col-span-2"><strong>GPU:</strong> 
                    <span class="{'text-green-600' if result["system_info"].get("gpu_available") else 'text-secondary-500'}">
                        {result["system_info"].get("gpu_info", "No GPU")}
                    </span>
                </p>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex gap-2">
            <button onclick="refreshConfig()" 
                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                🔄 Refresh
            </button>
            <button onclick="testSolrConnection()" 
                    class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                ✅ Test Solr
            </button>
            <button onclick="validateConfig()" 
                    class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                🔍 Validate
            </button>
        </div>
    </div>
    """
    
    return HTMLResponse(content=html_content)

@router.post("/update-cache-dir")
async def update_cache_directory(cache_dir: str = Form(...)):
    """Update cache directory path."""
    try:
        result = await config_service.update_cache_directory(cache_dir)
        
        if result["status"] == "success":
            return HTMLResponse(content=f"""
            <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                <p class="text-green-800 font-medium">✅ {result["message"]}</p>
                <p class="text-green-700 text-sm">New path: {result["cache_dir"]}</p>
            </div>
            """)
        else:
            return HTMLResponse(content=f"""
            <div class="mt-2 p-2 bg-error-50 border border-error-200 rounded">
                <p class="text-error-800 font-medium">❌ {result["message"]}</p>
            </div>
            """)
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="mt-2 p-2 bg-error-50 border border-error-200 rounded">
            <p class="text-error-800 font-medium">Update failed: {str(e)}</p>
        </div>
        """)

@router.post("/update-solr")
async def update_solr_config(host: str = Form(...), port: int = Form(...)):
    """Update Solr configuration and test connection."""
    try:
        result = await config_service.update_solr_config(host, port)
        
        status_color = "green" if result["connection_test"]["status"] == "connected" else "red"
        
        return HTMLResponse(content=f"""
        <div class="mt-2 p-2 bg-{status_color}-50 border border-{status_color}-200 rounded">
            <p class="text-{status_color}-800 font-medium">{result["message"]}</p>
            <p class="text-{status_color}-700 text-sm">{result["connection_test"]["message"]}</p>
        </div>
        """)
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded">
            <p class="text-red-800 font-medium">Update failed: {str(e)}</p>
        </div>
        """)


@router.post("/validate")
async def validate_config(config_path: str = Form("")):
    """Validate a configuration file with detailed feedback."""
    try:
        if not config_path:
            result = {"valid": False, "errors": ["No configuration path provided"]}
        else:
            result = await config_service.validate_config(Path(config_path))
        return result
    except Exception as e:
        return {"valid": False, "errors": [str(e)], "warnings": [], "checks": {}}


@router.post("/create-cache-dir")
async def create_cache_directory():
    """Create cache directory if it doesn't exist."""
    try:
        # This would implement cache directory creation
        return {"status": "success", "message": "Cache directory creation attempted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/current")
async def get_current_config():
    """Get current configuration without specifying path."""
    try:
        result = await config_service.show_config()
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
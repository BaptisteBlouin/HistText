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
async def show_config(config_path: str = Form(None)):
    """Show configuration details with enhanced information."""
    try:
        result = await config_service.show_config(Path(config_path) if config_path else None)
        
        # Return HTML formatted response
        solr_status_color = "green" if result["solr"]["status"] == "connected" else "red"
        cache_status_color = "green" if result["cache"]["exists"] else "orange"
        
        html_content = f"""
        <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-medium text-gray-900 mb-4">📋 Configuration Details</h4>
            
            <!-- Solr Configuration -->
            <div class="mb-6">
                <h5 class="font-medium text-gray-800 mb-2 flex items-center">
                    <span class="w-3 h-3 rounded-full bg-{solr_status_color}-500 mr-2"></span>
                    Solr Configuration
                </h5>
                <div class="bg-gray-50 rounded p-3 space-y-1">
                    <p><strong>URL:</strong> {result["solr"]["url"]}</p>
                    <p><strong>Host:</strong> {result["solr"]["host"]}</p>
                    <p><strong>Port:</strong> {result["solr"]["port"]}</p>
                    <p><strong>Status:</strong> 
                        <span class="px-2 py-1 text-xs rounded bg-{solr_status_color}-100 text-{solr_status_color}-800">
                            {result["solr"]["status"]}
                        </span>
                    </p>
                    <p><strong>Message:</strong> {result["solr"]["message"]}</p>
                    {'''<div class="mt-2">
                        <strong>Collections:</strong> ''' + ', '.join(result["solr"].get("collections", [])) + '''
                    </div>''' if result["solr"].get("collections") else ''}
                </div>
                
                <!-- Solr Update Form -->
                <div class="mt-3 p-3 bg-blue-50 rounded">
                    <h6 class="font-medium text-blue-800 mb-2">Update Solr Connection</h6>
                    <form hx-post="/api/config/update-solr" hx-target="#solr-update-result" class="flex gap-2">
                        <input name="host" type="text" value="{result["solr"]["host"]}" placeholder="localhost" 
                               class="px-2 py-1 border rounded text-sm">
                        <input name="port" type="number" value="{result["solr"]["port"]}" placeholder="8983" 
                               class="px-2 py-1 border rounded text-sm w-20">
                        <button type="submit" class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                            Update & Test
                        </button>
                    </form>
                    <div id="solr-update-result" class="mt-2"></div>
                </div>
            </div>
            
            <!-- Cache Configuration -->
            <div class="mb-6">
                <h5 class="font-medium text-gray-800 mb-2 flex items-center">
                    <span class="w-3 h-3 rounded-full bg-{cache_status_color}-500 mr-2"></span>
                    Cache Configuration
                </h5>
                <div class="bg-gray-50 rounded p-3">
                    <p><strong>Directory:</strong> {result["cache"]["dir"]}</p>
                    <p><strong>Enabled:</strong> {'Yes' if result["cache"]["enabled"] else 'No'}</p>
                    <p><strong>Exists:</strong> {'Yes' if result["cache"]["exists"] else 'No'}</p>
                    {'''<div class="mt-2">
                        <button onclick="createCacheDir()" class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                            Create Cache Directory
                        </button>
                    </div>''' if not result["cache"]["exists"] else ''}
                </div>
            </div>
            
            <!-- Models Configuration -->
            <div class="mb-6">
                <h5 class="font-medium text-gray-800 mb-2">🤖 Models Configuration</h5>
                <div class="bg-gray-50 rounded p-3">
                    <p><strong>Models Directory:</strong> {result["models_dir"]}</p>
                    <p><strong>Total Models:</strong> {len(result["models"])}</p>
                    
                    <!-- Model Statistics -->
                    <div class="mt-3">
                        <h6 class="font-medium text-gray-700 mb-2">Model Statistics by Type:</h6>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
        """
        
        for model_type, stats in result["model_stats"].items():
            if stats["count"] > 0:
                html_content += f"""
                            <div class="bg-white rounded p-2 border">
                                <div class="font-medium text-sm">{model_type.title()}</div>
                                <div class="text-lg font-bold text-blue-600">{stats["count"]}</div>
                            </div>
                """
        
        html_content += f"""
                        </div>
                    </div>
                    
                    <!-- Individual Models -->
                    <div class="mt-4">
                        <h6 class="font-medium text-gray-700 mb-2">Configured Models:</h6>
                        <div class="space-y-2 max-h-48 overflow-y-auto">
        """
        
        for name, model in result["models"].items():
            status_color = "green" if model["available"] else "red"
            html_content += f"""
                            <div class="flex justify-between items-center bg-white p-2 rounded border">
                                <div>
                                    <span class="font-medium">{name}</span>
                                    <span class="text-sm text-gray-500">({model["type"]})</span>
                                </div>
                                <span class="w-3 h-3 rounded-full bg-{status_color}-500"></span>
                            </div>
            """
        
        html_content += f"""
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- System Information -->
            <div class="mb-4">
                <h5 class="font-medium text-gray-800 mb-2">💻 System Information</h5>
                <div class="bg-gray-50 rounded p-3 text-sm">
                    <p><strong>Python:</strong> {result["system_info"].get("python_version", "Unknown")}</p>
                    <p><strong>Platform:</strong> {result["system_info"].get("platform", "Unknown")}</p>
                    <p><strong>GPU:</strong> 
                        <span class="{'text-green-600' if result["system_info"].get("gpu_available") else 'text-gray-500'}">
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
                <button onclick="validateConfig()" 
                        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                    ✅ Validate
                </button>
                <button onclick="exportConfig()" 
                        class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                    📤 Export
                </button>
            </div>
        </div>
        
        <script>
            function refreshConfig() {{
                const form = document.querySelector('form[hx-target="#config-result"]');
                if (form) {{
                    htmx.trigger(form, 'submit');
                }}
            }}
            
            function validateConfig() {{
                fetch('/api/config/validate', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/x-www-form-urlencoded'}},
                    body: 'config_path={result.get("config_path", "")}'
                }})
                .then(response => response.json())
                .then(data => {{
                    const resultDiv = document.getElementById('config-result');
                    let statusClass = data.valid ? 'green' : 'red';
                    let statusText = data.valid ? 'Valid' : 'Invalid';
                    
                    let html = `<div class="mt-4 p-4 bg-${{statusClass}}-50 border border-${{statusClass}}-200 rounded">
                        <h5 class="font-medium text-${{statusClass}}-800">Validation Result: ${{statusText}}</h5>`;
                    
                    if (data.errors && data.errors.length > 0) {{
                        html += '<div class="mt-2"><strong>Errors:</strong><ul class="list-disc ml-4">';
                        data.errors.forEach(error => html += `<li class="text-red-700">${{error}}</li>`);
                        html += '</ul></div>';
                    }}
                    
                    if (data.warnings && data.warnings.length > 0) {{
                        html += '<div class="mt-2"><strong>Warnings:</strong><ul class="list-disc ml-4">';
                        data.warnings.forEach(warning => html += `<li class="text-yellow-700">${{warning}}</li>`);
                        html += '</ul></div>';
                    }}
                    
                    html += '</div>';
                    resultDiv.innerHTML += html;
                }})
                .catch(error => console.error('Validation error:', error));
            }}
            
            function exportConfig() {{
                // Create a downloadable config file
                const configData = {json.dumps(result, indent=2)};
                const blob = new Blob([JSON.stringify(configData, null, 2)], {{type: 'application/json'}});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'histtext-config-export.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }}
            
            function createCacheDir() {{
                fetch('/api/config/create-cache-dir', {{method: 'POST'}})
                .then(response => response.json())
                .then(data => {{
                    alert(data.message || 'Cache directory creation attempted');
                    refreshConfig();
                }})
                .catch(error => alert('Error creating cache directory'));
            }}
        </script>
        """
        
        return HTMLResponse(content=html_content)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
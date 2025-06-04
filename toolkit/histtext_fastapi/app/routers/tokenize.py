# toolkit/histtext_fastapi/app/routers/tokenize.py
"""Enhanced tokenization router with background task support."""

from fastapi import APIRouter, HTTPException, Form, BackgroundTasks
from fastapi.responses import HTMLResponse
from typing import Optional

from ..schemas.tokenize import TokenizeRequest, TokenizeResponse
from ..services.tokenize_service import TokenizeService

router = APIRouter()
tokenize_service = TokenizeService()



@router.post("/process")
async def tokenize_collection(
    background_tasks: BackgroundTasks,
    collection: str = Form(...),
    model_name: str = Form(""),  # Allow empty string, will be processed by validation
    text_field: str = Form("text"),
    model_type: str = Form("transformers"),
    max_length: Optional[int] = Form(None),
    start: int = Form(0),
    batch_size: int = Form(1000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    simplify_chinese: bool = Form(False)
):
    """Tokenize documents with enhanced validation."""
    try:
        # Handle empty collection
        if not collection or collection.strip() == "":
            return HTMLResponse(content=f"""
            <div class="bg-error-50 border border-error-200 rounded-md p-4">
                <h4 class="text-sm font-medium text-error-800 mb-2">❌ Validation Error</h4>
                <div class="text-sm text-error-700">Please select a collection before starting tokenization.</div>
            </div>
            """, status_code=400)
        
        # Handle empty text field
        if not text_field or text_field.strip() == "":
            text_field = "text"
        
        # Handle model name based on type - this is the key fix
        processed_model_name = None
        if model_type == "chinese_segmenter":
            # For Chinese segmenter, model_name should be None
            processed_model_name = None
        else:
            # For other types, model_name is required
            if not model_name or model_name.strip() == "":
                return HTMLResponse(content=f"""
                <div class="bg-error-50 border border-error-200 rounded-md p-4">
                    <h4 class="text-sm font-medium text-error-800 mb-2">❌ Validation Error</h4>
                    <div class="text-sm text-error-700">Model name is required for {model_type} tokenization.</div>
                </div>
                """, status_code=400)
            processed_model_name = model_name.strip()
        
        request_data = TokenizeRequest(
            collection=collection.strip(),
            model_name=processed_model_name,  # Use processed model name
            text_field=text_field.strip(),
            model_type=model_type,
            max_length=max_length,
            start=start,
            batch_size=batch_size,
            num_batches=num_batches,
            filter_query=filter_query.strip() if filter_query else None,
            simplify_chinese=simplify_chinese
        )
        
        # Start processing and get task ID
        task_id = await tokenize_service.tokenize_collection_async(request_data, background_tasks)
      
        
        # Return HTML with progress tracking
        return HTMLResponse(content=f"""
        <div id="tokenize-task-{task_id}" class="bg-purple-50 border border-purple-200 rounded-md p-4 mb-4">
            <div class="flex items-start">
                <div class="flex-shrink-0 mt-1">
                    <svg id="spinner-{task_id}" class="animate-spin h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <div class="ml-3 flex-1">
                    <h3 class="text-sm font-medium text-purple-800">🔤 Tokenization Started</h3>
                    
                    <!-- Task Information -->
                    <div class="mt-2 text-sm text-purple-700">
                        <div class="bg-purple-100 rounded p-2 mb-2">
                            <p><strong>Task ID:</strong> <code class="bg-white px-1 rounded text-xs">{task_id}</code></p>
                            <div class="grid grid-cols-2 gap-2 mt-1">
                                <p><strong>Collection:</strong> {collection}</p>
                                <p><strong>Model:</strong> {model_name} ({model_type})</p>
                                <p><strong>Text Field:</strong> {text_field}</p>
                                <p><strong>Batch Size:</strong> {batch_size:,}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="mt-3">
                        <div id="progress-bar-{task_id}" class="w-full bg-purple-200 rounded-full h-3">
                            <div class="bg-purple-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium" style="width: 5%">
                                <span id="progress-text-{task_id}">5%</span>
                            </div>
                        </div>
                        <div id="status-text-{task_id}" class="text-sm text-purple-600 mt-1 font-medium">Initializing...</div>
                    </div>
                    
                    <!-- Statistics Dashboard -->
                    <div class="mt-3 bg-white rounded-lg p-3 border">
                        <h4 class="text-xs font-medium text-gray-700 mb-2">📊 Processing Statistics</h4>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div class="text-center">
                                <div class="text-lg font-bold text-purple-600" id="batch-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Current Batch</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-green-600" id="docs-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Documents</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-orange-600" id="speed-{task_id}">-</div>
                                <div class="text-xs text-gray-500">docs/sec</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="checkTokenizeStatus('{task_id}')" 
                                class="text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1 rounded-md">
                            🔄 Refresh Status
                        </button>
                        <button onclick="copyTaskId('{task_id}')" 
                                class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md">
                           📋 Copy Task ID
                       </button>
                       <button onclick="downloadTokenizeLogs('{task_id}')" 
                               class="text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md">
                           📄 Download Logs
                       </button>
                       <button onclick="clearTokenizeTask('{task_id}')" 
                               class="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md">
                           ❌ Clear
                       </button>
                   </div>
               </div>
           </div>
       </div>
       
       <script>
           window.checkTokenizeStatus = function(taskId) {{
               fetch(`/api/tokenize/status/${{taskId}}`)
                   .then(response => response.json())
                   .then(data => {{
                       updateTokenizeProgress(taskId, data);
                       if (data.status === 'running' || data.status === 'starting') {{
                           setTimeout(() => window.checkTokenizeStatus(taskId), 2000);
                       }}
                   }})
                   .catch(error => console.error('Error checking tokenize status:', error));
           }};
           
           window.updateTokenizeProgress = function(taskId, data) {{
               const progressBar = document.querySelector(`#progress-bar-${{taskId}} div`);
               const progressText = document.getElementById(`progress-text-${{taskId}}`);
               const statusText = document.getElementById(`status-text-${{taskId}}`);
               const spinner = document.getElementById(`spinner-${{taskId}}`);
               
               if (progressBar && progressText) {{
                   const progress = Math.max(data.progress || 0, 0);
                   progressBar.style.width = progress + '%';
                   progressText.textContent = Math.round(progress) + '%';
               }}
               
               if (statusText) {{
                   if (data.status === 'completed') {{
                       statusText.className = 'text-sm text-green-600 mt-1 font-medium';
                       statusText.innerHTML = `✅ ${{data.message}}`;
                       if (data.processing_time) {{
                           statusText.innerHTML += `<br><small>⏱️ Total time: ${{data.processing_time.toFixed(2)}}s</small>`;
                       }}
                       if (progressBar) {{
                           progressBar.className = 'bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium';
                           progressBar.style.width = '100%';
                           progressText.textContent = '✅ Complete';
                       }}
                       if (spinner) {{
                           spinner.classList.remove('animate-spin');
                           spinner.innerHTML = '<svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
                       }}
                   }} else if (data.status === 'failed') {{
                       statusText.className = 'text-sm text-red-600 mt-1 font-medium';
                       statusText.innerHTML = `❌ ${{data.message || data.error}}`;
                       if (progressBar) {{
                           progressBar.className = 'bg-red-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium';
                           progressText.textContent = '❌ Failed';
                       }}
                       if (spinner) {{
                           spinner.classList.remove('animate-spin');
                           spinner.innerHTML = '<svg class="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
                       }}
                   }} else {{
                       statusText.className = 'text-sm text-purple-600 mt-1 font-medium';
                       statusText.textContent = data.message || 'Processing...';
                   }}
               }}
               
               // Update statistics
               const batchEl = document.getElementById(`batch-${{taskId}}`);
               const docsEl = document.getElementById(`docs-${{taskId}}`);
               const speedEl = document.getElementById(`speed-${{taskId}}`);
               
               if (batchEl) batchEl.textContent = data.current_batch || '-';
               if (docsEl) docsEl.textContent = data.total_docs ? data.total_docs.toLocaleString() : '-';
               if (speedEl) speedEl.textContent = data.processing_speed ? data.processing_speed.toFixed(1) : '-';
           }};
           
           window.downloadTokenizeLogs = function(taskId) {{
               fetch(`/api/tokenize/logs/${{taskId}}?last_n=-1`)
                   .then(response => response.json())
                   .then(data => {{
                       const blob = new Blob([data.logs.join('\\n')], {{ type: 'text/plain' }});
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = `tokenize-logs-${{taskId}}.txt`;
                       document.body.appendChild(a);
                       a.click();
                       document.body.removeChild(a);
                       URL.revokeObjectURL(url);
                   }})
                   .catch(error => console.error('Error downloading tokenize logs:', error));
           }};
           
           window.clearTokenizeTask = function(taskId) {{
               const taskDiv = document.getElementById('tokenize-task-' + taskId);
               if (taskDiv && confirm('Clear this task from the display?')) {{
                   taskDiv.style.opacity = '0.5';
                   setTimeout(() => taskDiv.remove(), 300);
               }}
           }};
           
           // Auto-start status checking
           setTimeout(() => checkTokenizeStatus('{task_id}'), 1000);
       </script>
       """)
       
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="bg-error-50 border border-error-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-error-800 mb-2">❌ Processing Error</h4>
            <div class="text-sm text-error-700">Failed to start tokenization: {str(e)}</div>
        </div>
        """, status_code=400)


@router.get("/status/{task_id}")
async def get_tokenize_status(task_id: str):
   """Get status of tokenization processing task."""
   try:
       status = await tokenize_service.get_task_status(task_id)
       return status
   except Exception as e:
       raise HTTPException(status_code=404, detail=str(e))


@router.get("/logs/{task_id}")
async def get_tokenize_logs(task_id: str, last_n: int = 50):
   """Get detailed logs for a tokenization task."""
   try:
       logs = await tokenize_service.get_task_logs(task_id, last_n)
       return {"logs": logs}
   except Exception as e:
       raise HTTPException(status_code=404, detail=str(e))


@router.get("/supported-models")
async def get_supported_tokenize_models():
   """Get list of supported tokenization model types."""
   return {
       "model_types": [
           "transformers",
           "spacy", 
           "chinese_segmenter"
       ]
   }


@router.get("/collections")
async def get_solr_collections():
   """Get list of Solr collections for tokenization."""
   try:
       from histtext_toolkit.core.config import get_config
       from histtext_toolkit.solr.client import SolrClient
       from ..core.config import get_settings

       try:
           cfg = get_config()
           solr_host = cfg.solr.host
           solr_port = cfg.solr.port
           solr_username = cfg.solr.username
           solr_password = cfg.solr.password
       except:
           settings = get_settings()
           solr_host = settings.default_solr_host
           solr_port = settings.default_solr_port
           solr_username = None
           solr_password = None
       
       solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
       await solr_client.start_session()
       
       try:
           collections = await solr_client.get_collections()
           return {"collections": collections}
       finally:
           await solr_client.close_session()
           
   except Exception as e:
       return {"collections": [], "error": str(e)}


@router.get("/collections/{collection}/fields")
async def get_collection_fields(collection: str):
   """Get fields for a specific Solr collection."""
   try:
       from histtext_toolkit.core.config import get_config
       from histtext_toolkit.solr.client import SolrClient
       from ..core.config import get_settings
       
       try:
           cfg = get_config()
           solr_host = cfg.solr.host
           solr_port = cfg.solr.port
           solr_username = cfg.solr.username
           solr_password = cfg.solr.password
       except:
           settings = get_settings()
           solr_host = settings.default_solr_host
           solr_port = settings.default_solr_port
           solr_username = None
           solr_password = None
       
       solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
       await solr_client.start_session()
       
       try:
           fields = await solr_client.get_text_fields(collection)
           return {"fields": fields}
       finally:
           await solr_client.close_session()
           
   except Exception as e:
       return {"fields": ["text", "content", "body", "title"], "error": str(e)}
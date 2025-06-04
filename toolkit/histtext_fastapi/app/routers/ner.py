"""Named Entity Recognition endpoints."""

import traceback
from fastapi import APIRouter, HTTPException, Form, BackgroundTasks
from fastapi.responses import HTMLResponse
from typing import Optional, List

from ..schemas.ner import NERRequest, NERResponse, NERTestRequest, NERTestResponse
from ..services.ner_service import NERService

router = APIRouter()
ner_service = NERService()


@router.post("/process")
async def process_ner(
    background_tasks: BackgroundTasks,
    collection: str = Form(...),
    model_name: str = Form(...),
    model_type: str = Form("transformers"),
    text_field: str = Form("text"),  # Default value
    entity_types: Optional[str] = Form(""),
    max_length: Optional[int] = Form(None),
    aggregation_strategy: str = Form("simple"),
    threshold: float = Form(0.5),
    start: int = Form(0),
    batch_size: int = Form(10000),
    num_batches: Optional[int] = Form(None),
    filter_query: Optional[str] = Form(None),
    use_gpu: bool = Form(False),
    optimization_level: int = Form(1),
    compact_labels: bool = Form(True),
    label_stats: bool = Form(False)
):
    """Process NER on a collection with enhanced empty value handling."""
    try:
        # Handle empty or invalid collection
        if not collection or collection.strip() == "":
            return HTMLResponse(content=f"""
            <div class="bg-error-50 border border-error-200 rounded-md p-4">
                <h4 class="text-sm font-medium text-error-800 mb-2">❌ Validation Error</h4>
                <div class="text-sm text-error-700">Please select a collection before starting NER processing.</div>
            </div>
            """, status_code=400)
        
        # Handle empty text field - default to common field names
        if not text_field or text_field.strip() == "":
            text_field = "text"  # Default to most common field name
        
        # Handle empty model name
        if not model_name or model_name.strip() == "":
            return HTMLResponse(content=f"""
            <div class="bg-error-50 border border-error-200 rounded-md p-4">
                <h4 class="text-sm font-medium text-error-800 mb-2">❌ Validation Error</h4>
                <div class="text-sm text-error-700">Please select a model before starting NER processing.</div>
            </div>
            """, status_code=400)
        
        request_data = NERRequest(
            collection=collection.strip(),
            model_name=model_name.strip(),
            model_type=model_type,
            text_field=text_field.strip(),
            entity_types=entity_types.split(",") if entity_types and entity_types.strip() else [],
            max_length=max_length,
            aggregation_strategy=aggregation_strategy,
            threshold=threshold,
            start=start,
            batch_size=batch_size,
            num_batches=num_batches,
            filter_query=filter_query.strip() if filter_query else None,
            use_gpu=use_gpu,
            optimization_level=optimization_level,
            compact_labels=compact_labels,
            label_stats=label_stats
        )
        
        # Start processing and get task ID
        task_id = await ner_service.process_ner_async(request_data, background_tasks)
        
        
        # Return HTML with larger log display and better statistics
        return HTMLResponse(content=f"""
        <div id="ner-task-{task_id}" class="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <div class="flex items-start">
                <div class="flex-shrink-0 mt-1">
                    <svg id="spinner-{task_id}" class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <div class="ml-3 flex-1">
                    <h3 class="text-sm font-medium text-blue-800">🚀 NER Processing Started</h3>
                    
                    <!-- Task Information -->
                    <div class="mt-2 text-sm text-blue-700">
                        <div class="bg-blue-100 rounded p-2 mb-2">
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
                        <div id="progress-bar-{task_id}" class="w-full bg-blue-200 rounded-full h-3">
                            <div class="bg-blue-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium" style="width: 5%">
                                <span id="progress-text-{task_id}">5%</span>
                            </div>
                        </div>
                        <div id="status-text-{task_id}" class="text-sm text-blue-600 mt-1 font-medium">Initializing...</div>
                    </div>
                    
                    <!-- Enhanced Statistics Dashboard -->
                    <div class="mt-3 bg-white rounded-lg p-3 border">
                        <h4 class="text-xs font-medium text-gray-700 mb-2">📊 Processing Statistics</h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div class="text-center">
                                <div class="text-lg font-bold text-blue-600" id="batch-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Current Batch</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-green-600" id="docs-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Documents</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-purple-600" id="entities-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Entities Found</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-orange-600" id="speed-{task_id}">-</div>
                                <div class="text-xs text-gray-500">docs/sec</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Enhanced Live Logs -->
                    <div class="mt-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium text-blue-800">📋 Live Processing Logs</h4>
                            <div class="flex gap-2">
                                <button onclick="toggleLogs('{task_id}')" class="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 bg-blue-100 rounded">
                                    <span id="logs-toggle-{task_id}">Collapse</span>
                                </button>
                                <button onclick="refreshLogs('{task_id}')" class="text-xs text-green-600 hover:text-green-800 px-2 py-1 bg-green-100 rounded">
                                    🔄 Refresh
                                </button>
                            </div>
                        </div>
                        <div id="logs-container-{task_id}" class="bg-gray-900 text-green-400 text-xs p-3 rounded-lg font-mono max-h-64 overflow-y-auto border">
                            <div id="logs-{task_id}" class="whitespace-pre-wrap">
                                <div class="text-gray-500">🔄 Initializing logging system...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="checkStatus('{task_id}')" 
                                class="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md">
                            🔄 Refresh Status
                        </button>
                        <button onclick="copyTaskId('{task_id}')" 
                                class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md">
                            📋 Copy Task ID
                        </button>
                        <button onclick="downloadLogs('{task_id}')" 
                                class="text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md">
                            📄 Download Full Logs
                        </button>
                        <button onclick="showUploadCommand('{task_id}')" 
                                class="text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1 rounded-md">
                            📤 Show Upload Command
                        </button>
                        <button onclick="cancelTask('{task_id}')" 
                                class="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md">
                            ❌ Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            // Enhanced status checking with proper statistics updates
            window.checkStatus = function(taskId) {{
                fetch(`/api/ner/status/${{taskId}}`)
                    .then(response => response.json())
                    .then(data => {{
                        console.log('Status update for', taskId, data); // Debug log
                        updateProgressWithLogs(taskId, data);
                        
                        // Only continue auto-refresh if still processing
                        if (data.status === 'running' || data.status === 'starting') {{
                            setTimeout(() => window.checkStatus(taskId), 2000);
                        }} else {{
                            console.log('Processing finished with status:', data.status);
                        }}
                    }})
                    .catch(error => {{
                        console.error('Error checking status:', error);
                    }});
            }};
            
            // Enhanced progress update with proper statistics
            window.updateProgressWithLogs = function(taskId, data) {{
                // Update progress bar and text
                const progressBar = document.querySelector(`#progress-bar-${{taskId}} div`);
                const progressText = document.getElementById(`progress-text-${{taskId}}`);
                const statusText = document.getElementById(`status-text-${{taskId}}`);
                const spinner = document.getElementById(`spinner-${{taskId}}`);
                
                if (progressBar && progressText) {{
                    const progress = Math.max(data.progress || 0, 0);
                    progressBar.style.width = progress + '%';
                    progressText.textContent = Math.round(progress) + '%';
                }}
                
                // Update status text
                if (statusText) {{
                    if (data.status === 'completed') {{
                        statusText.className = 'text-sm text-green-600 mt-1 font-medium';
                        statusText.innerHTML = `✅ ${{data.message}}`;
                        if (data.processing_time) {{
                            statusText.innerHTML += `<br><small>⏱️ Total time: ${{data.processing_time.toFixed(2)}}s</small>`;
                        }}
                        
                        // Change progress bar to green
                        if (progressBar) {{
                            progressBar.className = 'bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium';
                            progressBar.style.width = '100%';
                            progressText.textContent = '✅ Complete';
                        }}
                        
                        // Stop spinner
                        if (spinner) {{
                            spinner.classList.remove('animate-spin');
                            spinner.innerHTML = '<svg class="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
                        }}
                    }} else if (data.status === 'failed') {{
                        statusText.className = 'text-sm text-red-600 mt-1 font-medium';
                        statusText.innerHTML = `❌ ${{data.message || data.error}}`;
                        
                        // Change progress bar to red
                        if (progressBar) {{
                            progressBar.className = 'bg-red-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium';
                            progressText.textContent = '❌ Failed';
                        }}
                        
                        // Stop spinner
                        if (spinner) {{
                            spinner.classList.remove('animate-spin');
                            spinner.innerHTML = '<svg class="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
                        }}
                    }} else {{
                        // Still processing
                        statusText.className = 'text-sm text-blue-600 mt-1 font-medium';
                        statusText.textContent = data.message || 'Processing...';
                    }}
                }}
                
                // Update statistics with proper formatting
                const batchEl = document.getElementById(`batch-${{taskId}}`);
                const docsEl = document.getElementById(`docs-${{taskId}}`);
                const entitiesEl = document.getElementById(`entities-${{taskId}}`);
                const speedEl = document.getElementById(`speed-${{taskId}}`);
                
                if (batchEl) {{
                    batchEl.textContent = data.current_batch || '-';
                }}
                if (docsEl) {{
                    docsEl.textContent = data.total_docs ? data.total_docs.toLocaleString() : '-';
                }}
                if (entitiesEl) {{
                    entitiesEl.textContent = data.total_entities ? data.total_entities.toLocaleString() : '-';
                }}
                if (speedEl) {{
                    speedEl.textContent = data.processing_speed ? data.processing_speed.toFixed(1) : '-';
                }}
                
                // Update logs with better formatting
                const logsEl = document.getElementById(`logs-${{taskId}}`);
                if (logsEl && data.logs && data.logs.length > 0) {{
                    const logsHtml = data.logs.map(log => {{
                        // Color-code different log levels
                        if (log.includes('ERROR:')) {{
                            return `<div class="text-red-400">${{log}}</div>`;
                        }} else if (log.includes('WARNING:')) {{
                            return `<div class="text-yellow-400">${{log}}</div>`;
                        }} else if (log.includes('INFO:')) {{
                            return `<div class="text-green-400">${{log}}</div>`;
                        }} else {{
                            return `<div>${{log}}</div>`;
                        }}
                    }}).join('');
                    logsEl.innerHTML = logsHtml;
                    
                    // Auto-scroll to bottom
                    const logsContainer = document.getElementById(`logs-container-${{taskId}}`);
                    if (logsContainer) {{
                        logsContainer.scrollTop = logsContainer.scrollHeight;
                    }}
                }}
            }};
            
            // Toggle logs visibility
            window.toggleLogs = function(taskId) {{
                const logsEl = document.getElementById(`logs-container-${{taskId}}`);
                const toggleEl = document.getElementById(`logs-toggle-${{taskId}}`);
                
                if (logsEl.style.display === 'none') {{
                    logsEl.style.display = 'block';
                    toggleEl.textContent = 'Collapse';
                }} else {{
                    logsEl.style.display = 'none';
                    toggleEl.textContent = 'Show Logs';
                }}
            }};
            
            // Refresh logs manually
           window.refreshLogs = function(taskId) {{
               fetch(`/api/ner/logs/${{taskId}}?last_n=50`)
                   .then(response => response.json())
                   .then(data => {{
                       const logsEl = document.getElementById(`logs-${{taskId}}`);
                       if (logsEl && data.logs && data.logs.length > 0) {{
                           const logsHtml = data.logs.map(log => {{
                               // Color-code different log levels
                               if (log.includes('ERROR:')) {{
                                   return `<div class="text-red-400">${{log}}</div>`;
                               }} else if (log.includes('WARNING:')) {{
                                   return `<div class="text-yellow-400">${{log}}</div>`;
                               }} else if (log.includes('INFO:')) {{
                                   return `<div class="text-green-400">${{log}}</div>`;
                               }} else {{
                                   return `<div>${{log}}</div>`;
                               }}
                           }}).join('');
                           logsEl.innerHTML = logsHtml;
                           
                           // Auto-scroll to bottom
                           const logsContainer = document.getElementById(`logs-container-${{taskId}}`);
                           if (logsContainer) {{
                               logsContainer.scrollTop = logsContainer.scrollHeight;
                           }}
                       }}
                   }})
                   .catch(error => {{
                       console.error('Error refreshing logs:', error);
                   }});
           }};
           
           // Download full logs
           window.downloadLogs = function(taskId) {{
               fetch(`/api/ner/logs/${{taskId}}?last_n=-1`)
                   .then(response => response.json())
                   .then(data => {{
                       const blob = new Blob([data.logs.join('\\n')], {{ type: 'text/plain' }});
                       const url = URL.createObjectURL(blob);
                       const a = document.createElement('a');
                       a.href = url;
                       a.download = `ner-processing-logs-${{taskId}}.txt`;
                       document.body.appendChild(a);
                       a.click();
                       document.body.removeChild(a);
                       URL.revokeObjectURL(url);
                       
                       // Show feedback
                       const button = event.target;
                       const originalText = button.textContent;
                       button.textContent = '✅ Downloaded!';
                       button.className = button.className.replace('bg-green-100 hover:bg-green-200 text-green-800', 'bg-green-200 text-green-900');
                       setTimeout(() => {{
                           button.textContent = originalText;
                           button.className = button.className.replace('bg-green-200 text-green-900', 'bg-green-100 hover:bg-green-200 text-green-800');
                       }}, 2000);
                   }})
                   .catch(error => {{
                       console.error('Error downloading logs:', error);
                       alert('Error downloading logs. Check console for details.');
                   }});
           }};
           
           // Show upload command
           window.showUploadCommand = function(taskId) {{
               fetch(`/api/ner/status/${{taskId}}`)
                   .then(response => response.json())
                   .then(data => {{
                       if (data.status === 'completed') {{
                           const collection = data.collection;
                           const uploadCollection = `${{collection}}_ner`;
                           const command = `histtext-toolkit upload ${{uploadCollection}} "cache/${{data.model_name}}/${{collection}}/*/\*.jsonl" --schema cache/${{uploadCollection}}.yaml`;
                           
                           // Create modal or alert with the command
                           const modal = document.createElement('div');
                           modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
                           modal.innerHTML = `
                               <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                                   <h3 class="text-lg font-medium text-gray-900 mb-4">📤 Upload Command</h3>
                                   <p class="text-sm text-gray-600 mb-3">Use this command to upload the NER results to Solr:</p>
                                   <div class="bg-gray-100 p-3 rounded-md mb-4">
                                       <code class="text-sm font-mono break-all">${{command}}</code>
                                   </div>
                                   <div class="flex gap-2">
                                       <button onclick="copyToClipboard('${{command}}')" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                                           📋 Copy Command
                                       </button>
                                       <button onclick="closeModal()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400">
                                           Close
                                       </button>
                                   </div>
                               </div>
                           `;
                           
                           document.body.appendChild(modal);
                           
                           // Close modal function
                           window.closeModal = function() {{
                               document.body.removeChild(modal);
                           }};
                           
                           // Copy to clipboard function
                           window.copyToClipboard = function(text) {{
                               navigator.clipboard.writeText(text).then(() => {{
                                   const button = event.target;
                                   const originalText = button.textContent;
                                   button.textContent = '✅ Copied!';
                                   setTimeout(() => {{
                                       button.textContent = originalText;
                                   }}, 2000);
                               }});
                           }};
                           
                           // Close on background click
                           modal.addEventListener('click', function(e) {{
                               if (e.target === modal) {{
                                   closeModal();
                               }}
                           }});
                           
                       }} else {{
                           alert('Processing not completed yet. Please wait for completion to get the upload command.');
                       }}
                   }})
                   .catch(error => {{
                       console.error('Error getting upload command:', error);
                       alert('Error getting upload command. Check console for details.');
                   }});
           }};
           
           // Copy task ID
           function copyTaskId(taskId) {{
               navigator.clipboard.writeText(taskId).then(() => {{
                   const button = event.target;
                   const originalText = button.textContent;
                   button.textContent = '✅ Copied!';
                   button.className = button.className.replace('bg-gray-100 hover:bg-gray-200 text-gray-800', 'bg-gray-200 text-gray-900');
                   setTimeout(() => {{
                       button.textContent = originalText;
                       button.className = button.className.replace('bg-gray-200 text-gray-900', 'bg-gray-100 hover:bg-gray-200 text-gray-800');
                   }}, 2000);
               }});
           }}
           
           // Cancel/Clear task
           function cancelTask(taskId) {{
               const taskDiv = document.getElementById('ner-task-' + taskId);
               if (taskDiv) {{
                   if (confirm('Are you sure you want to clear this task from the display?')) {{
                       taskDiv.style.opacity = '0.5';
                       taskDiv.style.transform = 'scale(0.95)';
                       setTimeout(() => {{
                           taskDiv.remove();
                       }}, 300);
                   }}
               }}
           }}
           
           // Auto-start status checking for this task
           setTimeout(() => checkStatus('{task_id}'), 1000);
           
           // Set up periodic log refresh every 5 seconds during processing
           let logRefreshInterval = setInterval(() => {{
               // Only refresh if still processing
               fetch(`/api/ner/status/{task_id}`)
                   .then(response => response.json())
                   .then(data => {{
                       if (data.status === 'running' || data.status === 'starting') {{
                           refreshLogs('{task_id}');
                       }} else {{
                           clearInterval(logRefreshInterval);
                       }}
                   }});
           }}, 5000);
       </script>
       """)
            
        
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="bg-error-50 border border-error-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-error-800 mb-2">❌ Processing Error</h4>
            <div class="text-sm text-error-700">Failed to start NER processing: {str(e)}</div>
        </div>
        """, status_code=400)


@router.get("/status/{task_id}")
async def get_ner_status(task_id: str):
    """Get status of NER processing task."""
    try:
        status = await ner_service.get_task_status(task_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models")
async def get_ner_models():
    """Get available NER models with details."""
    models = await ner_service.get_available_models()
    return models


@router.get("/models/dropdown")
async def get_ner_models_dropdown():
    """Get NER models formatted for dropdown."""
    models = await ner_service.get_available_models()
    
    dropdown_html = ""
    for model_type, model_list in models.items():
        dropdown_html += f'<optgroup label="{model_type.title()}">'
        for model in model_list:
            dropdown_html += f'<option value="{model["name"]}" data-type="{model_type}">{model["display_name"]}</option>'
        dropdown_html += '</optgroup>'
    
    return HTMLResponse(content=dropdown_html)


@router.post("/test")
async def test_ner(
    model_name: str = Form(...),
    model_type: str = Form("transformers"),
    text: str = Form(...),
    entity_types: Optional[str] = Form("")
):
    """Test NER with sample text."""
    try:
        request_data = NERTestRequest(
            model_name=model_name,
            model_type=model_type,
            text=text,
            entity_types=entity_types.split(",") if entity_types else []
        )
        
        result = await ner_service.test_ner(request_data)
        
        # Return formatted HTML result
        entities_html = ""
        if result["entities"]:
            entities_html = "<div class='space-y-2'>"
            for entity in result["entities"]:
                entities_html += f"""
                <div class="bg-gray-50 p-2 rounded border">
                    <span class="font-medium text-gray-900">{entity.get('text', '')}</span>
                    <span class="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">{entity.get('label', '')}</span>
                    <span class="ml-2 text-sm text-gray-600">({entity.get('confidence', 0):.2f})</span>
                </div>
                """
            entities_html += "</div>"
        else:
            entities_html = "<p class='text-gray-500 italic'>No entities found</p>"
        
        return HTMLResponse(content=f"""
        <div class="bg-green-50 border border-green-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-green-800 mb-2">NER Test Results</h4>
            <div class="text-sm text-green-700">
                <p><strong>Model:</strong> {model_name} ({model_type})</p>
                <p><strong>Processing Time:</strong> {result.get('processing_time', 0):.3f}s</p>
                <div class="mt-3">
                    <strong>Entities Found:</strong>
                    {entities_html}
                </div>
            </div>
        </div>
        """)
        
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-red-800 mb-2">NER Test Failed</h4>
            <div class="text-sm text-red-700">{str(e)}</div>
        </div>
        """)

@router.get("/debug/environment")
async def debug_environment():
    """Debug endpoint to check the environment and model availability."""
    debug_info = {
        "python_path": [],
        "spacy_info": {},
        "histtext_imports": {},
        "available_models": {},
        "system_info": {}
    }
    
    try:
        import sys
        debug_info["python_path"] = sys.path[:5]  # First 5 paths
        
        # Check spaCy
        try:
            import spacy
            debug_info["spacy_info"]["version"] = spacy.__version__
            debug_info["spacy_info"]["models"] = list(spacy.util.get_installed_models())
        except Exception as e:
            debug_info["spacy_info"]["error"] = str(e)
        
        # Check histtext_toolkit imports
        try:
            from histtext_toolkit.core.config import get_config
            cfg = get_config()
            debug_info["histtext_imports"]["config_loaded"] = True
            debug_info["histtext_imports"]["solr_host"] = cfg.solr.host
            debug_info["histtext_imports"]["cache_dir"] = cfg.cache.root_dir
        except Exception as e:
            debug_info["histtext_imports"]["error"] = str(e)
        
        # Check if spaCy model can be loaded
        try:
            import spacy
            nlp = spacy.load("en_core_web_sm")
            debug_info["available_models"]["en_core_web_sm"] = "✅ Available"
        except Exception as e:
            debug_info["available_models"]["en_core_web_sm"] = f"❌ Error: {str(e)}"
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
    
@router.post("/install-model")
async def install_spacy_model(model_name: str = Form("en_core_web_sm")):
    """Helper endpoint to install spaCy models."""
    import subprocess
    import sys
    
    try:
        # Run the spaCy download command
        result = subprocess.run(
            [sys.executable, "-m", "spacy", "download", model_name],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            return HTMLResponse(content=f"""
            <div class="bg-green-50 border border-green-200 rounded-md p-4">
                <h4 class="text-sm font-medium text-green-800 mb-2">✅ Model Installed Successfully</h4>
                <div class="text-sm text-green-700">
                    <p><strong>Model:</strong> {model_name}</p>
                    <pre class="bg-white p-2 rounded mt-2 text-xs">{result.stdout}</pre>
                </div>
            </div>
            """)
        else:
            return HTMLResponse(content=f"""
            <div class="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 class="text-sm font-medium text-red-800 mb-2">❌ Installation Failed</h4>
                <div class="text-sm text-red-700">
                    <p><strong>Model:</strong> {model_name}</p>
                    <p><strong>Return code:</strong> {result.returncode}</p>
                    <pre class="bg-white p-2 rounded mt-2 text-xs">{result.stderr}</pre>
                </div>
            </div>
            """)
            
    except Exception as e:
        return HTMLResponse(content=f"""
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
            <h4 class="text-sm font-medium text-red-800 mb-2">❌ Installation Error</h4>
            <div class="text-sm text-red-700">
                <p><strong>Error:</strong> {str(e)}</p>
            </div>
        </div>
        """)

@router.get("/logs/{task_id}")
async def get_task_logs(task_id: str, last_n: int = 50):
    """Get detailed logs for a task."""
    try:
        logs = await ner_service.get_task_logs(task_id, last_n)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    
@router.get("/collections")
async def get_solr_collections():
    """Get list of Solr collections."""
    try:
        from histtext_toolkit.core.config import get_config
        from histtext_toolkit.solr.client import SolrClient

        try:
            cfg = get_config()
            solr_host = cfg.solr.host
            solr_port = cfg.solr.port
            solr_username = cfg.solr.username
            solr_password = cfg.solr.password
        except:
            # Use defaults
            from histtext_toolkit.core.config import get_settings
            settings = get_settings()
            solr_host = settings.default_solr_host
            solr_port = settings.default_solr_port
            solr_username = None
            solr_password = None
        
        solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
        await solr_client.start_session()
        
        try:
            # Get collections from Solr
            collections = await solr_client.get_collections()
            return {"collections": collections}
        finally:
            await solr_client.close_session()
            
    except Exception as e:
        # Return empty list if can't connect to Solr
        return {"collections": [], "error": str(e)}


@router.get("/collections/{collection}/fields")
async def get_collection_fields(collection: str):
    """Get fields for a specific Solr collection."""
    try:
        from histtext_toolkit.core.config import get_config
        from histtext_toolkit.solr.client import SolrClient
        
        try:
            cfg = get_config()
            solr_host = cfg.solr.host
            solr_port = cfg.solr.port
            solr_username = cfg.solr.username
            solr_password = cfg.solr.password
        except:
            # Use defaults
            from histtext_toolkit.core.config import get_settings
            settings = get_settings()
            solr_host = settings.default_solr_host
            solr_port = settings.default_solr_port
            solr_username = None
            solr_password = None
        
        solr_client = SolrClient(solr_host, solr_port, solr_username, solr_password)
        await solr_client.start_session()
        
        try:
            # Get schema fields from Solr
            fields = await solr_client.get_text_fields(collection)
            return {"fields": fields}
        finally:
            await solr_client.close_session()
            
    except Exception as e:
        # Return common field names if can't connect
        return {"fields": ["text", "content", "body", "title"], "error": str(e)}


@router.get("/entity-types")
async def get_common_entity_types():
    """Get list of common entity types for different model types."""
    return {
        "common": ["PERSON", "ORGANIZATION", "LOCATION"],
        "transformers": ["PERSON", "ORG", "LOC", "MISC"],
        "spacy": ["PERSON", "ORG", "GPE", "DATE", "TIME", "MONEY", "QUANTITY"],
        "gliner": ["Person", "Organization", "Location", "Product", "Event", "Date"],
        "flair": ["PER", "ORG", "LOC", "MISC"],
        "stanza": ["PERSON", "ORG", "GPE", "DATE", "TIME", "MONEY", "PERCENT"]
    }
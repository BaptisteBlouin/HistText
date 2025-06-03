# toolkit/histtext_fastapi/app/routers/embeddings.py
"""Enhanced embeddings router with background task support."""

from fastapi import APIRouter, HTTPException, Form, BackgroundTasks
from fastapi.responses import HTMLResponse
from typing import Optional

from ..schemas.embeddings import EmbeddingsRequest, EmbeddingsResponse, WordEmbeddingsRequest
from ..services.embeddings_service import EmbeddingsService

router = APIRouter()
embeddings_service = EmbeddingsService()


@router.post("/compute")
async def compute_embeddings(
    background_tasks: BackgroundTasks,
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
    simplify_chinese: bool = Form(False)
):
    """Compute embeddings for documents in a collection with real-time updates."""
    try:
        request_data = EmbeddingsRequest(
            collection=collection,
            output_path=output_path,
            model_name=model_name,
            text_field=text_field,
            model_type=model_type,
            dim=dim,
            max_length=max_length,
            output_format=output_format,
            start=start,
            batch_size=batch_size,
            num_batches=num_batches,
            filter_query=filter_query,
            simplify_chinese=simplify_chinese
        )
        
        # Start processing and get task ID
        task_id = await embeddings_service.compute_embeddings_async(request_data, background_tasks)
        
        # Return HTML with progress tracking
        return HTMLResponse(content=f"""
        <div id="embeddings-task-{task_id}" class="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <div class="flex items-start">
                <div class="flex-shrink-0 mt-1">
                    <svg id="spinner-{task_id}" class="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <div class="ml-3 flex-1">
                    <h3 class="text-sm font-medium text-blue-800">🎯 Embeddings Computation Started</h3>
                    
                    <!-- Task Information -->
                    <div class="mt-2 text-sm text-blue-700">
                        <div class="bg-blue-100 rounded p-2 mb-2">
                            <p><strong>Task ID:</strong> <code class="bg-white px-1 rounded text-xs">{task_id}</code></p>
                            <div class="grid grid-cols-2 gap-2 mt-1">
                                <p><strong>Collection:</strong> {collection}</p>
                                <p><strong>Model:</strong> {model_name} ({model_type})</p>
                                <p><strong>Output:</strong> {output_path}</p>
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
                    
                    <!-- Statistics Dashboard -->
                    <div class="mt-3 bg-white rounded-lg p-3 border">
                        <h4 class="text-xs font-medium text-gray-700 mb-2">📊 Processing Statistics</h4>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div class="text-center">
                                <div class="text-lg font-bold text-blue-600" id="batch-{task_id}">-</div>
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
                    
                    <!-- Live Logs -->
                    <div class="mt-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium text-blue-800">📋 Live Processing Logs</h4>
                            <button onclick="refreshEmbeddingsLogs('{task_id}')" class="text-xs text-green-600 hover:text-green-800 px-2 py-1 bg-green-100 rounded">
                                🔄 Refresh
                            </button>
                        </div>
                        <div class="bg-gray-900 text-green-400 text-xs p-3 rounded-lg font-mono max-h-48 overflow-y-auto border">
                            <div id="logs-{task_id}" class="whitespace-pre-wrap">
                                <div class="text-gray-500">🔄 Initializing logging system...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="checkEmbeddingsStatus('{task_id}')" 
                                class="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md">
                            🔄 Refresh Status
                        </button>
                        <button onclick="copyTaskId('{task_id}')" 
                                class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md">
                            📋 Copy Task ID
                        </button>
                        <button onclick="downloadEmbeddingsLogs('{task_id}')" 
                                class="text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md">
                            📄 Download Logs
                        </button>
                        <button onclick="clearEmbeddingsTask('{task_id}')" 
                                class="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md">
                            ❌ Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            window.checkEmbeddingsStatus = function(taskId) {{
                fetch(`/api/embeddings/status/${{taskId}}`)
                    .then(response => response.json())
                    .then(data => {{
                        updateEmbeddingsProgress(taskId, data);
                        if (data.status === 'running' || data.status === 'starting') {{
                            setTimeout(() => window.checkEmbeddingsStatus(taskId), 2000);
                        }}
                    }})
                    .catch(error => console.error('Error checking embeddings status:', error));
            }};
            
            window.updateEmbeddingsProgress = function(taskId, data) {{
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
                        statusText.className = 'text-sm text-blue-600 mt-1 font-medium';
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
                
                // Update logs
                const logsEl = document.getElementById(`logs-${{taskId}}`);
                if (logsEl && data.logs && data.logs.length > 0) {{
                    const logsHtml = data.logs.map(log => {{
                        if (log.includes('ERROR:')) return `<div class="text-red-400">${{log}}</div>`;
                        else if (log.includes('WARNING:')) return `<div class="text-yellow-400">${{log}}</div>`;
                        else if (log.includes('INFO:')) return `<div class="text-green-400">${{log}}</div>`;
                        else return `<div>${{log}}</div>`;
                    }}).join('');
                    logsEl.innerHTML = logsHtml;
                    logsEl.parentElement.scrollTop = logsEl.parentElement.scrollHeight;
                }}
            }};
            
            window.refreshEmbeddingsLogs = function(taskId) {{
                fetch(`/api/embeddings/logs/${{taskId}}?last_n=50`)
                    .then(response => response.json())
                    .then(data => {{
                        const logsEl = document.getElementById(`logs-${{taskId}}`);
                        if (logsEl && data.logs && data.logs.length > 0) {{
                            const logsHtml = data.logs.map(log => {{
                                if (log.includes('ERROR:')) return `<div class="text-red-400">${{log}}</div>`;
                                else if (log.includes('WARNING:')) return `<div class="text-yellow-400">${{log}}</div>`;
                                else if (log.includes('INFO:')) return `<div class="text-green-400">${{log}}</div>`;
                                else return `<div>${{log}}</div>`;
                            }}).join('');
                            logsEl.innerHTML = logsHtml;
                            logsEl.parentElement.scrollTop = logsEl.parentElement.scrollHeight;
                        }}
                    }})
                    .catch(error => console.error('Error refreshing embeddings logs:', error));
            }};
            
            window.downloadEmbeddingsLogs = function(taskId) {{
                fetch(`/api/embeddings/logs/${{taskId}}?last_n=-1`)
                    .then(response => response.json())
                    .then(data => {{
                        const blob = new Blob([data.logs.join('\\n')], {{ type: 'text/plain' }});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `embeddings-logs-${{taskId}}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }})
                    .catch(error => console.error('Error downloading embeddings logs:', error));
            }};
            
            window.clearEmbeddingsTask = function(taskId) {{
                const taskDiv = document.getElementById('embeddings-task-' + taskId);
                if (taskDiv && confirm('Clear this task from the display?')) {{
                    taskDiv.style.opacity = '0.5';
                    setTimeout(() => taskDiv.remove(), 300);
                }}
            }};
            
            // Auto-start status checking
            setTimeout(() => checkEmbeddingsStatus('{task_id}'), 1000);
        </script>
        """)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status/{task_id}")
async def get_embeddings_status(task_id: str):
    """Get status of embeddings processing task."""
    try:
        status = await embeddings_service.get_task_status(task_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/logs/{task_id}")
async def get_embeddings_logs(task_id: str, last_n: int = 50):
    """Get detailed logs for an embeddings task."""
    try:
        logs = await embeddings_service.get_task_logs(task_id, last_n)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/supported-models")
async def get_supported_embeddings_models():
    """Get list of supported embeddings model types."""
    return {
        "model_types": [
            "fasttext",
            "word2vec", 
            "sentence_transformers"
        ],
        "output_formats": [
            "vec",
            "txt",
            "binary",
            "json"
        ]
    }

# toolkit/histtext_fastapi/app/routers/embeddings.py (add these endpoints)

@router.post("/compute-word")
async def compute_word_embeddings(
    background_tasks: BackgroundTasks,
    collection: str = Form(...),
    output_path: str = Form(...),
    text_field: str = Form("text"),
    method: str = Form("word2vec"),
    dim: int = Form(100),
    window: int = Form(5),
    min_count: int = Form(5),
    workers: int = Form(4),
    output_format: str = Form("txt"),
    batch_size: int = Form(1000),
    filter_query: Optional[str] = Form(None),
    simplify_chinese: bool = Form(False),
    auto_configure: bool = Form(False),
    no_header: bool = Form(False)
):
    """Compute word embeddings for documents in a collection with real-time updates."""
    try:
        request_data = WordEmbeddingsRequest(
            collection=collection,
            output_path=output_path,
            text_field=text_field,
            method=method,
            dim=dim,
            window=window,
            min_count=min_count,
            workers=workers,
            output_format=output_format,
            batch_size=batch_size,
            filter_query=filter_query,
            simplify_chinese=simplify_chinese,
            auto_configure=auto_configure,
            no_header=no_header
        )
        
        # Start processing and get task ID
        task_id = await embeddings_service.compute_word_embeddings_async(request_data, background_tasks)
        
        # Return HTML with progress tracking (similar to regular embeddings but word-specific)
        return HTMLResponse(content=f"""
        <div id="word-embeddings-task-{task_id}" class="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
            <div class="flex items-start">
                <div class="flex-shrink-0 mt-1">
                    <svg id="spinner-{task_id}" class="animate-spin h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
                <div class="ml-3 flex-1">
                    <h3 class="text-sm font-medium text-green-800">📈 Word Embeddings Training Started</h3>
                    
                    <!-- Task Information -->
                    <div class="mt-2 text-sm text-green-700">
                        <div class="bg-green-100 rounded p-2 mb-2">
                            <p><strong>Task ID:</strong> <code class="bg-white px-1 rounded text-xs">{task_id}</code></p>
                            <div class="grid grid-cols-2 gap-2 mt-1">
                                <p><strong>Collection:</strong> {collection}</p>
                                <p><strong>Method:</strong> {method}</p>
                                <p><strong>Dimensions:</strong> {dim}</p>
                                <p><strong>Auto-Configure:</strong> {'Yes' if auto_configure else 'No'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="mt-3">
                        <div id="progress-bar-{task_id}" class="w-full bg-green-200 rounded-full h-3">
                            <div class="bg-green-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium" style="width: 5%">
                                <span id="progress-text-{task_id}">5%</span>
                            </div>
                        </div>
                        <div id="status-text-{task_id}" class="text-sm text-green-600 mt-1 font-medium">Initializing...</div>
                    </div>
                    
                    <!-- Training Statistics -->
                    <div class="mt-3 bg-white rounded-lg p-3 border">
                        <h4 class="text-xs font-medium text-gray-700 mb-2">📊 Training Statistics</h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div class="text-center">
                                <div class="text-lg font-bold text-green-600" id="vocab-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Vocabulary</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-blue-600" id="docs-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Documents</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-purple-600" id="epochs-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Epochs</div>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-bold text-orange-600" id="loss-{task_id}">-</div>
                                <div class="text-xs text-gray-500">Loss</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Live Logs -->
                    <div class="mt-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium text-green-800">📋 Training Logs</h4>
                            <button onclick="refreshWordEmbeddingsLogs('{task_id}')" class="text-xs text-green-600 hover:text-green-800 px-2 py-1 bg-green-100 rounded">
                                🔄 Refresh
                            </button>
                        </div>
                        <div class="bg-gray-900 text-green-400 text-xs p-3 rounded-lg font-mono max-h-48 overflow-y-auto border">
                            <div id="logs-{task_id}" class="whitespace-pre-wrap">
                                <div class="text-gray-500">🔄 Initializing training system...</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button onclick="checkWordEmbeddingsStatus('{task_id}')" 
                                class="text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md">
                            🔄 Refresh Status
                        </button>
                        <button onclick="copyTaskId('{task_id}')" 
                                class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md">
                            📋 Copy Task ID
                        </button>
                        <button onclick="downloadWordEmbeddingsLogs('{task_id}')" 
                                class="text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md">
                            📄 Download Logs
                        </button>
                        <button onclick="clearWordEmbeddingsTask('{task_id}')" 
                                class="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md">
                            ❌ Clear
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <script>
            window.checkWordEmbeddingsStatus = function(taskId) {{
                fetch(`/api/embeddings/word-status/${{taskId}}`)
                    .then(response => response.json())
                    .then(data => {{
                        updateWordEmbeddingsProgress(taskId, data);
                        if (data.status === 'running' || data.status === 'starting') {{
                            setTimeout(() => window.checkWordEmbeddingsStatus(taskId), 2000);
                        }}
                    }})
                    .catch(error => console.error('Error checking word embeddings status:', error));
            }};
            
            window.updateWordEmbeddingsProgress = function(taskId, data) {{
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
                            statusText.innerHTML += `<br><small>⏱️ Training time: ${{data.processing_time.toFixed(2)}}s</small>`;
                        }}
                        if (data.vocab_size) {{
                            statusText.innerHTML += `<br><small>📚 Vocabulary: ${{data.vocab_size.toLocaleString()}} words</small>`;
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
                        statusText.className = 'text-sm text-green-600 mt-1 font-medium';
                        statusText.textContent = data.message || 'Training...';
                    }}
                }}
                
                // Update training statistics
                const vocabEl = document.getElementById(`vocab-${{taskId}}`);
                const docsEl = document.getElementById(`docs-${{taskId}}`);
                const epochsEl = document.getElementById(`epochs-${{taskId}}`);
                const lossEl = document.getElementById(`loss-${{taskId}}`);
                
                if (vocabEl) vocabEl.textContent = data.vocab_size ? data.vocab_size.toLocaleString() : '-';
                if (docsEl) docsEl.textContent = data.total_docs ? data.total_docs.toLocaleString() : '-';
                if (epochsEl) epochsEl.textContent = data.current_epoch || '-';
                if (lossEl) lossEl.textContent = data.loss ? data.loss.toFixed(4) : '-';
                
                // Update logs
                const logsEl = document.getElementById(`logs-${{taskId}}`);
                if (logsEl && data.logs && data.logs.length > 0) {{
                    const logsHtml = data.logs.map(log => {{
                        if (log.includes('ERROR:')) return `<div class="text-red-400">${{log}}</div>`;
                        else if (log.includes('WARNING:')) return `<div class="text-yellow-400">${{log}}</div>`;
                        else if (log.includes('INFO:')) return `<div class="text-green-400">${{log}}</div>`;
                        else return `<div>${{log}}</div>`;
                    }}).join('');
                    logsEl.innerHTML = logsHtml;
                    logsEl.parentElement.scrollTop = logsEl.parentElement.scrollHeight;
                }}
            }};
            
            window.refreshWordEmbeddingsLogs = function(taskId) {{
                fetch(`/api/embeddings/word-logs/${{taskId}}?last_n=50`)
                    .then(response => response.json())
                    .then(data => {{
                        const logsEl = document.getElementById(`logs-${{taskId}}`);
                        if (logsEl && data.logs && data.logs.length > 0) {{
                            const logsHtml = data.logs.map(log => {{
                                if (log.includes('ERROR:')) return `<div class="text-red-400">${{log}}</div>`;
                                else if (log.includes('WARNING:')) return `<div class="text-yellow-400">${{log}}</div>`;
                                else if (log.includes('INFO:')) return `<div class="text-green-400">${{log}}</div>`;
                                else return `<div>${{log}}</div>`;
                            }}).join('');
                            logsEl.innerHTML = logsHtml;
                            logsEl.parentElement.scrollTop = logsEl.parentElement.scrollHeight;
                        }}
                    }})
                    .catch(error => console.error('Error refreshing word embeddings logs:', error));
            }};
            
            window.downloadWordEmbeddingsLogs = function(taskId) {{
                fetch(`/api/embeddings/word-logs/${{taskId}}?last_n=-1`)
                    .then(response => response.json())
                    .then(data => {{
                        const blob = new Blob([data.logs.join('\\n')], {{ type: 'text/plain' }});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `word-embeddings-logs-${{taskId}}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }})
                    .catch(error => console.error('Error downloading word embeddings logs:', error));
            }};
            
            window.clearWordEmbeddingsTask = function(taskId) {{
                const taskDiv = document.getElementById('word-embeddings-task-' + taskId);
                if (taskDiv && confirm('Clear this task from the display?')) {{
                    taskDiv.style.opacity = '0.5';
                    setTimeout(() => taskDiv.remove(), 300);
                }}
            }};
            
            // Auto-start status checking
            setTimeout(() => checkWordEmbeddingsStatus('{task_id}'), 1000);
        </script>
        """)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/word-status/{task_id}")
async def get_word_embeddings_status(task_id: str):
    """Get status of word embeddings training task."""
    try:
        status = await embeddings_service.get_word_embeddings_task_status(task_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/word-logs/{task_id}")
async def get_word_embeddings_logs(task_id: str, last_n: int = 50):
    """Get detailed logs for a word embeddings task."""
    try:
        logs = await embeddings_service.get_word_embeddings_task_logs(task_id, last_n)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
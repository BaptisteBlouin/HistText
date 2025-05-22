// backend/template/mod.rs
use actix_files::NamedFile;
use actix_web::http::StatusCode;
use actix_web::{HttpRequest, HttpResponse};
use lazy_static::lazy_static;
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use tera::{Context, Tera};

pub mod spa;
mod vite_bundle;

lazy_static! {
    pub static ref TEMPLATES: Tera = {
        println!("Initializing templates...");
        
        // Simplified template loading with single path
        let template_paths = vec![
            "./backend/views/**/*.html",
            "./views/**/*.html",
        ];
        
        for path in template_paths {
            match Tera::new(path) {
                Ok(mut tera) => {
                    println!("Successfully loaded templates from {}", path);
                    tera.register_function("bundle", |args: &HashMap<String, Value>| -> tera::Result<Value> {
                        vite_bundle::process_bundle_args(args)
                    });
                    tera.autoescape_on(vec![]);
                    println!("Template engine initialized");
                    return tera;
                },
                Err(e) => {
                    println!("Failed to load templates from {}: {}", path, e);
                    continue;
                }
            }
        }
        
        println!("Template initialization failed - no valid template paths found");
        std::process::exit(1);
    };
}

pub const DEFAULT_TEMPLATE: &str = "index.html";

/// Convert request path to template name
/// Currently always returns default template for SPA behavior
pub fn to_template_name(_request_path: &str) -> &'static str {
    DEFAULT_TEMPLATE
}

/// Main request handler with simplified routing logic
pub async fn render_views(req: HttpRequest) -> HttpResponse {
    let path = req.path();
    
    // Handle static files first
    if let Some(response) = try_serve_static_file(path, &req).await {
        return response;
    }
    
    // Handle development mode Vite requests
    #[cfg(debug_assertions)]
    if is_vite_request(path) {
        if let Ok(response) = proxy_to_vite_server(path).await {
            return response;
        }
    }
    
    // Fallback to template rendering
    render_template_response(path)
}

/// Try to serve static files from various locations
async fn try_serve_static_file(path: &str, req: &HttpRequest) -> Option<HttpResponse> {
    let static_paths = vec![
        format!("frontend/dist{}", path),
        #[cfg(debug_assertions)]
        format!("frontend/public{}", path),
    ];
    
    for static_path in static_paths {
        if Path::new(&static_path).is_file() {
            if let Ok(file) = NamedFile::open(&static_path) {
                return Some(file.into_response(req));
            }
        }
    }
    
    None
}

/// Check if request is for Vite development server
#[cfg(debug_assertions)]
fn is_vite_request(path: &str) -> bool {
    path.contains("@vite")
        || path.contains("@react-refresh")
        || path.contains("node_modules/.vite")
        || path.contains("/__vite_ping")
        || path.starts_with("/bundles/")
        || path.starts_with("/src/")
}

/// Render template with simplified logic
fn render_template_response(path: &str) -> HttpResponse {
    let template_name = to_template_name(path);
    
    match TEMPLATES.render(template_name, &Context::new()) {
        Ok(content) => {
            let final_content = enhance_content_for_dev(content);
            HttpResponse::build(StatusCode::OK)
                .content_type("text/html")
                .body(final_content)
        }
        Err(e) => {
            eprintln!("Template rendering error: {}", e);
            HttpResponse::NotFound().body(format!("Template error: {}", e))
        }
    }
}

/// Enhance content for development mode
#[cfg(debug_assertions)]
fn enhance_content_for_dev(content: String) -> String {
    let dev_client_injection = r#"
        <!-- Vite Dev HMR Client -->
        <script type="module">
            import RefreshRuntime from 'http://localhost:21012/@react-refresh';
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {};
            window.$RefreshSig$ = () => (type) => type;
            window.__vite_plugin_react_preamble_installed__ = true;

            const viteClient = document.createElement('script');
            viteClient.type = 'module';
            viteClient.src = 'http://localhost:21012/@vite/client';
            document.head.appendChild(viteClient);
        </script>
    "#;

    if content.contains("<head>") {
        content.replace("<head>", &format!("<head>{}", dev_client_injection))
    } else if content.contains("<html>") {
        content.replace(
            "<html>",
            &format!("<html><head>{}</head>", dev_client_injection),
        )
    } else {
        format!(
            "<html><head>{}</head>{}</html>",
            dev_client_injection, content
        )
    }
}

#[cfg(not(debug_assertions))]
fn enhance_content_for_dev(content: String) -> String {
    content
}

#[cfg(debug_assertions)]
async fn proxy_to_vite_server(path: &str) -> Result<HttpResponse, Box<dyn std::error::Error>> {
    use reqwest::Client;

    let client = Client::new();
    let vite_url = format!("http://localhost:21012{}", path);
    
    let response = client.get(&vite_url).send().await?;
    let status = response.status().as_u16();
    
    let content_type = response
        .headers()
        .get("content-type")
        .map(|v| v.to_str().unwrap_or("text/plain").to_owned())
        .unwrap_or_else(|| "text/plain".to_owned());
    
    let headers = response
        .headers()
        .iter()
        .filter(|(key, _)| *key != "content-type" && *key != "content-length")
        .filter_map(|(key, value)| {
            value
                .to_str()
                .ok()
                .map(|v| (key.as_str().to_owned(), v.to_owned()))
        })
        .collect::<Vec<(String, String)>>();
    
    let body = response.bytes().await?;
    
    let mut http_response = HttpResponse::build(StatusCode::from_u16(status)?);
    http_response.content_type(content_type);
    
    for (key, value) in headers {
        http_response.append_header((key, value));
    }
    
    Ok(http_response.body(body))
}
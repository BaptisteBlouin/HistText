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

        // Try the primary path first
        let result = Tera::new("./backend/views/**/*.html");
        match result {
            Ok(t) => {
                println!("Successfully loaded templates from ./backend/views/**/*.html");
                let mut tera = t;
                tera.register_function("bundle", |args: &HashMap<String, Value>| -> tera::Result<Value> {
                    vite_bundle::process_bundle_args(args)
                });
                tera.autoescape_on(vec![]);
                println!("Bundle function registered and template engine initialized");
                tera
            },
            Err(e) => {
                println!("Error loading templates from ./backend/views/**/*.html: {}", e);

                // Try the alternate path
                let alt_result = Tera::new("./views/**/*.html");
                match alt_result {
                    Ok(t) => {
                        println!("Successfully loaded templates from ./views/**/*.html");
                        let mut tera = t;
                        tera.register_function("bundle", |args: &HashMap<String, Value>| -> tera::Result<Value> {
                            vite_bundle::process_bundle_args(args)
                        });
                        tera.autoescape_on(vec![]);
                        println!("Bundle function registered and template engine initialized");
                        tera
                    },
                    Err(e2) => {
                        println!("Error loading templates from ./views/**/*.html: {}", e2);
                        println!("Template initialization failed - check your path configuration");
                        ::std::process::exit(1);
                    }
                }
            }
        }
    };
}

pub const DEFAULT_TEMPLATE: &str = "index.html";

pub fn to_template_name(request_path: &str) -> &'static str {
    let request_path = request_path.strip_prefix('/').unwrap_or(request_path);
    println!("Converting path '{}' to template name", request_path);

    if request_path.is_empty() {
        println!("Empty path - using default template: {}", DEFAULT_TEMPLATE);
        DEFAULT_TEMPLATE
    } else {
        println!(
            "Non-empty path - using default template: {}",
            DEFAULT_TEMPLATE
        );
        DEFAULT_TEMPLATE // Always return default for now
    }
}

#[allow(clippy::needless_return)]
pub async fn render_views(req: HttpRequest) -> HttpResponse {
    let path = req.path();
    println!("Handling request for path: {}", path);

    // Special handling for Vite HMR endpoints
    if path.contains("@vite")
        || path.contains("@react-refresh")
        || path.contains("node_modules/.vite")
        || path.contains("/__vite_ping")
        || path.starts_with("/bundles/")
        || path.starts_with("/src/")
    {
        #[cfg(debug_assertions)]
        {
            println!(
                "Detected Vite/HMR request. Proxying to Vite dev server: {}",
                path
            );
            match proxy_to_vite_server(path).await {
                Ok(response) => {
                    println!("Proxy to Vite server successful");
                    return response;
                }
                Err(e) => {
                    println!("Error proxying to Vite server: {}", e);
                    // If proxy fails, continue with normal handling
                }
            }
        }
    }

    // Try to serve static files from frontend/dist
    let static_path = format!("frontend/dist{}", path);
    println!("Checking for static file at: {}", static_path);
    if Path::new(&static_path).is_file() {
        println!("Found static file: {}", static_path);
        if let Ok(file) = NamedFile::open(&static_path) {
            println!("Serving static file");
            return file.into_response(&req);
        } else {
            println!("Failed to open static file");
        }
    } else {
        println!("Static file not found");
    }

    // In debug mode, try to serve from frontend/public
    #[cfg(debug_assertions)]
    {
        let public_path = format!("frontend/public{}", path);
        println!("Checking for public file at: {}", public_path);
        if Path::new(&public_path).is_file() {
            println!("Found public file: {}", public_path);
            if let Ok(file) = NamedFile::open(&public_path) {
                println!("Serving public file");
                return file.into_response(&req);
            } else {
                println!("Failed to open public file");
            }
        } else {
            println!("Public file not found");
        }
    }

    // Fallback to template rendering
    let template_path = to_template_name(path);
    println!("Rendering template: {}", template_path);

    // Print available templates for debugging
    println!("Available templates:");
    for template_name in TEMPLATES.get_template_names() {
        println!("  - {}", template_name);
    }

    match TEMPLATES.render(template_path, &Context::new()) {
        Ok(content) => {
            println!("Template rendered successfully");

            #[cfg(debug_assertions)]
            {
                println!("In debug mode - injecting Vite HMR client");
                // In debug mode, inject the Vite HMR client
                let dev_client_injection = r#"
                    <!-- Vite Dev HMR Client -->
                    <script type="module">
                        // Load Vite client for HMR support
                        import RefreshRuntime from 'http://localhost:21012/@react-refresh';
                        RefreshRuntime.injectIntoGlobalHook(window);
                        window.$RefreshReg$ = () => {};
                        window.$RefreshSig$ = () => (type) => type;
                        window.__vite_plugin_react_preamble_installed__ = true;

                        // This ensures vite client is loaded correctly
                        const viteClient = document.createElement('script');
                        viteClient.type = 'module';
                        viteClient.src = 'http://localhost:21012/@vite/client';
                        document.head.appendChild(viteClient);
                    </script>
                "#;

                let enhanced_content = if content.contains("<head>") {
                    println!("Injecting into existing <head> tag");
                    content.replace("<head>", &format!("<head>{}", dev_client_injection))
                } else if content.contains("<html>") {
                    println!("Adding <head> tag after <html> tag");
                    content.replace(
                        "<html>",
                        &format!("<html><head>{}</head>", dev_client_injection),
                    )
                } else {
                    println!("Wrapping with full HTML structure");
                    format!(
                        "<html><head>{}</head>{}</html>",
                        dev_client_injection, content
                    )
                };

                println!("Sending enhanced HTML response");
                HttpResponse::build(StatusCode::OK)
                    .content_type("text/html")
                    .body(enhanced_content)
            }

            #[cfg(not(debug_assertions))]
            {
                println!("In production mode - sending HTML response");
                HttpResponse::build(StatusCode::OK)
                    .content_type("text/html")
                    .body(content)
            }
        }
        Err(e) => {
            println!("Template rendering error: {}", e);
            println!("Error details: {:?}", e);
            HttpResponse::NotFound().body(format!("Template error: {}", e))
        }
    }
}

#[cfg(debug_assertions)]
async fn proxy_to_vite_server(path: &str) -> Result<HttpResponse, Box<dyn std::error::Error>> {
    use reqwest::Client;

    println!("Proxying to Vite server: {}", path);
    let client = Client::new();
    let vite_url = format!("http://localhost:21012{}", path);
    println!("Vite URL: {}", vite_url);

    let response = client.get(&vite_url).send().await?;
    let status = response.status().as_u16();
    println!("Vite server response status: {}", status);

    // Convert to owned values to avoid borrowing from response
    let content_type = response
        .headers()
        .get("content-type")
        .map(|v| v.to_str().unwrap_or("text/plain").to_owned())
        .unwrap_or_else(|| "text/plain".to_owned());
    println!("Content-Type: {}", content_type);

    // Extract and convert headers to owned values
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

    // Now consume the response to get the body
    let body = response.bytes().await?;
    println!("Received body of size: {} bytes", body.len());

    // Build the response
    let mut http_response = HttpResponse::build(StatusCode::from_u16(status)?);

    // Add content-type header
    http_response.content_type(content_type);

    // Add other important headers
    for (key, value) in headers {
        println!("Adding header: {} = {}", key, value);
        http_response.append_header((key, value));
    }

    println!("Proxy response ready");
    Ok(http_response.body(body))
}
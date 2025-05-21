// backend/template/vite_bundle.rs
use std::collections::HashMap;
use tera::Result as TeraResult;
use serde_json::Value;
use lazy_static::lazy_static;

lazy_static! {
    static ref VITE_MANIFEST: ViteManifest = ViteManifest::new();
}

// All types in this module are private and not exposed through the public API
struct ViteManifest {
    entries: HashMap<String, ViteManifestEntry>,
}

struct ViteManifestEntry {
    file: String,
    dynamic_imports: Vec<String>,
    css: Vec<String>,
}

impl ViteManifest {
    fn new() -> Self {
        Self {
            entries: load_manifest_entries(),
        }
    }

    fn get_entry(&self, name: &str) -> Option<&ViteManifestEntry> {
        self.entries.get(name)
    }
}

// Process bundle arguments - this is the only public API
pub fn process_bundle_args(args: &HashMap<String, Value>) -> TeraResult<Value> {
    match args.get("name") {
        Some(val) => {
            match tera::from_value::<String>(val.clone()) {
                Ok(bundle_name) => {
                    let inject_html = create_inject(&bundle_name);
                    Ok(tera::to_value(inject_html).unwrap())
                },
                Err(_) => Err(tera::Error::msg(format!("Invalid bundle name: {:?}", val)))
            }
        },
        None => Err(tera::Error::msg("Missing 'name' parameter for bundle function"))
    }
}

// Updated create_inject in vite_bundle.rs to add better logging
fn create_inject(bundle_name: &str) -> String {
    let key = format!("bundles/{}", bundle_name);
    println!("Creating bundle injection for: {}", key);
    
    #[cfg(not(debug_assertions))]
    {
        println!("Production mode bundle injection");
        let entry = VITE_MANIFEST.get_entry(&key).unwrap_or_else(|| {
            println!("Warning: Could not find bundle '{}' in manifest", bundle_name);
            // Return an empty entry reference - this is safe as we handle it below
            VITE_MANIFEST.get_entry("__empty__").unwrap_or_else(|| {
                println!("Error: Failed to load Vite manifest for bundle: {}", bundle_name);
                panic!("Failed to load Vite manifest for bundle: {}", bundle_name)
            })
        });
        
        println!("Using entry file: {}", entry.file);
        let entry_file = format!(
            r#"<script type="module" src="/{file}"></script>"#,
            file = entry.file
        );
        
        println!("CSS files count: {}", entry.css.len());
        let css_files = entry.css.iter()
            .map(|css_file| {
                println!("  - CSS file: {}", css_file);
                format!(
                    r#"<link rel="stylesheet" href="/{file}" />"#,
                    file = css_file
                )
            })
            .collect::<Vec<String>>()
            .join("\n");
        
        println!("Dynamic imports count: {}", entry.dynamic_imports.len());
        let dyn_entry_files = entry.dynamic_imports.iter()
            .map(|dyn_script_file| {
                println!("  - Dynamic import: {}", dyn_script_file);
                format!(
                    r#"<script type="module" src="/{file}"></script>"#,
                    file = dyn_script_file
                )
            })
            .collect::<Vec<String>>()
            .join("\n");

        let result = format!(
            r#"
    <!-- production mode -->
    {entry_file}
    {css_files}
    {dyn_entry_files}
    "#
        );
        
        println!("Production bundle injection created");
        result
    }

    #[cfg(debug_assertions)]
    {
        println!("Development mode bundle injection");
        let result = format!(
            r#"<script type="module">
            // Injecting bundle for development mode
            import RefreshRuntime from 'http://localhost:21012/@react-refresh';
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {{}};
            window.$RefreshSig$ = () => (type) => type;
            window.__vite_plugin_react_preamble_installed__ = true;
            
            // Load the main bundle
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `http://localhost:21012/bundles/{bundle_name}`;
            document.head.appendChild(script);
            
            // Load the dev script
            const devScript = document.createElement('script');
            devScript.type = 'module';
            devScript.src = 'http://localhost:21012/src/dev.tsx';
            document.head.appendChild(devScript);
            </script>"#
        );
        println!("Development bundle injection created");
        result
    }
}

// Updated load_manifest_entries in vite_bundle.rs with better error handling and logging
fn load_manifest_entries() -> HashMap<String, ViteManifestEntry> {
    println!("Loading Vite manifest entries");
    let mut entries = HashMap::new();
    
    // Insert an empty entry for fallback
    entries.insert("__empty__".to_string(), ViteManifestEntry {
        file: "main.js".to_string(),
        dynamic_imports: Vec::new(),
        css: Vec::new(),
    });
    println!("Added __empty__ fallback entry");

    #[cfg(not(debug_assertions))]
    let manifest_path = "frontend/dist/manifest.json";
    
    #[cfg(debug_assertions)]
    let manifest_path = "frontend/dist/manifest.json";
    
    println!("Looking for manifest at: {}", manifest_path);
    
    // Try to read the manifest file
    match std::fs::read_to_string(manifest_path) {
        Ok(manifest_content) => {
            println!("Successfully read manifest file");
            match serde_json::from_str::<Value>(&manifest_content) {
                Ok(json) => {
                    println!("Successfully parsed manifest JSON");
                    if let Value::Object(map) = json {
                        println!("Found {} entries in manifest", map.len());
                        for (key, value) in map {
                            if let Value::Object(entry_data) = value {
                                println!("Processing entry: {}", key);
                                
                                // Parse file
                                let file = entry_data.get("file")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("main.js")
                                    .to_string();
                                println!("  - File: {}", file);
                                
                                // Parse dynamic imports
                                let dynamic_imports = entry_data.get("dynamicImports")
                                    .and_then(|v| v.as_array())
                                    .map(|arr| {
                                        println!("  - Dynamic imports count: {}", arr.len());
                                        arr.iter()
                                            .filter_map(|item| {
                                                let result = item.as_str().map(|s| s.to_string());
                                                if let Some(ref s) = result {
                                                    println!("    - Dynamic import: {}", s);
                                                }
                                                result
                                            })
                                            .collect()
                                    })
                                    .unwrap_or_else(|| {
                                        println!("  - No dynamic imports found");
                                        Vec::new()
                                    });
                                
                                // Parse CSS
                                let css = entry_data.get("css")
                                    .and_then(|v| v.as_array())
                                    .map(|arr| {
                                        println!("  - CSS files count: {}", arr.len());
                                        arr.iter()
                                            .filter_map(|item| {
                                                let result = item.as_str().map(|s| s.to_string());
                                                if let Some(ref s) = result {
                                                    println!("    - CSS file: {}", s);
                                                }
                                                result
                                            })
                                            .collect()
                                    })
                                    .unwrap_or_else(|| {
                                        println!("  - No CSS files found");
                                        Vec::new()
                                    });
                                
                                entries.insert(key, ViteManifestEntry {
                                    file,
                                    dynamic_imports,
                                    css,
                                });
                            } else {
                                println!("Entry '{}' is not an object, skipping", key);
                            }
                        }
                    } else {
                        println!("Manifest JSON is not an object: {:?}", json);
                    }
                },
                Err(e) => {
                    println!("Could not parse Vite manifest JSON: {}", e);
                    println!("Manifest content: {}", manifest_content);
                }
            }
        },
        Err(e) => {
            println!("Could not read Vite manifest file at {}: {}", manifest_path, e);
            
            // Try to list the directory to see if the file exists
            if let Ok(entries) = std::fs::read_dir("frontend/dist") {
                println!("Contents of frontend/dist:");
                for entry in entries {
                    if let Ok(entry) = entry {
                        println!("  - {}", entry.path().display());
                    }
                }
            } else {
                println!("Could not read directory frontend/dist");
            }
        }
    }

    println!("Loaded {} manifest entries", entries.len());
    entries
}
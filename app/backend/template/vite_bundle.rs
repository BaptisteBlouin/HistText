// backend/template/vite_bundle.rs
use lazy_static::lazy_static;
use serde_json::Value;
use std::collections::HashMap;
use tera::Result as TeraResult;

lazy_static! {
    static ref VITE_MANIFEST: ViteManifest = ViteManifest::new();
}

// All types in this module are private and not exposed through the public API
struct ViteManifest {
    entries: HashMap<String, ViteManifestEntry>,
}

#[allow(dead_code)]
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
    #[allow(dead_code)]
    fn get_entry(&self, name: &str) -> Option<&ViteManifestEntry> {
        self.entries.get(name)
    }
}

// Process bundle arguments - this is the only public API
pub fn process_bundle_args(args: &HashMap<String, Value>) -> TeraResult<Value> {
    match args.get("name") {
        Some(val) => match tera::from_value::<String>(val.clone()) {
            Ok(bundle_name) => {
                let inject_html = create_inject(&bundle_name);
                Ok(tera::to_value(inject_html).unwrap())
            }
            Err(_) => Err(tera::Error::msg(format!("Invalid bundle name: {:?}", val))),
        },
        None => Err(tera::Error::msg(
            "Missing 'name' parameter for bundle function",
        )),
    }
}

// Updated create_inject in vite_bundle.rs to add better logging
fn create_inject(bundle_name: &str) -> String {
    println!("Creating bundle injection for: {}", bundle_name);

    #[cfg(not(debug_assertions))]
    {
        println!("Production mode bundle injection");
        
        // Try multiple possible keys since Vite manifest can have different formats
        let possible_keys = vec![
            bundle_name.to_string(),                    // "index.tsx"
            format!("bundles/{}", bundle_name),         // "bundles/index.tsx"
            format!("src/{}", bundle_name),             // "src/index.tsx"
        ];
        
        let mut found_entry = None;
        let mut used_key = String::new();
        
        for key in possible_keys {
            if let Some(entry) = VITE_MANIFEST.entries.get(&key) {
                found_entry = Some(entry);
                used_key = key;
                break;
            }
        }
        
        match found_entry {
            Some(entry) => {
                println!("Found entry with key: {}", used_key);
                
                let css_files = entry
                    .css
                    .iter()
                    .map(|css_file| {
                        format!(r#"<link rel="stylesheet" href="/{file}" />"#, file = css_file)
                    })
                    .collect::<Vec<String>>()
                    .join("\n");

                let entry_file = format!(
                    r#"<script type="module" src="/{file}"></script>"#,
                    file = entry.file
                );

                let result = format!(
                    r#"
    <!-- Production bundle -->
    {css_files}
    {entry_file}
    "#
                );
                
                println!("Production bundle injection created successfully");
                result
            }
            None => {
                println!("Warning: Could not find bundle '{}' in manifest", bundle_name);
                println!("Available entries: {:?}", VITE_MANIFEST.entries.keys().collect::<Vec<_>>());
                
                // Fallback - try to serve a basic script
                format!(
                    r#"<script type="module" src="/assets/{}.js"></script>"#,
                    bundle_name
                )
            }
        }
    }

    #[cfg(debug_assertions)]
    {
        println!("Development mode bundle injection");
        format!(
            r#"<script type="module">
            import RefreshRuntime from 'http://localhost:21012/@react-refresh';
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$ = () => {{}};
            window.$RefreshSig$ = () => (type) => type;
            window.__vite_plugin_react_preamble_installed__ = true;
            
            const script = document.createElement('script');
            script.type = 'module';
            script.src = `http://localhost:21012/bundles/{bundle_name}`;
            document.head.appendChild(script);
            
            const devScript = document.createElement('script');
            devScript.type = 'module';
            devScript.src = 'http://localhost:21012/src/dev.tsx';
            document.head.appendChild(devScript);
            </script>"#
        )
    }
}

fn load_manifest_entries() -> HashMap<String, ViteManifestEntry> {
    println!("Loading Vite manifest entries");
    let mut entries = HashMap::new();

    // Insert an empty entry for fallback
    entries.insert(
        "__empty__".to_string(),
        ViteManifestEntry {
            file: "main.js".to_string(),
            dynamic_imports: Vec::new(),
            css: Vec::new(),
        },
    );
    println!("Added __empty__ fallback entry");

    #[cfg(not(debug_assertions))]
    let manifest_path = "frontend/dist/.vite/manifest.json";

    #[cfg(debug_assertions)]
    let manifest_path = "frontend/dist/.vite/manifest.json";

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
                                let file = entry_data
                                    .get("file")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("main.js")
                                    .to_string();
                                println!("  - File: {}", file);

                                // Parse dynamic imports
                                let dynamic_imports = entry_data
                                    .get("dynamicImports")
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
                                let css = entry_data
                                    .get("css")
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

                                entries.insert(
                                    key,
                                    ViteManifestEntry {
                                        file,
                                        dynamic_imports,
                                        css,
                                    },
                                );
                            } else {
                                println!("Entry '{}' is not an object, skipping", key);
                            }
                        }
                    } else {
                        println!("Manifest JSON is not an object: {:?}", json);
                    }
                }
                Err(e) => {
                    println!("Could not parse Vite manifest JSON: {}", e);
                    println!("Manifest content: {}", manifest_content);
                }
            }
        }
        Err(e) => {
            println!(
                "Could not read Vite manifest file at {}: {}",
                manifest_path, e
            );

            // Try to list the directory to see if the file exists
            if let Ok(entries) = std::fs::read_dir("frontend/dist") {
                println!("Contents of frontend/dist:");
                // Fixed clippy warning by using flatten() instead of manual if let
                for entry in entries.flatten() {
                    println!("  - {}", entry.path().display());
                }
            } else {
                println!("Could not read directory frontend/dist");
            }
        }
    }

    println!("Loaded {} manifest entries", entries.len());
    entries
}
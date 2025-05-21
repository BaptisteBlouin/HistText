/// This module provides development-specific functionality
/// that was previously provided by create-rust-app

/// Called during server startup in development mode
/// to notify development tooling
pub async fn setup_development() {
    // Only run in debug mode
    #[cfg(debug_assertions)]
    {
        // Check if DEV_SERVER_PORT environment variable is set
        if let Ok(port) = std::env::var("DEV_SERVER_PORT") {
            let url = format!("http://localhost:{}/backend-up", port);
            
            // Notify dev server that backend is up
            match reqwest::get(&url).await {
                Ok(_) => println!("Development server notified of backend startup"),
                Err(_) => println!("WARNING: Dev server notification failed - this is normal if you're not using the dev server"),
            }
        }
    }
}

/// Notifies dev server that Vite is down
pub async fn vitejs_ping_down() {
    #[cfg(debug_assertions)]
    {
        if let Ok(port) = std::env::var("DEV_SERVER_PORT") {
            let url = format!("http://localhost:{}/vitejs-down", port);
            
            match reqwest::get(&url).await {
                Ok(_) => {},
                Err(_) => {
                    println!("WARNING: Could not inform dev server that vitejs is down.");
                }
            }
        }
    }
}

/// Notifies dev server that Vite is up
pub async fn vitejs_ping_up() {
    #[cfg(debug_assertions)]
    {
        if let Ok(port) = std::env::var("DEV_SERVER_PORT") {
            let url = format!("http://localhost:{}/vitejs-up", port);
            
            match reqwest::get(&url).await {
                Ok(_) => {},
                Err(_) => {
                    println!("WARNING: Could not inform dev server that vitejs is up.");
                }
            }
        }
    }
}
//! Server implementation for the application.

// Re-export server components
pub mod error;
pub mod guards;
pub mod routes;
pub mod ssh;
pub mod startup;
pub mod state;
pub mod security;

/// Runs the HTTP server with all necessary components initialized.
pub async fn run_server() -> std::io::Result<()> {
    use crate::app_data::{AppConfig, AppData};
    use crate::config::Config;
    use crate::graphql;
    use crate::server::ssh::establish_ssh_tunnels;
    use crate::server::startup::preload_embeddings;
    use crate::services::database::Database;
    use crate::services::mailer::Mailer;
    use actix_web::middleware::{Compress, Logger, NormalizePath, TrailingSlash};
    use actix_web::web::PayloadConfig;
    use actix_web::{
        web::{self, Data},
        App, HttpServer,
    };
    use std::sync::Arc;
    use tokio::signal;
    use tokio::signal::unix::{signal, SignalKind};

    use crate::server::security::SecurityHeaders;

    // Load configuration from environment variables
    let config = match Config::load() {
        Ok(config) => Arc::new(config),
        Err(e) => {
            eprintln!("Configuration error: {}", e);
            std::process::exit(1);
        }
    };

    // Set up development environment in debug mode
    #[cfg(debug_assertions)]
    dotenv::dotenv().ok();

    // Set up application data
    let app_data = AppData::new(config.clone());

    // Set up GraphQL schema
    let schema = async_graphql::Schema::build(
        graphql::QueryRoot,
        graphql::MutationRoot,
        graphql::SubscriptionRoot,
    )
    .data(app_data.database.clone())
    .data(app_data.mailer.clone())
    .data(config.clone())
    .finish();

    // Initialize structured logging
    simple_logger::init_with_env().unwrap();

    // Initialize database connection pool
    let db = Database::new();
    let db_pool = db.pool.clone();

    // Initialize mailer for auth system
    let config_global = Config::global();
    let mailer = Data::new(Mailer::from_config(config_global));

    let mailer_data = Data::new(mailer);

    // Start preloading embeddings in the background
    let embedding_task = {
        let pool = db_pool.clone();
        tokio::spawn(async move {
            if let Err(e) = preload_embeddings(pool).await {
                tracing::error!("Error preloading embeddings: {:?}", e);
            }
        })
    };

    // Establish SSH tunnels
    let ssh_children = match establish_ssh_tunnels(&db_pool).await {
        Ok(children) => children,
        Err(e) => {
            tracing::error!("Error establishing SSH tunnels: {:?}", e);
            std::process::exit(1);
        }
    };

    // Create app state
    let app_state = state::AppState {
        ssh_children,
        config: config.clone(),
    };

    // Create app state data
    let app_state_data = Data::new(app_state.clone());

    // Set up Actix web server
    let server = HttpServer::new(move || {
        // Create the app_data instance once
        let shared_app_data = web::Data::new(app_data.clone());
        let shared_db = web::Data::new(db.clone());
        let shared_db_pool = web::Data::new(db_pool.clone());
        let shared_schema = web::Data::new(schema.clone());

        let app = App::new()
            // Configure middleware
            .wrap(Compress::default())
            .wrap(NormalizePath::new(TrailingSlash::MergeOnly))
            .wrap(Logger::default());
        
        // Add environment-specific security headers
        #[cfg(debug_assertions)]
        let app = app.wrap(
            SecurityHeaders::new()
                .include_hsts(false)
                .with_custom_csp(
                    "default-src 'self'; \
                     script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:21012 https://cdnjs.cloudflare.com; \
                     style-src 'self' 'unsafe-inline' http://localhost:21012 https://cdnjs.cloudflare.com; \
                     img-src 'self' data: https:; \
                     font-src 'self' data: https://cdnjs.cloudflare.com; \
                     connect-src 'self' http://localhost:21012 ws://localhost:21012; \
                     worker-src 'self'; \
                     frame-src 'self' https:; \
                     frame-ancestors 'self'; \
                     form-action 'self'; \
                     base-uri 'self'; \
                     object-src 'none'"
                )
        );
        
        #[cfg(not(debug_assertions))]
        let app = app.wrap(
            SecurityHeaders::new()
                .with_custom_csp(
                    "default-src 'self'; \
                     script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; \
                     style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; \
                     img-src 'self' data: https:; \
                     font-src 'self' data: https://cdnjs.cloudflare.com; \
                     connect-src 'self'; \
                     worker-src 'self'; \
                     frame-src 'self' https:; \
                     frame-ancestors 'self'; \
                     form-action 'self'; \
                     base-uri 'self'; \
                     object-src 'none'"
                )
        );
        
        // Continue with the rest of the configuration
        let app = app
            // Set payload limits
            .app_data(web::JsonConfig::default().limit(config.max_query_size_mb * 1024 * 1024))
            .app_data(PayloadConfig::new(
                config.max_document_size_mb * 1024 * 1024,
            ))
            // Add application data
            .app_data(shared_app_data.clone())
            .app_data(web::Data::new(app_data.database.clone()))
            .app_data(web::Data::new(app_data.mailer.clone()))
            .app_data(shared_schema.clone())
            .app_data(web::Data::new(Arc::clone(&config)))
            .app_data(app_state_data.clone())
            .app_data(mailer_data.clone())
            // Configure app settings
            .app_data(web::Data::new(AppConfig {
                app_url: config.app_url.clone(),
            }));

        // Configure routes
        app.configure(|cfg| {
            routes::configure_routes(
                cfg,
                app_state_data.clone(),
                shared_db.clone(),
                shared_db_pool.clone(),
                shared_app_data.clone(),
                shared_schema.clone(),
            );
        })
    })
    .bind("0.0.0.0:3000")?
    .run();

    // Set up signal handling for graceful shutdown
    let mut terminate_signal = match signal(SignalKind::terminate()) {
        Ok(signal) => signal,
        Err(e) => {
            tracing::error!("Failed to bind SIGTERM: {:?}", e);
            std::process::exit(1);
        }
    };

    let sigint = signal::ctrl_c();

    // Wait for server completion or shutdown signal
    tokio::select! {
        res = server => {
            if let Err(e) = res {
                eprintln!("Server error: {}", e);
            }
        }
        res = sigint => {
            match res {
                Ok(()) => println!("Received Ctrl+C, initiating graceful shutdown..."),
                Err(e) => eprintln!("Error receiving Ctrl+C signal: {:?}", e),
            }
        }
        res = terminate_signal.recv() => {
            if res.is_some() {
                println!("Received termination signal, initiating graceful shutdown...");
            }
        }
    }

    // Cleanup resources during shutdown

    // Cancel embedding preload task if it's still running
    embedding_task.abort();

    // Kill SSH tunnels
    {
        let mut children = app_state.ssh_children.lock().await;
        for child in children.iter_mut() {
            if let Err(e) = child.kill().await {
                eprintln!("Failed to kill SSH child process: {:?}", e);
            } else {
                println!("SSH child process killed successfully.");
            }
        }
    }

    println!("Server has been shut down gracefully.");
    Ok(())
}
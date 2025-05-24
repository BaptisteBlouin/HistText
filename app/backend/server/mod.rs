pub mod error;
pub mod guards;
pub mod routes;
pub mod ssh;
pub mod startup;
pub mod state;
pub mod security;

pub async fn run_server() -> std::io::Result<()> {
    use crate::app_data::{AppConfig, AppData};
    use crate::config::Config;
    use crate::graphql;
    use crate::server::ssh::establish_ssh_tunnels;
    use crate::server::startup::preload_embeddings;
    use crate::services::database::Database;
    use crate::services::mailer::Mailer;
    use crate::services::cache_manager::CacheManager;
    use crate::services::response_pool::ResponsePool;
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

    let config = match Config::load() {
        Ok(config) => Arc::new(config),
        Err(e) => {
            eprintln!("Configuration error: {}", e);
            std::process::exit(1);
        }
    };

    #[cfg(debug_assertions)]
    dotenv::dotenv().ok();

    let app_data = AppData::new(config.clone());

    let schema = async_graphql::Schema::build(
        graphql::QueryRoot,
        graphql::MutationRoot,
        graphql::SubscriptionRoot,
    )
    .data(app_data.database.clone())
    .data(app_data.mailer.clone())
    .data(config.clone())
    .finish();

    simple_logger::init_with_env().unwrap();

    let db = Database::new();
    let db_pool = db.pool.clone();

    let config_global = Config::global();
    let mailer = Data::new(Mailer::from_config(config_global));
    let mailer_data = Data::new(mailer);

    let cache_manager = Arc::new(CacheManager::new(
        config.max_cache_size,
        config.cache_ttl_seconds,
    ));

    let response_pool = Arc::new(ResponsePool::new());

    let embedding_task = {
        let pool = db_pool.clone();
        tokio::spawn(async move {
            if let Err(e) = preload_embeddings(pool).await {
                tracing::error!("Error preloading embeddings: {:?}", e);
            }
        })
    };

    let ssh_children = match establish_ssh_tunnels(&db_pool).await {
        Ok(children) => children,
        Err(e) => {
            tracing::error!("Error establishing SSH tunnels: {:?}", e);
            std::process::exit(1);
        }
    };

    let app_state = state::AppState {
        ssh_children: ssh_children.clone(),
        config: config.clone(),
    };

    let app_state_data = Data::new(app_state.clone());

    let server = HttpServer::new(move || {
        let shared_app_data = web::Data::new(app_data.clone());
        let shared_db = web::Data::new(db.clone());
        let shared_db_pool = web::Data::new(db_pool.clone());
        let shared_schema = web::Data::new(schema.clone());

        let app = App::new()
            .wrap(Compress::default())
            .wrap(NormalizePath::new(TrailingSlash::MergeOnly))
            .wrap(Logger::default());
        
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
        
        let app = app
            .app_data(web::JsonConfig::default().limit(config.max_query_size_mb * 1024 * 1024))
            .app_data(PayloadConfig::new(
                config.max_document_size_mb * 1024 * 1024,
            ))
            .app_data(shared_app_data.clone())
            .app_data(web::Data::new(app_data.database.clone()))
            .app_data(web::Data::new(app_data.mailer.clone()))
            .app_data(shared_schema.clone())
            .app_data(web::Data::new(Arc::clone(&config)))
            .app_data(app_state_data.clone())
            .app_data(mailer_data.clone())
            .app_data(web::Data::new(AppConfig {
                app_url: config.app_url.clone(),
            }))
            .app_data(web::Data::new(cache_manager.clone()))
            .app_data(web::Data::new(response_pool.clone()));

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
    .shutdown_timeout(5);

    let mut terminate_signal = match signal(SignalKind::terminate()) {
        Ok(signal) => signal,
        Err(e) => {
            tracing::error!("Failed to bind SIGTERM: {:?}", e);
            std::process::exit(1);
        }
    };

    let sigint = signal::ctrl_c();

    tokio::select! {
        res = server.run() => {
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

    embedding_task.abort();

    {
        let mut children = ssh_children.lock().await;
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
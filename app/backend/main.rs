#![allow(dead_code)]

extern crate diesel;

mod app_data;
mod config;
mod graphql;
mod models;
mod openapi;
mod schema;
mod server;
mod services;
mod template;
mod mail;


mod histtext {
    pub mod documents;
    pub mod embeddings;
    pub mod metadata;
    pub mod ner;
    pub mod stats;
    pub mod tokenizer;
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    if let Err(e) = histtext::embeddings::initialize_embedding_system().await {
        eprintln!("Failed to initialize embedding system: {}", e);
        std::process::exit(1);
    }

    // Initialize application components including roles
    let db_pool = services::database::Database::new().pool.clone();
    if let Err(e) = server::startup::initialize_application(db_pool).await {
        eprintln!("Failed to initialize application: {}", e);
        std::process::exit(1);
    }

    let result = server::run_server().await;

    histtext::embeddings::shutdown_embedding_system().await;

    result
}
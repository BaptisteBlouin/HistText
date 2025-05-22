//! SSH tunneling functionality for Solr database connections.
//!
//! This module provides functions to establish SSH tunnels to remote Solr instances
//! both during server startup and on-demand via API endpoints. It manages the lifecycle
//! of SSH child processes and ensures proper connection handling.

use crate::schema::solr_databases::dsl::*;
use crate::server::error::AppError;
use crate::server::state::AppState;
use crate::services::database::DbPool;
use crate::services::solr_database::SolrDatabase;
use actix_web::{web, HttpResponse};
use anyhow::Context;
use diesel::prelude::*;
use futures::future::join_all;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Child;
use tokio::process::Command;
use tokio::sync::Mutex;

/// Creates an SSH tunnel for a single Solr database
///
/// Establishes a port forwarding tunnel from local_port to server_port
/// on the remote host using SSH with security checks disabled.
///
/// # Arguments
/// * `db` - The SolrDatabase configuration to connect to
///
/// # Returns
/// A Result containing the Child process handle or an AppError
async fn create_ssh_tunnel(db: &SolrDatabase) -> Result<Child, AppError> {
    let ssh_command = "ssh";
    let ssh_args = [
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=/dev/null",
        "-L",
        &format!("{}:localhost:{}", db.local_port, db.server_port),
        "-N",
        &db.url,
    ];

    println!(
        "Establishing SSH tunnel: {} {}",
        ssh_command,
        ssh_args.join(" ")
    );

    // Spawn SSH process
    let mut child = Command::new(ssh_command)
        .args(ssh_args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            AppError::Ssh(format!(
                "Failed to spawn SSH process for {}: {}",
                db.name, e
            ))
        })?;

    // Wait briefly and check if the process is still running
    // This helps catch immediate failures
    tokio::time::sleep(Duration::from_millis(500)).await;
    if let Ok(Some(_)) = child.try_wait() {
        return Err(AppError::Ssh(format!(
            "Failed to establish SSH tunnel for Solr Database '{}'",
            db.name
        )));
    }

    println!("SSH tunnel established for {}", db.name);
    Ok(child)
}

/// Connects to a specific Solr database via SSH
///
/// This function is called by the API endpoint for on-demand SSH connections.
/// It retrieves the database configuration, establishes the tunnel, and
/// stores the process handle in the application state.
///
/// # Arguments
/// * `db_id` - ID of the SolrDatabase to connect to
/// * `pool` - Database connection pool
/// * `app_state` - Application state containing SSH children
///
/// # Returns
/// HttpResponse indicating success or failure
pub async fn connect_solr_ssh(
    db_id: i32,
    pool: &DbPool,
    app_state: &AppState,
) -> Result<HttpResponse, AppError> {
    // Get database connection
    let mut conn = pool.get().context("Failed to get DB connection")?;

    // Find the specific Solr database
    let solr_db = solr_databases
        .filter(id.eq(db_id))
        .first::<SolrDatabase>(&mut conn)
        .optional()
        .context("Failed to query solr_database")?;

    // Return 404 if database not found
    let solr_db = match solr_db {
        Some(db) => db,
        None => return Ok(HttpResponse::NotFound().body("Solr database not found")),
    };

    // Create the SSH tunnel
    let result = create_ssh_tunnel(&solr_db).await;

    match result {
        Ok(child) => {
            // Add the child process to the AppState's SSH children vector
            let mut children = app_state.ssh_children.lock().await;
            children.push(child);

            Ok(HttpResponse::Ok().body("SSH connection established successfully"))
        }
        Err(e) => {
            eprintln!("SSH tunnel error: {}", e);
            Ok(HttpResponse::InternalServerError()
                .body(format!("Failed to establish SSH tunnel: {}", e)))
        }
    }
}

/// API handler for connecting a specific Solr database via SSH
///
/// Exposes an endpoint that requires admin permission to establish
/// an SSH connection to a specific Solr database.
///
/// # Arguments
/// * `path` - Path parameter containing the Solr database ID
/// * `pool` - Database connection pool
/// * `app_state` - Application state
///
/// # Returns
/// HTTP response indicating success or failure
#[utoipa::path(
    post,
    path = "/api/solr_databases/{id}/connect_ssh",
    tag = "Solr Database Management",
    params(
        ("id" = i32, Path, description = "Solr database ID to connect to")
    ),
    responses(
        (status = 200, description = "SSH connection established successfully"),
        (status = 404, description = "Solr database not found"),
        (status = 500, description = "Failed to establish SSH connection")
    ),
    security(
        ("Bearer" = [])
    )
)]
pub async fn connect_solr_database_ssh(
    path: web::Path<i32>,
    pool: web::Data<DbPool>,
    app_state: web::Data<AppState>,
) -> Result<HttpResponse, AppError> {
    let db_id = path.into_inner();
    connect_solr_ssh(db_id, &pool, &app_state).await
}

/// Establishes SSH tunnels for all configured Solr databases
///
/// This function is called during server startup to create SSH tunnels
/// for all databases defined in the system. It uses concurrent processing
/// to establish multiple tunnels simultaneously.
///
/// # Arguments
/// * `pool` - Database connection pool for fetching SolrDatabase records
///
/// # Returns
/// A thread-safe collection of child processes or an error
pub async fn establish_ssh_tunnels(
    pool: &DbPool,
) -> Result<Arc<Mutex<Vec<tokio::process::Child>>>, AppError> {
    // Get database connection and load all Solr databases
    let mut conn = pool.get().context("Failed to get DB connection")?;
    let solr_dbs: Vec<SolrDatabase> = solr_databases
        .load::<SolrDatabase>(&mut conn)
        .context("Failed to load solr_databases")?;

    // If no solr_databases entries exist, return an empty vector
    if solr_dbs.is_empty() {
        println!("No Solr databases configured for SSH tunneling. Continuing without tunnels.");
        return Ok(Arc::new(Mutex::new(Vec::new())));
    }

    let mut children = Vec::new();
    let mut futures = Vec::new();

    // Create a future for each SSH tunnel
    for db in &solr_dbs {
        let db_ref = db;
        let future = async move {
            match create_ssh_tunnel(db_ref).await {
                Ok(child) => Ok((db_ref.name.clone(), child)),
                Err(e) => Err(e),
            }
        };
        futures.push(future);
    }

    // Run all futures concurrently
    let results = join_all(futures).await;
    for result in results {
        match result {
            Ok((db_name, child)) => {
                println!("SSH tunnel established for {}", db_name);
                children.push(child);
            }
            Err(e) => {
                eprintln!("SSH tunnel error: {}", e);
                // Continue with other tunnels even if one fails
            }
        }
    }

    // Check if we managed to establish any tunnels
    if children.is_empty() && !solr_dbs.is_empty() {
        return Err(AppError::Ssh(
            "Failed to establish any SSH tunnels".to_string(),
        ));
    }

    Ok(Arc::new(Mutex::new(children)))
}

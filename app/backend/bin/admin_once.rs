//! Administrative user initialization utility.
//!
//! This module provides functionality to bootstrap the application with
//! an administrative user account. It ensures that:
//!
//! - An admin user exists with secure password hashing
//! - The admin user has the "Admin" role
//! - The "Admin" role has the "admin" permission
//!
//! It's typically run once during initial setup or deployment.


use dotenvy::dotenv;
use log::{info, warn};
use sqlx::PgPool;
use std::env;

/// Generate a secure salt
fn generate_salt() -> [u8; 16] {
    use rand::Fill;
    let mut salt = [0; 16];
    salt.fill(&mut rand::rng());
    salt
}

/// Hash password using Argon2id
fn hash_password(password: &str) -> Result<String, argon2::Error> {
    let secret_key = env::var("SECRET_KEY")
        .unwrap_or_else(|_| "default_secret_key".to_string());
    
    let config = argon2::Config {
        variant: argon2::Variant::Argon2id,
        version: argon2::Version::Version13,
        secret: secret_key.as_bytes(),
        ..Default::default()
    };
    
    let salt = generate_salt();
    argon2::hash_encoded(password.as_bytes(), &salt, &config)
}

/// Program entry point
///
/// This function performs the admin initialization process:
///
/// 1. Loads environment variables from .env file
/// 2. Connects to the PostgreSQL database
/// 3. Creates admin user if it doesn't exist
/// 4. Assigns Admin role to the admin user
/// 5. Creates Admin-admin role-permission mapping
///
/// # Errors
/// Returns a database error if any operation fails
#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {    
    // Load environment variables
    dotenv().ok();

    // Connect to database
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPool::connect(&database_url).await?;

    info!("Connected to database, starting admin initialization");


    // Check if admin user exists
    let existing_admin: Option<(i32,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind("admin")
        .fetch_optional(&pool)
        .await?;

    // Create admin user if it doesn't exist
    let user_id = if let Some((id,)) = existing_admin {
        info!("Admin user already exists with ID: {}. Skipping creation.", id);
        id
    } else {
        info!("Creating new admin user");

        // Generate secure password or use environment variable
        let admin_password = env::var("ADMIN_PASSWORD")
            .unwrap_or_else(|_| {
                warn!("ADMIN_PASSWORD not set, using default password 'admin'");
                warn!("SECURITY WARNING: Change the default password immediately!");
                "admin".to_string()
            });

        // Hash the password using the centralized service
        let hashed_password = hash_password(&admin_password)
        .map_err(|e| {
            eprintln!("Password hashing error: {:?}", e);
            sqlx::Error::Protocol("Password hashing failed".into())
        })?;

        // Insert admin user
        let inserted_admin = sqlx::query!(
            "INSERT INTO users (email, hash_password, activated, firstname, lastname, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id",
            "admin",
            hashed_password,
            true,
            "System",
            "Administrator"
        )
        .fetch_one(&pool)
        .await?;

        info!("Admin user created with ID: {}", inserted_admin.id);
        
        if admin_password == "admin" {
            warn!("==========================================");
            warn!("SECURITY WARNING: Default password in use!");
            warn!("Please change the admin password immediately after first login.");
            warn!("Default credentials: admin / admin");
            warn!("==========================================");
        }
        
        inserted_admin.id
    };

    // Check if admin role exists for user
    let existing_role: Option<(i32,)> =
        sqlx::query_as("SELECT user_id FROM user_roles WHERE user_id = $1 AND role = 'Admin'")
            .bind(user_id)
            .fetch_optional(&pool)
            .await?;

    // Create admin role assignment if it doesn't exist
    if existing_role.is_some() {
        info!("Admin role already exists for user ID: {}", user_id);
    } else {
        sqlx::query!(
            "INSERT INTO user_roles (user_id, role, created_at) 
             VALUES ($1, 'Admin', NOW())",
            user_id
        )
        .execute(&pool)
        .await?;

        info!("Admin role assigned to user ID: {}", user_id);
    }

    // Check if admin permission exists for Admin role
    let existing_permission: Option<(String, String)> = sqlx::query_as(
        "SELECT role, permission FROM role_permissions WHERE role = $1 AND permission = $2",
    )
    .bind("Admin")
    .bind("admin")
    .fetch_optional(&pool)
    .await?;

    // Create role-permission mapping if it doesn't exist
    if existing_permission.is_some() {
        info!("Role permission (Admin, admin) already exists.");
    } else {
        sqlx::query!(
            "INSERT INTO role_permissions (role, permission, created_at) 
             VALUES ($1, $2, NOW())",
            "Admin",
            "admin"
        )
        .execute(&pool)
        .await?;
        info!("Role permission (Admin, admin) inserted.");
    }

    // Create some additional useful roles and permissions for a fresh system
    create_default_roles_and_permissions(&pool).await?;

    info!("Admin initialization completed successfully");
    Ok(())
}

/// Creates default roles and permissions for the system
///
/// This function sets up common roles and permissions that are useful
/// for most deployments of the application.
async fn create_default_roles_and_permissions(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("Setting up default roles and permissions");

    // Define default roles and their permissions
    let default_setup = vec![
        ("User", vec!["read"]),
        ("Editor", vec!["read", "write"]),
        ("Moderator", vec!["read", "write", "moderate"]),
        ("Admin", vec!["admin", "read", "write", "moderate", "manage_users"]),
    ];

    for (role_name, permissions) in default_setup {
        for permission in permissions {
            // Check if role-permission mapping exists
            let existing: Option<(String, String)> = sqlx::query_as(
                "SELECT role, permission FROM role_permissions WHERE role = $1 AND permission = $2",
            )
            .bind(role_name)
            .bind(permission)
            .fetch_optional(pool)
            .await?;

            // Create if it doesn't exist
            if existing.is_none() {
                sqlx::query!(
                    "INSERT INTO role_permissions (role, permission, created_at) 
                     VALUES ($1, $2, NOW()) 
                     ON CONFLICT (role, permission) DO NOTHING",
                    role_name,
                    permission
                )
                .execute(pool)
                .await?;

                info!("Created role-permission mapping: {} -> {}", role_name, permission);
            }
        }
    }

    info!("Default roles and permissions setup completed");
    Ok(())
}
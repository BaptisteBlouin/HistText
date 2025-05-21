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

use argon2::{self};
use dotenvy::dotenv;
use lazy_static::lazy_static;
use rand::Rng;
use sqlx::PgPool;
use std::env;

lazy_static! {
    /// Global Argon2id configuration with application secret
    ///
    /// This configuration uses secure defaults and incorporates the
    /// application's secret key as additional entropy for password hashing.
    pub static ref ARGON_CONFIG: argon2::Config<'static> = argon2::Config {
        variant: argon2::Variant::Argon2id,
        version: argon2::Version::Version13,
        secret: std::env::var("SECRET_KEY").map_or_else(
            |_| panic!("No SECRET_KEY environment variable set!"),
            |s| Box::leak(s.into_boxed_str()).as_bytes()
        ),
        ..Default::default()
    };
}

/// Generates a cryptographically secure random salt
///
/// Creates a 16-byte salt using the system's secure random number
/// generator for use in password hashing.
///
/// # Returns
/// A 16-byte array of random data
pub fn generate_salt() -> [u8; 16] {
    use rand::Fill;
    let mut salt = [0; 16];
    salt.fill(&mut rand::rng());
    salt
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

    // Check if admin user exists
    let existing_admin: Option<(i32,)> = sqlx::query_as("SELECT id FROM users WHERE email = $1")
        .bind("admin")
        .fetch_optional(&pool)
        .await?;

    // Create admin user if it doesn't exist
    let user_id = if let Some((id,)) = existing_admin {
        println!(
            "Admin user already exists with ID: {}. Skipping creation.",
            id
        );
        id
    } else {
        // Generate salt and hash password
        let mut salt = [0u8; 16];
        rand::rng().fill(&mut salt);

        let password = "admin";
        let hashed_password = argon2::hash_encoded(password.as_bytes(), &salt, &ARGON_CONFIG)
            .unwrap_or_else(|e| {
                eprintln!("Password hashing error: {:?}", e);
                String::from("default_hashed_password")
            });

        // Insert admin user
        let inserted_admin = sqlx::query!(
            "INSERT INTO users (email, hash_password, activated, firstname, lastname, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id",
            "admin",
            hashed_password,
            true,
            "admin",
            "admin"
        )
        .fetch_one(&pool)
        .await?;

        println!("Admin user created with ID: {}", inserted_admin.id);
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
        println!("Admin role already exists for user ID: {}", user_id);
    } else {
        sqlx::query!(
            "INSERT INTO user_roles (user_id, role, created_at) 
             VALUES ($1, 'Admin', NOW())",
            user_id
        )
        .execute(&pool)
        .await?;

        println!("Admin role assigned to user ID: {}", user_id);
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
        println!("Role permission (Admin, admin) already exists.");
    } else {
        sqlx::query!(
            "INSERT INTO role_permissions (role, permission, created_at) 
             VALUES ($1, $2, NOW())",
            "Admin",
            "admin"
        )
        .execute(&pool)
        .await?;
        println!("Role permission (Admin, admin) inserted.");
    }

    Ok(())
}

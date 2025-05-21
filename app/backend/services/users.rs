//! User account management with secure password handling.
//!
//! This module provides functionality to manage user accounts, including
//! creation, retrieval, updates, and deletion. It implements secure password
//! handling using Argon2id password hashing with per-request salt generation
//! and configurable security parameters.

use actix_web::{web, HttpResponse};
use argon2;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::users;
use crate::services::crud::{execute_db_query, CrudError};
use crate::services::database::Database;

/// User account record
///
/// Contains user profile information and authentication details.
#[derive(Queryable, Serialize, ToSchema)]
pub struct User {
    /// Unique identifier
    #[schema(example = 1)]
    pub id: i32,

    /// Email address (used for login)
    #[schema(example = "user@example.com")]
    pub email: String,

    /// Password hash using Argon2id
    #[schema(example = "$argon2id$v=19$m=4096,t=3,p=1$...")]
    pub hash_password: String,

    /// User's first name
    #[schema(example = "John")]
    pub firstname: String,

    /// User's last name
    #[schema(example = "Doe")]
    pub lastname: String,

    /// Whether the account is active
    #[schema(example = true)]
    pub activated: bool,

    /// When the account was created
    pub created_at: chrono::NaiveDateTime,

    /// When the account was last updated
    pub updated_at: chrono::NaiveDateTime,
}

/// Data for creating a new user account
#[derive(Insertable, Deserialize, ToSchema)]
#[diesel(table_name = users)]
pub struct NewUser {
    /// Email address (used for login)
    #[schema(example = "user@example.com")]
    pub email: String,

    /// Plain-text password (will be hashed)
    #[schema(example = "password123")]
    pub hash_password: String,

    /// Whether the account should be initially active
    #[schema(example = true)]
    pub activated: bool,

    /// User's first name
    #[schema(example = "John")]
    pub firstname: String,

    /// User's last name
    #[schema(example = "Doe")]
    pub lastname: String,
}

/// Data for updating an existing user account
///
/// All fields are optional to support partial updates.
#[derive(AsChangeset, Deserialize, ToSchema)]
#[diesel(table_name = users)]
pub struct UpdateUser {
    /// New email address
    #[schema(example = "updated@example.com")]
    pub email: Option<String>,

    /// New plain-text password (will be hashed)
    #[schema(example = "newpassword123")]
    pub hash_password: Option<String>,

    /// New account activation status
    #[schema(example = false)]
    pub activated: Option<bool>,

    /// New first name
    #[schema(example = "Johnny")]
    pub firstname: Option<String>,

    /// New last name
    #[schema(example = "Doesmith")]
    pub lastname: Option<String>,
}

/// Generates a cryptographically secure random salt for password hashing
///
/// # Returns
/// A 16-byte array containing random data for use as salt
pub fn generate_salt() -> [u8; 16] {
    use rand::Fill;
    let mut salt = [0; 16];
    // this does not fail
    salt.fill(&mut rand::rng());
    salt
}

/// Handler for user account operations
///
/// Encapsulates business logic for managing user accounts,
/// including validation, password hashing, and CRUD operations.
pub struct UserHandler {
    /// Application configuration (contains security settings)
    config: Arc<Config>,
}

impl UserHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration with security settings
    ///
    /// # Returns
    /// A new UserHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Validates a new user account
    ///
    /// Ensures that required fields meet formatting and security requirements.
    ///
    /// # Arguments
    /// * `item` - The new user to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_new(&self, item: &NewUser) -> Result<(), CrudError> {
        if item.email.is_empty() || !item.email.contains('@') {
            return Err(CrudError::Validation("Invalid email format".into()));
        }
        if item.hash_password.len() < 8 {
            return Err(CrudError::Validation(
                "Password must be at least 8 characters long".into(),
            ));
        }
        if item.firstname.is_empty() || item.firstname.len() > 100 {
            return Err(CrudError::Validation(
                "First name must be between 1 and 100 characters".into(),
            ));
        }
        if item.lastname.is_empty() || item.lastname.len() > 100 {
            return Err(CrudError::Validation(
                "Last name must be between 1 and 100 characters".into(),
            ));
        }
        Ok(())
    }

    /// Validates user account updates
    ///
    /// Ensures that any fields being updated meet requirements.
    ///
    /// # Arguments
    /// * `item` - The update data to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or a CrudError with validation details
    fn validate_update(&self, item: &UpdateUser) -> Result<(), CrudError> {
        if let Some(ref email) = item.email {
            if email.is_empty() || !email.contains('@') {
                return Err(CrudError::Validation("Invalid email format".into()));
            }
        }
        if let Some(ref password) = item.hash_password {
            if password.len() < 8 {
                return Err(CrudError::Validation(
                    "Password must be at least 8 characters long".into(),
                ));
            }
        }
        if let Some(ref firstname) = item.firstname {
            if firstname.is_empty() || firstname.len() > 100 {
                return Err(CrudError::Validation(
                    "First name must be between 1 and 100 characters".into(),
                ));
            }
        }
        if let Some(ref lastname) = item.lastname {
            if lastname.is_empty() || lastname.len() > 100 {
                return Err(CrudError::Validation(
                    "Last name must be between 1 and 100 characters".into(),
                ));
            }
        }
        Ok(())
    }

    /// Creates an Argon2 configuration with application secret
    ///
    /// # Returns
    /// Argon2 configuration with security parameters
    fn get_argon_config(&self) -> argon2::Config<'static> {
        argon2::Config {
            variant: argon2::Variant::Argon2id,
            version: argon2::Version::Version13,
            secret: Box::leak(self.config.secret_key.clone().into_boxed_str()).as_bytes(),
            ..Default::default()
        }
    }

    /// Hashes a password using Argon2id with a random salt
    ///
    /// # Arguments
    /// * `password` - Plain-text password to hash
    ///
    /// # Returns
    /// Encoded password hash or an error
    fn hash_password(&self, password: &str) -> Result<String, CrudError> {
        let salt = generate_salt();
        argon2::hash_encoded(password.as_bytes(), &salt, &self.get_argon_config())
            .map_err(|e| CrudError::Validation(format!("Password hashing error: {}", e)))
    }

    /// Lists all user accounts
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all user accounts as JSON
    pub async fn list(&self, db: web::Data<Database>) -> Result<HttpResponse, CrudError> {
        use crate::schema::users::dsl::*;
        let results = execute_db_query(db, |conn| users.load::<User>(conn)).await?;
        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific user account by ID
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the user ID
    ///
    /// # Returns
    /// HTTP response with the requested user account as JSON
    pub async fn get_by_id(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::users::dsl::*;
        let user_id = path.into_inner();
        let result =
            execute_db_query(db, move |conn| users.find(user_id).first::<User>(conn)).await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new user account
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New user account to create
    ///
    /// # Returns
    /// HTTP response with the created user account as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewUser>,
    ) -> Result<HttpResponse, CrudError> {
        self.validate_new(&item)?;
        let hashed_password = self.hash_password(&item.hash_password)?;
        let new_user = NewUser {
            email: item.email.clone(),
            hash_password: hashed_password,
            activated: item.activated,
            firstname: item.firstname.clone(),
            lastname: item.lastname.clone(),
        };
        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(users::table)
                .values(&new_user)
                .get_result::<User>(conn)
        })
        .await?;
        Ok(HttpResponse::Created().json(result))
    }

    /// Updates an existing user account
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the user ID
    /// * `item` - Update data
    ///
    /// # Returns
    /// HTTP response with the updated user account as JSON
    pub async fn update(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
        item: web::Json<UpdateUser>,
    ) -> Result<HttpResponse, CrudError> {
        self.validate_update(&item)?;
        let user_id = path.into_inner();
        let mut update_data = item.into_inner();

        // Hash new password if provided
        if let Some(ref password) = update_data.hash_password {
            let hashed_password = self.hash_password(password)?;
            update_data.hash_password = Some(hashed_password);
        }

        let result = execute_db_query(db, move |conn| {
            diesel::update(users::table.find(user_id))
                .set(&update_data)
                .get_result::<User>(conn)
        })
        .await?;
        Ok(HttpResponse::Ok().json(result))
    }

    /// Deletes a user account
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the user ID
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
    ) -> Result<HttpResponse, CrudError> {
        use crate::schema::users::dsl::*;
        let user_id = path.into_inner();
        let deleted_count = execute_db_query(db, move |conn| {
            diesel::delete(users.filter(id.eq(user_id))).execute(conn)
        })
        .await?;
        if deleted_count == 0 {
            return Err(CrudError::NotFound("User not found".into()));
        }
        Ok(HttpResponse::Ok().body("User deleted"))
    }
}

/// Retrieves all user accounts
///
/// Lists all user accounts with their profile information.
/// Note: In production systems, consider filtering out password hashes
/// before returning this data to clients.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with all user accounts as JSON
#[utoipa::path(
    get,
    path = "/api/users",
    tag = "Users",
    responses(
        (status = 200, description = "List of all user accounts with profile information", body = [User]),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_users(
    db: web::Data<Database>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler
        .list(db)
        .await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e.to_string()))
}

/// Retrieves a specific user account
///
/// Gets detailed information about a single user account
/// identified by its unique ID.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - Path parameter containing the user ID
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with the requested user account or not-found error
#[utoipa::path(
    get,
    path = "/api/users/{id}",
    tag = "Users",
    params(
        ("id" = i32, Path, example = 1)
    ),
    responses(
        (status = 200, description = "User account found and returned", body = User),
        (status = 404, description = "No user found with the specified ID"),
        (status = 500, description = "Database connection error or query execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_user_by_id(
    db: web::Data<Database>,
    user_id: web::Path<i32>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.get_by_id(db, user_id).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Creates a new user account
///
/// Validates input data, securely hashes the password using Argon2id,
/// and stores the new user account in the database.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with new user details including plaintext password
/// * `config` - Application configuration with security settings
///
/// # Returns
/// HTTP response with the created user account or validation error
#[utoipa::path(
    post,
    path = "/api/users",
    tag = "Users",
    request_body = NewUser,
    responses(
        (status = 201, description = "User account created successfully", body = User),
        (status = 400, description = "Validation error: invalid email format, password too short, or name length constraints"),
        (status = 500, description = "Database connection error, constraint violation, or password hashing failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_user(
    db: web::Data<Database>,
    item: web::Json<NewUser>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.create(db, item).await.map_err(|e| match e {
        CrudError::Validation(_) => actix_web::error::ErrorBadRequest(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

/// Updates an existing user account
///
/// Supports partial updates with optional fields and securely
/// rehashes password if a new one is provided. Can be used for
/// changing email, password, profile information, or account status.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - Path parameter containing the user ID
/// * `item` - JSON payload with fields to update
/// * `config` - Application configuration with security settings
///
/// # Returns
/// HTTP response with the updated user account or appropriate error
#[utoipa::path(
    put,
    path = "/api/users/{id}",
    tag = "Users",
    params(
        ("id" = i32, Path, example = 1)
    ),
    request_body = UpdateUser,
    responses(
        (status = 200, description = "User account updated successfully", body = User),
        (status = 400, description = "Validation error: invalid field formats or constraints"),
        (status = 404, description = "No user found with the specified ID"),
        (status = 500, description = "Database connection error, constraint violation, or password hashing failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_user(
    db: web::Data<Database>,
    user_id: web::Path<i32>,
    item: web::Json<UpdateUser>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler
        .update(db, user_id, item)
        .await
        .map_err(|e| match e {
            CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
            CrudError::Validation(_) => actix_web::error::ErrorBadRequest(e.to_string()),
            _ => actix_web::error::ErrorInternalServerError(e.to_string()),
        })
}

/// Deletes a user account
///
/// Permanently removes a user account from the system.
/// Note: Consider implementing soft deletion in production
/// systems to maintain audit trails.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - Path parameter containing the user ID
/// * `config` - Application configuration
///
/// # Returns
/// HTTP response with success message or not-found error
#[utoipa::path(
    delete,
    path = "/api/users/{id}",
    tag = "Users",
    params(
        ("id" = i32, Path, example = 1)
    ),
    responses(
        (status = 200, description = "User account deleted successfully"),
        (status = 404, description = "No user found with the specified ID"),
        (status = 500, description = "Database connection error or execution failure")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_user(
    db: web::Data<Database>,
    user_id: web::Path<i32>,
    config: web::Data<Arc<Config>>,
) -> Result<HttpResponse, actix_web::Error> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.delete(db, user_id).await.map_err(|e| match e {
        CrudError::NotFound(_) => actix_web::error::ErrorNotFound(e.to_string()),
        _ => actix_web::error::ErrorInternalServerError(e.to_string()),
    })
}

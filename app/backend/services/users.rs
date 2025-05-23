//! User account management with secure password handling.
//!
//! This module provides functionality to manage user accounts, including
//! creation, retrieval, updates, and deletion. It uses the centralized
//! password service for secure password hashing and validation.

use actix_web::{web, HttpResponse};
use diesel::prelude::*;
use log::{debug, info, warn};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::users;
use crate::services::crud::execute_db_query;
use crate::services::error::{AppError, AppResult};
use crate::services::database::Database;
use crate::services::password::PasswordService;

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

/// Handler for user account operations
///
/// Encapsulates business logic for managing user accounts,
/// including validation, password hashing, and CRUD operations.
pub struct UserHandler {
    /// Application configuration
    config: Arc<Config>,
    /// Centralized password service
    password_service: PasswordService,
}

impl UserHandler {
    /// Creates a new handler with the provided configuration
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new UserHandler instance
    pub fn new(config: Arc<Config>) -> Self {
        let password_service = PasswordService::new(config.clone());
        Self { config, password_service }
    }

    /// Validates a new user account
    ///
    /// Ensures that required fields meet formatting and security requirements.
    ///
    /// # Arguments
    /// * `item` - The new user to validate
    ///
    /// # Returns
    /// Ok(()) if valid, or an AppError with validation details
    fn validate_new(&self, item: &NewUser) -> AppResult<()> {
        // Validate email
        if item.email.is_empty() {
            return Err(AppError::validation("Email cannot be empty", Some("email")));
        }
        
        if !item.email.contains('@') || !item.email.contains('.') {
            return Err(AppError::validation("Invalid email format", Some("email")));
        }
        
        if item.email.len() > 254 {
            return Err(AppError::validation("Email is too long", Some("email")));
        }

        // Validate password using centralized service
        self.password_service.validate_password_strength(&item.hash_password)?;

        // Validate name fields
        if item.firstname.is_empty() {
            return Err(AppError::validation("First name cannot be empty", Some("firstname")));
        }
        
        if item.firstname.len() > 100 {
            return Err(AppError::validation(
                "First name must be no more than 100 characters", 
                Some("firstname")
            ));
        }
        
        if item.lastname.is_empty() {
            return Err(AppError::validation("Last name cannot be empty", Some("lastname")));
        }
        
        if item.lastname.len() > 100 {
            return Err(AppError::validation(
                "Last name must be no more than 100 characters", 
                Some("lastname")
            ));
        }

        // Check for potentially harmful content
        let forbidden_chars = ['<', '>', '"', '\'', '&'];
        if item.firstname.chars().any(|c| forbidden_chars.contains(&c)) {
            return Err(AppError::validation(
                "First name contains invalid characters", 
                Some("firstname")
            ));
        }
        
        if item.lastname.chars().any(|c| forbidden_chars.contains(&c)) {
            return Err(AppError::validation(
                "Last name contains invalid characters", 
                Some("lastname")
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
    /// Ok(()) if valid, or an AppError with validation details
    fn validate_update(&self, item: &UpdateUser) -> AppResult<()> {
        // Validate email if provided
        if let Some(ref email) = item.email {
            if email.is_empty() {
                return Err(AppError::validation("Email cannot be empty", Some("email")));
            }
            
            if !email.contains('@') || !email.contains('.') {
                return Err(AppError::validation("Invalid email format", Some("email")));
            }
            
            if email.len() > 254 {
                return Err(AppError::validation("Email is too long", Some("email")));
            }
        }

        // Validate password if provided
        if let Some(ref password) = item.hash_password {
            self.password_service.validate_password_strength(password)?;
        }

        // Validate first name if provided
        if let Some(ref firstname) = item.firstname {
            if firstname.is_empty() {
                return Err(AppError::validation("First name cannot be empty", Some("firstname")));
            }
            
            if firstname.len() > 100 {
                return Err(AppError::validation(
                    "First name must be no more than 100 characters", 
                    Some("firstname")
                ));
            }
            
            let forbidden_chars = ['<', '>', '"', '\'', '&'];
            if firstname.chars().any(|c| forbidden_chars.contains(&c)) {
                return Err(AppError::validation(
                    "First name contains invalid characters", 
                    Some("firstname")
                ));
            }
        }

        // Validate last name if provided
        if let Some(ref lastname) = item.lastname {
            if lastname.is_empty() {
                return Err(AppError::validation("Last name cannot be empty", Some("lastname")));
            }
            
            if lastname.len() > 100 {
                return Err(AppError::validation(
                    "Last name must be no more than 100 characters", 
                    Some("lastname")
                ));
            }
            
            let forbidden_chars = ['<', '>', '"', '\'', '&'];
            if lastname.chars().any(|c| forbidden_chars.contains(&c)) {
                return Err(AppError::validation(
                    "Last name contains invalid characters", 
                    Some("lastname")
                ));
            }
        }

        Ok(())
    }

    /// Lists all user accounts
    ///
    /// # Arguments
    /// * `db` - Database connection
    ///
    /// # Returns
    /// HTTP response with all user accounts as JSON
    pub async fn list(&self, db: web::Data<Database>) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        debug!("Fetching all user accounts");
        
        let results = execute_db_query(db, |conn| {
            users.load::<User>(conn)
        }).await?;
        
        info!("Successfully fetched {} user accounts", results.len());
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
    ) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        let user_id = path.into_inner();
        debug!("Fetching user account with ID: {}", user_id);
        
        let result = execute_db_query(db, move |conn| {
            users.find(user_id).first::<User>(conn)
        }).await?;
        
        debug!("Successfully fetched user account: {}", result.email);
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
    ) -> AppResult<HttpResponse> {
        let user_data = item.into_inner();
        
        debug!("Creating new user account for: {}", user_data.email);
        
        // Validate the new user data
        self.validate_new(&user_data)?;

        // Check if email already exists
        let email_clone = user_data.email.clone();
        let existing_user = execute_db_query(db.clone(), move |conn| {
            use crate::schema::users::dsl::*;
            users.filter(email.eq(&email_clone))
                .first::<User>(conn)
                .optional()
        }).await?;

        if existing_user.is_some() {
            warn!("Attempted to create user with existing email: {}", user_data.email);
            return Err(AppError::validation(
                "A user with this email already exists", 
                Some("email")
            ));
        }

        // Hash the password
        let hashed_password = self.password_service.hash_password(&user_data.hash_password)?;
        
        let new_user = NewUser {
            email: user_data.email.clone(),
            hash_password: hashed_password,
            activated: user_data.activated,
            firstname: user_data.firstname,
            lastname: user_data.lastname,
        };

        let result = execute_db_query(db, move |conn| {
            diesel::insert_into(users::table)
                .values(&new_user)
                .get_result::<User>(conn)
        }).await?;

        info!("Successfully created user account: {} (ID: {})", result.email, result.id);
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
    ) -> AppResult<HttpResponse> {
        let user_id = path.into_inner();
        let mut update_data = item.into_inner();
        
        debug!("Updating user account with ID: {}", user_id);
        
        // Validate the update data
        self.validate_update(&update_data)?;

        // If email is being updated, check for conflicts
        if let Some(ref new_email) = update_data.email {
            let email_clone = new_email.clone();
            let existing_user = execute_db_query(db.clone(), move |conn| {
                use crate::schema::users::dsl::*;
                users.filter(email.eq(&email_clone))
                    .filter(id.ne(user_id))
                    .first::<User>(conn)
                    .optional()
            }).await?;

            if existing_user.is_some() {
                warn!("Attempted to update user {} with existing email: {}", user_id, new_email);
                return Err(AppError::validation(
                    "A user with this email already exists", 
                    Some("email")
                ));
            }
        }

        // Hash new password if provided
        if let Some(ref password) = update_data.hash_password {
            debug!("Updating password for user: {}", user_id);
            let hashed_password = self.password_service.hash_password(password)?;
            update_data.hash_password = Some(hashed_password);
        }

        let result = execute_db_query(db, move |conn| {
            use crate::schema::users::dsl::*;
            diesel::update(users.find(user_id))
                .set(&update_data)
                .get_result::<User>(conn)
        }).await?;

        info!("Successfully updated user account: {} (ID: {})", result.email, result.id);
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
    ) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        let user_id = path.into_inner();
        debug!("Deleting user account with ID: {}", user_id);

        // First get the user to log the deletion
        let user_to_delete = execute_db_query(db.clone(), move |conn| {
            users.find(user_id).first::<User>(conn).optional()
        }).await?;

        let deleted_count = execute_db_query(db, move |conn| {
            diesel::delete(users.filter(id.eq(user_id))).execute(conn)
        }).await?;
        
        if deleted_count == 0 {
            debug!("No user found with ID: {}", user_id);
            return Err(AppError::not_found("User", Some(user_id.to_string())));
        }

        if let Some(user) = user_to_delete {
            info!("Successfully deleted user account: {} (ID: {})", user.email, user.id);
        }

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "User deleted successfully"
        })))
    }

    /// Check if a user's password needs to be rehashed
    ///
    /// This can be used during login to detect if the password hash
    /// was created with older parameters and needs updating.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - ID of the user to check
    ///
    /// # Returns
    /// True if the password should be rehashed
    pub async fn needs_password_rehash(
        &self, 
        db: web::Data<Database>, 
        user_id: i32
    ) -> AppResult<bool> {
        use crate::schema::users::dsl::*;
        
        let user = execute_db_query(db, move |conn| {
            users.find(user_id).first::<User>(conn)
        }).await?;

        Ok(self.password_service.needs_rehash(&user.hash_password))
    }

    /// Rehash a user's password with current parameters
    ///
    /// This should be called during successful login if the password
    /// needs to be updated to current security standards.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - ID of the user to rehash password for
    /// * `current_password` - Current plain-text password for verification
    ///
    /// # Returns
    /// Result indicating success or failure
    pub async fn rehash_password(
        &self,
        db: web::Data<Database>,
        user_id: i32,
        current_password: &str,
    ) -> AppResult<()> {
        use crate::schema::users::dsl::*;
        
        debug!("Rehashing password for user: {}", user_id);

        // Get current user
        let user = execute_db_query(db.clone(), move |conn| {
            users.find(user_id).first::<User>(conn)
        }).await?;

        // Verify current password
        if !self.password_service.verify_password(current_password, &user.hash_password)? {
            return Err(AppError::auth(
                crate::services::error::AuthErrorReason::InvalidCredentials,
                "Current password verification failed"
            ));
        }

        // Hash with new parameters
        let new_hash = self.password_service.hash_password(current_password)?;

        // Update database
        execute_db_query(db, move |conn| {
            diesel::update(users.filter(id.eq(user_id)))
                .set(hash_password.eq(&new_hash))
                .execute(conn)
        }).await?;

        info!("Successfully rehashed password for user: {}", user_id);
        Ok(())
    }
}

/// Retrieves all user accounts
///
/// Lists all user accounts with their profile information.
/// Note: Password hashes are included but should be filtered in production.
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
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.list(db).await
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
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.get_by_id(db, user_id).await
}

/// Creates a new user account
///
/// Validates input data, securely hashes the password using the centralized
/// password service, and stores the new user account in the database.
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
        (status = 400, description = "Validation error: invalid email format, weak password, name constraints, or email already exists"),
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
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.create(db, item).await
}

/// Updates an existing user account
///
/// Supports partial updates with optional fields and securely
/// rehashes password if a new one is provided using the centralized
/// password service. Can be used for changing email, password, 
/// profile information, or account status.
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
        (status = 400, description = "Validation error: invalid field formats, constraints, or email conflicts"),
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
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.update(db, user_id, item).await
}

/// Deletes a user account
///
/// Permanently removes a user account from the system.
/// Note: Consider implementing soft deletion in production
/// systems to maintain audit trails and referential integrity.
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
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.delete(db, user_id).await
}
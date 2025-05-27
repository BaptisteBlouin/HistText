//! Enhanced user account management with comprehensive security event logging.
//!
//! This module provides functionality to manage user accounts with complete
//! security event tracking throughout the user lifecycle, including creation,
//! authentication, updates, and deletion. It uses centralized password service
//! for secure password handling and logs all security-relevant events.

use actix_web::{web, HttpRequest, HttpResponse};
use diesel::prelude::*;
use log::{debug, info, warn, error};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::config::Config;
use crate::schema::users;
use crate::services::crud::execute_db_query;
use crate::services::error::{AppError, AppResult};
use crate::services::database::Database;
use crate::services::password::PasswordService;
use crate::services::security_events::SecurityEventLogger;
use crate::services::role_assignment::get_role_assignment_service;

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
#[derive(AsChangeset, Deserialize, ToSchema, Clone)] // Added Clone derive
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

/// Self-update structure with limited fields users can modify about themselves
#[derive(AsChangeset, Deserialize, ToSchema, Clone)] // Added Clone derive
#[diesel(table_name = users)]
pub struct SelfUpdateUser {
    /// User can update their own email
    #[schema(example = "newemail@example.com")]
    pub email: Option<String>,

    /// User can update their own password
    #[schema(example = "newpassword123")]
    pub hash_password: Option<String>,

    /// User can update their first name
    #[schema(example = "NewFirstName")]
    pub firstname: Option<String>,

    /// User can update their last name
    #[schema(example = "NewLastName")]
    pub lastname: Option<String>,

    // Note: activated is NOT included - users cannot change their activation status
}

/// Enhanced user handler with comprehensive security logging
///
/// Encapsulates business logic for managing user accounts with full
/// security event tracking throughout the user lifecycle.
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

    /// Validates self-update data
    fn validate_self_update(&self, item: &SelfUpdateUser) -> AppResult<()> {
        // Reuse existing validation logic but for SelfUpdateUser
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

        if let Some(ref password) = item.hash_password {
            self.password_service.validate_password_strength(password)?;
        }

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

    /// Lists all user accounts with security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// HTTP response with all user accounts as JSON
    pub async fn list(&self, db: web::Data<Database>, req: Option<&HttpRequest>) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        debug!("Admin fetching all user accounts");
        
        let results = execute_db_query(db.clone(), |conn| {
            users.load::<User>(conn)
        }).await?;
        
        info!("Successfully fetched {} user accounts", results.len());

        // Log administrative access to user list
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "admin_user_list_access",
            None,
            None,
            &format!("Administrator accessed user list ({} users)", results.len()),
            "low",
            req,
        ).await {
            warn!("Failed to log user list access event: {}", e);
        }

        Ok(HttpResponse::Ok().json(results))
    }

    /// Gets a specific user account by ID with security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the user ID
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// HTTP response with the requested user account as JSON
    pub async fn get_by_id(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
        req: Option<&HttpRequest>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        let user_id = path.into_inner();
        debug!("Fetching user account with ID: {}", user_id);
        
        let result = execute_db_query(db.clone(), move |conn| {
            users.find(user_id).first::<User>(conn)
        }).await?;
        
        debug!("Successfully fetched user account: {}", result.email);

        // Log access to specific user account
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "admin_user_access",
            Some(result.id),
            Some(result.email.clone()),
            &format!("Administrator accessed user profile: {}", result.email),
            "low",
            req,
        ).await {
            warn!("Failed to log user access event: {}", e);
        }

        Ok(HttpResponse::Ok().json(result))
    }

    /// Creates a new user account with comprehensive security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - New user account to create
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// HTTP response with the created user account as JSON
    pub async fn create(
        &self,
        db: web::Data<Database>,
        item: web::Json<NewUser>,
        req: Option<&HttpRequest>,
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

            // Log failed user creation attempt
            if let Err(e) = SecurityEventLogger::log_event(
                db.clone(),
                "user_creation_failed",
                None,
                Some(user_data.email.clone()),
                &format!("Failed user creation: Email {} already exists", user_data.email),
                "medium",
                req,
            ).await {
                warn!("Failed to log user creation failure: {}", e);
            }

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

        let result = execute_db_query(db.clone(), move |conn| {
            diesel::insert_into(users::table)
                .values(&new_user)
                .get_result::<User>(conn)
        }).await?;

        info!("Successfully created user account: {} (ID: {})", result.email, result.id);

        // If the user was created as activated, automatically assign default role
        if result.activated {
            let role_service = get_role_assignment_service();
            if let Err(e) = role_service.assign_default_role_to_user(
                db.clone(),
                result.id,
                &result.email,
                "admin_creation",
                req,
            ).await {
                // Log error but don't fail user creation
                warn!("Failed to assign default role to newly created user {}: {}", 
                    result.id, e);
            }
        }

        // Log successful user creation
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "user_creation_success",
            Some(result.id),
            Some(result.email.clone()),
            &format!("Administrator created user account: {} ({})", result.email, 
                if result.activated { "activated" } else { "pending activation" }),
            "medium",
            req,
        ).await {
            warn!("Failed to log user creation success: {}", e);
        }

        Ok(HttpResponse::Created().json(result))
    }

    /// Updates an existing user account with security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the user ID
    /// * `item` - Update data
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// HTTP response with the updated user account as JSON
    pub async fn update(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
        item: web::Json<UpdateUser>,
        req: Option<&HttpRequest>,
    ) -> AppResult<HttpResponse> {
        let user_id = path.into_inner();
        let mut update_data = item.into_inner();
        
        debug!("Updating user account with ID: {}", user_id);
        
        // Get original user data for change tracking
        let original_user = execute_db_query(db.clone(), move |conn| {
            use crate::schema::users::dsl::*;
            users.find(user_id).first::<User>(conn)
        }).await?;
        
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

                // Log failed email change attempt
                if let Err(e) = SecurityEventLogger::log_event(
                    db.clone(),
                    "user_update_failed",
                    Some(user_id),
                    Some(original_user.email.clone()),
                    &format!("Failed email update for {}: {} already exists", original_user.email, new_email),
                    "medium",
                    req,
                ).await {
                    warn!("Failed to log user update failure: {}", e);
                }

                return Err(AppError::validation(
                    "A user with this email already exists", 
                    Some("email")
                ));
            }
        }

        // Track changes for security logging
        let mut changes = Vec::new();
        let password_changed = update_data.hash_password.is_some();
        let activation_changed = update_data.activated.is_some();
        
        if let Some(ref new_email) = update_data.email {
            if *new_email != original_user.email {
                changes.push(format!("email: {} -> {}", original_user.email, new_email));
            }
        }

        if let Some(ref new_firstname) = update_data.firstname {
            if *new_firstname != original_user.firstname {
                changes.push(format!("firstname: {} -> {}", original_user.firstname, new_firstname));
            }
        }

        if let Some(ref new_lastname) = update_data.lastname {
            if *new_lastname != original_user.lastname {
                changes.push(format!("lastname: {} -> {}", original_user.lastname, new_lastname));
            }
        }

        if let Some(new_activated) = update_data.activated {
            if new_activated != original_user.activated {
                changes.push(format!("activated: {} -> {}", original_user.activated, new_activated));
            }
        }

        if password_changed {
            changes.push("password: changed".to_string());
        }

        // Hash new password if provided
        if let Some(ref password) = update_data.hash_password {
            debug!("Updating password for user: {}", user_id);
            let hashed_password = self.password_service.hash_password(password)?;
            update_data.hash_password = Some(hashed_password);
        }

        // Clone update_data before moving it into the closure
        let _update_data_clone = update_data.clone();
        let result = execute_db_query(db.clone(), move |conn| {
            use crate::schema::users::dsl::*;
            diesel::update(users.find(user_id))
                .set(&update_data)
                .get_result::<User>(conn)
        }).await?;

        info!("Successfully updated user account: {} (ID: {})", result.email, result.id);

        // Log the update with detailed change information
        let change_description = if changes.is_empty() {
            "No changes made".to_string()
        } else {
            format!("Administrator updated user {}: {}", result.email, changes.join(", "))
        };

        if let Err(e) = SecurityEventLogger::log_event(
            db.clone(),
            if password_changed { "admin_password_change" } else { "user_profile_update" },
            Some(result.id),
            Some(result.email.clone()),
            &change_description,
            if password_changed || activation_changed { "medium" } else { "low" },
            req,
        ).await {
            warn!("Failed to log user update: {}", e);
        }

        // If password was changed, log it separately for security
        if password_changed {
            if let Err(e) = SecurityEventLogger::log_event(
                db,
                "admin_forced_password_change",
                Some(result.id),
                Some(result.email.clone()),
                &format!("Administrator forced password change for user: {}", result.email),
                "high",
                req,
            ).await {
                warn!("Failed to log password change: {}", e);
            }
        }

        Ok(HttpResponse::Ok().json(result))
    }

    /// Deletes a user account with security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `path` - Path parameter containing the user ID
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// HTTP response indicating success or not found
    pub async fn delete(
        &self,
        db: web::Data<Database>,
        path: web::Path<i32>,
        req: Option<&HttpRequest>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        let user_id = path.into_inner();
        debug!("Deleting user account with ID: {}", user_id);

        // First get the user to log the deletion
        let user_to_delete = execute_db_query(db.clone(), move |conn| {
            users.find(user_id).first::<User>(conn).optional()
        }).await?;

        if user_to_delete.is_none() {
            debug!("No user found with ID: {}", user_id);
            return Err(AppError::not_found("User", Some(user_id.to_string())));
        }

        let user = user_to_delete.unwrap();
        let user_email = user.email.clone(); // Clone email before user is moved

        let deleted_count = execute_db_query(db.clone(), move |conn| {
            diesel::delete(users.filter(id.eq(user_id))).execute(conn)
        }).await?;
        
        if deleted_count == 0 {
            debug!("No user found with ID: {}", user_id);
            return Err(AppError::not_found("User", Some(user_id.to_string())));
        }

        info!("Successfully deleted user account: {} (ID: {})", user_email, user.id);

        // Log the user deletion
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "user_deletion",
            Some(user.id),
            Some(user_email.clone()),
            &format!("Administrator deleted user account: {} ({})", 
                user_email, 
                if user.activated { "was active" } else { "was inactive" }),
            "high",
            req,
        ).await {
            warn!("Failed to log user deletion: {}", e);
        }

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "User deleted successfully"
        })))
    }

    /// Self-update - allows users to update their own information with security logging
    pub async fn self_update(
        &self,
        db: web::Data<Database>,
        auth: crate::services::auth::Auth,
        item: web::Json<SelfUpdateUser>,
        req: Option<&HttpRequest>,
    ) -> AppResult<HttpResponse> {
        let user_id = auth.user_id;
        let mut update_data = item.into_inner();
        
        debug!("User {} updating their own account", user_id);
        
        // Get original user data for change tracking
        let original_user = execute_db_query(db.clone(), move |conn| {
            use crate::schema::users::dsl::*;
            users.find(user_id).first::<User>(conn)
        }).await?;
        
        // Validate the update data
        self.validate_self_update(&update_data)?;

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
                warn!("User {} attempted to use existing email: {}", user_id, new_email);
                
                // Log failed email change attempt
                if let Err(e) = SecurityEventLogger::log_event(
                    db.clone(),
                    "self_update_failed",
                    Some(user_id),
                    Some(original_user.email.clone()),
                    &format!("Failed self email update: {} already exists", new_email),
                    "low",
                    req,
                ).await {
                    warn!("Failed to log self update failure: {}", e);
                }

                return Err(AppError::validation(
                    "A user with this email already exists", 
                    Some("email")
                ));
            }
        }

        // Track changes for security logging
        let mut changes = Vec::new();
        let password_changed = update_data.hash_password.is_some();
        
        if let Some(ref new_email) = update_data.email {
            if *new_email != original_user.email {
                changes.push(format!("email: {} -> {}", original_user.email, new_email));
            }
        }

        if let Some(ref new_firstname) = update_data.firstname {
            if *new_firstname != original_user.firstname {
                changes.push(format!("firstname: {} -> {}", original_user.firstname, new_firstname));
            }
        }

        if let Some(ref new_lastname) = update_data.lastname {
            if *new_lastname != original_user.lastname {
                changes.push(format!("lastname: {} -> {}", original_user.lastname, new_lastname));
            }
        }

        if password_changed {
            changes.push("password: changed".to_string());
        }

        // Hash new password if provided
        if let Some(ref password) = update_data.hash_password {
            debug!("User {} updating their password", user_id);
            let hashed_password = self.password_service.hash_password(password)?;
            update_data.hash_password = Some(hashed_password);
        }

        // Convert SelfUpdateUser to UpdateUser for database operation
        let db_update = UpdateUser {
            email: update_data.email,
            hash_password: update_data.hash_password,
            firstname: update_data.firstname,
            lastname: update_data.lastname,
            activated: None, // Users cannot change their activation status
        };

        let result = execute_db_query(db.clone(), move |conn| {
            use crate::schema::users::dsl::*;
            diesel::update(users.find(user_id))
                .set(&db_update)
                .get_result::<User>(conn)
        }).await?;

        info!("User {} successfully updated their own account", result.id);

        // Log the self-update with detailed change information
        let change_description = if changes.is_empty() {
            "No changes made to profile".to_string()
        } else {
            format!("User updated profile: {}", changes.join(", "))
        };

        if let Err(e) = SecurityEventLogger::log_event(
            db.clone(),
            if password_changed { "self_password_change" } else { "self_profile_update" },
            Some(result.id),
            Some(result.email.clone()),
            &change_description,
            if password_changed { "medium" } else { "low" },
            req,
        ).await {
            warn!("Failed to log self update: {}", e);
        }

        // If password was changed, log it separately
        if password_changed {
            if let Err(e) = SecurityEventLogger::log_password_change(
                db,
                result.id,
                &result.email,
                req,
            ).await {
                warn!("Failed to log password change: {}", e);
            }
        }

        Ok(HttpResponse::Ok().json(result))
    }

    /// Get own user information with access logging
    pub async fn get_self(
        &self,
        db: web::Data<Database>,
        auth: crate::services::auth::Auth,
        req: Option<&HttpRequest>,
    ) -> AppResult<HttpResponse> {
        use crate::schema::users::dsl::*;
        
        let user_id = auth.user_id;
        debug!("User {} fetching their own account info", user_id);
        
        let result = execute_db_query(db.clone(), move |conn| {
            users.find(user_id).first::<User>(conn)
        }).await?;
        
        debug!("Successfully fetched self info for user: {}", result.email);

        // Log self-access (low priority, but useful for audit trails)
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "self_profile_access",
            Some(result.id),
            Some(result.email.clone()),
            "User accessed their own profile information",
            "low",
            req,
        ).await {
            warn!("Failed to log self profile access: {}", e);
        }

        Ok(HttpResponse::Ok().json(result))
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

    /// Rehash a user's password with current parameters and log the security event
    ///
    /// This should be called during successful login if the password
    /// needs to be updated to current security standards.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - ID of the user to rehash password for
    /// * `current_password` - Current plain-text password for verification
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// Result indicating success or failure
    pub async fn rehash_password(
        &self,
        db: web::Data<Database>,
        user_id: i32,
        current_password: &str,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        use crate::schema::users::dsl::*;
        
        debug!("Rehashing password for user: {}", user_id);

        // Get current user
        let user = execute_db_query(db.clone(), move |conn| {
            users.find(user_id).first::<User>(conn)
        }).await?;

        // Verify current password
        if !self.password_service.verify_password(current_password, &user.hash_password)? {
            // Log failed rehash attempt
            if let Err(e) = SecurityEventLogger::log_event(
                db.clone(),
                "password_rehash_failed",
                Some(user_id),
                Some(user.email.clone()),
                "Failed password rehash: current password verification failed",
                "medium",
                req,
            ).await {
                warn!("Failed to log password rehash failure: {}", e);
            }

            return Err(AppError::auth(
                crate::services::error::AuthErrorReason::InvalidCredentials,
                "Current password verification failed"
            ));
        }

        // Hash with new parameters
        let new_hash = self.password_service.hash_password(current_password)?;
        let user_email = user.email.clone(); // Clone before moving

        // Update database
        execute_db_query(db.clone(), move |conn| {
            diesel::update(users.filter(id.eq(user_id)))
                .set(hash_password.eq(&new_hash))
                .execute(conn)
        }).await?;

        info!("Successfully rehashed password for user: {}", user_id);

        // Log successful password rehash for security audit
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "password_rehash_success",
            Some(user_id),
            Some(user_email),
            "Password hash updated to current security standards during login",
            "low",
            req,
        ).await {
            warn!("Failed to log password rehash success: {}", e);
        }

        Ok(())
    }

    /// Activate a user account with security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - ID of the user to activate
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// Result indicating success or failure
    pub async fn activate_user(
        &self,
        db: web::Data<Database>,
        user_id: i32,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        use crate::schema::users::dsl::*;
       
       debug!("Activating user account: {}", user_id);

       // Get user info before activation
       let user = execute_db_query(db.clone(), move |conn| {
           users.find(user_id).first::<User>(conn)
       }).await?;

       if user.activated {
           warn!("Attempted to activate already active user: {}", user.email);
           return Ok(()); // Already activated, no error needed
       }

       let user_email = user.email.clone(); // Clone before moving

       // Activate the user
       execute_db_query(db.clone(), move |conn| {
           diesel::update(users.filter(id.eq(user_id)))
               .set(activated.eq(true))
               .execute(conn)
       }).await?;

       info!("Successfully activated user account: {}", user_email);

       // Automatically assign default role to newly activated user
       let role_service = get_role_assignment_service();
       if let Err(e) = role_service.assign_default_role_to_user(
           db.clone(),
           user_id,
           &user_email,
           "admin_activation",
           req,
       ).await {
           // Log error but don't fail activation
           warn!("Failed to assign default role to activated user {}: {}", 
               user_id, e);
       }

       // Log account activation
       if let Err(e) = SecurityEventLogger::log_event(
           db,
           "account_activation",
           Some(user_id),
           Some(user_email),
           "User account successfully activated",
           "medium",
           req,
       ).await {
           warn!("Failed to log account activation: {}", e);
       }

       Ok(())
   }


    /// Deactivate a user account with security logging
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - ID of the user to deactivate
    /// * `reason` - Reason for deactivation
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// Result indicating success or failure
    pub async fn deactivate_user(
       &self,
       db: web::Data<Database>,
       user_id: i32,
       reason: &str,
       req: Option<&HttpRequest>,
   ) -> AppResult<()> {
       use crate::schema::users::dsl::*;
       
       debug!("Deactivating user account: {} (reason: {})", user_id, reason);

       // Get user info before deactivation
       let user = execute_db_query(db.clone(), move |conn| {
           users.find(user_id).first::<User>(conn)
       }).await?;

       if !user.activated {
           warn!("Attempted to deactivate already inactive user: {}", user.email);
           return Ok(()); // Already deactivated, no error needed
       }

       let user_email = user.email.clone(); // Clone before moving

       // Deactivate the user
       execute_db_query(db.clone(), move |conn| {
           diesel::update(users.filter(id.eq(user_id)))
               .set(activated.eq(false))
               .execute(conn)
       }).await?;

       info!("Successfully deactivated user account: {} (reason: {})", user_email, reason);

       // Optionally remove default role (you can choose whether to do this)
       let role_service = get_role_assignment_service();
       if let Err(e) = role_service.remove_default_role_from_user(
           db.clone(),
           user_id,
           &user_email,
           req,
       ).await {
           // Log error but don't fail deactivation
           warn!("Failed to remove default role from deactivated user {}: {}", 
               user_id, e);
       }

       // Log account deactivation
       if let Err(e) = SecurityEventLogger::log_event(
           db,
           "account_deactivation",
           Some(user_id),
           Some(user_email),
           &format!("User account deactivated: {}", reason),
           "high",
           req,
       ).await {
           warn!("Failed to log account deactivation: {}", e);
       }

       Ok(())
   }

    /// Lock a user account due to suspicious activity
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - ID of the user to lock
    /// * `reason` - Reason for locking
    /// * `req` - HTTP request for logging context
    ///
    /// # Returns
    /// Result indicating success or failure
    pub async fn lock_user_account(
        &self,
        db: web::Data<Database>,
        user_id: i32,
        reason: &str,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        // This would require additional database schema for account locking
        // For now, we'll deactivate and log as a security lock
        
        let user = execute_db_query(db.clone(), move |conn| {
            use crate::schema::users::dsl::*;
            users.find(user_id).first::<User>(conn)
        }).await?;

        let user_email = user.email.clone(); // Clone before deactivation

        // Deactivate account
        self.deactivate_user(db.clone(), user_id, reason, req).await?;

        // Log as security lock (high severity)
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "account_security_lock",
            Some(user_id),
            Some(user_email.clone()),
            &format!("Account locked for security reasons: {}", reason),
            "high",
            req,
        ).await {
            warn!("Failed to log account lock: {}", e);
        }

        error!("User account {} locked due to: {}", user_email, reason);
        Ok(())
    }
}

/// Retrieves all user accounts with admin security logging
///
/// Lists all user accounts with their profile information.
/// Note: Password hashes are included but should be filtered in production.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `config` - Application configuration
/// * `req` - HTTP request for security logging
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
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.list(db, Some(&req)).await
}

/// Retrieves a specific user account with access logging
///
/// Gets detailed information about a single user account
/// identified by its unique ID.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - Path parameter containing the user ID
/// * `config` - Application configuration
/// * `req` - HTTP request for security logging
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
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.get_by_id(db, user_id, Some(&req)).await
}

/// Creates a new user account with comprehensive security logging
///
/// Validates input data, securely hashes the password using the centralized
/// password service, and stores the new user account in the database with
/// full security event logging.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - JSON payload with new user details including plaintext password
/// * `config` - Application configuration with security settings
/// * `req` - HTTP request for security logging
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
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.create(db, item, Some(&req)).await
}

/// Updates an existing user account with change tracking and security logging
///
/// Supports partial updates with optional fields and securely
/// rehashes password if a new one is provided using the centralized
/// password service. Logs all changes for security audit.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - Path parameter containing the user ID
/// * `item` - JSON payload with fields to update
/// * `config` - Application configuration with security settings
/// * `req` - HTTP request for security logging
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
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.update(db, user_id, item, Some(&req)).await
}

/// Deletes a user account with comprehensive security logging
///
/// Permanently removes a user account from the system with full
/// security audit logging. Consider implementing soft deletion in
/// production systems to maintain audit trails.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `user_id` - Path parameter containing the user ID
/// * `config` - Application configuration
/// * `req` - HTTP request for security logging
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
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.delete(db, user_id, Some(&req)).await
}

/// Gets current user's own information with access logging
#[utoipa::path(
    get,
    path = "/api/user/me",
    tag = "Users",
    responses(
        (status = 200, description = "Current user's account information", body = User),
        (status = 401, description = "User not authenticated")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_current_user(
    db: web::Data<Database>,
    auth: crate::services::auth::Auth,
    config: web::Data<Arc<Config>>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.get_self(db, auth, Some(&req)).await
}

/// Updates current user's own information with security logging
#[utoipa::path(
    put,
    path = "/api/user/me",
    tag = "Users",
    request_body = SelfUpdateUser,
    responses(
        (status = 200, description = "User account updated successfully", body = User),
        (status = 400, description = "Validation error: invalid field formats or email conflicts"),
        (status = 401, description = "User not authenticated")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_current_user(
    db: web::Data<Database>,
    auth: crate::services::auth::Auth,
    item: web::Json<SelfUpdateUser>,
    config: web::Data<Arc<Config>>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    handler.self_update(db, auth, item, Some(&req)).await
}

/// Activate a user account (admin only)
#[utoipa::path(
    post,
    path = "/api/users/{id}/activate",
    tag = "Users",
    params(
        ("id" = i32, Path, example = 1)
    ),
    responses(
        (status = 200, description = "User account activated successfully"),
        (status = 404, description = "No user found with the specified ID"),
        (status = 500, description = "Database connection error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn activate_user(
    db: web::Data<Database>,
    user_id: web::Path<i32>,
    config: web::Data<Arc<Config>>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    let user_id = user_id.into_inner();
    
    handler.activate_user(db, user_id, Some(&req)).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "User account activated successfully"
    })))
}

/// Deactivate a user account (admin only)
#[derive(Deserialize, ToSchema)]
pub struct DeactivateUserRequest {
    #[schema(example = "Account suspended for policy violation")]
    pub reason: String,
}

#[utoipa::path(
    post,
    path = "/api/users/{id}/deactivate",
    tag = "Users",
    params(
        ("id" = i32, Path, example = 1)
    ),
    request_body = DeactivateUserRequest,
    responses(
        (status = 200, description = "User account deactivated successfully"),
        (status = 404, description = "No user found with the specified ID"),
        (status = 500, description = "Database connection error")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn deactivate_user(
    db: web::Data<Database>,
    user_id: web::Path<i32>,
    item: web::Json<DeactivateUserRequest>,
    config: web::Data<Arc<Config>>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let handler = UserHandler::new(config.get_ref().clone());
    let user_id = user_id.into_inner();
    let reason = &item.reason;
    
    handler.deactivate_user(db, user_id, reason, Some(&req)).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "message": "User account deactivated successfully"
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use crate::services::database::Database;
    use actix_web::web::Data;
    use std::sync::Arc;

    // Test utility to create a database connection for tests
    fn test_db() -> Data<Database> {
        let config = Arc::new(Config::load().expect("Failed to load config"));
        Data::new(Database::with_config(config))
    }

    fn test_config() -> Data<Arc<Config>> {
        Data::new(Arc::new(Config::load().expect("Failed to load config")))
    }

    #[actix_rt::test]
    async fn test_validate_new_user() {
        let config = test_config();
        let handler = UserHandler::new(config.get_ref().clone());
        
        // Valid user
        let valid_user = NewUser {
            email: "test@example.com".to_string(),
            hash_password: "SecurePass123!".to_string(),
            activated: true,
            firstname: "John".to_string(),
            lastname: "Doe".to_string(),
        };
        
        assert!(handler.validate_new(&valid_user).is_ok());
        
        // Invalid email
        let invalid_email = NewUser {
            email: "invalid-email".to_string(),
            hash_password: "SecurePass123!".to_string(),
            activated: true,
            firstname: "John".to_string(),
            lastname: "Doe".to_string(),
        };
        
        assert!(handler.validate_new(&invalid_email).is_err());
        
        // Weak password
        let weak_password = NewUser {
            email: "test@example.com".to_string(),
            hash_password: "123".to_string(),
            activated: true,
            firstname: "John".to_string(),
            lastname: "Doe".to_string(),
        };
        
        assert!(handler.validate_new(&weak_password).is_err());
    }

    #[actix_rt::test]
    async fn test_password_strength_validation() {
        let config = test_config();
        let handler = UserHandler::new(config.get_ref().clone());
        
        // Test various password strengths
        assert!(handler.password_service.validate_password_strength("SecurePass123!").is_ok());
        assert!(handler.password_service.validate_password_strength("weak").is_err());
        assert!(handler.password_service.validate_password_strength("password123").is_err()); // Common pattern
    }

    #[test]
    fn test_forbidden_characters() {
        let config = Arc::new(Config::load().expect("Failed to load config"));
        let handler = UserHandler::new(config);
        
        let user_with_forbidden_chars = NewUser {
            email: "test@example.com".to_string(),
            hash_password: "SecurePass123!".to_string(),
            activated: true,
            firstname: "John<script>".to_string(),
            lastname: "Doe".to_string(),
        };
        
        assert!(handler.validate_new(&user_with_forbidden_chars).is_err());
    }
}
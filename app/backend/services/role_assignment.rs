//! Automatic role assignment service for user lifecycle events.

use crate::config::Config;
use crate::services::crud::execute_db_transaction_named;
use crate::services::error::AppError;
use crate::services::database::Database;
use crate::services::security_events::SecurityEventLogger;
use actix_web::{web, HttpRequest};
use diesel::prelude::*;
use log::{debug, info, warn};
use std::sync::Arc;

/// Default role assigned to newly activated users
pub const DEFAULT_USER_ROLE: &str = "FreeUser";

/// Role assignment service for automatic role management
pub struct RoleAssignmentService {
    /// Application configuration
    #[allow(dead_code)]
    config: Arc<Config>,
}

impl RoleAssignmentService {
    /// Creates a new role assignment service
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Creates the default role if it doesn't exist
    pub async fn ensure_default_role_exists(&self, db: web::Data<Database>) -> Result<(), AppError> {
        debug!("Ensuring default role '{}' exists", DEFAULT_USER_ROLE);

        execute_db_transaction_named(
            db,
            move |conn| {
                use crate::schema::role_permissions::dsl::*;

                // Check if the role already has at least one permission (indicating it exists)
                let existing_permissions = role_permissions
                    .filter(role.eq(DEFAULT_USER_ROLE))
                    .count()
                    .get_result::<i64>(conn)?;

                if existing_permissions == 0 {
                    // Create basic permissions for the FreeUser role
                    let default_permissions = vec![
                        crate::services::role_permissions::NewRolePermission {
                            role: DEFAULT_USER_ROLE.to_string(),
                            permission: "read".to_string(),
                        },
                        crate::services::role_permissions::NewRolePermission {
                            role: DEFAULT_USER_ROLE.to_string(),
                            permission: "search".to_string(),
                        },
                    ];

                    diesel::insert_into(role_permissions)
                        .values(&default_permissions)
                        .execute(conn)?;

                    info!("Created default role '{}' with basic permissions", DEFAULT_USER_ROLE);
                } else {
                    debug!("Default role '{}' already exists with {} permissions", 
                        DEFAULT_USER_ROLE, existing_permissions);
                }

                Ok(())
            },
            Some("ensure_default_role_exists"),
        ).await?;

        Ok(())
    }

    /// Assigns the default role to a user during account activation
    pub async fn assign_default_role_to_user(
        &self,
        db: web::Data<Database>,
        target_user_id: i32,
        user_email: &str,
        trigger_reason: &str,
        req: Option<&HttpRequest>,
    ) -> Result<(), AppError> {
        debug!("Assigning default role '{}' to user {} ({})", 
            DEFAULT_USER_ROLE, target_user_id, trigger_reason);

        let user_email_owned = user_email.to_string();
        let trigger_reason_owned = trigger_reason.to_string();

        execute_db_transaction_named(
            db.clone(),
            move |conn| {
                use crate::schema::user_roles::dsl::*;

                // Check if user already has this role
                let existing_role = user_roles
                    .filter(user_id.eq(target_user_id))
                    .filter(role.eq(DEFAULT_USER_ROLE))
                    .first::<crate::services::user_roles::UserRole>(conn)
                    .optional()?;

                if existing_role.is_some() {
                    debug!("User {} already has role '{}'", target_user_id, DEFAULT_USER_ROLE);
                    return Ok(());
                }

                // Create the role assignment
                let new_user_role = crate::services::user_roles::NewUserRole {
                    user_id: target_user_id,
                    role: DEFAULT_USER_ROLE.to_string(),
                };

                diesel::insert_into(user_roles)
                    .values(&new_user_role)
                    .execute(conn)?;

                info!("Successfully assigned role '{}' to user {} due to {}", 
                    DEFAULT_USER_ROLE, target_user_id, trigger_reason_owned);

                Ok(())
            },
            Some("assign_default_role_to_user"),
        ).await?;

        // Log the role assignment for security audit
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "automatic_role_assignment",
            Some(target_user_id),
            Some(user_email_owned),
            &format!("Automatically assigned role '{}' due to {}", DEFAULT_USER_ROLE, trigger_reason),
            "medium",
            req,
        ).await {
            warn!("Failed to log automatic role assignment: {}", e);
        }

        Ok(())
    }

    /// Removes the default role from a user (for deactivation scenarios)
    pub async fn remove_default_role_from_user(
        &self,
        db: web::Data<Database>,
        target_user_id: i32,
        user_email: &str,
        req: Option<&HttpRequest>,
    ) -> Result<(), AppError> {
        debug!("Removing default role '{}' from user {}", DEFAULT_USER_ROLE, target_user_id);

        let user_email_owned = user_email.to_string();

        let deleted_count = execute_db_transaction_named(
            db.clone(),
            move |conn| {
                use crate::schema::user_roles::dsl::*;

                diesel::delete(
                    user_roles
                        .filter(user_id.eq(target_user_id))
                        .filter(role.eq(DEFAULT_USER_ROLE))
                )
                .execute(conn)
            },
            Some("remove_default_role_from_user"),
        ).await?;

        if deleted_count > 0 {
            info!("Successfully removed role '{}' from user {}", DEFAULT_USER_ROLE, target_user_id);

            // Log the role removal for security audit
            if let Err(e) = SecurityEventLogger::log_event(
                db,
                "automatic_role_removal",
                Some(target_user_id),
                Some(user_email_owned),
                &format!("Automatically removed role '{}' due to account deactivation", DEFAULT_USER_ROLE),
                "medium",
                req,
            ).await {
                warn!("Failed to log automatic role removal: {}", e);
            }
        } else {
            debug!("User {} did not have role '{}' to remove", target_user_id, DEFAULT_USER_ROLE);
        }

        Ok(())
    }

    /// Gets all users who should have the default role but don't
    pub async fn get_users_missing_default_role(&self, db: web::Data<Database>) -> Result<Vec<i32>, AppError> {
        debug!("Finding users missing default role '{}'", DEFAULT_USER_ROLE);

        let missing_users = execute_db_transaction_named(
            db,
            move |conn| {
                use crate::schema::users::dsl as users_dsl;
                use crate::schema::user_roles::dsl as user_roles_dsl;

                // Find activated users who don't have the FreeUser role
                users_dsl::users
                    .filter(users_dsl::activated.eq(true))
                    .filter(
                        users_dsl::id.ne_all(
                            user_roles_dsl::user_roles
                                .filter(user_roles_dsl::role.eq(DEFAULT_USER_ROLE))
                                .select(user_roles_dsl::user_id)
                        )
                    )
                    .select(users_dsl::id)
                    .load::<i32>(conn)
            },
            Some("get_users_missing_default_role"),
        ).await?;

        info!("Found {} users missing default role '{}'", missing_users.len(), DEFAULT_USER_ROLE);
        Ok(missing_users)
    }

    /// Batch assign default role to multiple users
    pub async fn batch_assign_default_role(
        &self,
        db: web::Data<Database>,
        user_ids: Vec<i32>,
        req: Option<&HttpRequest>,
    ) -> Result<(), AppError> {
        if user_ids.is_empty() {
            debug!("No users to assign default role to");
            return Ok(());
        }
        let user_count = user_ids.len();
        info!("Batch assigning default role '{}' to {} users", DEFAULT_USER_ROLE, user_ids.len());

        let _assigned_count = execute_db_transaction_named(
            db.clone(),
            move |conn| {
                use crate::schema::user_roles::dsl::*;

                // Create role assignments for all users
                let new_roles: Vec<crate::services::user_roles::NewUserRole> = user_ids
                    .iter()
                    .map(|&uid| crate::services::user_roles::NewUserRole {
                        user_id: uid,
                        role: DEFAULT_USER_ROLE.to_string(),
                    })
                    .collect();

                diesel::insert_into(user_roles)
                    .values(&new_roles)
                    .execute(conn)
            },
            Some("batch_assign_default_role"),
        ).await?;

        info!("Successfully assigned default role to {} users", user_count);

        // Log batch assignment
        if let Err(e) = SecurityEventLogger::log_event(
            db,
            "batch_role_assignment",
            None,
            None,
            &format!("Batch assigned role '{}' to {} users", DEFAULT_USER_ROLE, user_count),
            "medium",
            req,
        ).await {
            warn!("Failed to log batch role assignment: {}", e);
        }

        Ok(())
    }
}

/// Global role assignment service instance
pub fn get_role_assignment_service() -> RoleAssignmentService {
    RoleAssignmentService::new(crate::config::Config::global().clone())
}
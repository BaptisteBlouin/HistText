//! Administrative role management endpoints.

use actix_web::{web, HttpRequest, HttpResponse};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::services::crud::execute_db_query;
use crate::services::database::Database;
use crate::services::error::AppError;
use crate::services::role_assignment::{get_role_assignment_service, DEFAULT_USER_ROLE};
use crate::services::security_events::SecurityEventLogger;

#[derive(Serialize, ToSchema)]
pub struct RoleAssignmentStats {
    /// Total number of activated users
    pub total_activated_users: i64,
    /// Number of users with the default role
    pub users_with_default_role: i64,
    /// Number of users missing the default role
    pub users_missing_default_role: i64,
    /// Default role name
    pub default_role_name: String,
}

#[derive(Deserialize, ToSchema)]
pub struct BatchRoleAssignmentRequest {
    /// List of user IDs to assign the default role to
    pub user_ids: Vec<i32>,
}

#[derive(Serialize, ToSchema)]
pub struct BatchRoleAssignmentResponse {
    /// Number of users successfully assigned the role
    pub assigned_count: usize,
    /// Any user IDs that failed (empty if all succeeded)
    pub failed_user_ids: Vec<i32>,
    /// Success message
    pub message: String,
}

/// Get role assignment statistics
#[utoipa::path(
    get,
    path = "/api/admin/role-assignment-stats",
    tag = "Admin",
    responses(
        (status = 200, description = "Role assignment statistics", body = RoleAssignmentStats),
        (status = 500, description = "Database error")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_role_assignment_stats(db: web::Data<Database>) -> Result<HttpResponse, AppError> {
    let stats = execute_db_query(db, |conn| {
        use crate::schema::user_roles::dsl as user_roles_dsl;
        use crate::schema::users::dsl as users_dsl;

        // Count total activated users
        let total_activated_users = users_dsl::users
            .filter(users_dsl::activated.eq(true))
            .count()
            .get_result::<i64>(conn)?;

        // Count users with default role
        let users_with_default_role = user_roles_dsl::user_roles
            .filter(user_roles_dsl::role.eq(DEFAULT_USER_ROLE))
            .count()
            .get_result::<i64>(conn)?;

        let users_missing_default_role = total_activated_users - users_with_default_role;

        Ok(RoleAssignmentStats {
            total_activated_users,
            users_with_default_role,
            users_missing_default_role,
            default_role_name: DEFAULT_USER_ROLE.to_string(),
        })
    })
    .await?;

    Ok(HttpResponse::Ok().json(stats))
}

/// Fix missing role assignments for activated users
#[utoipa::path(
    post,
    path = "/api/admin/fix-missing-roles",
    tag = "Admin",
    responses(
        (status = 200, description = "Missing roles fixed successfully", body = BatchRoleAssignmentResponse),
        (status = 500, description = "Database error")
    ),
    security(("bearer_auth" = []))
)]
pub async fn fix_missing_role_assignments(
    db: web::Data<Database>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let role_service = get_role_assignment_service();

    // Get users missing the default role
    let missing_users = role_service
        .get_users_missing_default_role(db.clone())
        .await?;

    if missing_users.is_empty() {
        return Ok(HttpResponse::Ok().json(BatchRoleAssignmentResponse {
            assigned_count: 0,
            failed_user_ids: vec![],
            message: "No users found missing the default role".to_string(),
        }));
    }

    let user_count = missing_users.len();

    // Batch assign the default role
    role_service
        .batch_assign_default_role(db.clone(), missing_users, Some(&req))
        .await?;

    // Log the administrative action
    if let Err(e) = SecurityEventLogger::log_event(
        db,
        "admin_batch_role_fix",
        None,
        None,
        &format!(
            "Administrator fixed missing role assignments for {} users",
            user_count
        ),
        "medium",
        Some(&req),
    )
    .await
    {
        log::warn!("Failed to log batch role fix: {}", e);
    }

    Ok(HttpResponse::Ok().json(BatchRoleAssignmentResponse {
        assigned_count: user_count,
        failed_user_ids: vec![],
        message: format!("Successfully assigned default role to {} users", user_count),
    }))
}

/// Manually assign default role to specific users
#[utoipa::path(
    post,
    path = "/api/admin/assign-roles",
    tag = "Admin",
    request_body = BatchRoleAssignmentRequest,
    responses(
        (status = 200, description = "Roles assigned successfully", body = BatchRoleAssignmentResponse),
        (status = 400, description = "Invalid request"),
        (status = 500, description = "Database error")
    ),
    security(("bearer_auth" = []))
)]
pub async fn assign_roles_to_users(
    db: web::Data<Database>,
    req: HttpRequest,
    payload: web::Json<BatchRoleAssignmentRequest>,
) -> Result<HttpResponse, AppError> {
    let request_data = payload.into_inner();

    if request_data.user_ids.is_empty() {
        return Err(AppError::validation(
            "User IDs list cannot be empty",
            Some("user_ids"),
        ));
    }

    if request_data.user_ids.len() > 100 {
        return Err(AppError::validation(
            "Cannot assign roles to more than 100 users at once",
            Some("user_ids"),
        ));
    }

    let role_service = get_role_assignment_service();

    // Clone the user_ids to avoid borrowing issues
    let user_ids_for_query = request_data.user_ids.clone();

    // Verify that all user IDs exist and are activated
    let valid_users = execute_db_query(db.clone(), move |conn| {
        use crate::schema::users::dsl::*;

        users
            .filter(id.eq_any(&user_ids_for_query))
            .filter(activated.eq(true))
            .select(id)
            .load::<i32>(conn)
    })
    .await?;

    if valid_users.is_empty() {
        return Err(AppError::validation(
            "No valid activated users found",
            Some("user_ids"),
        ));
    }

    let failed_user_ids: Vec<i32> = request_data
        .user_ids
        .iter()
        .filter(|&&uid| !valid_users.contains(&uid))
        .cloned()
        .collect();

    // Batch assign the default role to valid users
    role_service
        .batch_assign_default_role(db.clone(), valid_users.clone(), Some(&req))
        .await?;

    // Log the administrative action
    if let Err(e) = SecurityEventLogger::log_event(
        db,
        "admin_manual_role_assignment",
        None,
        None,
        &format!(
            "Administrator manually assigned roles to {} users",
            valid_users.len()
        ),
        "medium",
        Some(&req),
    )
    .await
    {
        log::warn!("Failed to log manual role assignment: {}", e);
    }

    Ok(HttpResponse::Ok().json(BatchRoleAssignmentResponse {
        assigned_count: valid_users.len(),
        failed_user_ids,
        message: format!(
            "Successfully assigned default role to {} users",
            valid_users.len()
        ),
    }))
}

/// Get list of users missing the default role
#[utoipa::path(
    get,
    path = "/api/admin/users-missing-roles",
    tag = "Admin",
    responses(
        (status = 200, description = "List of users missing default role", body = Vec<i32>),
        (status = 500, description = "Database error")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_users_missing_default_role(
    db: web::Data<Database>,
) -> Result<HttpResponse, AppError> {
    let role_service = get_role_assignment_service();
    let missing_users = role_service.get_users_missing_default_role(db).await?;

    Ok(HttpResponse::Ok().json(missing_users))
}

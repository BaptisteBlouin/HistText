//! Authentication and authorization route handlers for the web API.
//!
//! Features:
//! - User authentication endpoints (login, logout, refresh)
//! - User registration and account activation
//! - Password management (change, reset, forgot)
//! - Session management with cookie-based refresh tokens
//! - Permission management endpoints with admin protection
//! - Comprehensive error handling with proper HTTP status codes
//! - Cookie security with HttpOnly, Secure, and SameSite attributes
//! - Middleware integration for route protection

use actix_web::cookie::{Cookie, SameSite};
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, post, web, Error as AWError, HttpRequest, HttpResponse, Result};
use serde_json::json;

use crate::auth::controllers::auth as controller;
use crate::auth::controllers::auth::{
    ActivationInput, ChangeInput, ForgotInput, LoginInput, RegisterInput, ResetInput, 
    UserSessionResponse, COOKIE_NAME,
};
use crate::auth::{Auth, PaginationParams};
use crate::config::Config;
use crate::services::database::Database;
use crate::services::mailer::Mailer;

/// Retrieves paginated user sessions for the authenticated user
///
/// Returns a list of active sessions with device information and timestamps,
/// allowing users to monitor and manage their authentication sessions.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `auth` - Authenticated user context
/// * `info` - Pagination parameters from query string
///
/// # Returns
/// HTTP response with session list or error
#[utoipa::path(
    get,
    path = "/auth/sessions",
    tag = "Authentication",
    params(PaginationParams),
    responses(
        (status = 200, description = "Successfully retrieved user sessions", body = UserSessionResponse),
        (status = 401, description = "User not authenticated"),
        (status = 500, description = "Failed to retrieve sessions from database")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
#[get("/sessions")]
pub async fn sessions(
    db: Data<Database>,
    auth: Auth,
    Query(info): Query<PaginationParams>,
) -> Result<HttpResponse, AWError> {
    let result = web::block(move || controller::get_sessions(&db, &auth, &info)).await?;

    match result {
        Ok(sessions) => Ok(HttpResponse::Ok().json(sessions)),
        Err((status_code, error_message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": error_message }).to_string())),
    }
}

/// Destroys a specific user session by ID
///
/// Logs out a specific session, invalidating the associated refresh token.
/// Users can only destroy their own sessions.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item_id` - Session ID from URL path
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
#[utoipa::path(
    delete,
    path = "/auth/sessions/{id}",
    tag = "Authentication",
    params(
        ("id" = i32, Path, description = "Session ID to destroy")
    ),
    responses(
        (status = 200, description = "Session successfully destroyed"),
        (status = 401, description = "User not authenticated"),
        (status = 404, description = "Session not found or does not belong to user"),
        (status = 500, description = "Failed to destroy session")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
#[delete("/sessions/{id}")]
pub async fn destroy_session(
    db: Data<Database>,
    item_id: Path<i32>,
    auth: Auth,
) -> Result<HttpResponse, AWError> {
    let result =
        web::block(move || controller::destroy_session(&db, &auth, item_id.into_inner())).await?;

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body(json!({"message": "Deleted."}).to_string())),
        Err((status_code, error_message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": error_message }).to_string())),
    }
}

/// Destroys all user sessions for the authenticated user
///
/// Logs out from all devices by invalidating all refresh tokens associated
/// with the user account. This is useful for security purposes.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating success or error
#[utoipa::path(
    delete,
    path = "/auth/sessions",
    tag = "Authentication",
    responses(
        (status = 200, description = "All sessions successfully destroyed"),
        (status = 401, description = "User not authenticated"),
        (status = 500, description = "Failed to destroy sessions")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
#[delete("/sessions")]
pub async fn destroy_sessions(db: Data<Database>, auth: Auth) -> Result<HttpResponse, AWError> {
    let result = web::block(move || controller::destroy_sessions(&db, &auth)).await?;

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body(json!({"message": "Deleted."}).to_string())),
        Err((status_code, error_message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": error_message }).to_string())),
    }
}

/// Authenticates user with email and password
///
/// Validates user credentials and returns an access token in the response body
/// while setting a secure HttpOnly refresh token cookie for session management.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - Login credentials including email and password
///
/// # Returns
/// HTTP response with access token or authentication error
#[utoipa::path(
    post,
    path = "/auth/login",
    tag = "Authentication",
    request_body = LoginInput,
    responses(
        (status = 200, description = "Successfully authenticated user", body = inline(Object), example = json!({"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."})),
        (status = 400, description = "Account not activated or invalid device"),
        (status = 401, description = "Invalid credentials"),
        (status = 500, description = "Internal server error during authentication")
    )
)]
#[post("/login")]
pub async fn login(
    db: Data<Database>,
    Json(item): Json<LoginInput>,
) -> Result<HttpResponse, AWError> {
    let result = web::block(move || controller::login(&db, &item)).await?;

    match result {
        Ok((access_token, refresh_token)) => {
            Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
                .cookie(
                    Cookie::build(COOKIE_NAME, refresh_token)
                        .secure(true)
                        .http_only(true)
                        .same_site(SameSite::Strict)
                        .path("/")
                        .finish(),
                )
                .body(json!({ "access_token": access_token }).to_string()))
        }
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Logs out user by invalidating refresh token
///
/// Destroys the current user session by invalidating the refresh token
/// and clearing the refresh token cookie.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - HTTP request containing refresh token cookie
///
/// # Returns
/// HTTP response indicating successful logout or error
#[utoipa::path(
    post,
    path = "/auth/logout",
    tag = "Authentication",
    responses(
        (status = 200, description = "Successfully logged out user"),
        (status = 401, description = "Invalid or missing refresh token"),
        (status = 500, description = "Failed to destroy session")
    )
)]
#[post("/logout")]
pub async fn logout(db: Data<Database>, req: HttpRequest) -> Result<HttpResponse, AWError> {
    let refresh_token = req
        .cookie(COOKIE_NAME)
        .map(|cookie| String::from(cookie.value()));

    let result = web::block(move || {
        controller::logout(&db, refresh_token.as_ref().map(std::convert::AsRef::as_ref))
    })
    .await?;

    match result {
        Ok(()) => {
            let mut cookie = Cookie::named(COOKIE_NAME);
            cookie.make_removal();

            Ok(HttpResponse::Ok().cookie(cookie).finish())
        }
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Refreshes access token using refresh token
///
/// Generates a new access token and refresh token pair using the current
/// refresh token from the HTTP-only cookie, extending the user's session.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `req` - HTTP request containing refresh token cookie
///
/// # Returns
/// HTTP response with new access token or authentication error
#[utoipa::path(
    post,
    path = "/auth/refresh",
    tag = "Authentication",
    responses(
        (status = 200, description = "Successfully refreshed tokens", body = inline(Object), example = json!({"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."})),
        (status = 401, description = "Invalid or expired refresh token"),
        (status = 500, description = "Failed to refresh tokens")
    )
)]
#[post("/refresh")]
pub async fn refresh(db: Data<Database>, req: HttpRequest) -> Result<HttpResponse, AWError> {
    let refresh_token = req
        .cookie(COOKIE_NAME)
        .map(|cookie| String::from(cookie.value()));

    let result = web::block(move || {
        controller::refresh(&db, refresh_token.as_ref().map(std::convert::AsRef::as_ref))
    })
    .await?;

    match result {
        Ok((access_token, refresh_token)) => {
            Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
                .cookie(
                    Cookie::build(COOKIE_NAME, refresh_token)
                        .secure(true)
                        .http_only(true)
                        .same_site(SameSite::Strict)
                        .path("/")
                        .finish(),
                )
                .body(json!({ "access_token": access_token }).to_string()))
        }
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Registers a new user account
///
/// Creates a new user account with the provided information and sends
/// an activation email. The account must be activated before login.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - Registration data including email, password, and personal info
/// * `mailer` - Email service for sending activation email
///
/// # Returns
/// HTTP response indicating successful registration or error
#[utoipa::path(
    post,
    path = "/auth/register",
    tag = "Authentication",
    request_body = RegisterInput,
    responses(
        (status = 200, description = "Successfully registered user", body = inline(Object), example = json!({"message": "Registered! Check your email to activate your account."})),
        (status = 400, description = "User already registered or invalid input"),
        (status = 500, description = "Failed to create user account")
    )
)]
#[post("/register")]
pub async fn register(
    db: Data<Database>,
    Json(item): Json<RegisterInput>,
    mailer: Data<Mailer>,
) -> Result<HttpResponse, AWError> {
    let result = controller::register(&db, &item, &mailer);

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body("{ \"message\": \"Registered! Check your email to activate your account.\" }")),
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Activates user account using activation token
///
/// Validates the activation token from the registration email and
/// activates the user account, enabling login functionality.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - Activation token from email query parameters
/// * `mailer` - Email service for sending confirmation email
///
/// # Returns
/// HTTP response indicating successful activation or error
#[utoipa::path(
    get,
    path = "/auth/activate",
    tag = "Authentication",
    params(ActivationInput),
    responses(
        (status = 200, description = "Successfully activated account", body = inline(Object), example = json!({"message": "Activated!"})),
        (status = 400, description = "Invalid activation token"),
        (status = 401, description = "Expired or malformed token"),
        (status = 500, description = "Failed to activate account")
    )
)]
#[get("/activate")]
pub async fn activate(
    db: Data<Database>,
    Query(item): Query<ActivationInput>,
    mailer: Data<Mailer>,
) -> Result<HttpResponse, AWError> {
    let result = controller::activate(&db, &item, &mailer);

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body("{ \"message\": \"Activated!\" }")),
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Initiates password recovery process
///
/// Sends password reset instructions to the provided email address.
/// If the account exists, sends a reset link; otherwise, sends registration info.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - Email address for password recovery
/// * `mailer` - Email service for sending recovery instructions
///
/// # Returns
/// HTTP response with generic success message for security
#[utoipa::path(
    post,
    path = "/auth/forgot",
    tag = "Authentication",
    request_body = ForgotInput,
    responses(
        (status = 200, description = "Password recovery email sent", body = inline(Object), example = json!({"message": "Please check your email."})),
        (status = 500, description = "Failed to send recovery email")
    )
)]
#[post("/forgot")]
pub async fn forgot_password(
    db: Data<Database>,
    Json(item): Json<ForgotInput>,
    mailer: Data<Mailer>,
) -> Result<HttpResponse, AWError> {
    let result = controller::forgot_password(&db, &item, &mailer);

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body("{ \"message\": \"Please check your email.\" }")),
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Changes user password with current password verification
///
/// Updates the user's password after verifying the current password.
/// Requires authentication and sends confirmation email.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - Password change request with old and new passwords
/// * `auth` - Authenticated user context
/// * `mailer` - Email service for sending confirmation email
///
/// # Returns
/// HTTP response indicating successful password change or error
#[utoipa::path(
    post,
    path = "/auth/change",
    tag = "Authentication",
    request_body = ChangeInput,
    responses(
        (status = 200, description = "Password successfully changed", body = inline(Object), example = json!({"message": "Password changed."})),
        (status = 400, description = "Missing password or passwords are the same"),
        (status = 401, description = "Invalid current password or user not authenticated"),
        (status = 500, description = "Failed to update password")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
#[post("/change")]
pub async fn change_password(
    db: Data<Database>,
    Json(item): Json<ChangeInput>,
    auth: Auth,
    mailer: Data<Mailer>,
) -> Result<HttpResponse, AWError> {
    let result = controller::change_password(&db, &item, &auth, &mailer);

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body(json!({"message": "Password changed."}).to_string())),
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Validates authentication token
///
/// Simple endpoint to verify that the user's authentication token is valid.
/// Returns 200 OK if authenticated, otherwise returns authentication error.
///
/// # Arguments
/// * `auth` - Authenticated user context
///
/// # Returns
/// HTTP response indicating authentication status
#[utoipa::path(
    post,
    path = "/auth/check",
    tag = "Authentication",
    responses(
        (status = 200, description = "User is authenticated"),
        (status = 401, description = "User not authenticated or invalid token")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
#[post("/check")]
pub async fn check(auth: Auth) -> HttpResponse {
    controller::check(&auth);
    HttpResponse::Ok().finish()
}

/// Resets user password using reset token
///
/// Updates the user's password using a valid reset token from the
/// password recovery email, bypassing current password verification.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `item` - Password reset request with token and new password
/// * `mailer` - Email service for sending confirmation email
///
/// # Returns
/// HTTP response indicating successful password reset or error
#[utoipa::path(
    post,
    path = "/auth/reset",
    tag = "Authentication",
    request_body = ResetInput,
    responses(
        (status = 200, description = "Password successfully reset", body = inline(Object), example = json!({"message": "Password reset"})),
        (status = 400, description = "Missing password or account not activated"),
        (status = 401, description = "Invalid or expired reset token"),
        (status = 500, description = "Failed to reset password")
    )
)]
#[post("/reset")]
pub async fn reset_password(
    db: Data<Database>,
    Json(item): Json<ResetInput>,
    mailer: Data<Mailer>,
) -> Result<HttpResponse, AWError> {
    let result = controller::reset_password(&db, &item, &mailer);

    match result {
        Ok(()) => Ok(HttpResponse::build(actix_web::http::StatusCode::OK)
            .body(json!({"message": "Password reset"}).to_string())),
        Err((status_code, message)) => Ok(HttpResponse::build(
            actix_web::http::StatusCode::from_u16(status_code).unwrap(),
        )
        .body(json!({ "message": message }).to_string())),
    }
}

/// Configures all authentication endpoints for the application
///
/// This function should be called from your main application setup
/// to register all authentication-related routes.
///
/// # Arguments
/// * `config` - Actix web ServiceConfig to configure
/// * `app_config` - Application configuration
#[allow(dead_code)]
pub fn configure_routes(config: &mut actix_web::web::ServiceConfig, _app_config: &Config) {
    config.service(
        web::scope("/auth")
            .service(sessions)
            .service(destroy_session)
            .service(destroy_sessions)
            .service(login)
            .service(logout)
            .service(check)
            .service(refresh)
            .service(register)
            .service(activate)
            .service(forgot_password)
            .service(change_password)
            .service(reset_password),
    );

    configure_permission_routes(config);
}

/// Configure routes for permission management
fn configure_permission_routes(config: &mut actix_web::web::ServiceConfig) {
    use crate::auth::controllers::permission_management;
    use crate::auth::middleware::auth::JwtAuth;
    use crate::auth::middleware::auth::RequirePermission;

    config.service(
        web::scope("/permissions")
            .wrap(JwtAuth)
            .wrap(RequirePermission::new("admin"))
            .route(
                "/role",
                web::post().to(permission_management::grant_role_permission),
            )
            .route(
                "/user",
                web::post().to(permission_management::grant_user_permission),
            )
            .route(
                "/role/batch",
                web::post().to(permission_management::grant_role_permissions),
            )
            .route(
                "/user/batch",
                web::post().to(permission_management::grant_user_permissions),
            )
            .route(
                "/role/revoke",
                web::post().to(permission_management::revoke_role_permission),
            )
            .route(
                "/user/revoke",
                web::post().to(permission_management::revoke_user_permission),
            )
            .route(
                "/role/revoke/batch",
                web::post().to(permission_management::revoke_role_permissions),
            )
            .route(
                "/user/revoke/batch",
                web::post().to(permission_management::revoke_user_permissions),
            )
            .route(
                "/role/{role}/revoke/all",
                web::delete().to(permission_management::revoke_all_role_permissions),
            )
            .route(
                "/user/{user_id}/revoke/all",
                web::delete().to(permission_management::revoke_all_user_permissions),
            ),
    );
}

/// Helper function to show how to use Permission middleware
///
/// This is an example of how you would apply permission middleware
/// to protect routes in your application.
#[allow(dead_code)]
pub fn configure_protected_routes(config: &mut web::ServiceConfig) {
    use crate::auth::middleware::auth::{JwtAuth, RequirePermission, RequireRole};

    config.service(
        web::scope("/admin")
            .wrap(JwtAuth)
            .wrap(RequirePermission::new("admin"))
            .route(
                "/dashboard",
                web::get().to(|| async { HttpResponse::Ok().json(json!({"status": "ok"})) }),
            ),
    );

    config.service(
        web::scope("/manager")
            .wrap(JwtAuth)
            .wrap(RequireRole::new("manager")),
    );
}
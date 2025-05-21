// backend/auth/routes.rs

use actix_web::cookie::{Cookie, SameSite};
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, post, web, Error as AWError, HttpRequest, HttpResponse, Result};
use serde_json::json;

use crate::auth::controllers::auth as controller;
use crate::auth::controllers::auth::{
    ActivationInput, ChangeInput, ForgotInput, LoginInput, RegisterInput, ResetInput, COOKIE_NAME,
};
use crate::auth::Auth;
use crate::auth::PaginationParams;
use crate::config::Config;
use crate::services::database::Database;
use crate::services::mailer::Mailer;

/// Handler for GET requests at the /sessions endpoint
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

/// Handler for DELETE requests at the /sessions/{id} endpoint
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

/// Handler for DELETE requests at the /sessions endpoint
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

/// Handler for POST requests at the /login endpoint
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

/// Handler for POST requests at the /logout endpoint
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

/// Handler for POST requests at the /refresh endpoint
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

/// Handler for POST requests at the /register endpoint
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

/// Handler for GET requests at the /activate endpoint
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

/// Handler for POST requests at the /forgot endpoint
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

/// Handler for POST requests at the /change endpoint
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

/// Handler for POST requests at the /check endpoint
#[post("/check")]
pub async fn check(auth: Auth) -> HttpResponse {
    controller::check(&auth);
    HttpResponse::Ok().finish()
}

/// Handler for POST requests at the /reset endpoint
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
#[allow(dead_code)] // Suppress warning as this will be used in the main application
pub fn configure_routes(config: &mut actix_web::web::ServiceConfig, _app_config: &Config) {
    // Set up authentication routes
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

    // Configure permission management routes
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
#[allow(dead_code)] // Suppress warning as this is intended to be an example
pub fn configure_protected_routes(config: &mut web::ServiceConfig) {
    use crate::auth::middleware::auth::{JwtAuth, RequirePermission, RequireRole};

    // Example: Routes that require authentication and specific permissions
    config.service(
        web::scope("/admin")
            // First verify authentication
            .wrap(JwtAuth)
            // Then check for admin permission - define this permission in your database
            .wrap(RequirePermission::new("admin"))
            // Add your admin routes here
            .route(
                "/dashboard",
                web::get().to(|| async { HttpResponse::Ok().json(json!({"status": "ok"})) }),
            ),
    );

    // Example: Routes that require a specific role
    config.service(
        web::scope("/manager")
            .wrap(JwtAuth)
            .wrap(RequireRole::new("manager")), // Add your manager routes here
    );
}

//! Consolidated authentication and authorization service.
//!
//! This module provides complete authentication functionality including:
//! - JWT-based authentication with access and refresh tokens
//! - User registration, activation, and password management
//! - Role-based access control with permissions
//! - Session management with device tracking
//! - Password hashing with Argon2
//! - Email-based account activation and password recovery

use crate::config::Config;
use crate::services::error::{AppError, AppResult, AuthErrorReason};
use crate::services::crud::execute_db_query;
use crate::services::database::Database;
use crate::services::mailer::Mailer;
use actix_web::{
    dev::Payload,
    error::{Error as ActixError, ErrorUnauthorized},
    http::header,
    web, FromRequest, HttpRequest, HttpResponse,
};
use chrono::{Duration, Utc};
use diesel::prelude::*;
use futures::future::{ready, Ready};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use utoipa::{IntoParams, ToSchema};
use actix_web::web::Query;


pub const COOKIE_NAME: &str = "refresh_token";

/// User ID type
pub type ID = i32;

lazy_static::lazy_static! {
    /// Argon2 configuration for password hashing
    pub static ref ARGON_CONFIG: argon2::Config<'static> = argon2::Config {
        variant: argon2::Variant::Argon2id,
        version: argon2::Version::Version13,
        secret: std::env::var("SECRET_KEY")
            .map_or_else(|_| panic!("No SECRET_KEY environment variable set!"), 
                        |s| Box::leak(s.into_boxed_str()).as_bytes()),
        ..Default::default()
    };
}

/// Permission model for role-based access control
#[derive(Debug, Serialize, Deserialize, Clone, Hash, PartialEq, Eq)]
pub struct Permission {
    pub permission: String,
    pub from_role: String,
}

/// JWT claims for access tokens
#[derive(Debug, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
    pub roles: Vec<String>,
    pub permissions: Vec<Permission>,
}

/// JWT claims for refresh tokens
#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

/// Authentication context containing user identity and permissions
#[derive(Debug, Clone)]
pub struct Auth {
    pub user_id: ID,
    pub roles: HashSet<String>,
    pub permissions: HashSet<Permission>,
}

impl Auth {
    /// Checks if user has specific permission
    pub fn has_permission(&self, permission: String) -> bool {
        self.permissions.contains(&Permission {
            permission,
            from_role: String::new(),
        })
    }

    /// Checks if user has all specified permissions
    pub fn has_all_permissions(&self, perms: impl AsRef<[String]>) -> bool {
        perms
            .as_ref()
            .iter()
            .all(|p| self.has_permission(p.to_string()))
    }

    /// Checks if user has any of the specified permissions
    pub fn has_any_permission(&self, perms: impl AsRef<[String]>) -> bool {
        perms
            .as_ref()
            .iter()
            .any(|p| self.has_permission(p.to_string()))
    }

    /// Checks if user has specific role
    pub fn has_role(&self, role: impl AsRef<str>) -> bool {
        self.roles.contains(role.as_ref())
    }

    /// Checks if user has all specified roles
    pub fn has_all_roles(&self, roles: impl AsRef<[String]>) -> bool {
        roles.as_ref().iter().all(|r| self.has_role(r))
    }

    /// Checks if user has any of the specified roles
    pub fn has_any_roles(&self, roles: impl AsRef<[String]>) -> bool {
        roles.as_ref().iter().any(|r| self.has_role(r))
    }
}

/// Implement FromRequest for Auth to enable automatic extraction in route handlers
impl FromRequest for Auth {
    type Error = ActixError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        let config = match req.app_data::<web::Data<Arc<Config>>>() {
            Some(config) => config,
            None => {
                return ready(Err(ErrorUnauthorized("Server configuration not found")));
            }
        };

        if let Some(auth_header) = req.headers().get(header::AUTHORIZATION) {
            if let Ok(auth_str) = auth_header.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    let token_result = decode::<AccessTokenClaims>(
                        token,
                        &DecodingKey::from_secret(config.secret_key.as_bytes()),
                        &Validation::default(),
                    );

                    if let Ok(token_data) = token_result {
                        let permissions: HashSet<Permission> =
                            token_data.claims.permissions.iter().cloned().collect();

                        let roles: HashSet<String> =
                            token_data.claims.roles.iter().cloned().collect();

                        let auth = Auth {
                            user_id: token_data.claims.sub,
                            roles,
                            permissions,
                        };

                        return ready(Ok(auth));
                    }

                    return ready(Err(ErrorUnauthorized("Invalid token")));
                }
            }
        }

        ready(Err(ErrorUnauthorized("Authorization required")))
    }
}

/// Request parameters for user login
#[derive(Deserialize, Serialize, ToSchema)]
pub struct LoginInput {
    #[schema(example = "user@example.com")]
    pub email: String,
    pub password: String,
    #[schema(example = "iPhone 12")]
    pub device: Option<String>,
    pub ttl: Option<i64>,
}

/// Request parameters for user registration
#[derive(Serialize, Deserialize, ToSchema)]
pub struct RegisterInput {
    #[schema(example = "user@example.com")]
    pub email: String,
    #[schema(example = "John")]
    pub firstname: String,
    #[schema(example = "Doe")]
    pub lastname: String,
    pub password: String,
}

/// Request parameters for account activation
#[derive(Serialize, Deserialize, IntoParams)]
pub struct ActivationInput {
    pub activation_token: String,
}

/// Request parameters for password reset request
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ForgotInput {
    #[schema(example = "user@example.com")]
    pub email: String,
}

/// Request parameters for password change
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChangeInput {
    pub old_password: String,
    pub new_password: String,
}

/// Request parameters for password reset
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ResetInput {
    pub reset_token: String,
    pub new_password: String,
}

/// Pagination parameters for database queries
#[derive(Deserialize, Serialize, IntoParams)]
pub struct PaginationParams {
    pub page: i64,
    pub page_size: i64,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: 0,
            page_size: 10,
        }
    }
}

/// User session data for API responses
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct UserSessionJson {
    pub id: ID,
    pub device: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Queryable)]
pub struct UserSession {
    pub id: i32,
    pub user_id: i32,
    pub refresh_token: String,
    pub device: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    pub updated_at: chrono::NaiveDateTime,
}

/// Response containing user sessions with pagination
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct UserSessionResponse {
    pub sessions: Vec<UserSessionJson>,
    pub num_pages: i64,
}

/// Authentication service handler
pub struct AuthHandler {
    config: Arc<Config>,
}

impl AuthHandler {
    pub fn new(config: Arc<Config>) -> Self {
        Self { config }
    }

    /// Generates a cryptographically secure salt for password hashing
    pub fn generate_salt() -> [u8; 16] {
        use rand::Fill;
        let mut salt = [0; 16];
        salt.fill(&mut rand::rng());
        salt
    }

    /// Hashes a password using Argon2id
    pub fn hash_password(&self, password: &str) -> AppResult<String> {
        let salt = Self::generate_salt();
        argon2::hash_encoded(password.as_bytes(), &salt, &ARGON_CONFIG)
            .map_err(|e| AppError::validation(
                format!("Password hashing error: {}", e),
                Some("password")
            ))
    }

    /// Verifies a password against its hash
    pub fn verify_password(&self, password: &str, hash: &str) -> AppResult<bool> {
        argon2::verify_encoded_ext(hash, password.as_bytes(), ARGON_CONFIG.secret, ARGON_CONFIG.ad)
            .map_err(|e| AppError::auth(
                AuthErrorReason::InvalidCredentials,
                format!("Password verification failed: {}", e)
            ))
    }

    /// Creates JWT tokens for a user
    pub async fn create_tokens(
        &self,
        db: web::Data<Database>,
        user_id: ID,
        ttl: Option<i64>,
    ) -> AppResult<(String, String)> {
        use crate::schema::role_permissions::dsl as role_perms_dsl;
        use crate::schema::user_permissions::dsl as user_perms_dsl;
        use crate::schema::user_roles::dsl as user_roles_dsl;

        // Fetch user permissions and roles
        let (permissions, roles) = execute_db_query(db, move |conn| {
            // Get roles
            let user_roles: Vec<String> = user_roles_dsl::user_roles
                .filter(user_roles_dsl::user_id.eq(user_id))
                .select(user_roles_dsl::role)
                .load(conn)?;

            // Get permissions from roles
            let mut role_permissions: Vec<Permission> = Vec::new();
            for role in &user_roles {
                let perms: Vec<String> = role_perms_dsl::role_permissions
                    .filter(role_perms_dsl::role.eq(role))
                    .select(role_perms_dsl::permission)
                    .load(conn)?;
                
                for perm in perms {
                    role_permissions.push(Permission {
                        permission: perm,
                        from_role: role.clone(),
                    });
                }
            }

            // Get direct user permissions
            let direct_perms: Vec<String> = user_perms_dsl::user_permissions
                .filter(user_perms_dsl::user_id.eq(user_id))
                .select(user_perms_dsl::permission)
                .load(conn)?;

            for perm in direct_perms {
                role_permissions.push(Permission {
                    permission: perm,
                    from_role: "direct".to_string(),
                });
            }

            Ok((role_permissions, user_roles))
        }).await?;

        let access_token_duration = Duration::seconds(ttl.unwrap_or(15 * 60));
        let refresh_token_duration = Duration::hours(24);

        let access_token_claims = AccessTokenClaims {
            exp: (Utc::now() + access_token_duration).timestamp() as usize,
            sub: user_id,
            token_type: "access_token".to_string(),
            roles,
            permissions,
        };

        let refresh_token_claims = RefreshTokenClaims {
            exp: (Utc::now() + refresh_token_duration).timestamp() as usize,
            sub: user_id,
            token_type: "refresh_token".to_string(),
        };

        let access_token = encode(
            &Header::default(),
            &access_token_claims,
            &EncodingKey::from_secret(self.config.secret_key.as_ref()),
        )
        .map_err(|e| AppError::auth(
            AuthErrorReason::InvalidToken,
            format!("Token creation error: {}", e)
        ))?;

        let refresh_token = encode(
            &Header::default(),
            &refresh_token_claims,
            &EncodingKey::from_secret(self.config.secret_key.as_ref()),
        )
        .map_err(|e| AppError::auth(
            AuthErrorReason::InvalidToken,
            format!("Token creation error: {}", e)
        ))?;

        Ok((access_token, refresh_token))
    }

    /// Authenticates user and creates session tokens
    pub async fn login(
        &self,
        db: web::Data<Database>,
        item: web::Json<LoginInput>,
    ) -> AppResult<(String, String)> {  
        use crate::schema::users::dsl as users_dsl;
        use crate::schema::user_sessions::dsl as sessions_dsl;

        let login_data = item.into_inner();

        let user = execute_db_query(db.clone(), move |conn| {
            users_dsl::users
                .filter(users_dsl::email.eq(&login_data.email))
                .filter(users_dsl::activated.eq(true))
                .first::<crate::services::users::User>(conn)
        })
        .await
        .map_err(|e| match e {
            AppError::NotFound { .. } => AppError::auth(
                AuthErrorReason::InvalidCredentials,
                "Invalid email or password"
            ),
            _ => e,
        })?;

        if !self.verify_password(&login_data.password, &user.hash_password)? {
            return Err(AppError::auth(
                AuthErrorReason::InvalidCredentials,
                "Invalid email or password"
            ));
        }

        let (access_token, refresh_token) = self.create_tokens(db.clone(), user.id, login_data.ttl).await?;

        let refresh_token_clone = refresh_token.clone();
        
        execute_db_query(db, move |conn| {
            diesel::insert_into(sessions_dsl::user_sessions)
                .values((
                    sessions_dsl::user_id.eq(user.id),
                    sessions_dsl::refresh_token.eq(&refresh_token_clone),
                    sessions_dsl::device.eq(&login_data.device),
                ))
                .execute(conn)
        }).await?;

        Ok((access_token, refresh_token))
    }

    /// Registers a new user account
    pub async fn register(
        &self,
        db: web::Data<Database>,
        item: web::Json<RegisterInput>,
        mailer: web::Data<Mailer>,
    ) -> Result<HttpResponse, AppError> {
        use crate::schema::users::dsl as users_dsl;

        let register_data = item.into_inner();
        let email_clone = register_data.email.clone();

        // Check if user already exists
        let existing_user = execute_db_query(db.clone(), move |conn| {
            users_dsl::users
                .filter(users_dsl::email.eq(&register_data.email))
                .first::<crate::services::users::User>(conn)
                .optional()
        }).await?;

        if let Some(user) = existing_user {
            if user.activated {
                return Err(AppError::validation("User already registered", Some("email")));
            }
            // Delete unactivated account
            execute_db_query(db.clone(), move |conn| {
                diesel::delete(users_dsl::users.filter(users_dsl::id.eq(user.id))).execute(conn)
            }).await?;
        }

        let hashed_password = self.hash_password(&register_data.password)?;
        let email_clone2 = email_clone.clone();

        let new_user = execute_db_query(db, move |conn| {
            diesel::insert_into(users_dsl::users)
                .values((
                    users_dsl::email.eq(&email_clone2),
                    users_dsl::hash_password.eq(&hashed_password),
                    users_dsl::firstname.eq(&register_data.firstname),
                    users_dsl::lastname.eq(&register_data.lastname),
                    users_dsl::activated.eq(false),
                ))
                .get_result::<crate::services::users::User>(conn)
        }).await?;

        // Create activation token
        let activation_claims = RefreshTokenClaims {
            exp: (Utc::now() + Duration::days(30)).timestamp() as usize,
            sub: new_user.id,
            token_type: "activation_token".to_string(),
        };

        let activation_token = encode(
            &Header::default(),
            &activation_claims,
            &EncodingKey::from_secret(self.config.secret_key.as_ref()),
        )
        .map_err(|e| AppError::auth(
            AuthErrorReason::InvalidToken,
            format!("Token creation error: {}", e)
        ))?;

        // Send activation email
        let activation_link = format!("{}/activate?token={}", self.config.app_url, activation_token);
        mailer.send_register(&email_clone, &activation_link);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Registration successful. Please check your email to activate your account."
        })))
    }

    /// Initiates password recovery process
    pub async fn forgot_password(
        &self,
        db: web::Data<Database>,
        item: web::Json<ForgotInput>,
        mailer: web::Data<Mailer>,
    ) -> Result<HttpResponse, AppError> {
        use crate::schema::users::dsl as users_dsl;

        let forgot_data = item.into_inner();
        let email_clone = forgot_data.email.clone();

        let user_result = execute_db_query(db, move |conn| {
            users_dsl::users
                .filter(users_dsl::email.eq(&forgot_data.email))
                .first::<crate::services::users::User>(conn)
                .optional()
        }).await?;

        if let Some(user) = user_result {
            let reset_claims = RefreshTokenClaims {
                exp: (Utc::now() + Duration::hours(24)).timestamp() as usize,
                sub: user.id,
                token_type: "reset_token".to_string(),
            };

            let reset_token = encode(
                &Header::default(),
                &reset_claims,
                &EncodingKey::from_secret(self.config.secret_key.as_ref()),
            )
            .map_err(|e| AppError::auth(
            AuthErrorReason::InvalidToken,
            format!("Token creation error: {}", e)
        ))?;

            let reset_link = format!("reset?token={}", reset_token);
            mailer.send_recover_existent_account(&user.email, &reset_link);
        } else {
            let register_link = "register";
            mailer.send_recover_nonexistent_account(&email_clone, register_link);
        }

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Please check your email."
        })))
    }

    /// Changes user password with current password verification
    pub async fn change_password(
        &self,
        db: web::Data<Database>,
        item: web::Json<ChangeInput>,
        auth: Auth,
        mailer: web::Data<Mailer>,
    ) -> Result<HttpResponse, AppError> {
        use crate::schema::users::dsl as users_dsl;

        if item.old_password.is_empty() || item.new_password.is_empty() {
            return Err(AppError::validation("Missing password", Some("password")));
        }

        if item.old_password == item.new_password {
            return Err(AppError::validation("The new password must be different", Some("new_password")));
        }

        let user = execute_db_query(db.clone(), move |conn| {
            users_dsl::users
                .filter(users_dsl::id.eq(auth.user_id))
                .filter(users_dsl::activated.eq(true))
                .first::<crate::services::users::User>(conn)
        }).await?;

        if !self.verify_password(&item.old_password, &user.hash_password)? {
            return Err(AppError::auth(AuthErrorReason::InvalidCredentials, "Invalid credentials"));
        }

        let new_hash = self.hash_password(&item.new_password)?;

        execute_db_query(db, move |conn| {
            diesel::update(users_dsl::users.filter(users_dsl::id.eq(auth.user_id)))
                .set(users_dsl::hash_password.eq(&new_hash))
                .execute(conn)
        }).await?;

        mailer.send_password_changed(&user.email);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Password changed."
        })))
    }

    /// Resets user password using reset token
    pub async fn reset_password(
        &self,
        db: web::Data<Database>,
        item: web::Json<ResetInput>,
        mailer: web::Data<Mailer>,
    ) -> Result<HttpResponse, AppError> {
        use crate::schema::users::dsl as users_dsl;

        if item.new_password.is_empty() {
            return Err(AppError::validation("Missing password", Some("password")));
        }

        let token_data = decode::<RefreshTokenClaims>(
            &item.reset_token,
            &DecodingKey::from_secret(self.config.secret_key.as_ref()),
            &Validation::default(),
        )
        .map_err(|_| AppError::auth(AuthErrorReason::InvalidToken, "Invalid reset token"))?;

        if token_data.claims.token_type != "reset_token" {
            return Err(AppError::auth(AuthErrorReason::InvalidToken, "Invalid token type"));
        }

        let user = execute_db_query(db.clone(), move |conn| {
            users_dsl::users
                .filter(users_dsl::id.eq(token_data.claims.sub))
                .filter(users_dsl::activated.eq(true))
                .first::<crate::services::users::User>(conn)
        }).await?;

        let new_hash = self.hash_password(&item.new_password)?;

        execute_db_query(db, move |conn| {
            diesel::update(users_dsl::users.filter(users_dsl::id.eq(user.id)))
                .set(users_dsl::hash_password.eq(&new_hash))
                .execute(conn)
        }).await?;

        mailer.send_password_reset(&user.email);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Password reset"
        })))
    }

    /// Activates user account using activation token
    pub async fn activate(
        &self,
        db: web::Data<Database>,
        query: Query<ActivationInput>,
        mailer: web::Data<Mailer>,
    ) -> Result<HttpResponse, AppError> {
        use crate::schema::users::dsl as users_dsl;

        // Extract the query data
        let activation_data = query.into_inner();

        let token_data = decode::<RefreshTokenClaims>(
            &activation_data.activation_token,  // Changed from item.activation_token
            &DecodingKey::from_secret(self.config.secret_key.as_ref()),
            &Validation::default(),
        )
        .map_err(|_| AppError::auth(AuthErrorReason::InvalidToken, "Invalid activation token"))?;

        if token_data.claims.token_type != "activation_token" {
            return Err(AppError::auth(AuthErrorReason::InvalidToken, "Invalid token type"));
        }

        let user = execute_db_query(db.clone(), move |conn| {
            users_dsl::users
                .filter(users_dsl::id.eq(token_data.claims.sub))
                .filter(users_dsl::activated.eq(false))
                .first::<crate::services::users::User>(conn)
        }).await?;

        execute_db_query(db, move |conn| {
            diesel::update(users_dsl::users.filter(users_dsl::id.eq(user.id)))
                .set(users_dsl::activated.eq(true))
                .execute(conn)
        }).await?;

        mailer.send_activated(&user.email);

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Account activated successfully!"
        })))
    }

    pub async fn logout(
        &self,
        db: web::Data<Database>,
        refresh_token: Option<&str>,
    ) -> Result<HttpResponse, AppError> {
        use crate::schema::user_sessions::dsl as sessions_dsl;

        let Some(refresh_token) = refresh_token else {
            return Err(AppError::auth(AuthErrorReason::InvalidToken, "Invalid session"));
        };

        // Clone the refresh_token to move it into the closure
        let refresh_token_owned = refresh_token.to_string();

        let session = execute_db_query(db.clone(), move |conn| {
            sessions_dsl::user_sessions
                .filter(sessions_dsl::refresh_token.eq(&refresh_token_owned))
                .first::<UserSession>(conn)
        }).await?;

        execute_db_query(db, move |conn| {
            diesel::delete(sessions_dsl::user_sessions.filter(sessions_dsl::id.eq(session.id)))
                .execute(conn)
        }).await?;

        Ok(HttpResponse::Ok().json(serde_json::json!({
            "message": "Logged out successfully"
        })))
    }

    /// Refreshes access token using refresh token
    pub async fn refresh(
        &self,
        db: web::Data<Database>,
        refresh_token_str: Option<&str>,
    ) -> Result<(String, String), AppError> {
        use crate::schema::user_sessions::dsl as sessions_dsl;

        let Some(refresh_token_str) = refresh_token_str else {
            return Err(AppError::auth(AuthErrorReason::InvalidToken, "Invalid session"));
        };

        let _refresh_token = decode::<RefreshTokenClaims>(
            refresh_token_str,
            &DecodingKey::from_secret(self.config.secret_key.as_ref()),
            &Validation::default(),
        )
        .map_err(|_| AppError::auth(AuthErrorReason::InvalidToken, "Invalid token"))?;

        // Clone the refresh_token_str to move it into the closure
        let refresh_token_owned = refresh_token_str.to_string();

        let session = execute_db_query(db.clone(), move |conn| {
            sessions_dsl::user_sessions
                .filter(sessions_dsl::refresh_token.eq(&refresh_token_owned))
                .first::<UserSession>(conn)
        }).await?;

        let (access_token, new_refresh_token) = self.create_tokens(db.clone(), session.user_id, None).await?;

        // Clone the new_refresh_token before moving it into the closure
        let new_refresh_token_clone = new_refresh_token.clone();

        // Update the session with new refresh token
        execute_db_query(db, move |conn| {
            diesel::update(sessions_dsl::user_sessions.filter(sessions_dsl::id.eq(session.id)))
                .set(sessions_dsl::refresh_token.eq(&new_refresh_token_clone))
                .execute(conn)
        }).await?;

        Ok((access_token, new_refresh_token))
    }
}

/// Authentication route handlers
pub mod handlers {
    use super::*;
    use actix_web::cookie::{Cookie, SameSite};

    /// User login endpoint
    #[utoipa::path(
        post,
        path = "/api/auth/login",
        tag = "Authentication",
        request_body = LoginInput,
        responses(
            (status = 200, description = "Successfully authenticated user", body = inline(Object)),
            (status = 400, description = "Account not activated or invalid credentials"),
            (status = 500, description = "Internal server error")
        )
    )]
    pub async fn login(
        db: web::Data<Database>,
        item: web::Json<LoginInput>,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let handler = AuthHandler::new(config.get_ref().clone());
        let (access_token, refresh_token) = handler.login(db, item).await?;

        Ok(HttpResponse::Ok()
            .cookie(
                Cookie::build(COOKIE_NAME, refresh_token)
                    .secure(true)
                    .http_only(true)
                    .same_site(SameSite::Strict)
                    .path("/")
                    .finish(),
            )
            .json(serde_json::json!({
                "access_token": access_token
            })))
    }

    /// User registration endpoint
    #[utoipa::path(
        post,
        path = "/api/auth/register",
        tag = "Authentication",
        request_body = RegisterInput,
        responses(
            (status = 200, description = "Successfully registered user"),
            (status = 400, description = "User already exists or validation error"),
            (status = 500, description = "Internal server error")
        )
    )]
    pub async fn register(
        db: web::Data<Database>,
        item: web::Json<RegisterInput>,
        mailer: web::Data<Mailer>,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let handler = AuthHandler::new(config.get_ref().clone());
        handler.register(db, item, mailer).await
    }
    
    /// Account activation endpoint
    #[utoipa::path(
        get,
        path = "/api/auth/activate",
        tag = "Authentication",
        params(ActivationInput),
        responses(
            (status = 200, description = "Successfully activated account"),
            (status = 400, description = "Invalid activation token"),
            (status = 500, description = "Internal server error")
        )
    )]
    pub async fn activate(
        db: web::Data<Database>,
        query: web::Query<ActivationInput>,
        mailer: web::Data<Mailer>,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let handler = AuthHandler::new(config.get_ref().clone());
        handler.activate(db, query, mailer).await
    }

    /// Authentication check endpoint
    #[utoipa::path(
        post,
        path = "/api/auth/check",
        tag = "Authentication",
        responses(
            (status = 200, description = "User is authenticated"),
            (status = 401, description = "User not authenticated")
        ),
        security(("bearer_auth" = []))
    )]
    pub async fn check(auth: Auth) -> HttpResponse {
        HttpResponse::Ok().json(serde_json::json!({
            "authenticated": true,
            "user_id": auth.user_id
        }))
    }

    #[utoipa::path(
        post,
        path = "/api/auth/logout",
        tag = "Authentication",
        responses(
            (status = 200, description = "Successfully logged out user"),
            (status = 401, description = "Invalid or missing refresh token")
        )
    )]
    pub async fn logout(
        db: web::Data<Database>,
        req: HttpRequest,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let refresh_token = req
            .cookie(COOKIE_NAME)
            .map(|cookie| cookie.value().to_string());

        let handler = AuthHandler::new(config.get_ref().clone());
        let mut response = handler.logout(db, refresh_token.as_deref()).await?;

        // Clear the refresh token cookie
        let mut cookie = Cookie::named(COOKIE_NAME);
        cookie.make_removal();

        response.add_cookie(&cookie).map_err(|e| {
            AppError::Internal {
                message: format!("Cookie error: {}", e),
                source: None,
            }
        })?;

        Ok(response)
    }

    /// Token refresh endpoint
    #[utoipa::path(
        post,
        path = "/api/auth/refresh",
        tag = "Authentication",
        responses(
            (status = 200, description = "Successfully refreshed tokens"),
            (status = 401, description = "Invalid or expired refresh token")
        )
    )]
    pub async fn refresh(
        db: web::Data<Database>,
        req: HttpRequest,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let refresh_token = req
            .cookie(COOKIE_NAME)
            .map(|cookie| cookie.value().to_string());

        let handler = AuthHandler::new(config.get_ref().clone());
        let (access_token, new_refresh_token) = handler.refresh(db, refresh_token.as_deref()).await?;

        Ok(HttpResponse::Ok()
            .cookie(
                Cookie::build(COOKIE_NAME, new_refresh_token)
                    .secure(true)
                    .http_only(true)
                    .same_site(SameSite::Strict)
                    .path("/")
                    .finish(),
            )
            .json(serde_json::json!({
                "access_token": access_token
            })))
    }

    #[utoipa::path(
        post,
        path = "/api/auth/forgot",
        tag = "Authentication",
        request_body = ForgotInput,
        responses(
            (status = 200, description = "Password recovery email sent"),
            (status = 500, description = "Failed to send recovery email")
        )
    )]
    pub async fn forgot_password(
        db: web::Data<Database>,
        item: web::Json<ForgotInput>,
        mailer: web::Data<Mailer>,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let handler = AuthHandler::new(config.get_ref().clone());
        handler.forgot_password(db, item, mailer).await
    }

    /// Password change endpoint
    #[utoipa::path(
        post,
        path = "/api/auth/change",
        tag = "Authentication",
        request_body = ChangeInput,
        responses(
            (status = 200, description = "Password successfully changed"),
            (status = 400, description = "Invalid password or validation error"),
            (status = 401, description = "User not authenticated")
        ),
        security(("bearer_auth" = []))
    )]
    pub async fn change_password(
        db: web::Data<Database>,
        item: web::Json<ChangeInput>,
        auth: Auth,
        mailer: web::Data<Mailer>,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let handler = AuthHandler::new(config.get_ref().clone());
        handler.change_password(db, item, auth, mailer).await
    }

    /// Password reset endpoint
    #[utoipa::path(
        post,
        path = "/api/auth/reset",
        tag = "Authentication",
        request_body = ResetInput,
        responses(
            (status = 200, description = "Password successfully reset"),
            (status = 400, description = "Invalid reset token or validation error")
        )
    )]
    pub async fn reset_password(
        db: web::Data<Database>,
        item: web::Json<ResetInput>,
        mailer: web::Data<Mailer>,
        config: web::Data<Arc<Config>>,
        ) -> Result<HttpResponse, AppError> {
        let handler = AuthHandler::new(config.get_ref().clone());
        handler.reset_password(db, item, mailer).await
    }

}
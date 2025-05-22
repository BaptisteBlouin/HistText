//! Authentication and authorization utilities for user management.
//!
//! Features:
//! - JWT-based authentication with access and refresh tokens
//! - User registration, activation, and password management
//! - Role-based access control with permissions
//! - Session management with device tracking
//! - Password hashing with Argon2
//! - Email-based account activation and password recovery

use crate::auth::models::role::Role;
use crate::auth::models::{
    permission::Permission, user::User, user::UserChangeset, user_session::UserSession,
    user_session::UserSessionChangeset,
};
use crate::auth::{PaginationParams, ID};
use crate::config::Config;
use crate::services::database::Database;
use crate::services::mailer::Mailer;
use actix_web::{
    dev::Payload,
    error::{Error as ActixError, ErrorUnauthorized},
    http::header,
    FromRequest, HttpRequest,
};
use futures::future::{ready, Ready};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use utoipa::{IntoParams, ToSchema};

pub const COOKIE_NAME: &str = "refresh_token";

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

#[cfg(not(debug_assertions))]
type Seconds = i64;
type StatusCodeU16 = u16;
type Message = &'static str;

/// Request parameters for user login
#[derive(Deserialize, Serialize, ToSchema)]
pub struct LoginInput {
    /// User email address
    #[schema(example = "user@example.com")]
    pub email: String,
    /// User password
    pub password: String,
    /// Optional device identifier
    #[schema(example = "iPhone 12")]
    pub device: Option<String>,
    /// Token time-to-live in seconds
    #[cfg(not(debug_assertions))]
    pub ttl: Option<Seconds>,
    #[cfg(debug_assertions)]
    pub ttl: Option<i64>,
}

/// JWT claims for refresh tokens
#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

/// Request parameters for user registration
#[derive(Serialize, Deserialize, ToSchema)]
pub struct RegisterInput {
    /// User email address
    #[schema(example = "user@example.com")]
    pub email: String,
    /// User first name
    #[schema(example = "John")]
    pub firstname: String,
    /// User last name
    #[schema(example = "Doe")]
    pub lastname: String,
    /// User password
    pub password: String,
}

/// JWT claims for registration tokens
#[derive(Debug, Serialize, Deserialize)]
pub struct RegistrationClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

/// Request parameters for account activation
#[derive(Serialize, Deserialize, IntoParams)]
pub struct ActivationInput {
    /// Activation token from email
    pub activation_token: String,
}

/// Request parameters for password reset request
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ForgotInput {
    /// User email address
    #[schema(example = "user@example.com")]
    pub email: String,
}

/// JWT claims for password reset tokens
#[derive(Debug, Serialize, Deserialize)]
pub struct ResetTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

/// Request parameters for password change
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ChangeInput {
    /// Current password
    pub old_password: String,
    /// New password
    pub new_password: String,
}

/// Request parameters for password reset
#[derive(Serialize, Deserialize, ToSchema)]
pub struct ResetInput {
    /// Reset token from email
    pub reset_token: String,
    /// New password
    pub new_password: String,
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

/// User session data for API responses
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct UserSessionJson {
    /// Session ID
    pub id: ID,
    /// Device identifier
    pub device: Option<String>,
    /// Session creation timestamp
    pub created_at: chrono::NaiveDateTime,
    /// Session last update timestamp
    #[cfg(not(feature = "database_sqlite"))]
    pub updated_at: chrono::NaiveDateTime,
}

/// Response containing user sessions with pagination
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct UserSessionResponse {
    /// List of user sessions
    pub sessions: Vec<UserSessionJson>,
    /// Total number of pages
    pub num_pages: i64,
}

type AccessToken = String;
type RefreshToken = String;

/// Retrieves paginated user sessions
///
/// # Arguments
/// * `db` - Database connection
/// * `auth` - Authenticated user information
/// * `info` - Pagination parameters
///
/// # Returns
/// Result containing session response or error details
pub fn get_sessions(
    db: &Database,
    auth: &Auth,
    info: &PaginationParams,
) -> Result<UserSessionResponse, (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let pagination = PaginationParams {
        page: info.page,
        page_size: info.page_size,
    };

    let Ok(sessions) = UserSession::read_all(&mut db, &pagination, auth.user_id) else {
        return Err((500, "Could not fetch sessions."));
    };

    let sessions_json: Vec<UserSessionJson> = sessions
        .iter()
        .map(|s| UserSessionJson {
            id: s.id,
            device: s.device.clone(),
            created_at: s.created_at.naive_utc(),
            #[cfg(not(feature = "database_sqlite"))]
            updated_at: s.updated_at.naive_utc(),
        })
        .collect();

    let Ok(num_sessions) = UserSession::count_all(&mut db, auth.user_id) else {
        return Err((500, "Could not fetch sessions."));
    };

    let num_pages = (num_sessions / info.page_size) + i64::from(num_sessions % info.page_size != 0);

    let resp = UserSessionResponse {
        sessions: sessions_json,
        num_pages,
    };

    Ok(resp)
}

/// Destroys a specific user session
///
/// # Arguments
/// * `db` - Database connection
/// * `auth` - Authenticated user information
/// * `item_id` - Session ID to destroy
///
/// # Returns
/// Result indicating success or error details
pub fn destroy_session(
    db: &Database,
    auth: &Auth,
    item_id: ID,
) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let user_session = match UserSession::read(&mut db, item_id) {
        Ok(user_session) if user_session.user_id == auth.user_id => user_session,
        Ok(_) => return Err((404, "Session not found.")),
        Err(_) => return Err((500, "Internal error.")),
    };

    UserSession::delete(&mut db, user_session.id)
        .map_err(|_| (500, "Could not delete session."))?;

    Ok(())
}

/// Destroys all user sessions
///
/// # Arguments
/// * `db` - Database connection
/// * `auth` - Authenticated user information
///
/// # Returns
/// Result indicating success or error details
pub fn destroy_sessions(db: &Database, auth: &Auth) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    UserSession::delete_all_for_user(&mut db, auth.user_id)
        .map_err(|_| (500, "Could not delete sessions."))?;

    Ok(())
}

/// Authenticates user and creates session tokens
///
/// # Arguments
/// * `db` - Database connection
/// * `item` - Login credentials
///
/// # Returns
/// Result containing access and refresh tokens or error details
pub fn login(
    db: &Database,
    item: &LoginInput,
) -> Result<(AccessToken, RefreshToken), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let device = match item.device {
        Some(ref device) if device.len() > 256 => {
            return Err((400, "'device' cannot be longer than 256 characters."));
        }
        Some(ref device) => Some(device.clone()),
        None => None,
    };

    let user = match User::find_by_email(&mut db, item.email.clone()) {
        Ok(user) if user.activated => user,
        Ok(_) => return Err((400, "Account has not been activated.")),
        Err(_) => return Err((401, "Invalid credentials.")),
    };

    let is_valid = argon2::verify_encoded_ext(
        &user.hash_password,
        item.password.as_bytes(),
        ARGON_CONFIG.secret,
        ARGON_CONFIG.ad,
    )
    .unwrap();

    if !is_valid {
        return Err((401, "Invalid credentials."));
    }

    create_user_session(&mut db, device, None, user.id)
}

/// Creates a new user session with tokens
///
/// # Arguments
/// * `db` - Database connection
/// * `device_type` - Optional device identifier
/// * `ttl` - Token time-to-live in seconds
/// * `user_id` - User ID
///
/// # Returns
/// Result containing access and refresh tokens or error details
pub fn create_user_session(
    db: &mut crate::services::database::Connection,
    device_type: Option<String>,
    ttl: Option<i64>,
    user_id: i32,
) -> Result<(AccessToken, RefreshToken), (StatusCodeU16, Message)> {
    let device = match device_type {
        Some(device) if device.len() > 256 => {
            return Err((400, "'device' cannot be longer than 256 characters."));
        }
        Some(device) => Some(device),
        None => None,
    };

    let Ok(permissions) = Permission::fetch_all(db, user_id) else {
        return Err((500, "An internal server error occurred."));
    };

    let Ok(roles) = Role::fetch_all(db, user_id) else {
        return Err((500, "An internal server error occurred."));
    };

    let access_token_duration = chrono::Duration::seconds(
        ttl.map_or_else(|| 15 * 60, |tt| std::cmp::max(tt, 1)),
    );

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let access_token_claims = AccessTokenClaims {
        exp: (chrono::Utc::now() + access_token_duration).timestamp() as usize,
        sub: user_id,
        token_type: "access_token".to_string(),
        roles,
        permissions,
    };

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let refresh_token_claims = RefreshTokenClaims {
        exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
        sub: user_id,
        token_type: "refresh_token".to_string(),
    };

    let access_token = encode(
        &Header::default(),
        &access_token_claims,
        &EncodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
    )
    .unwrap();

    let refresh_token = encode(
        &Header::default(),
        &refresh_token_claims,
        &EncodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
    )
    .unwrap();

    UserSession::create(
        db,
        &UserSessionChangeset {
            user_id,
            refresh_token: refresh_token.clone(),
            device,
        },
    )
    .map_err(|_| (500, "Could not create session."))?;

    Ok((access_token, refresh_token))
}

/// Logs out user by destroying session
///
/// # Arguments
/// * `db` - Database connection
/// * `refresh_token` - Refresh token to invalidate
///
/// # Returns
/// Result indicating success or error details
pub fn logout(
    db: &Database,
    refresh_token: Option<&'_ str>,
) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let Some(refresh_token) = refresh_token else {
        return Err((401, "Invalid session."));
    };

    let Ok(session) = UserSession::find_by_refresh_token(&mut db, refresh_token) else {
        return Err((401, "Invalid session."));
    };

    UserSession::delete(&mut db, session.id).map_err(|_| (500, "Could not delete session."))?;

    Ok(())
}

/// Refreshes access token using refresh token
///
/// # Arguments
/// * `db` - Database connection
/// * `refresh_token_str` - Current refresh token
///
/// # Returns
/// Result containing new access and refresh tokens or error details
pub fn refresh(
    db: &Database,
    refresh_token_str: Option<&'_ str>,
) -> Result<(AccessToken, RefreshToken), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let Some(refresh_token_str) = refresh_token_str else {
        return Err((401, "Invalid session."));
    };

    let _refresh_token = match decode::<RefreshTokenClaims>(
        refresh_token_str,
        &DecodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
        &Validation::default(),
    ) {
        Ok(token)
            if token
                .claims
                .token_type
                .eq_ignore_ascii_case("refresh_token") =>
        {
            token
        }
        _ => return Err((401, "Invalid token.")),
    };

    let Ok(session) = UserSession::find_by_refresh_token(&mut db, refresh_token_str) else {
        return Err((401, "Invalid session."));
    };

    let Ok(permissions) = Permission::fetch_all(&mut db, session.user_id) else {
        return Err((500, "An internal server error occurred."));
    };

    let Ok(roles) = Role::fetch_all(&mut db, session.user_id) else {
        return Err((500, "An internal server error occurred."));
    };

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let access_token_claims = AccessTokenClaims {
        exp: (chrono::Utc::now() + chrono::Duration::minutes(15)).timestamp() as usize,
        sub: session.user_id,
        token_type: "access_token".to_string(),
        roles,
        permissions,
    };

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let refresh_token_claims = RefreshTokenClaims {
        exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
        sub: session.user_id,
        token_type: "refresh_token".to_string(),
    };

    let access_token = encode(
        &Header::default(),
        &access_token_claims,
        &EncodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
    )
    .unwrap();

    let refresh_token_str = encode(
        &Header::default(),
        &refresh_token_claims,
        &EncodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
    )
    .unwrap();

    UserSession::update(
        &mut db,
        session.id,
        &UserSessionChangeset {
            user_id: session.user_id,
            refresh_token: refresh_token_str.clone(),
            device: session.device,
        },
    )
    .map_err(|_| (500, "Could not update session."))?;

    Ok((access_token, refresh_token_str))
}

/// Registers a new user account
///
/// # Arguments
/// * `db` - Database connection
/// * `item` - Registration details
/// * `mailer` - Email service for activation
///
/// # Returns
/// Result indicating success or error details
pub fn register(
    db: &Database,
    item: &RegisterInput,
    mailer: &Mailer,
) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    match User::find_by_email(&mut db, item.email.to_string()) {
        Ok(user) if user.activated => return Err((400, "Already registered.")),
        Ok(user) => {
            User::delete(&mut db, user.id).unwrap();
        }
        Err(_) => (),
    }

    let salt = generate_salt();
    let hash = argon2::hash_encoded(item.password.as_bytes(), &salt, &ARGON_CONFIG).unwrap();

    let user = User::create(
        &mut db,
        &UserChangeset {
            activated: false,
            email: item.email.clone(),
            hash_password: hash,
            firstname: item.firstname.clone(),
            lastname: item.lastname.clone(),
        },
    )
    .unwrap();

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let registration_claims = RegistrationClaims {
        exp: (chrono::Utc::now() + chrono::Duration::days(30)).timestamp() as usize,
        sub: user.id,
        token_type: "activation_token".to_string(),
    };

    let token = encode(
        &Header::default(),
        &registration_claims,
        &EncodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
    )
    .unwrap();

    mailer.send_register(&user.email, &format!("activate?token={token}"));

    Ok(())
}

/// Activates user account using activation token
///
/// # Arguments
/// * `db` - Database connection
/// * `item` - Activation token
/// * `mailer` - Email service for confirmation
///
/// # Returns
/// Result indicating success or error details
pub fn activate(
    db: &Database,
    item: &ActivationInput,
    mailer: &Mailer,
) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let token = match decode::<RegistrationClaims>(
        &item.activation_token,
        &DecodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
        &Validation::default(),
    ) {
        Ok(token)
            if token
                .claims
                .token_type
                .eq_ignore_ascii_case("activation_token") =>
        {
            token
        }
        _ => return Err((401, "Invalid token.")),
    };

    let user = match User::read(&mut db, token.claims.sub) {
        Ok(user) if !user.activated => user,
        Ok(_) => return Err((200, "Already activated!")),
        Err(_) => return Err((400, "Invalid token.")),
    };

    User::update(
        &mut db,
        user.id,
        &UserChangeset {
            activated: true,
            email: user.email.clone(),
            firstname: user.firstname.clone(),
            lastname: user.lastname.clone(),
            hash_password: user.hash_password,
        },
    )
    .map_err(|_| (500, "Could not activate user."))?;

    mailer.send_activated(&user.email);

    Ok(())
}

/// Initiates password recovery process
///
/// # Arguments
/// * `db` - Database connection
/// * `item` - User email for recovery
/// * `mailer` - Email service for recovery instructions
///
/// # Returns
/// Result indicating success or error details
pub fn forgot_password(
    db: &Database,
    item: &ForgotInput,
    mailer: &Mailer,
) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    let user_result = User::find_by_email(&mut db, item.email.clone());

    if let Ok(user) = user_result {
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let reset_token_claims = ResetTokenClaims {
            exp: (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize,
            sub: user.id,
            token_type: "reset_token".to_string(),
        };

        let reset_token = encode(
            &Header::default(),
            &reset_token_claims,
            &EncodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
        )
        .unwrap();

        let link = &format!("reset?token={reset_token}");
        mailer.send_recover_existent_account(&user.email, link);
    } else {
        let link = &"register".to_string();
        mailer.send_recover_nonexistent_account(&item.email, link);
    }

    Ok(())
}

/// Changes user password with current password verification
///
/// # Arguments
/// * `db` - Database connection
/// * `item` - Password change request
/// * `auth` - Authenticated user information
/// * `mailer` - Email service for confirmation
///
/// # Returns
/// Result indicating success or error details
pub fn change_password(
    db: &Database,
    item: &ChangeInput,
    auth: &Auth,
    mailer: &Mailer,
) -> Result<(), (StatusCodeU16, Message)> {
    if item.old_password.is_empty() || item.new_password.is_empty() {
        return Err((400, "Missing password"));
    }

    if item.old_password.eq(&item.new_password) {
        return Err((400, "The new password must be different"));
    }

    let mut db = db.get_connection().unwrap();

    let user = match User::read(&mut db, auth.user_id) {
        Ok(user) if user.activated => user,
        Ok(_) => return Err((400, "Account has not been activated")),
        Err(_) => return Err((500, "Could not find user")),
    };

    let is_old_password_valid = argon2::verify_encoded_ext(
        &user.hash_password,
        item.old_password.as_bytes(),
        ARGON_CONFIG.secret,
        ARGON_CONFIG.ad,
    )
    .unwrap();

    if !is_old_password_valid {
        return Err((401, "Invalid credentials"));
    }

    let salt = generate_salt();
    let new_hash =
        argon2::hash_encoded(item.new_password.as_bytes(), &salt, &ARGON_CONFIG).unwrap();

    User::update(
        &mut db,
        auth.user_id,
        &UserChangeset {
            email: user.email.clone(),
            firstname: user.firstname.clone(),
            lastname: user.lastname.clone(),
            hash_password: new_hash,
            activated: user.activated,
        },
    )
    .map_err(|_| (500, "Could not update password"))?;

    mailer.send_password_changed(&user.email);

    Ok(())
}

/// Validates authentication (no-op function for route guards)
///
/// # Arguments
/// * `_` - Auth instance (unused)
pub const fn check(_: &Auth) {}

/// Resets user password using reset token
///
/// # Arguments
/// * `db` - Database connection
/// * `item` - Password reset request
/// * `mailer` - Email service for confirmation
///
/// # Returns
/// Result indicating success or error details
pub fn reset_password(
    db: &Database,
    item: &ResetInput,
    mailer: &Mailer,
) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    if item.new_password.is_empty() {
        return Err((400, "Missing password"));
    }

    let token = match decode::<ResetTokenClaims>(
        &item.reset_token,
        &DecodingKey::from_secret(std::env::var("SECRET_KEY").unwrap().as_ref()),
        &Validation::default(),
    ) {
        Ok(token) if token.claims.token_type.eq_ignore_ascii_case("reset_token") => token,
        _ => return Err((401, "Invalid token.")),
    };

    let user = match User::read(&mut db, token.claims.sub) {
        Ok(user) if user.activated => user,
        Ok(_) => return Err((400, "Account has not been activated")),
        Err(_) => return Err((400, "Invalid token.")),
    };

    let salt = generate_salt();
    let new_hash =
        argon2::hash_encoded(item.new_password.as_bytes(), &salt, &ARGON_CONFIG).unwrap();

    User::update(
        &mut db,
        user.id,
        &UserChangeset {
            email: user.email.clone(),
            firstname: user.firstname.clone(),
            lastname: user.lastname.clone(),
            hash_password: new_hash,
            activated: user.activated,
        },
    )
    .map_err(|_| (500, "Could not update password"))?;

    mailer.send_password_reset(&user.email);

    Ok(())
}

/// Generates a cryptographically secure salt for password hashing
///
/// # Returns
/// 16-byte array containing random salt
#[must_use]
#[allow(clippy::missing_panics_doc)]
pub fn generate_salt() -> [u8; 16] {
    use rand::Fill;
    let mut salt = [0; 16];
    salt.fill(&mut rand::rng());
    salt
}

/// Authentication context containing user identity and permissions
#[derive(Debug, Clone)]
pub struct Auth {
    /// User ID
    pub user_id: ID,
    /// User roles
    pub roles: HashSet<String>,
    /// User permissions
    pub permissions: HashSet<Permission>,
}

impl Auth {
    /// Checks if user has specific permission
    ///
    /// # Arguments
    /// * `permission` - Permission string to check
    ///
    /// # Returns
    /// `true` if user has the permission
    #[must_use]
    pub fn has_permission(&self, permission: String) -> bool {
        self.permissions.contains(&Permission {
            permission,
            from_role: String::new(),
        })
    }

    /// Checks if user has all specified permissions
    ///
    /// # Arguments
    /// * `perms` - List of permissions to check
    ///
    /// # Returns
    /// `true` if user has all permissions
    #[must_use]
    #[allow(dead_code)]
    pub fn has_all_permissions(&self, perms: impl AsRef<[String]>) -> bool {
        perms
            .as_ref()
            .iter()
            .all(|p| self.has_permission(p.to_string()))
    }

    /// Checks if user has any of the specified permissions
    ///
    /// # Arguments
    /// * `perms` - List of permissions to check
    ///
    /// # Returns
    /// `true` if user has at least one permission
    #[must_use]
    #[allow(dead_code)]
    pub fn has_any_permission(&self, perms: impl AsRef<[String]>) -> bool {
        perms
            .as_ref()
            .iter()
            .any(|p| self.has_permission(p.to_string()))
    }

    /// Checks if user has specific role
    ///
    /// # Arguments
    /// * `role` - Role name to check
    ///
    /// # Returns
    /// `true` if user has the role
    #[must_use]
    pub fn has_role(&self, role: impl AsRef<str>) -> bool {
        self.roles.contains(role.as_ref())
    }

    /// Checks if user has all specified roles
    ///
    /// # Arguments
    /// * `roles` - List of roles to check
    ///
    /// # Returns
    /// `true` if user has all roles
    #[must_use]
    #[allow(dead_code)]
    pub fn has_all_roles(&self, roles: impl AsRef<[String]>) -> bool {
        roles.as_ref().iter().all(|r| self.has_role(r))
    }

    /// Checks if user has any of the specified roles
    ///
    /// # Arguments
    /// * `roles` - List of roles to check
    ///
    /// # Returns
    /// `true` if user has at least one role
    #[allow(dead_code)]
    pub fn has_any_roles(&self, roles: impl AsRef<[String]>) -> bool {
        roles.as_ref().iter().any(|r| self.has_role(r))
    }
}

/// Implement FromRequest for Auth to enable automatic extraction in route handlers
impl FromRequest for Auth {
    type Error = ActixError;
    type Future = Ready<Result<Self, Self::Error>>;

    /// Extracts authentication information from HTTP request
    ///
    /// # Arguments
    /// * `req` - HTTP request
    /// * `_` - Request payload (unused)
    ///
    /// # Returns
    /// Future resolving to Auth instance or authentication error
    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        let config = match req.app_data::<Arc<Config>>() {
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
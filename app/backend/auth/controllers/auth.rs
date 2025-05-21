// Complete controllers/auth.rs file with FromRequest implementation

use crate::auth::models::role::Role;
use crate::auth::models::{
    permission::Permission, user::User, user::UserChangeset, user_session::UserSession,
    user_session::UserSessionChangeset,
};
use crate::auth::ID;
use crate::services::database::Database;
use crate::services::mailer::Mailer;

use crate::config::Config;
use actix_web::{
    dev::Payload,
    error::{Error as ActixError, ErrorUnauthorized},
    http::header,
    // Remove unused import: web::Data
    FromRequest,
    HttpRequest,
};
use futures::future::{ready, Ready};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;

pub const COOKIE_NAME: &str = "refresh_token";
lazy_static::lazy_static! {
    pub static ref ARGON_CONFIG: argon2::Config<'static> = argon2::Config {
        variant: argon2::Variant::Argon2id,
        version: argon2::Version::Version13,
        secret: std::env::var("SECRET_KEY").map_or_else(|_| panic!("No SECRET_KEY environment variable set!"), |s| Box::leak(s.into_boxed_str()).as_bytes()),
        ..Default::default()
    };
}

#[cfg(not(debug_assertions))]
type Seconds = i64;
// Use different type alias to avoid conflict
type StatusCodeU16 = u16;
type Message = &'static str;

#[derive(Deserialize, Serialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct LoginInput {
    pub email: String,
    pub password: String,
    pub device: Option<String>,
    #[cfg(not(debug_assertions))]
    pub ttl: Option<Seconds>,
    #[cfg(debug_assertions)]
    pub ttl: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct RegisterInput {
    pub email: String,
    pub firstname: String,
    pub lastname: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistrationClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::IntoParams))]
pub struct ActivationInput {
    pub activation_token: String,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct ForgotInput {
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResetTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct ChangeInput {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Serialize, Deserialize)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct ResetInput {
    pub reset_token: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessTokenClaims {
    pub exp: usize,
    pub sub: ID,
    pub token_type: String,
    pub roles: Vec<String>,
    pub permissions: Vec<Permission>,
}

// Use auth::PaginationParams instead of defining a new one
use crate::auth::PaginationParams;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct UserSessionJson {
    pub id: ID,
    pub device: Option<String>,
    pub created_at: chrono::NaiveDateTime,
    #[cfg(not(feature = "database_sqlite"))]
    pub updated_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(feature = "utoipa", derive(utoipa::ToSchema))]
pub struct UserSessionResponse {
    pub sessions: Vec<UserSessionJson>,
    pub num_pages: i64,
}

pub fn get_sessions(
    db: &Database,
    auth: &Auth,
    info: &PaginationParams,
) -> Result<UserSessionResponse, (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    // Convert to auth::PaginationParams
    let pagination = crate::auth::PaginationParams {
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
            created_at: s.created_at.naive_utc(), // Convert to NaiveDateTime
            #[cfg(not(feature = "database_sqlite"))]
            updated_at: s.updated_at.naive_utc(), // Convert to NaiveDateTime
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

pub fn destroy_sessions(db: &Database, auth: &Auth) -> Result<(), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    UserSession::delete_all_for_user(&mut db, auth.user_id)
        .map_err(|_| (500, "Could not delete sessions."))?;

    Ok(())
}

type AccessToken = String;
type RefreshToken = String;

pub fn login(
    db: &Database,
    item: &LoginInput,
) -> Result<(AccessToken, RefreshToken), (StatusCodeU16, Message)> {
    let mut db = db.get_connection().unwrap();

    // verify device
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

pub fn create_user_session(
    db: &mut crate::services::database::Connection,
    device_type: Option<String>,
    ttl: Option<i64>,
    user_id: i32,
) -> Result<(AccessToken, RefreshToken), (StatusCodeU16, Message)> {
    // verify device
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
        ttl.map_or_else(|| /* 15 minutes */ 15 * 60, |tt| std::cmp::max(tt, 1)),
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

    // update session with the new refresh token
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

pub const fn check(_: &Auth) {}

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

#[must_use]
#[allow(clippy::missing_panics_doc)]
pub fn generate_salt() -> [u8; 16] {
    use rand::Fill;
    let mut salt = [0; 16];
    // this does not fail
    salt.fill(&mut rand::rng());
    salt
}

#[derive(Debug, Clone)]
pub struct Auth {
    pub user_id: ID,
    pub roles: HashSet<String>,
    pub permissions: HashSet<Permission>,
}

impl Auth {
    #[must_use]
    pub fn has_permission(&self, permission: String) -> bool {
        self.permissions.contains(&Permission {
            permission,
            from_role: String::new(),
        })
    }

    #[must_use]
    #[allow(dead_code)]
    pub fn has_all_permissions(&self, perms: impl AsRef<[String]>) -> bool {
        perms
            .as_ref()
            .iter()
            .all(|p| self.has_permission(p.to_string()))
    }

    #[must_use]
    #[allow(dead_code)]
    pub fn has_any_permission(&self, perms: impl AsRef<[String]>) -> bool {
        perms
            .as_ref()
            .iter()
            .any(|p| self.has_permission(p.to_string()))
    }

    #[must_use]
    pub fn has_role(&self, role: impl AsRef<str>) -> bool {
        self.roles.contains(role.as_ref())
    }

    #[must_use]
    #[allow(dead_code)]
    pub fn has_all_roles(&self, roles: impl AsRef<[String]>) -> bool {
        roles.as_ref().iter().all(|r| self.has_role(r))
    }

    #[allow(dead_code)]
    pub fn has_any_roles(&self, roles: impl AsRef<[String]>) -> bool {
        roles.as_ref().iter().any(|r| self.has_role(r))
    }
}

/// Implement FromRequest for Auth to make it usable as a parameter in route handlers
/// This allows controllers to automatically extract Auth from requests
impl FromRequest for Auth {
    type Error = ActixError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        // Get app configuration which contains JWT secret
        let config = match req.app_data::<Arc<Config>>() {
            Some(config) => config,
            None => {
                return ready(Err(ErrorUnauthorized("Server configuration not found")));
            }
        };

        // Check for authorization header
        if let Some(auth_header) = req.headers().get(header::AUTHORIZATION) {
            if let Ok(auth_str) = auth_header.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    // Try to decode the token
                    let token_result = decode::<AccessTokenClaims>(
                        token,
                        &DecodingKey::from_secret(config.secret_key.as_bytes()),
                        &Validation::default(),
                    );

                    // If successful, create and return an Auth instance
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

                    // Token validation failed
                    return ready(Err(ErrorUnauthorized("Invalid token")));
                }
            }
        }

        // No or invalid Authorization header
        ready(Err(ErrorUnauthorized("Authorization required")))
    }
}

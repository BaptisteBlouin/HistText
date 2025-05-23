//! Centralized password hashing and verification service.
//!
//! This module provides secure password handling using Argon2id with
//! configurable parameters and consistent salt generation across the application.

use crate::config::Config;
use crate::services::error::{AppError, AppResult};
use argon2;
use lazy_static::lazy_static;
use log::{debug, warn};
use std::sync::Arc;

lazy_static! {
    /// Global Argon2id configuration with application secret
    ///
    /// This configuration uses secure defaults and incorporates the
    /// application's secret key as additional entropy for password hashing.
    static ref ARGON_CONFIG: argon2::Config<'static> = {
        let secret_key = std::env::var("SECRET_KEY")
            .unwrap_or_else(|_| {
                warn!("SECRET_KEY not found in environment, using default");
                "default_secret_key_change_in_production".to_string()
            });
        
        argon2::Config {
            variant: argon2::Variant::Argon2id,
            version: argon2::Version::Version13,
            secret: Box::leak(secret_key.into_boxed_str()).as_bytes(),
            mem_cost: 65536,      // 64 MiB
            time_cost: 3,         // 3 iterations
            lanes: 4,             // 4 parallel lanes
            ..Default::default()
        }
    };
}

/// Password service for secure password operations
#[derive(Clone)]
pub struct PasswordService {
    /// Application configuration
    config: Arc<Config>,
}

impl PasswordService {
    /// Creates a new password service instance
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new PasswordService instance
    pub fn new(config: Arc<Config>) -> Self {
        debug!("Initializing password service with Argon2id");
        Self { config }
    }

    /// Creates a password service from global configuration
    ///
    /// # Returns
    /// A new PasswordService instance using global config
    pub fn from_global_config() -> Self {
        Self::new(Config::global().clone())
    }

    /// Generates a cryptographically secure random salt
    ///
    /// Creates a 16-byte salt using the system's secure random number
    /// generator for use in password hashing.
    ///
    /// # Returns
    /// A 16-byte array of random data
    pub fn generate_salt() -> [u8; 16] {
        use rand::Fill;
        let mut salt = [0; 16];
        salt.fill(&mut rand::rng());
        salt
    }

    /// Hashes a password using Argon2id with secure parameters
    ///
    /// # Arguments
    /// * `password` - Plain-text password to hash
    ///
    /// # Returns
    /// Encoded password hash string or an error
    ///
    /// # Example
    /// ```rust
    /// let service = PasswordService::from_global_config();
    /// let hash = service.hash_password("my_secure_password").unwrap();
    /// ```
    pub fn hash_password(&self, password: &str) -> AppResult<String> {
        if password.is_empty() {
            return Err(AppError::validation(
                "Password cannot be empty",
                Some("password")
            ));
        }

        if password.len() < 8 {
            return Err(AppError::validation(
                "Password must be at least 8 characters long",
                Some("password")
            ));
        }

        if password.len() > 128 {
            return Err(AppError::validation(
                "Password must be no more than 128 characters long",
                Some("password")
            ));
        }

        let salt = Self::generate_salt();
        
        debug!("Hashing password with Argon2id");
        argon2::hash_encoded(password.as_bytes(), &salt, &ARGON_CONFIG)
            .map_err(|e| {
                warn!("Password hashing failed: {}", e);
                AppError::validation(
                    "Password hashing failed",
                    Some("password")
                )
            })
    }

    /// Verifies a password against its hash
    ///
    /// # Arguments
    /// * `password` - Plain-text password to verify
    /// * `hash` - Stored password hash to verify against
    ///
    /// # Returns
    /// True if the password matches the hash, false otherwise, or an error
    ///
    /// # Example
    /// ```rust
    /// let service = PasswordService::from_global_config();
    /// let is_valid = service.verify_password("my_password", &stored_hash).unwrap();
    /// ```
    pub fn verify_password(&self, password: &str, hash: &str) -> AppResult<bool> {
        if password.is_empty() || hash.is_empty() {
            debug!("Password or hash is empty");
            return Ok(false);
        }

        debug!("Verifying password with Argon2id");
        argon2::verify_encoded_ext(
            hash,
            password.as_bytes(),
            ARGON_CONFIG.secret,
            ARGON_CONFIG.ad
        )
        .map_err(|e| {
            warn!("Password verification failed: {}", e);
            AppError::validation(
                "Password verification failed",
                Some("password")
            )
        })
    }

    /// Validates password strength requirements
    ///
    /// # Arguments
    /// * `password` - Password to validate
    ///
    /// # Returns
    /// Ok(()) if password meets requirements, error otherwise
    pub fn validate_password_strength(&self, password: &str) -> AppResult<()> {
        if password.len() < 8 {
            return Err(AppError::validation(
                "Password must be at least 8 characters long",
                Some("password")
            ));
        }

        if password.len() > 128 {
            return Err(AppError::validation(
                "Password must be no more than 128 characters long",
                Some("password")
            ));
        }

        // Check for at least one letter and one number
        let has_letter = password.chars().any(|c| c.is_alphabetic());
        let has_number = password.chars().any(|c| c.is_numeric());

        if !has_letter {
            return Err(AppError::validation(
                "Password must contain at least one letter",
                Some("password")
            ));
        }

        if !has_number {
            return Err(AppError::validation(
                "Password must contain at least one number",
                Some("password")
            ));
        }

        // Check for common weak passwords
        let weak_passwords = [
            "password", "password123", "123456789", "qwerty123",
            "admin123", "letmein", "welcome123", "password1"
        ];

        let password_lower = password.to_lowercase();
        if weak_passwords.iter().any(|&weak| password_lower.contains(weak)) {
            return Err(AppError::validation(
                "Password is too common, please choose a stronger password",
                Some("password")
            ));
        }

        Ok(())
    }

    /// Generates a secure random password
    ///
    /// # Arguments
    /// * `length` - Desired password length (minimum 12, maximum 64)
    ///
    /// # Returns
    /// A securely generated random password
    pub fn generate_secure_password(&self, length: usize) -> AppResult<String> {
        if length < 12 {
            return Err(AppError::validation(
                "Generated password length must be at least 12 characters",
                Some("length")
            ));
        }

        if length > 64 {
            return Err(AppError::validation(
                "Generated password length must be no more than 64 characters",
                Some("length")
            ));
        }

        use rand::Rng;
        const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ\
                                 abcdefghijklmnopqrstuvwxyz\
                                 0123456789\
                                 !@#$%^&*()_+-=[]{}|;:,.<>?";

        let mut rng = rand::rng();
        let password: String = (0..length)
            .map(|_| {
                let idx = rng.random_range(0..CHARSET.len());
                CHARSET[idx] as char
            })
            .collect();

        // Ensure the generated password meets our strength requirements
        self.validate_password_strength(&password)?;
        
        Ok(password)
    }

    /// Checks if a password hash needs to be updated
    ///
    /// This can be used to detect when password hashes were created with
    /// older parameters and need to be rehashed with current settings.
    ///
    /// # Arguments
    /// * `hash` - Password hash to check
    ///
    /// # Returns
    /// True if the hash should be updated
    pub fn needs_rehash(&self, hash: &str) -> bool {
        // Check if hash uses current Argon2id parameters
        // This is a simplified check - in production you might want more sophisticated logic
        hash.starts_with("$argon2i$") || // Old Argon2i variant
        hash.starts_with("$argon2d$") || // Old Argon2d variant
        !hash.contains("m=65536")        // Old memory cost
    }
}

/// Default password service instance for backwards compatibility
impl Default for PasswordService {
    fn default() -> Self {
        Self::from_global_config()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hashing_and_verification() {
        let service = PasswordService::from_global_config();
        let password = "test_password_123";
        
        let hash = service.hash_password(password).unwrap();
        assert!(service.verify_password(password, &hash).unwrap());
        assert!(!service.verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_password_strength_validation() {
        let service = PasswordService::from_global_config();
        
        // Valid password
        assert!(service.validate_password_strength("MySecure123").is_ok());
        
        // Too short
        assert!(service.validate_password_strength("short").is_err());
        
        // No number
        assert!(service.validate_password_strength("MySecurePassword").is_err());
        
        // No letter
        assert!(service.validate_password_strength("12345678").is_err());
        
        // Common weak password
        assert!(service.validate_password_strength("password123").is_err());
    }

    #[test]
    fn test_secure_password_generation() {
        let service = PasswordService::from_global_config();
        
        let password = service.generate_secure_password(16).unwrap();
        assert_eq!(password.len(), 16);
        assert!(service.validate_password_strength(&password).is_ok());
        
        // Too short
        assert!(service.generate_secure_password(8).is_err());
        
        // Too long
        assert!(service.generate_secure_password(100).is_err());
    }
}
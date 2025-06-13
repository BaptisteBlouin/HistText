//! Centralized password hashing and verification service.
//!
//! This module provides secure password handling using Argon2id with
//! configurable parameters and consistent salt generation across the application.
//! It includes robust password validation, generation of secure passwords,
//! and utilities for password management.

use crate::config::Config;
use crate::services::error::{AppError, AppResult};
use argon2;
use lazy_static::lazy_static;
use log::{debug, warn};
use regex::Regex;
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

    /// Regex pattern for detecting common password patterns
    static ref COMMON_PATTERNS: Regex = Regex::new(
        r"(?i)(password|admin|welcome|123456|qwerty|letmein|abc123)"
    ).expect("Failed to compile password pattern regex");
}

/// Password service for secure password operations
#[derive(Clone)]
pub struct PasswordService {
    /// Application configuration
    config: Arc<Config>,
    /// Minimum password length
    min_length: usize,
    /// Maximum password length
    max_length: usize,
}

impl PasswordService {
    /// Creates a new password service instance
    ///
    /// # Arguments
    /// * `config` - Application configuration
    ///
    /// # Returns
    /// A new PasswordService instance with default settings
    pub fn new(config: Arc<Config>) -> Self {
        debug!("Initializing password service with Argon2id");
        Self {
            config,
            min_length: 8,
            max_length: 128,
        }
    }

    /// Creates a new password service with custom validation parameters
    ///
    /// # Arguments
    /// * `config` - Application configuration
    /// * `min_length` - Minimum password length to require
    /// * `max_length` - Maximum password length to allow
    ///
    /// # Returns
    /// A new PasswordService instance with custom settings
    pub fn with_params(config: Arc<Config>, min_length: usize, max_length: usize) -> Self {
        debug!("Initializing password service with custom parameters");
        Self {
            config,
            min_length,
            max_length,
        }
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
        // Validate password before hashing
        self.validate_password_strength(password)?;

        let salt = Self::generate_salt();

        debug!("Hashing password with Argon2id");
        argon2::hash_encoded(password.as_bytes(), &salt, &ARGON_CONFIG).map_err(|e| {
            warn!("Password hashing failed: {}", e);
            AppError::validation("Password hashing failed", Some("password"))
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
            ARGON_CONFIG.ad,
        )
        .map_err(|e| {
            warn!("Password verification failed: {}", e);
            AppError::validation("Password verification failed", Some("password"))
        })
    }

    /// Validates password strength requirements
    ///
    /// Checks for:
    /// - Minimum and maximum length
    /// - Presence of letters and numbers
    /// - Absence of common password patterns
    /// - Complexity assessment
    ///
    /// # Arguments
    /// * `password` - Password to validate
    ///
    /// # Returns
    /// Ok(()) if password meets requirements, error otherwise
    pub fn validate_password_strength(&self, password: &str) -> AppResult<()> {
        // Check length
        if password.len() < self.min_length {
            return Err(AppError::validation(
                format!(
                    "Password must be at least {} characters long",
                    self.min_length
                ),
                Some("password"),
            ));
        }

        if password.len() > self.max_length {
            return Err(AppError::validation(
                format!(
                    "Password must be no more than {} characters long",
                    self.max_length
                ),
                Some("password"),
            ));
        }

        // Check for at least one letter and one number
        let has_letter = password.chars().any(|c| c.is_alphabetic());
        let has_number = password.chars().any(|c| c.is_numeric());
        let has_symbol = password.chars().any(|c| !c.is_alphanumeric());

        if !has_letter {
            return Err(AppError::validation(
                "Password must contain at least one letter",
                Some("password"),
            ));
        }

        if !has_number {
            return Err(AppError::validation(
                "Password must contain at least one number",
                Some("password"),
            ));
        }

        // Calculate password strength score
        let mut strength_score = 0;

        // Base score from length
        strength_score += password.len() as i32 / 2;

        // Bonus for character diversity
        if has_letter {
            strength_score += 1;
        }
        if has_number {
            strength_score += 1;
        }
        if has_symbol {
            strength_score += 2;
        }

        // Bonus for mixed case
        if password.chars().any(|c| c.is_uppercase()) && password.chars().any(|c| c.is_lowercase())
        {
            strength_score += 2;
        }

        // Check for common patterns (negative factor)
        if COMMON_PATTERNS.is_match(password) {
            strength_score -= 3;

            // If after this penalty the password is still weak, reject it
            if strength_score < 5 {
                return Err(AppError::validation(
                    "Password contains common patterns, please choose a stronger password",
                    Some("password"),
                ));
            }
        }

        // Reject very weak passwords (after all calculations)
        if strength_score < 4 {
            return Err(AppError::validation(
                "Password is too weak, please use a stronger combination of characters",
                Some("password"),
            ));
        }

        Ok(())
    }

    /// Generates a secure random password
    ///
    /// Creates a password with a good mix of character types:
    /// - Uppercase letters
    /// - Lowercase letters
    /// - Numbers
    /// - Special characters
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
                Some("length"),
            ));
        }

        if length > 64 {
            return Err(AppError::validation(
                "Generated password length must be no more than 64 characters",
                Some("length"),
            ));
        }

        use rand::Rng;

        // Define character sets for a strong password
        const LOWERCASE: &[u8] = b"abcdefghijklmnopqrstuvwxyz";
        const UPPERCASE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const NUMBERS: &[u8] = b"0123456789";
        const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{}|;:,.<>?";

        let mut rng = rand::rng();

        // Ensure at least one character from each category
        let mut password = Vec::with_capacity(length);

        // Add one character from each required set
        password.push(LOWERCASE[rng.random_range(0..LOWERCASE.len())] as char);
        password.push(UPPERCASE[rng.random_range(0..UPPERCASE.len())] as char);
        password.push(NUMBERS[rng.random_range(0..NUMBERS.len())] as char);
        password.push(SYMBOLS[rng.random_range(0..SYMBOLS.len())] as char);

        // Fill the rest with a mix of all character types
        const ALL_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}|;:,.<>?";

        for _ in password.len()..length {
            password.push(ALL_CHARS[rng.random_range(0..ALL_CHARS.len())] as char);
        }

        // Shuffle the characters to avoid predictable patterns
        for i in 0..password.len() {
            let j = rng.random_range(0..password.len());
            password.swap(i, j);
        }

        let password_string: String = password.into_iter().collect();

        // Double-check the generated password meets our requirements
        self.validate_password_strength(&password_string)?;

        Ok(password_string)
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
        if !hash.starts_with("$argon2id$") {
            // Not using Argon2id variant
            return true;
        }

        // Check memory cost parameter
        if !hash.contains("m=65536") {
            // Using different memory cost
            return true;
        }

        // Check time cost parameter
        if !hash.contains("t=3") {
            // Using different time cost
            return true;
        }

        // Check parallelism parameter
        if !hash.contains("p=4") {
            // Using different parallelism
            return true;
        }

        false
    }

    /// Estimates the password hash strength on a scale of 1-10
    ///
    /// Useful for giving users feedback on how strong their passwords are.
    ///
    /// # Arguments
    /// * `password` - Password to evaluate
    ///
    /// # Returns
    /// Strength score from 1 (very weak) to 10 (very strong)
    pub fn estimate_password_strength(&self, password: &str) -> u8 {
        let mut score = 0;

        // Length contributes significantly to strength
        score += (password.len() as u8).min(20) / 2;

        // Character diversity
        let has_lowercase = password.chars().any(|c| c.is_lowercase());
        let has_uppercase = password.chars().any(|c| c.is_uppercase());
        let has_digit = password.chars().any(|c| c.is_numeric());
        let has_symbol = password.chars().any(|c| !c.is_alphanumeric());

        if has_lowercase {
            score += 1;
        }
        if has_uppercase {
            score += 1;
        }
        if has_digit {
            score += 1;
        }
        if has_symbol {
            score += 2;
        }

        // Deduct points for common patterns
        if COMMON_PATTERNS.is_match(password) {
            score = score.saturating_sub(3);
        }

        // Ensure the score is within bounds
        score.clamp(1, 10)
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
        let password = "TestPassword123!";

        let hash = service.hash_password(password).unwrap();
        assert!(service.verify_password(password, &hash).unwrap());
        assert!(!service.verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_password_strength_validation() {
        let service = PasswordService::from_global_config();

        // Valid password
        assert!(service.validate_password_strength("MySecure123!").is_ok());

        // Too short
        assert!(service.validate_password_strength("Short1").is_err());

        // No number
        assert!(service
            .validate_password_strength("MySecurePassword")
            .is_err());

        // No letter
        assert!(service.validate_password_strength("12345678").is_err());

        // Common pattern
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

    #[test]
    fn test_needs_rehash() {
        let service = PasswordService::from_global_config();

        // Current format hash
        let current_hash = "$argon2id$v=19$m=65536,t=3,p=4$salt$hash";
        assert!(!service.needs_rehash(current_hash));

        // Old variant
        let old_variant = "$argon2i$v=19$m=65536,t=3,p=4$salt$hash";
        assert!(service.needs_rehash(old_variant));

        // Old memory cost
        let old_mem = "$argon2id$v=19$m=4096,t=3,p=4$salt$hash";
        assert!(service.needs_rehash(old_mem));

        // Old time cost
        let old_time = "$argon2id$v=19$m=65536,t=2,p=4$salt$hash";
        assert!(service.needs_rehash(old_time));

        // Old parallelism
        let old_parallel = "$argon2id$v=19$m=65536,t=3,p=2$salt$hash";
        assert!(service.needs_rehash(old_parallel));
    }

    #[test]
    fn test_password_strength_estimation() {
        let service = PasswordService::from_global_config();

        // Very weak password
        assert!(service.estimate_password_strength("123456") <= 3);

        // Medium strength password
        assert!(service.estimate_password_strength("MyPassword123") >= 5);

        // Strong password
        assert!(service.estimate_password_strength("C0mpl3x!P@ssw0rd#2023") >= 8);
    }
}

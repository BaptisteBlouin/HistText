//! Password recovery email template for existing user accounts.
//!
//! Features:
//! - Automated password reset instructions for registered users
//! - Time-limited reset link generation with 24-hour expiration
//! - Multi-format email support with plain text and HTML versions
//! - Security-conscious messaging with clear expiration notices
//! - Integration with the mailer service for reliable delivery

use crate::services::mailer::Mailer;

/// Sends password reset instructions to existing user account
///
/// This function sends a password recovery email to users who have requested
/// a password reset for their existing account. It includes a time-limited
/// reset link that expires after 24 hours for security purposes.
///
/// # Arguments
/// * `mailer` - Email service instance for sending messages
/// * `to_email` - Recipient email address
/// * `link` - Password reset link with embedded token
///
/// # Example
/// ```rust
/// use crate::services::mailer::Mailer;
/// use crate::auth::mail::auth_recover_existent_account;
///
/// let mailer = Mailer::new();
/// let reset_link = "https://example.com/reset?token=abc123";
/// auth_recover_existent_account::send(&mailer, "user@example.com", reset_link);
/// ```
pub fn send(mailer: &Mailer, to_email: &str, link: &str) {
    let subject = "Reset Password Instructions";
    
    let text = format!(
        r#"
(This is an automated message.)

Hello,

Someone requested a password reset for the account associated with this email.
Please visit this link to reset your password:
{link}
(valid for 24 hours)
"#
    );
    
    let html = format!(
        r#"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Someone requested a password reset for the account associated with this email.
Please visit this link to reset your password:</p>
<p><a href="{link}">{link}</a></p>
<p>(valid for 24 hours)</p>
"#
    );

    mailer.send(to_email, subject, &text, &html);
}
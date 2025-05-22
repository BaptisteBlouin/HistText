//! Password reset confirmation email template for user security.
//!
//! Features:
//! - Automated email notification for successful password resets
//! - Multi-format email support with plain text and HTML versions
//! - Security-focused messaging to confirm password reset completion
//! - Integration with the mailer service for reliable delivery

use crate::services::mailer::Mailer;

/// Sends password reset confirmation email to user
///
/// This function sends a security notification email to users after their
/// password has been successfully reset through the password recovery process,
/// confirming the completion of the reset operation.
///
/// # Arguments
/// * `mailer` - Email service instance for sending messages
/// * `to_email` - Recipient email address
///
/// # Example
/// ```rust
/// use crate::services::mailer::Mailer;
/// use crate::auth::mail::auth_password_reset;
///
/// let mailer = Mailer::new();
/// auth_password_reset::send(&mailer, "user@example.com");
/// ```
pub fn send(mailer: &Mailer, to_email: &str) {
    let subject = "Your password was reset";
    
    let text = r"
(This is an automated message.)

Hello,

Your password was successfully reset!
"
    .to_string();

    let html = r"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Your password was successfully reset!</p>
"
    .to_string();

    mailer.send(to_email, subject, &text, &html);
}
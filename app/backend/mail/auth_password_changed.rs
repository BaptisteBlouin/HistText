//! Password change notification email template for user security.
//!
//! Features:
//! - Automated email notification for successful password changes
//! - Multi-format email support with plain text and HTML versions
//! - Security-focused messaging to inform users of account changes
//! - Integration with the mailer service for reliable delivery

use crate::services::mailer::Mailer;

/// Sends password change confirmation email to user
///
/// This function sends a security notification email to users after their
/// password has been successfully changed, helping them stay informed about
/// account security events.
///
/// # Arguments
/// * `mailer` - Email service instance for sending messages
/// * `to_email` - Recipient email address
///
/// # Example
/// ```rust
/// use crate::services::mailer::Mailer;
/// use crate::auth::mail::auth_password_changed;
///
/// let mailer = Mailer::new();
/// auth_password_changed::send(&mailer, "user@example.com");
/// ```
pub fn send(mailer: &Mailer, to_email: &str) {
    let subject = "Your password was changed";
    
    let text = r"
(This is an automated message.)

Hello,

Your password was changed successfully!
"
    .to_string();
    
    let html = r"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Your password was changed successfully!</p>
"
    .to_string();

    mailer.send(to_email, subject, &text, &html);
}
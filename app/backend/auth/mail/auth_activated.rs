//! Account activation email template for user authentication.
//!
//! Features:
//! - Automated email notification for successful account activation
//! - Multi-format email support with plain text and HTML versions
//! - Integration with the mailer service for reliable delivery
//! - User-friendly messaging for account confirmation

use crate::services::mailer::Mailer;

/// Sends account activation confirmation email to user
///
/// This function sends a confirmation email to users after their account
/// has been successfully activated through the activation token process.
///
/// # Arguments
/// * `mailer` - Email service instance for sending messages
/// * `to_email` - Recipient email address
///
/// # Example
/// ```rust
/// use crate::services::mailer::Mailer;
/// use crate::auth::mail::auth_activated;
///
/// let mailer = Mailer::new();
/// auth_activated::send(&mailer, "user@example.com");
/// ```
pub fn send(mailer: &Mailer, to_email: &str) {
    let subject = "Account activated";
    
    let text = r"
(This is an automated message.)

Hello,

Your account has been activated!
"
    .to_string();
    
    let html = r"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Your account has been activated!</p>
"
    .to_string();

    mailer.send(to_email, subject, &text, &html);
}
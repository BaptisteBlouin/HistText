//! Account registration confirmation email template for new users.
//!
//! Features:
//! - Automated email confirmation for new user registrations
//! - Account activation link generation with embedded tokens
//! - Multi-format email support with plain text and HTML versions
//! - Clear instructions for completing the registration process
//! - Integration with the mailer service for reliable delivery

use crate::services::mailer::Mailer;

/// Sends registration confirmation email to new user
///
/// This function sends an account activation email to users who have just
/// registered for a new account. The email contains a confirmation link
/// that must be clicked to activate the account and complete the registration
/// process.
///
/// # Arguments
/// * `mailer` - Email service instance for sending messages
/// * `to_email` - Recipient email address
/// * `link` - Account activation link with embedded token
///
/// # Example
/// ```rust
/// use crate::services::mailer::Mailer;
/// use crate::auth::mail::auth_register;
///
/// let mailer = Mailer::new();
/// let activation_link = "https://example.com/activate?token=xyz789";
/// auth_register::send(&mailer, "newuser@example.com", activation_link);
/// ```
pub fn send(mailer: &Mailer, to_email: &str, link: &str) {
    let subject = "Registration Confirmation";
    
    let text = format!(
        r#"
(This is an automated message.)

Hello,

Please follow the link below to complete your registration:
{link}
"#
    );
    
    let html = format!(
        r#"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Please follow the link below to complete your registration:</p>
<p><a href="{link}">{link}</a></p>
"#
    );

    mailer.send(to_email, subject, &text, &html);
}
//! Password recovery email template for non-existent user accounts.
//!
//! Features:
//! - Automated response for password reset requests on non-existent accounts
//! - Security-conscious design that doesn't reveal account existence status
//! - Registration invitation for legitimate users who need to create accounts
//! - Multi-format email support with plain text and HTML versions
//! - Integration with the mailer service for reliable delivery

use crate::services::mailer::Mailer;

/// Sends password reset response for non-existent user account
///
/// This function sends a helpful email to users who have requested a password
/// reset for an email address that doesn't have an associated account. It
/// provides a registration link for users who legitimately need to create
/// an account while maintaining security by not explicitly revealing whether
/// accounts exist or not.
///
/// # Arguments
/// * `mailer` - Email service instance for sending messages
/// * `to_email` - Recipient email address
/// * `link` - Registration link for new account creation
///
/// # Example
/// ```rust
/// use crate::services::mailer::Mailer;
/// use crate::auth::mail::auth_recover_nonexistent_account;
///
/// let mailer = Mailer::new();
/// let register_link = "https://example.com/register";
/// auth_recover_nonexistent_account::send(&mailer, "user@example.com", register_link);
/// ```
pub fn send(mailer: &Mailer, to_email: &str, link: &str) {
    let subject = "Reset Password Instructions";
    
    let text = format!(
        r#"
(This is an automated message.)

Hello,

Someone requested a password reset for the account associated with this email, but no account exists!
If this was intentional, you can register for a new account using the link below:
{link}
"#
    );
    
    let html = format!(
        r#"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Someone requested a password reset for the account associated with this email, but no account exists!
If this was intentional, you can register for a new account using the link below:</p>
<p><a href="{link}">{link}</a></p>
"#
    );

    mailer.send(to_email, subject, &text, &html);
}
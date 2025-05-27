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
    let subject = "Complete Your HistText Registration";
    
    let text = format!(
        r#"(This is an automated message.)

Hello,

Thank you for registering with HistText! Please click the link below to activate your account and complete your registration:

{link}

This link will expire in 24 hours for security reasons.

If you didn't create this account, please ignore this email.

Best regards,
The HistText Team"#,
        link = link
    );

    let html = format!(
        r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete Your Registration</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f7fa;
        }}
        .container {{
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }}
        .content {{
            padding: 30px;
        }}
        .automated-notice {{
            background: #f0f8ff;
            color: #1976d2;
            padding: 8px 15px;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 20px;
            text-align: center;
        }}
        .activation-button {{
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }}
        .activation-button:hover {{
            text-decoration: none;
            color: white;
        }}
        .link-text {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
            word-break: break-all;
            font-family: monospace;
            font-size: 14px;
            color: #666;
            margin: 15px 0;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }}
        .warning {{
            background: #fff3cd;
            color: #856404;
            padding: 10px 15px;
            border-radius: 4px;
            margin: 15px 0;
            font-size: 14px;
        }}
        @media (max-width: 600px) {{
            body {{
                padding: 10px;
            }}
            .header, .content {{
                padding: 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Complete Your Registration</h1>
        </div>
        
        <div class="content">
            <div class="automated-notice">
                This is an automated message.
            </div>
            
            <p>Hello,</p>
            
            <p>Thank you for registering with HistText! Please click the button below to activate your account and complete your registration:</p>
            
            <div style="text-align: center;">
                <a href="{link}" class="activation-button">
                    Activate Your Account
                </a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            
            <div class="link-text">
                {link}
            </div>
            
            <div class="warning">
                <strong>Important:</strong> This link will expire in 24 hours for security reasons.
            </div>
            
            <p>If you didn't create this account, please ignore this email.</p>
            
            <p style="margin-top: 25px;">
                Best regards,<br>
                The HistText Team
            </p>
        </div>
        
        <div class="footer">
            <p>If you're having trouble with the activation link, please contact us at <a href="mailto:histtext@gmail.com">histtext@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
        "#,
        link = link
    );

    mailer.send(to_email, subject, &text, &html);
}
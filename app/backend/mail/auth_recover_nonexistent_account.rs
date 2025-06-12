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
pub async fn send(mailer: &Mailer, to_email: &str, link: &str) {
    let subject = "HistText Account Not Found";
    
    let text = format!(
        r#"(This is an automated message.)

Hello,

Someone requested a password reset for the HistText account associated with this email address, but no account exists with this email.

If this was intentional, you can create a new account using the link below:

{link}

If you already have an account with a different email address, please use that email to reset your password.

If you did not request this, please ignore this email.

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
    <title>Account Not Found</title>
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
            background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
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
        .info-box {{
            background: #e3f2fd;
            border: 1px solid #2196f3;
            color: #1976d2;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            text-align: center;
            font-weight: 600;
        }}
        .register-button {{
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
        .register-button:hover {{
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
        .suggestion-box {{
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }}
        .footer {{
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
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
            <h1>Account Not Found</h1>
        </div>
        
        <div class="content">
            <div class="automated-notice">
                This is an automated message.
            </div>
            
            <div class="info-box">
                No HistText account exists with this email address
            </div>
            
            <p>Hello,</p>
            
            <p>Someone requested a password reset for the HistText account associated with this email address, but no account exists with this email.</p>
            
            <p>If this was intentional, you can create a new account using the button below:</p>
            
            <div style="text-align: center;">
                <a href="{link}" class="register-button">
                    Create New Account
                </a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            
            <div class="link-text">
                {link}
            </div>
            
            <div class="suggestion-box">
                <strong>Already have an account?</strong> If you already have an account with a different email address, please use that email to reset your password.
            </div>
            
            <p>If you did not request this, please ignore this email.</p>
            
            <p style="margin-top: 25px;">
                Best regards,<br>
                The HistText Team
            </p>
        </div>
        
        <div class="footer">
            <p>Questions? Contact us at <a href="mailto:histtext@gmail.com">histtext@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
        "#,
        link = link
    );

    mailer.send(to_email, subject, &text, &html).await;
}
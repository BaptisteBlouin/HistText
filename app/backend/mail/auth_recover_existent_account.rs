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
    let subject = "Reset Your HistText Password";
    
    let text = format!(
        r#"(This is an automated message.)

Hello,

Someone requested a password reset for the HistText account associated with this email address.

Please click the link below to reset your password:

{link}

This link will expire in 24 hours for security reasons.

If you did not request this password reset, please ignore this email. Your password will remain unchanged.

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
    <title>Reset Your Password</title>
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
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
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
        .reset-button {{
            display: inline-block;
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
        }}
        .reset-button:hover {{
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
        .warning {{
            background: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
        }}
        .info-box {{
            background: #e3f2fd;
            border: 1px solid #2196f3;
            color: #1976d2;
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
            <h1>Reset Your Password</h1>
        </div>
        
        <div class="content">
            <div class="automated-notice">
                This is an automated message.
            </div>
            
            <p>Hello,</p>
            
            <p>Someone requested a password reset for the HistText account associated with this email address.</p>
            
            <p>Please click the button below to reset your password:</p>
            
            <div style="text-align: center;">
                <a href="{link}" class="reset-button">
                    Reset My Password
                </a>
            </div>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            
            <div class="link-text">
                {link}
            </div>
            
            <div class="warning">
                <strong>Important:</strong> This link will expire in 24 hours for security reasons.
            </div>
            
            <div class="info-box">
                <strong>Didn't request this?</strong> If you did not request this password reset, please ignore this email. Your password will remain unchanged.
            </div>
            
            <p style="margin-top: 25px;">
                Best regards,<br>
                The HistText Team
            </p>
        </div>
        
        <div class="footer">
            <p>If you're having trouble with the reset link, please contact us at <a href="mailto:histtext@gmail.com">histtext@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
        "#,
        link = link
    );

    mailer.send(to_email, subject, &text, &html);
}
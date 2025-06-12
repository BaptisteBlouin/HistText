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
pub async fn send(mailer: &Mailer, to_email: &str) {
    let subject = "HistText Password Changed Successfully";
    
    let text = r"(This is an automated message.)

Hello,

Your HistText account password was changed successfully!

This email confirms that your password was updated on your account. If you made this change, no further action is required.

Security Notice:
If you did not change your password, please contact us immediately at histtext@gmail.com and consider securing your account.

Best regards,
The HistText Team".to_string();

    let html = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f7fa;
        }
        .container {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 30px;
        }
        .automated-notice {
            background: #f0f8ff;
            color: #1976d2;
            padding: 8px 15px;
            border-radius: 4px;
            font-size: 14px;
            margin-bottom: 20px;
            text-align: center;
        }
        .success-box {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            text-align: center;
            color: #2e7d32;
            font-weight: 600;
        }
        .security-notice {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .security-notice h3 {
            margin: 0 0 10px 0;
            color: #856404;
            font-size: 16px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .header, .content {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Changed</h1>
        </div>
        
        <div class="content">
            <div class="automated-notice">
                This is an automated message.
            </div>
            
            <div class="success-box">
                Your HistText account password was changed successfully!
            </div>
            
            <p>Hello,</p>
            
            <p>This email confirms that your password was updated on your account. If you made this change, no further action is required.</p>
            
            <div class="security-notice">
                <h3>Security Notice</h3>
                <p>If you did not change your password, please contact us immediately at <a href="mailto:histtext@gmail.com">histtext@gmail.com</a> and consider securing your account.</p>
            </div>
            
            <p style="margin-top: 25px;">
                Best regards,<br>
                The HistText Team
            </p>
        </div>
        
        <div class="footer">
            <p>This notification was sent to keep your account secure. For questions, contact <a href="mailto:histtext@gmail.com">histtext@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
    "#.to_string();

    mailer.send(to_email, subject, &text, &html).await;
}
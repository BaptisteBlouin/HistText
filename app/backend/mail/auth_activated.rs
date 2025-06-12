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
pub async fn send(mailer: &Mailer, to_email: &str) {
    let subject = "Welcome to HistText - Your Account is Active";
    
    let text = r"
(This is an automated message.)

Hello,

Your HistText account has been successfully activated!

What's included:
Your account now includes access to our free collection of texts. You can start exploring and analyzing documents immediately.

Getting Started:
- Visit the HistText website to access the analysis platform
- Browse our free collection of documents
- Use our text analysis tools to discover insights

Free Collection Access:
As an activated user, you have access to hundreds of documents, advanced text analysis features, and export capabilities for your research.

Private Collection Access:
If you want to access our private collection with additional documents, please contact our support team.

If you need assistance getting started, our support team is available to help.

Best regards,
The HistText Team

---
If you didn't create this account, please contact us at histtext@gmail.com
    ".trim().to_string();

    let html = r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to HistText</title>
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        .status-box {
            background: #e8f5e8;
            border: 1px solid #4caf50;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 25px;
            text-align: center;
            color: #2e7d32;
            font-weight: 600;
        }
        .section {
            margin-bottom: 25px;
        }
        .section h3 {
            margin: 0 0 10px 0;
            color: #667eea;
            font-size: 16px;
            font-weight: 600;
        }
        .section ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .section li {
            margin: 6px 0;
            color: #555;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .cta-button:hover {
            text-decoration: none;
            color: white;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
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
            <h1>Welcome to HistText</h1>
        </div>
        
        <div class="content">
            <div class="automated-notice">
                This is an automated message.
            </div>
            
            <div class="status-box">
                Your HistText account has been successfully activated!
            </div>
            
            <p>Hello,</p>
            
            <div class="section">
                <h3>What's included</h3>
                <p>Your account now includes access to our free collection of texts. You can start exploring and analyzing documents immediately.</p>
            </div>
            
            <div class="section">
                <h3>Getting Started</h3>
                <ul>
                    <li>Visit the HistText website to access the analysis platform</li>
                    <li>Browse our free collection of documents</li>
                    <li>Use our text analysis tools to discover insights</li>
                </ul>
            </div>
            
            <div class="section">
                <h3>Free Collection Access</h3>
                <p>As an activated user, you have access to hundreds of documents, advanced text analysis features, and export capabilities for your research.</p>
            </div>
            
            <div class="section">
                <h3>Private Collection Access</h3>
                <p>If you want to access our private collection with additional premium documents, please contact our support team.</p>
            </div>
            
            
            <p>If you need assistance getting started, our support team is available to help.</p>
            
            <p style="margin-top: 25px;">
                Best regards,<br>
                The HistText Team
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Security Notice:</strong> If you didn't create this account, please contact us at <a href="mailto:histtext@gmail.com">histtext@gmail.com</a></p>
        </div>
    </div>
</body>
</html>
"#.trim().to_string();

    mailer.send(to_email, subject, &text, &html).await;
}
use crate::config::Config;
use anyhow::{anyhow, Result};
use base64::Engine;
use lettre::message::{header, Message, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::{Credentials, Mechanism};
use lettre::{SmtpTransport, Transport};
use log::{error, info, warn};
use oauth2::{
    basic::BasicClient, reqwest::async_http_client, AuthUrl, ClientId, ClientSecret,
    RefreshToken, TokenResponse, TokenUrl,
};
use reqwest::Client;
use serde_json::json;
use std::collections::HashMap;
use tokio::time::{sleep, Duration};

#[derive(Clone, Debug, PartialEq)]
pub enum EmailProvider {
    Smtp,
    OAuth2,
    SendGrid,
    Mailgun,
}

impl From<&str> for EmailProvider {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "oauth2" => EmailProvider::OAuth2,
            "sendgrid" => EmailProvider::SendGrid,
            "mailgun" => EmailProvider::Mailgun,
            _ => EmailProvider::Smtp,
        }
    }
}

#[derive(Clone)]
pub struct Mailer {
    pub provider: EmailProvider,
    pub from_email: String,
    pub app_url: String,
    pub actually_send: bool,
    
    // SMTP settings
    pub smtp_server: String,
    pub smtp_username: String,
    pub smtp_password: String,
    
    // OAuth2 settings
    pub oauth2_client_id: String,
    pub oauth2_client_secret: String,
    pub oauth2_refresh_token: String,
    pub oauth2_redirect_uri: String,
    
    // HTTP API settings
    pub email_api_key: String,
    pub email_api_endpoint: String,
    pub mailgun_domain: String,
    
    // HTTP client for API calls
    pub http_client: Client,
    
    // Retry settings
    pub max_retries: u32,
    pub retry_delay_ms: u64,
}

impl Mailer {
    /// Construct Mailer from your config struct (recommended for all use cases)
    pub fn from_config(config: &Config) -> Self {
        Self {
            provider: EmailProvider::from(config.email_provider.as_str()),
            from_email: config.smtp_from_address.clone(),
            app_url: config.app_url.clone(),
            actually_send: config.send_mail,
            
            // SMTP settings
            smtp_server: config.smtp_server.clone(),
            smtp_username: config.smtp_username.clone(),
            smtp_password: config.smtp_password.clone(),
            
            // OAuth2 settings
            oauth2_client_id: config.oauth2_client_id.clone(),
            oauth2_client_secret: config.oauth2_client_secret.clone(),
            oauth2_refresh_token: config.oauth2_refresh_token.clone(),
            oauth2_redirect_uri: config.oauth2_redirect_uri.clone(),
            
            // HTTP API settings
            email_api_key: config.email_api_key.clone(),
            email_api_endpoint: config.email_api_endpoint.clone(),
            mailgun_domain: config.mailgun_domain.clone(),
            
            // HTTP client
            http_client: Client::new(),
            
            // Retry settings
            max_retries: 3,
            retry_delay_ms: 1000,
        }
    }

    /// Send an email (text and html body) with retry logic
    pub async fn send(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) {
        info!("📧 Email Request: to={}, subject={}, provider={:?}", to_email, subject, self.provider);

        if !self.actually_send {
            self.log_email_preview(to_email, subject, text_body, html_body);
            return;
        }

        let mut last_error = None;
        
        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                warn!("Retrying email send (attempt {}/{})", attempt + 1, self.max_retries + 1);
                sleep(Duration::from_millis(self.retry_delay_ms * attempt as u64)).await;
            }

            match self.send_internal(to_email, subject, text_body, html_body).await {
                Ok(_) => {
                    info!("Email sent successfully to {} via {:?}", to_email, self.provider);
                    return;
                }
                Err(e) => {
                    error!("Failed to send email (attempt {}): {}", attempt + 1, e);
                    last_error = Some(e);
                }
            }
        }
        
        error!("Failed to send email after {} attempts: {:?}", self.max_retries + 1, last_error);
    }
    
    /// Internal send method that handles different providers
    async fn send_internal(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) -> Result<()> {
        match self.provider {
            EmailProvider::Smtp => self.send_smtp(to_email, subject, text_body, html_body).await,
            EmailProvider::OAuth2 => self.send_oauth2(to_email, subject, text_body, html_body).await,
            EmailProvider::SendGrid => self.send_sendgrid(to_email, subject, text_body, html_body).await,
            EmailProvider::Mailgun => self.send_mailgun(to_email, subject, text_body, html_body).await,
        }
    }
    
    /// Send email via SMTP
    async fn send_smtp(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) -> Result<()> {
        let sender = self.from_email.parse()
            .map_err(|e| anyhow!("Invalid sender email '{}': {}", self.from_email, e))?;
        let recipient = to_email.parse()
            .map_err(|e| anyhow!("Invalid recipient email '{}': {}", to_email, e))?;

        let email = Message::builder()
            .from(sender)
            .to(recipient)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_PLAIN)
                            .body(text_body.to_string()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_HTML)
                            .body(html_body.to_string()),
                    ),
            )
            .map_err(|e| anyhow!("Failed to build email message: {}", e))?;

        let mailer = SmtpTransport::relay(&self.smtp_server)
            .map_err(|e| anyhow!("Failed to create SMTP transport: {}", e))?
            .credentials(Credentials::new(
                self.smtp_username.clone(),
                self.smtp_password.clone(),
            ))
            .build();

        mailer.send(&email)
            .map_err(|e| anyhow!("SMTP send failed: {}", e))?;
            
        Ok(())
    }
    
    /// Send email via OAuth2 (Gmail)
    async fn send_oauth2(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) -> Result<()> {
        // First get a fresh access token
        let access_token = self.get_oauth2_access_token().await?;
        
        let sender = self.from_email.parse()
            .map_err(|e| anyhow!("Invalid sender email '{}': {}", self.from_email, e))?;
        let recipient = to_email.parse()
            .map_err(|e| anyhow!("Invalid recipient email '{}': {}", to_email, e))?;

        let email = Message::builder()
            .from(sender)
            .to(recipient)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_PLAIN)
                            .body(text_body.to_string()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(header::ContentType::TEXT_HTML)
                            .body(html_body.to_string()),
                    ),
            )
            .map_err(|e| anyhow!("Failed to build email message: {}", e))?;

        // Use OAuth2 with SMTP
        let mailer = SmtpTransport::relay("smtp.gmail.com")
            .map_err(|e| anyhow!("Failed to create Gmail SMTP transport: {}", e))?
            .authentication(vec![Mechanism::Xoauth2])
            .credentials(Credentials::new(
                self.smtp_username.clone(),
                access_token,
            ))
            .build();

        mailer.send(&email)
            .map_err(|e| anyhow!("OAuth2 SMTP send failed: {}", e))?;
            
        Ok(())
    }
    
    /// Get OAuth2 access token using refresh token
    async fn get_oauth2_access_token(&self) -> Result<String> {
        let client = BasicClient::new(
            ClientId::new(self.oauth2_client_id.clone()),
            Some(ClientSecret::new(self.oauth2_client_secret.clone())),
            AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".to_string())?,
            Some(TokenUrl::new("https://www.googleapis.com/oauth2/v3/token".to_string())?),
        );

        let token_result = client
            .exchange_refresh_token(&RefreshToken::new(self.oauth2_refresh_token.clone()))
            .request_async(async_http_client)
            .await
            .map_err(|e| anyhow!("Failed to refresh OAuth2 token: {}", e))?;

        Ok(token_result.access_token().secret().clone())
    }
    
    /// Send email via SendGrid API
    async fn send_sendgrid(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) -> Result<()> {
        let payload = json!({
            "personalizations": [{
                "to": [{"email": to_email}]
            }],
            "from": {"email": self.from_email},
            "subject": subject,
            "content": [
                {"type": "text/plain", "value": text_body},
                {"type": "text/html", "value": html_body}
            ]
        });

        let response = self.http_client
            .post("https://api.sendgrid.com/v3/mail/send")
            .header("Authorization", format!("Bearer {}", self.email_api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow!("SendGrid API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("SendGrid API error {}: {}", status, error_text));
        }

        Ok(())
    }
    
    /// Send email via Mailgun API
    async fn send_mailgun(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) -> Result<()> {
        let url = format!("https://api.mailgun.net/v3/{}/messages", self.mailgun_domain);
        
        let mut form = HashMap::new();
        form.insert("from", self.from_email.as_str());
        form.insert("to", to_email);
        form.insert("subject", subject);
        form.insert("text", text_body);
        form.insert("html", html_body);

        let auth_header = format!(
            "Basic {}", 
            base64::engine::general_purpose::STANDARD.encode(format!("api:{}", self.email_api_key))
        );

        let response = self.http_client
            .post(&url)
            .header("Authorization", auth_header)
            .form(&form)
            .send()
            .await
            .map_err(|e| anyhow!("Mailgun API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow!("Mailgun API error {}: {}", status, error_text));
        }

        Ok(())
    }

    // These call your crate's existing auth mail functions as before
    // Now they are async to support the new send method

    pub async fn send_register(&self, to_email: &str, activation_link: &str) {
        let link = format!("{}/{}", self.app_url, activation_link);
        crate::mail::auth_register::send(self, to_email, &link).await;
    }
    pub async fn send_activated(&self, to_email: &str) {
        crate::mail::auth_activated::send(self, to_email).await;
    }
    pub async fn send_password_changed(&self, to_email: &str) {
        crate::mail::auth_password_changed::send(self, to_email).await;
    }
    pub async fn send_password_reset(&self, to_email: &str) {
        crate::mail::auth_password_reset::send(self, to_email).await;
    }
    pub async fn send_recover_existent_account(&self, to_email: &str, reset_link: &str) {
        let link = format!("{}/{}", self.app_url, reset_link);
        crate::mail::auth_recover_existent_account::send(self, to_email, &link).await;
    }
    pub async fn send_recover_nonexistent_account(&self, to_email: &str, register_link: &str) {
        let link = format!("{}/{}", self.app_url, register_link);
        crate::mail::auth_recover_nonexistent_account::send(self, to_email, &link).await;
    }
    
    /// Log email preview when actually_send is false
    fn log_email_preview(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) {
        info!("📧 EMAIL PREVIEW (send_mail=false)");
        info!("{}", "=".repeat(60));
        info!("📮 To: {}", to_email);
        info!("📝 Subject: {}", subject);
        info!("🌐 Provider: {:?}", self.provider);
        info!("📄 Text Body:");
        info!("{}", "-".repeat(40));
        
        // Log text body with line numbers for better readability
        for (i, line) in text_body.lines().enumerate() {
            info!("{:3} | {}", i + 1, line);
        }
        
        info!("{}", "-".repeat(40));
        info!("🎨 HTML Body (first 500 chars):");
        let html_preview = if html_body.len() > 500 {
            format!("{}... [truncated]", &html_body[..500])
        } else {
            html_body.to_string()
        };
        info!("{}", html_preview);
        info!("{}", "=".repeat(60));
        
        // Add helpful development message
        if self.provider == EmailProvider::Smtp && self.smtp_server == "localhost" {
            warn!("💡 Email not sent - To enable emails, configure EMAIL_PROVIDER and SEND_MAIL=true");
        } else {
            warn!("💡 Email preview only - Set SEND_MAIL=true to actually send emails");
        }
    }
    
    /// Check if email service is properly configured and enabled
    pub fn is_email_service_ready(&self) -> bool {
        if !self.actually_send {
            return false;
        }
        
        match self.provider {
            EmailProvider::Smtp => {
                !self.smtp_server.is_empty() && 
                self.smtp_server != "localhost" &&
                !self.smtp_username.is_empty() &&
                !self.smtp_password.is_empty()
            },
            EmailProvider::OAuth2 => {
                !self.oauth2_client_id.is_empty() &&
                !self.oauth2_client_secret.is_empty() &&
                !self.oauth2_refresh_token.is_empty()
            },
            EmailProvider::SendGrid => {
                !self.email_api_key.is_empty()
            },
            EmailProvider::Mailgun => {
                !self.email_api_key.is_empty() &&
                !self.mailgun_domain.is_empty()
            },
        }
    }
    
    /// Get user-friendly status message about email configuration
    pub fn get_email_status_message(&self) -> String {
        if !self.actually_send {
            return "Email sending is disabled (SEND_MAIL=false). Accounts are auto-activated.".to_string();
        }
        
        if !self.is_email_service_ready() {
            return format!("Email service ({:?}) is not properly configured. Check your environment variables.", self.provider);
        }
        
        format!("Email service ready using {:?} provider", self.provider)
    }
    
    /// Queue an email to be sent via background job system
    pub async fn queue_email(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) -> Result<()> {
        // For now, just send directly - in the future this could integrate with the existing Fang job system
        self.send(to_email, subject, text_body, html_body).await;
        Ok(())
    }
}

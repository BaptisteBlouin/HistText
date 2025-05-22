use crate::config::Config;
use lettre::message::{header, Message, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::stub::StubTransport;
use lettre::{SmtpTransport, Transport};
use log::{error, info};

#[derive(Clone)]
pub struct Mailer {
    pub from_email: String,
    pub smtp_server: String,
    pub smtp_username: String,
    pub smtp_password: String,
    pub app_url: String,
    pub actually_send: bool,
}

impl Mailer {
    /// Construct Mailer from your config struct (recommended for all use cases)
    pub fn from_config(config: &Config) -> Self {
        Self {
            from_email: config.smtp_from_address.clone(),
            smtp_server: config.smtp_server.clone(),
            smtp_username: config.smtp_username.clone(),
            smtp_password: config.smtp_password.clone(),
            app_url: config.app_url.clone(),
            actually_send: config.send_mail,
        }
    }

    /// Send an email (text and html body)
    pub fn send(&self, to_email: &str, subject: &str, text_body: &str, html_body: &str) {
        info!("Sending email: to={}, subject={}", to_email, subject);

        let sender = match self.from_email.parse() {
            Ok(sender) => sender,
            Err(e) => {
                error!("Invalid sender email '{}': {}", self.from_email, e);
                return;
            }
        };
        let recipient = match to_email.parse() {
            Ok(recipient) => recipient,
            Err(e) => {
                error!("Invalid recipient email '{}': {}", to_email, e);
                return;
            }
        };

        let email = match Message::builder()
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
            ) {
            Ok(email) => email,
            Err(e) => {
                error!("Failed to build email message: {}", e);
                return;
            }
        };

        if self.actually_send {
            let mailer = SmtpTransport::relay(&self.smtp_server)
                .unwrap()
                .credentials(Credentials::new(
                    self.smtp_username.clone(),
                    self.smtp_password.clone(),
                ))
                .build();

            match mailer.send(&email) {
                Ok(_) => info!("Email sent successfully to {}", to_email),
                Err(e) => {
                    error!("Failed to send email: {}", e);
                    if e.is_permanent() {
                        error!("SMTP permanent error: {}", e);
                    } else if e.is_transient() {
                        error!("SMTP transient error: {}", e);
                    } else if e.is_timeout() {
                        error!("SMTP timeout error: {}", e);
                    }
                }
            }
        } else {
            let mailer = StubTransport::new_ok();
            let result = mailer.send(&email);
            info!(
                "Email not actually sent (actually_send=false); stub result: {:?}",
                result
            );
        }
    }

    // These call your crate's existing auth mail functions as before

    pub fn send_register(&self, to_email: &str, activation_link: &str) {
        let link = format!("{}/{}", self.app_url, activation_link);
        crate::mail::auth_register::send(self, to_email, &link);
    }
    pub fn send_activated(&self, to_email: &str) {
        crate::mail::auth_activated::send(self, to_email);
    }
    pub fn send_password_changed(&self, to_email: &str) {
        crate::mail::auth_password_changed::send(self, to_email);
    }
    pub fn send_password_reset(&self, to_email: &str) {
        crate::mail::auth_password_reset::send(self, to_email);
    }
    pub fn send_recover_existent_account(&self, to_email: &str, reset_link: &str) {
        let link = format!("{}/{}", self.app_url, reset_link);
        crate::mail::auth_recover_existent_account::send(self, to_email, &link);
    }
    pub fn send_recover_nonexistent_account(&self, to_email: &str, register_link: &str) {
        let link = format!("{}/{}", self.app_url, register_link);
        crate::mail::auth_recover_nonexistent_account::send(self, to_email, &link);
    }
}

// app/backend/auth/mail/auth_password_reset.rs
use crate::services::mailer::Mailer;

pub fn send(mailer: &Mailer, to_email: &str) {
    let subject = "Your password was reset";
    let text = r"
(This is an automated message.)

Hello,

Your password was successfully reset!
"
    .to_string();

    let html = r"
<p>(This is an automated message.)</p>

<p>Hello,</p>

<p>Your password was successfully reset!</p>
"
    .to_string();

    mailer.send(to_email, subject, &text, &html);
}

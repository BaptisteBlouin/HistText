use actix_web::{web, HttpRequest};
use chrono::Utc;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::schema::security_events;
use crate::services::crud::execute_db_query;
use crate::services::database::Database;
use crate::services::error::AppResult;

#[derive(Queryable, Serialize, ToSchema, Debug, Selectable)]
#[diesel(table_name = security_events)]
pub struct SecurityEvent {
    pub id: i32,
    pub event_type: String,
    pub user_id: Option<i32>,
    pub user_email: Option<String>,
    pub description: String,
    pub severity: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Insertable, Debug)]
#[diesel(table_name = security_events)]
pub struct NewSecurityEvent {
    pub event_type: String,
    pub user_id: Option<i32>,
    pub user_email: Option<String>,
    pub description: String,
    pub severity: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

pub struct SecurityEventLogger;

impl SecurityEventLogger {
    pub async fn log_event(
        db: web::Data<Database>,
        event_type: &str,
        user_id: Option<i32>,
        user_email: Option<String>,
        description: &str,
        severity: &str,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        let ip_address = req.and_then(|r| {
            r.connection_info()
                .remote_addr()
                .map(|addr| addr.to_string())
        });

        let user_agent = req.and_then(|r| {
            r.headers()
                .get("user-agent")
                .and_then(|ua| ua.to_str().ok())
                .map(|ua| ua.to_string())
        });

        let new_event = NewSecurityEvent {
            event_type: event_type.to_string(),
            user_id,
            user_email,
            description: description.to_string(),
            severity: severity.to_string(),
            ip_address,
            user_agent,
        };

        execute_db_query(db, move |conn| {
            diesel::insert_into(security_events::table)
                .values(&new_event)
                .execute(conn)
        })
        .await?;

        Ok(())
    }

    pub async fn log_password_change(
        db: web::Data<Database>,
        user_id: i32,
        user_email: &str,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        Self::log_event(
            db,
            "password_change",
            Some(user_id),
            Some(user_email.to_string()),
            "User successfully changed their password",
            "low",
            req,
        )
        .await
    }

    pub async fn log_failed_login(
        db: web::Data<Database>,
        email: &str,
        reason: &str,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        Self::log_event(
            db,
            "failed_login",
            None,
            Some(email.to_string()),
            &format!("Failed login attempt: {}", reason),
            "medium",
            req,
        )
        .await
    }

    pub async fn log_successful_login(
        db: web::Data<Database>,
        user_id: i32,
        user_email: &str,
        req: Option<&HttpRequest>,
    ) -> AppResult<()> {
        Self::log_event(
            db,
            "successful_login",
            Some(user_id),
            Some(user_email.to_string()),
            "User successfully logged in",
            "low",
            req,
        )
        .await
    }

    pub async fn get_recent_events(
        db: web::Data<Database>,
        limit: i64,
    ) -> AppResult<Vec<SecurityEvent>> {
        execute_db_query(db, move |conn| {
            use crate::schema::security_events::dsl::*;
            security_events
                .order(created_at.desc())
                .limit(limit)
                .select(SecurityEvent::as_select())
                .load::<SecurityEvent>(conn)
        })
        .await
    }
}
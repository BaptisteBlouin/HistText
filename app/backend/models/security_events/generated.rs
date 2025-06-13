/* @generated and managed by dsync */

#[allow(unused)]
use crate::diesel::*;
use crate::models::users::Users;
use crate::schema::*;
use crate::models::common::*;

/// Struct representing a row in table `security_events`
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::Queryable, diesel::Selectable, diesel::QueryableByName, diesel::Associations, diesel::Identifiable)]
#[diesel(table_name=security_events, primary_key(id), belongs_to(Users, foreign_key=user_id))]
pub struct SecurityEvents {
    /// Field representing column `id`
    pub id: i32,
    /// Field representing column `event_type`
    pub event_type: String,
    /// Field representing column `user_id`
    pub user_id: Option<i32>,
    /// Field representing column `user_email`
    pub user_email: Option<String>,
    /// Field representing column `description`
    pub description: String,
    /// Field representing column `severity`
    pub severity: String,
    /// Field representing column `ip_address`
    pub ip_address: Option<String>,
    /// Field representing column `user_agent`
    pub user_agent: Option<String>,
    /// Field representing column `created_at`
    pub created_at: chrono::NaiveDateTime,
}

/// Create Struct for a row in table `security_events` for [`SecurityEvents`]
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::Insertable)]
#[diesel(table_name=security_events)]
pub struct CreateSecurityEvents {
    /// Field representing column `event_type`
    pub event_type: String,
    /// Field representing column `user_id`
    pub user_id: Option<i32>,
    /// Field representing column `user_email`
    pub user_email: Option<String>,
    /// Field representing column `description`
    pub description: String,
    /// Field representing column `severity`
    pub severity: String,
    /// Field representing column `ip_address`
    pub ip_address: Option<String>,
    /// Field representing column `user_agent`
    pub user_agent: Option<String>,
}

/// Update Struct for a row in table `security_events` for [`SecurityEvents`]
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::AsChangeset, PartialEq, Default)]
#[diesel(table_name=security_events)]
pub struct UpdateSecurityEvents {
    /// Field representing column `event_type`
    pub event_type: Option<String>,
    /// Field representing column `user_id`
    pub user_id: Option<Option<i32>>,
    /// Field representing column `user_email`
    pub user_email: Option<Option<String>>,
    /// Field representing column `description`
    pub description: Option<String>,
    /// Field representing column `severity`
    pub severity: Option<String>,
    /// Field representing column `ip_address`
    pub ip_address: Option<Option<String>>,
    /// Field representing column `user_agent`
    pub user_agent: Option<Option<String>>,
    /// Field representing column `created_at`
    pub created_at: Option<chrono::NaiveDateTime>,
}

impl SecurityEvents {
    /// Insert a new row into `security_events` with a given [`CreateSecurityEvents`]
    pub fn create(db: &mut ConnectionType, item: &CreateSecurityEvents) -> diesel::QueryResult<Self> {
        use crate::schema::security_events::dsl::*;

        diesel::insert_into(security_events).values(item).get_result::<Self>(db)
    }

    /// Get a row from `security_events`, identified by the primary key
    pub fn read(db: &mut ConnectionType, param_id: i32) -> diesel::QueryResult<Self> {
        use crate::schema::security_events::dsl::*;

        security_events.filter(id.eq(param_id)).first::<Self>(db)
    }

    /// Update a row in `security_events`, identified by the primary key with [`UpdateSecurityEvents`]
    pub fn update(db: &mut ConnectionType, param_id: i32, item: &UpdateSecurityEvents) -> diesel::QueryResult<Self> {
        use crate::schema::security_events::dsl::*;

        diesel::update(security_events.filter(id.eq(param_id))).set(item).get_result(db)
    }

    /// Delete a row in `security_events`, identified by the primary key
    pub fn delete(db: &mut ConnectionType, param_id: i32) -> diesel::QueryResult<usize> {
        use crate::schema::security_events::dsl::*;

        diesel::delete(security_events.filter(id.eq(param_id))).execute(db)
    }
}

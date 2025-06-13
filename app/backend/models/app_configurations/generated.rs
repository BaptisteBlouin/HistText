/* @generated and managed by dsync */

#[allow(unused)]
use crate::diesel::*;
use crate::schema::*;
use crate::models::common::*;

/// Struct representing a row in table `app_configurations`
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::Queryable, diesel::Selectable, diesel::QueryableByName, diesel::Identifiable)]
#[diesel(table_name=app_configurations, primary_key(id))]
pub struct AppConfigurations {
    /// Field representing column `id`
    pub id: i32,
    /// Field representing column `config_key`
    pub config_key: String,
    /// Field representing column `config_value`
    pub config_value: String,
    /// Field representing column `config_type`
    pub config_type: String,
    /// Field representing column `category`
    pub category: String,
    /// Field representing column `description`
    pub description: Option<String>,
    /// Field representing column `is_system`
    pub is_system: bool,
    /// Field representing column `created_at`
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Field representing column `updated_at`
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Create Struct for a row in table `app_configurations` for [`AppConfigurations`]
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::Insertable)]
#[diesel(table_name=app_configurations)]
pub struct CreateAppConfigurations {
    /// Field representing column `config_key`
    pub config_key: String,
    /// Field representing column `config_value`
    pub config_value: String,
    /// Field representing column `config_type`
    pub config_type: String,
    /// Field representing column `category`
    pub category: String,
    /// Field representing column `description`
    pub description: Option<String>,
    /// Field representing column `is_system`
    pub is_system: bool,
}

/// Update Struct for a row in table `app_configurations` for [`AppConfigurations`]
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::AsChangeset, PartialEq, Default)]
#[diesel(table_name=app_configurations)]
pub struct UpdateAppConfigurations {
    /// Field representing column `config_key`
    pub config_key: Option<String>,
    /// Field representing column `config_value`
    pub config_value: Option<String>,
    /// Field representing column `config_type`
    pub config_type: Option<String>,
    /// Field representing column `category`
    pub category: Option<String>,
    /// Field representing column `description`
    pub description: Option<Option<String>>,
    /// Field representing column `is_system`
    pub is_system: Option<bool>,
    /// Field representing column `created_at`
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Field representing column `updated_at`
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl AppConfigurations {
    /// Insert a new row into `app_configurations` with a given [`CreateAppConfigurations`]
    pub fn create(db: &mut ConnectionType, item: &CreateAppConfigurations) -> diesel::QueryResult<Self> {
        use crate::schema::app_configurations::dsl::*;

        diesel::insert_into(app_configurations).values(item).get_result::<Self>(db)
    }

    /// Get a row from `app_configurations`, identified by the primary key
    pub fn read(db: &mut ConnectionType, param_id: i32) -> diesel::QueryResult<Self> {
        use crate::schema::app_configurations::dsl::*;

        app_configurations.filter(id.eq(param_id)).first::<Self>(db)
    }

    /// Update a row in `app_configurations`, identified by the primary key with [`UpdateAppConfigurations`]
    pub fn update(db: &mut ConnectionType, param_id: i32, item: &UpdateAppConfigurations) -> diesel::QueryResult<Self> {
        use crate::schema::app_configurations::dsl::*;

        diesel::update(app_configurations.filter(id.eq(param_id))).set(item).get_result(db)
    }

    /// Delete a row in `app_configurations`, identified by the primary key
    pub fn delete(db: &mut ConnectionType, param_id: i32) -> diesel::QueryResult<usize> {
        use crate::schema::app_configurations::dsl::*;

        diesel::delete(app_configurations.filter(id.eq(param_id))).execute(db)
    }
}

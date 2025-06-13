/* @generated and managed by dsync */

#[allow(unused)]
use crate::diesel::*;
use crate::schema::*;
use crate::models::common::*;

/// Struct representing a row in table `_sqlx_migrations`
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::Queryable, diesel::Selectable, diesel::QueryableByName, diesel::Identifiable)]
#[diesel(table_name=_sqlx_migrations, primary_key(version))]
pub struct SqlxMigrations {
    /// Field representing column `version`
    pub version: i64,
    /// Field representing column `description`
    pub description: String,
    /// Field representing column `installed_on`
    pub installed_on: chrono::DateTime<chrono::Utc>,
    /// Field representing column `success`
    pub success: bool,
    /// Field representing column `checksum`
    pub checksum: Vec<u8>,
    /// Field representing column `execution_time`
    pub execution_time: i64,
}

/// Create Struct for a row in table `_sqlx_migrations` for [`SqlxMigrations`]
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::Insertable)]
#[diesel(table_name=_sqlx_migrations)]
pub struct CreateSqlxMigrations {
    /// Field representing column `version`
    pub version: i64,
    /// Field representing column `description`
    pub description: String,
    /// Field representing column `installed_on`
    pub installed_on: chrono::DateTime<chrono::Utc>,
    /// Field representing column `success`
    pub success: bool,
    /// Field representing column `checksum`
    pub checksum: Vec<u8>,
    /// Field representing column `execution_time`
    pub execution_time: i64,
}

/// Update Struct for a row in table `_sqlx_migrations` for [`SqlxMigrations`]
#[tsync::tsync]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, diesel::AsChangeset, PartialEq, Default)]
#[diesel(table_name=_sqlx_migrations)]
pub struct UpdateSqlxMigrations {
    /// Field representing column `description`
    pub description: Option<String>,
    /// Field representing column `installed_on`
    pub installed_on: Option<chrono::DateTime<chrono::Utc>>,
    /// Field representing column `success`
    pub success: Option<bool>,
    /// Field representing column `checksum`
    pub checksum: Option<Vec<u8>>,
    /// Field representing column `execution_time`
    pub execution_time: Option<i64>,
}

impl SqlxMigrations {
    /// Insert a new row into `_sqlx_migrations` with a given [`CreateSqlxMigrations`]
    pub fn create(db: &mut ConnectionType, item: &CreateSqlxMigrations) -> diesel::QueryResult<Self> {
        use crate::schema::_sqlx_migrations::dsl::*;

        diesel::insert_into(_sqlx_migrations).values(item).get_result::<Self>(db)
    }

    /// Get a row from `_sqlx_migrations`, identified by the primary key
    pub fn read(db: &mut ConnectionType, param_version: i64) -> diesel::QueryResult<Self> {
        use crate::schema::_sqlx_migrations::dsl::*;

        _sqlx_migrations.filter(version.eq(param_version)).first::<Self>(db)
    }

    /// Update a row in `_sqlx_migrations`, identified by the primary key with [`UpdateSqlxMigrations`]
    pub fn update(db: &mut ConnectionType, param_version: i64, item: &UpdateSqlxMigrations) -> diesel::QueryResult<Self> {
        use crate::schema::_sqlx_migrations::dsl::*;

        diesel::update(_sqlx_migrations.filter(version.eq(param_version))).set(item).get_result(db)
    }

    /// Delete a row in `_sqlx_migrations`, identified by the primary key
    pub fn delete(db: &mut ConnectionType, param_version: i64) -> diesel::QueryResult<usize> {
        use crate::schema::_sqlx_migrations::dsl::*;

        diesel::delete(_sqlx_migrations.filter(version.eq(param_version))).execute(db)
    }
}

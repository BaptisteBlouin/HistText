// Modified user_role.rs with correct imports

use diesel::QueryResult;
use serde::{Deserialize, Serialize};

use crate::auth::{Utc, ID};
use crate::schema::user_roles;
use crate::services::database::Connection;
use diesel::insert_into;
use diesel::prelude::*;

#[derive(
    Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Associations, AsChangeset,
)]
#[diesel(table_name = user_roles, belongs_to(crate::auth::models::user::User))]
pub struct UserRole {
    pub user_id: ID,
    pub role: String,
    pub created_at: Utc,
}

#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = user_roles)]
pub struct UserRoleChangeset {
    pub user_id: ID,
    pub role: String,
}

impl UserRole {
    pub fn create(db: &mut Connection, item: &UserRoleChangeset) -> QueryResult<Self> {
        use crate::schema::user_roles::dsl::user_roles;

        insert_into(user_roles).values(item).get_result::<Self>(db)
    }

    #[cfg(feature = "database_sqlite")]
    pub fn create_many(db: &mut Connection, items: Vec<UserRoleChangeset>) -> QueryResult<usize> {
        use crate::schema::user_roles::dsl::*;

        insert_into(user_roles).values(items).execute(db)
    }

    #[cfg(not(feature = "database_sqlite"))]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<UserRoleChangeset>,
    ) -> QueryResult<Vec<Self>> {
        use crate::schema::user_roles::dsl::user_roles;

        insert_into(user_roles)
            .values(items)
            .get_results::<Self>(db)
    }

    pub fn read(db: &mut Connection, item_user_id: ID, item_role: String) -> QueryResult<Self> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        user_roles
            .filter(user_id.eq(item_user_id).and(role.eq(item_role)))
            .first::<Self>(db)
    }

    pub fn read_all(db: &mut Connection, item_user_id: ID) -> QueryResult<Vec<Self>> {
        use crate::schema::user_roles::dsl::{created_at, user_id, user_roles};

        user_roles
            .filter(user_id.eq(item_user_id))
            .order(created_at)
            .load::<Self>(db)
    }

    pub fn read_all_roles(db: &mut Connection, item_user_id: ID) -> QueryResult<Vec<String>> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        user_roles
            .filter(user_id.eq(item_user_id))
            .select(role)
            .load::<String>(db)
    }

    pub fn delete(db: &mut Connection, item_user_id: ID, item_role: String) -> QueryResult<usize> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        diesel::delete(user_roles.filter(user_id.eq(item_user_id).and(role.eq(item_role))))
            .execute(db)
    }

    pub fn delete_many(
        db: &mut Connection,
        item_user_id: ID,
        item_roles: Vec<String>,
    ) -> QueryResult<usize> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        diesel::delete(user_roles.filter(user_id.eq(item_user_id).and(role.eq_any(item_roles))))
            .execute(db)
    }
}

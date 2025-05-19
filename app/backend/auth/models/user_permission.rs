// Modified user_permission.rs with correct imports

use diesel::QueryResult;
use serde::{Deserialize, Serialize};

use crate::schema::user_permissions;
use diesel::prelude::*;
use diesel::insert_into;
use crate::auth::{Utc, ID};
use crate::services::database::Connection;

#[derive(
    Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Associations, AsChangeset,
)]
#[diesel(table_name=user_permissions,belongs_to(crate::auth::models::user::User))]
pub struct UserPermission {
    pub user_id: ID,
    pub permission: String,
    pub created_at: Utc,
}

#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name=user_permissions)]
pub struct UserPermissionChangeset {
    pub user_id: ID,
    pub permission: String,
}

impl UserPermission {
    pub fn create(db: &mut Connection, item: &UserPermissionChangeset) -> QueryResult<Self> {
        use crate::schema::user_permissions::dsl::user_permissions;

        insert_into(user_permissions)
            .values(item)
            .get_result::<Self>(db)
    }

    #[cfg(feature = "database_sqlite")]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<UserPermissionChangeset>,
    ) -> QueryResult<usize> {
        use crate::schema::user_permissions::dsl::*;

        insert_into(user_permissions).values(items).execute(db)
    }

    #[cfg(not(feature = "database_sqlite"))]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<UserPermissionChangeset>,
    ) -> QueryResult<Self> {
        use crate::schema::user_permissions::dsl::user_permissions;

        insert_into(user_permissions)
            .values(items)
            .get_result::<Self>(db)
    }

    pub fn read(
        db: &mut Connection,
        item_user_id: ID,
        item_permission: String,
    ) -> QueryResult<Self> {
        use crate::schema::user_permissions::dsl::{permission, user_id, user_permissions};

        user_permissions
            .filter(user_id.eq(item_user_id).and(permission.eq(item_permission)))
            .first::<Self>(db)
    }

    pub fn read_all(db: &mut Connection, item_user_id: ID) -> QueryResult<Vec<Self>> {
        use crate::schema::user_permissions::dsl::{created_at, user_id, user_permissions};

        user_permissions
            .filter(user_id.eq(item_user_id))
            .order(created_at)
            .load::<Self>(db)
    }

    pub fn delete(
        db: &mut Connection,
        item_user_id: ID,
        item_permission: String,
    ) -> QueryResult<usize> {
        use crate::schema::user_permissions::dsl::{permission, user_id, user_permissions};

        diesel::delete(
            user_permissions.filter(user_id.eq(item_user_id).and(permission.eq(item_permission))),
        )
        .execute(db)
    }

    pub fn delete_many(
        db: &mut Connection,
        item_user_id: ID,
        item_permissions: Vec<String>,
    ) -> QueryResult<usize> {
        use crate::schema::user_permissions::dsl::{permission, user_id, user_permissions};

        diesel::delete(
            user_permissions
                .filter(user_id.eq(item_user_id))
                .filter(permission.eq_any(item_permissions)),
        )
        .execute(db)
    }

    pub fn delete_all(db: &mut Connection, item_user_id: ID) -> QueryResult<usize> {
        use crate::schema::user_permissions::dsl::{user_id, user_permissions};

        diesel::delete(user_permissions.filter(user_id.eq(item_user_id))).execute(db)
    }
}
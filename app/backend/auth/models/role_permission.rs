// auth/models/role_permission.rs

use serde::{Deserialize, Serialize};

use crate::auth::Utc;
use crate::schema::role_permissions;
use crate::services::database::Connection;
use diesel::insert_into;
use diesel::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable, AsChangeset)]
#[diesel(table_name = role_permissions)]
pub struct RolePermission {
    pub role: String,
    pub permission: String,
    pub created_at: Utc,
}

#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = role_permissions)]
pub struct RolePermissionChangeset {
    pub role: String,
    pub permission: String,
}

impl RolePermission {
    pub fn create(db: &mut Connection, item: &RolePermissionChangeset) -> QueryResult<Self> {
        use crate::schema::role_permissions::dsl::role_permissions;

        insert_into(role_permissions)
            .values(item)
            .get_result::<Self>(db)
    }

    #[cfg(feature = "database_sqlite")]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<RolePermissionChangeset>,
    ) -> QueryResult<usize> {
        use crate::schema::role_permissions::dsl::*;

        insert_into(role_permissions).values(items).execute(db)
    }

    #[cfg(not(feature = "database_sqlite"))]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<RolePermissionChangeset>,
    ) -> QueryResult<Vec<Self>> {
        use crate::schema::role_permissions::dsl::role_permissions;

        insert_into(role_permissions)
            .values(items)
            .get_results::<Self>(db)
    }

    pub fn read(
        db: &mut Connection,
        item_role: String,
        item_permission: String,
    ) -> QueryResult<Self> {
        use crate::schema::role_permissions::dsl::{permission, role, role_permissions};

        role_permissions
            .filter(role.eq(item_role).and(permission.eq(item_permission)))
            .first::<Self>(db)
    }

    pub fn read_all(db: &mut Connection, item_role: String) -> QueryResult<Vec<Self>> {
        use crate::schema::role_permissions::dsl::{created_at, role, role_permissions};

        role_permissions
            .filter(role.eq(item_role))
            .order(created_at)
            .load::<Self>(db)
    }

    pub fn delete(
        db: &mut Connection,
        item_role: String,
        item_permission: String,
    ) -> QueryResult<usize> {
        use crate::schema::role_permissions::dsl::{permission, role, role_permissions};

        diesel::delete(
            role_permissions.filter(role.eq(item_role).and(permission.eq(item_permission))),
        )
        .execute(db)
    }

    pub fn delete_many(
        db: &mut Connection,
        item_role: String,
        item_permissions: Vec<String>,
    ) -> QueryResult<usize> {
        use crate::schema::role_permissions::dsl::{permission, role, role_permissions};

        diesel::delete(
            role_permissions
                .filter(role.eq(item_role))
                .filter(permission.eq_any(item_permissions)),
        )
        .execute(db)
    }

    pub fn delete_all(db: &mut Connection, item_role: &str) -> QueryResult<usize> {
        use crate::schema::role_permissions::dsl::{role, role_permissions};

        diesel::delete(role_permissions.filter(role.eq(item_role))).execute(db)
    }
}

// Modified permission.rs with correct imports

use crate::auth::ID;
use crate::auth::models::user_permission::UserPermission;
use crate::auth::models::role_permission::RolePermission;
use crate::services::database::Connection;
use anyhow::Result;
use diesel::{
    sql_query,
    sql_types::{Integer, Text},
    RunQueryDsl,
};
use diesel::QueryableByName;
use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};

#[derive(Debug, Serialize, Deserialize, QueryableByName, Clone)]
pub struct Permission {
    #[diesel(sql_type=Text)]
    pub from_role: String,

    #[diesel(sql_type=Text)]
    pub permission: String,
}

impl Hash for Permission {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.permission.as_str().hash(state);
    }
}

impl PartialEq for Permission {
    fn eq(&self, other: &Self) -> bool {
        self.permission.eq(&other.permission)
    }
}
impl Eq for Permission {}

impl Permission {
    pub fn grant_to_user(db: &mut Connection, user_id: ID, permission: &str) -> Result<()> {
        let _granted = UserPermission::create(
            db,
            &crate::auth::models::user_permission::UserPermissionChangeset {
                permission: permission.to_string(),
                user_id,
            },
        )?;

        Ok(())
    }

    pub fn grant_to_role(db: &mut Connection, role: &str, permission: &str) -> Result<()> {
        let _granted = RolePermission::create(
            db,
            &crate::auth::models::role_permission::RolePermissionChangeset {
                permission: permission.to_string(),
                role: role.to_string(),
            },
        )?;

        Ok(())
    }

    pub fn grant_many_to_role(
        db: &mut Connection,
        role: String,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _granted = RolePermission::create_many(
            db,
            permissions
                .into_iter()
                .map(|permission| crate::auth::models::role_permission::RolePermissionChangeset {
                    permission,
                    role: role.clone(),
                })
                .collect::<Vec<_>>(),
        )?;

        Ok(())
    }

    pub fn grant_many_to_user(
        db: &mut Connection,
        user_id: i32,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _granted = UserPermission::create_many(
            db,
            permissions
                .into_iter()
                .map(|permission| crate::auth::models::user_permission::UserPermissionChangeset {
                    user_id,
                    permission,
                })
                .collect::<Vec<_>>(),
        )?;

        Ok(())
    }

    pub fn revoke_from_user(db: &mut Connection, user_id: ID, permission: &str) -> Result<()> {
        let _deleted = UserPermission::delete(db, user_id, permission.to_string())?;

        Ok(())
    }

    pub fn revoke_from_role(db: &mut Connection, role: String, permission: String) -> Result<()> {
        let _deleted = RolePermission::delete(db, role, permission)?;

        Ok(())
    }

    pub fn revoke_many_from_user(
        db: &mut Connection,
        user_id: ID,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _deleted = UserPermission::delete_many(db, user_id, permissions)?;

        Ok(())
    }

    pub fn revoke_many_from_role(
        db: &mut Connection,
        role: String,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _deleted = RolePermission::delete_many(db, role, permissions)?;

        Ok(())
    }

    pub fn revoke_all_from_role(db: &mut Connection, role: &str) -> Result<()> {
        let _deleted = RolePermission::delete_all(db, role)?;

        Ok(())
    }

    pub fn revoke_all_from_user(db: &mut Connection, user_id: i32) -> Result<()> {
        let _deleted = UserPermission::delete_all(db, user_id)?;

        Ok(())
    }

    pub fn fetch_all(db: &mut Connection, user_id: ID) -> Result<Vec<Self>> {
        let permissions = sql_query(
            r"
        SELECT
            permission AS permission,
            user_roles.role AS from_role
        FROM user_roles
        INNER JOIN role_permissions ON user_roles.role = role_permissions.role
        WHERE user_roles.user_id = $1
      ",
        );

        let permissions = permissions
            .bind::<Integer, _>(user_id)
            .get_results::<Self>(db)?;

        Ok(permissions)
    }
}
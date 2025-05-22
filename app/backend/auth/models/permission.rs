//! Permission management model for role-based access control.
//!
//! Features:
//! - User and role-based permission management
//! - Batch permission operations for efficiency
//! - Permission granting and revocation operations
//! - Database integration with Diesel ORM and raw SQL queries
//! - Hash and equality implementations for set operations
//! - Comprehensive CRUD operations for permissions

use crate::auth::models::role_permission::RolePermission;
use crate::auth::models::user_permission::UserPermission;
use crate::auth::ID;
use crate::services::database::Connection;
use anyhow::Result;
use diesel::QueryableByName;
use diesel::{
    sql_query,
    sql_types::{Integer, Text},
    RunQueryDsl,
};
use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};

/// Permission entity representing a specific access right
///
/// Contains both the permission name and the role it originates from,
/// enabling comprehensive permission tracking across the system.
#[derive(Debug, Serialize, Deserialize, QueryableByName, Clone)]
pub struct Permission {
    /// Role that grants this permission
    #[diesel(sql_type = Text)]
    pub from_role: String,
    /// Permission identifier
    #[diesel(sql_type = Text)]
    pub permission: String,
}

impl Hash for Permission {
    /// Hash implementation based on permission name only
    ///
    /// This allows permissions from different roles to be treated as
    /// equivalent when checking for access rights.
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.permission.as_str().hash(state);
    }
}

impl PartialEq for Permission {
    /// Equality comparison based on permission name only
    ///
    /// Permissions are considered equal if they have the same name,
    /// regardless of which role grants them.
    fn eq(&self, other: &Self) -> bool {
        self.permission.eq(&other.permission)
    }
}

impl Eq for Permission {}

impl Permission {
    /// Grants a permission directly to a user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to grant permission to
    /// * `permission` - Permission name to grant
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// Permission::grant_to_user(&mut db, 1, "user:read")?;
    /// ```
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

    /// Grants a permission to a role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role` - Role name to grant permission to
    /// * `permission` - Permission name to grant
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// Permission::grant_to_role(&mut db, "admin", "user:write")?;
    /// ```
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

    /// Grants multiple permissions to a role in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role` - Role name to grant permissions to
    /// * `permissions` - Vector of permission names to grant
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// let perms = vec!["user:read".to_string(), "user:write".to_string()];
    /// Permission::grant_many_to_role(&mut db, "editor".to_string(), perms)?;
    /// ```
    pub fn grant_many_to_role(
        db: &mut Connection,
        role: String,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _granted = RolePermission::create_many(
            db,
            permissions
                .into_iter()
                .map(
                    |permission| crate::auth::models::role_permission::RolePermissionChangeset {
                        permission,
                        role: role.clone(),
                    },
                )
                .collect::<Vec<_>>(),
        )?;

        Ok(())
    }

    /// Grants multiple permissions directly to a user in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to grant permissions to
    /// * `permissions` - Vector of permission names to grant
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// let perms = vec!["admin:read".to_string(), "admin:write".to_string()];
    /// Permission::grant_many_to_user(&mut db, 1, perms)?;
    /// ```
    pub fn grant_many_to_user(
        db: &mut Connection,
        user_id: i32,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _granted = UserPermission::create_many(
            db,
            permissions
                .into_iter()
                .map(
                    |permission| crate::auth::models::user_permission::UserPermissionChangeset {
                        user_id,
                        permission,
                    },
                )
                .collect::<Vec<_>>(),
        )?;

        Ok(())
    }

    /// Revokes a permission directly from a user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to revoke permission from
    /// * `permission` - Permission name to revoke
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// Permission::revoke_from_user(&mut db, 1, "user:delete")?;
    /// ```
    pub fn revoke_from_user(db: &mut Connection, user_id: ID, permission: &str) -> Result<()> {
        let _deleted = UserPermission::delete(db, user_id, permission.to_string())?;

        Ok(())
    }

    /// Revokes a permission from a role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role` - Role name to revoke permission from
    /// * `permission` - Permission name to revoke
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// Permission::revoke_from_role(&mut db, "guest".to_string(), "admin:write".to_string())?;
    /// ```
    pub fn revoke_from_role(db: &mut Connection, role: String, permission: String) -> Result<()> {
        let _deleted = RolePermission::delete(db, role, permission)?;

        Ok(())
    }

    /// Revokes multiple permissions from a user in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to revoke permissions from
    /// * `permissions` - Vector of permission names to revoke
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// let perms = vec!["temp:read".to_string(), "temp:write".to_string()];
    /// Permission::revoke_many_from_user(&mut db, 1, perms)?;
    /// ```
    pub fn revoke_many_from_user(
        db: &mut Connection,
        user_id: ID,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _deleted = UserPermission::delete_many(db, user_id, permissions)?;

        Ok(())
    }

    /// Revokes multiple permissions from a role in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role` - Role name to revoke permissions from
    /// * `permissions` - Vector of permission names to revoke
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// let perms = vec!["old:read".to_string(), "old:write".to_string()];
    /// Permission::revoke_many_from_role(&mut db, "deprecated".to_string(), perms)?;
    /// ```
    pub fn revoke_many_from_role(
        db: &mut Connection,
        role: String,
        permissions: Vec<String>,
    ) -> Result<()> {
        let _deleted = RolePermission::delete_many(db, role, permissions)?;

        Ok(())
    }

    /// Revokes all permissions from a role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role` - Role name to revoke all permissions from
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// Permission::revoke_all_from_role(&mut db, "temp_role")?;
    /// ```
    pub fn revoke_all_from_role(db: &mut Connection, role: &str) -> Result<()> {
        let _deleted = RolePermission::delete_all(db, role)?;

        Ok(())
    }

    /// Revokes all permissions directly granted to a user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to revoke all permissions from
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// Permission::revoke_all_from_user(&mut db, 1)?;
    /// ```
    pub fn revoke_all_from_user(db: &mut Connection, user_id: i32) -> Result<()> {
        let _deleted = UserPermission::delete_all(db, user_id)?;

        Ok(())
    }

    /// Retrieves all permissions for a user from their roles
    ///
    /// Uses a SQL query to join user roles with role permissions,
    /// providing a complete view of all permissions granted to the user.
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to fetch permissions for
    ///
    /// # Returns
    /// Result containing vector of permissions with their originating roles
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::permission::Permission;
    /// 
    /// let mut db = get_connection();
    /// let permissions = Permission::fetch_all(&mut db, 1)?;
    /// for perm in permissions {
    ///     println!("Permission: {} from role: {}", perm.permission, perm.from_role);
    /// }
    /// ```
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
//! Role-permission relationship model for managing role-based access control.
//!
//! Features:
//! - Role-permission association management
//! - Batch operations for efficient permission assignment
//! - Database integration with Diesel ORM
//! - CRUD operations for role permissions
//! - Cross-database compatibility with SQLite and PostgreSQL
//! - Timestamped permission tracking

use crate::auth::Utc;
use crate::schema::role_permissions;
use crate::services::database::Connection;
use diesel::insert_into;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

/// Role permission entity representing the association between roles and permissions
#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable, AsChangeset)]
#[diesel(table_name = role_permissions)]
pub struct RolePermission {
    /// Role name
    pub role: String,
    /// Permission identifier
    pub permission: String,
    /// Timestamp when permission was granted to role
    pub created_at: Utc,
}

/// Changeset for creating or updating role permissions
#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = role_permissions)]
pub struct RolePermissionChangeset {
    /// Role name
    pub role: String,
    /// Permission identifier
    pub permission: String,
}

impl RolePermission {
    /// Creates a new role-permission association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - Role permission changeset with role and permission data
    ///
    /// # Returns
    /// Result containing the created role permission or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role_permission::{RolePermission, RolePermissionChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = RolePermissionChangeset {
    ///     role: "admin".to_string(),
    ///     permission: "user:write".to_string(),
    /// };
    /// let role_perm = RolePermission::create(&mut db, &changeset)?;
    /// ```
    pub fn create(db: &mut Connection, item: &RolePermissionChangeset) -> QueryResult<Self> {
        use crate::schema::role_permissions::dsl::role_permissions;

        insert_into(role_permissions)
            .values(item)
            .get_result::<Self>(db)
    }

    /// Creates multiple role-permission associations in batch (SQLite)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `items` - Vector of role permission changesets
    ///
    /// # Returns
    /// Result containing number of created associations or database error
    #[cfg(feature = "database_sqlite")]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<RolePermissionChangeset>,
    ) -> QueryResult<usize> {
        use crate::schema::role_permissions::dsl::*;

        insert_into(role_permissions).values(items).execute(db)
    }

    /// Creates multiple role-permission associations in batch (PostgreSQL)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `items` - Vector of role permission changesets
    ///
    /// # Returns
    /// Result containing vector of created associations or database error
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

    /// Retrieves a specific role-permission association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_role` - Role name to search for
    /// * `item_permission` - Permission name to search for
    ///
    /// # Returns
    /// Result containing the role permission or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role_permission::RolePermission;
    /// 
    /// let mut db = get_connection();
    /// let role_perm = RolePermission::read(&mut db, "admin".to_string(), "user:read".to_string())?;
    /// ```
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

    /// Retrieves all permissions for a specific role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_role` - Role name to fetch permissions for
    ///
    /// # Returns
    /// Result containing vector of role permissions ordered by creation time
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role_permission::RolePermission;
    /// 
    /// let mut db = get_connection();
    /// let permissions = RolePermission::read_all(&mut db, "admin".to_string())?;
    /// for perm in permissions {
    ///     println!("Admin has permission: {}", perm.permission);
    /// }
    /// ```
    pub fn read_all(db: &mut Connection, item_role: String) -> QueryResult<Vec<Self>> {
        use crate::schema::role_permissions::dsl::{created_at, role, role_permissions};

        role_permissions
            .filter(role.eq(item_role))
            .order(created_at)
            .load::<Self>(db)
    }

    /// Deletes a specific role-permission association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_role` - Role name
    /// * `item_permission` - Permission name
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role_permission::RolePermission;
    /// 
    /// let mut db = get_connection();
    /// let deleted = RolePermission::delete(&mut db, "guest".to_string(), "admin:write".to_string())?;
    /// println!("Deleted {} permission associations", deleted);
    /// ```
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

    /// Deletes multiple role-permission associations in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_role` - Role name
    /// * `item_permissions` - Vector of permission names to delete
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role_permission::RolePermission;
    /// 
    /// let mut db = get_connection();
    /// let perms = vec!["temp:read".to_string(), "temp:write".to_string()];
    /// let deleted = RolePermission::delete_many(&mut db, "temp_role".to_string(), perms)?;
    /// println!("Deleted {} permission associations", deleted);
    /// ```
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

    /// Deletes all permissions for a specific role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_role` - Role name to remove all permissions from
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role_permission::RolePermission;
    /// 
    /// let mut db = get_connection();
    /// let deleted = RolePermission::delete_all(&mut db, "deprecated_role")?;
    /// println!("Removed {} permissions from role", deleted);
    /// ```
    pub fn delete_all(db: &mut Connection, item_role: &str) -> QueryResult<usize> {
        use crate::schema::role_permissions::dsl::{role, role_permissions};

        diesel::delete(role_permissions.filter(role.eq(item_role))).execute(db)
    }
}
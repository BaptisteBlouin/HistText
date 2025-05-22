//! User-permission relationship model for managing direct user permissions.
//!
//! Features:
//! - Direct user permission assignment and management
//! - Batch operations for efficient permission handling
//! - Database integration with Diesel ORM
//! - CRUD operations for user-specific permissions
//! - Cross-database compatibility with SQLite and PostgreSQL
//! - Timestamped permission tracking
//! - User association through foreign key relationships

use crate::auth::{Utc, ID};
use crate::schema::user_permissions;
use crate::services::database::Connection;
use diesel::insert_into;
use diesel::prelude::*;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};

/// User permission entity representing direct permission grants to users
///
/// This allows for user-specific permissions that bypass role-based access,
/// providing fine-grained control over individual user capabilities.
#[derive(
    Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Associations, AsChangeset,
)]
#[diesel(table_name = user_permissions, belongs_to(crate::auth::models::user::User))]
pub struct UserPermission {
    /// User ID this permission is granted to
    pub user_id: ID,
    /// Permission identifier
    pub permission: String,
    /// Timestamp when permission was granted to user
    pub created_at: Utc,
}

/// Changeset for creating or updating user permissions
#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = user_permissions)]
pub struct UserPermissionChangeset {
    /// User ID to grant permission to
    pub user_id: ID,
    /// Permission identifier
    pub permission: String,
}

impl UserPermission {
    /// Creates a new user-permission association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - User permission changeset with user ID and permission data
    ///
    /// # Returns
    /// Result containing the created user permission or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_permission::{UserPermission, UserPermissionChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = UserPermissionChangeset {
    ///     user_id: 1,
    ///     permission: "special:access".to_string(),
    /// };
    /// let user_perm = UserPermission::create(&mut db, &changeset)?;
    /// ```
    pub fn create(db: &mut Connection, item: &UserPermissionChangeset) -> QueryResult<Self> {
        use crate::schema::user_permissions::dsl::user_permissions;

        insert_into(user_permissions)
            .values(item)
            .get_result::<Self>(db)
    }

    /// Creates multiple user-permission associations in batch (SQLite)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `items` - Vector of user permission changesets
    ///
    /// # Returns
    /// Result containing number of created associations or database error
    #[cfg(feature = "database_sqlite")]
    pub fn create_many(
        db: &mut Connection,
        items: Vec<UserPermissionChangeset>,
    ) -> QueryResult<usize> {
        use crate::schema::user_permissions::dsl::*;

        insert_into(user_permissions).values(items).execute(db)
    }

    /// Creates multiple user-permission associations in batch (PostgreSQL)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `items` - Vector of user permission changesets
    ///
    /// # Returns
    /// Result containing the created user permission or database error
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

    /// Retrieves a specific user-permission association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to search for
    /// * `item_permission` - Permission name to search for
    ///
    /// # Returns
    /// Result containing the user permission or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_permission::UserPermission;
    /// 
    /// let mut db = get_connection();
    /// let user_perm = UserPermission::read(&mut db, 1, "admin:override".to_string())?;
    /// ```
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

    /// Retrieves all direct permissions for a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to fetch permissions for
    ///
    /// # Returns
    /// Result containing vector of user permissions ordered by creation time
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_permission::UserPermission;
    /// 
    /// let mut db = get_connection();
    /// let permissions = UserPermission::read_all(&mut db, 1)?;
    /// for perm in permissions {
    ///     println!("User has direct permission: {}", perm.permission);
    /// }
    /// ```
    pub fn read_all(db: &mut Connection, item_user_id: ID) -> QueryResult<Vec<Self>> {
        use crate::schema::user_permissions::dsl::{created_at, user_id, user_permissions};

        user_permissions
            .filter(user_id.eq(item_user_id))
            .order(created_at)
            .load::<Self>(db)
    }

    /// Deletes a specific user-permission association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID
    /// * `item_permission` - Permission name
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_permission::UserPermission;
    /// 
    /// let mut db = get_connection();
    /// let deleted = UserPermission::delete(&mut db, 1, "temp:access".to_string())?;
    /// println!("Deleted {} permission associations", deleted);
    /// ```
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

    /// Deletes multiple user-permission associations in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID
    /// * `item_permissions` - Vector of permission names to delete
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_permission::UserPermission;
    /// 
    /// let mut db = get_connection();
    /// let perms = vec!["temp:read".to_string(), "temp:write".to_string()];
    /// let deleted = UserPermission::delete_many(&mut db, 1, perms)?;
    /// println!("Deleted {} permission associations", deleted);
    /// ```
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

    /// Deletes all direct permissions for a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to remove all permissions from
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_permission::UserPermission;
    /// 
    /// let mut db = get_connection();
    /// let deleted = UserPermission::delete_all(&mut db, 1)?;
    /// println!("Removed {} direct permissions from user", deleted);
    /// ```
    pub fn delete_all(db: &mut Connection, item_user_id: ID) -> QueryResult<usize> {
        use crate::schema::user_permissions::dsl::{user_id, user_permissions};

        diesel::delete(user_permissions.filter(user_id.eq(item_user_id))).execute(db)
    }
}
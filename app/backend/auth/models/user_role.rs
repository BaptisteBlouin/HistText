//! User-role relationship model for managing role assignments.
//!
//! Features:
//! - User role assignment and management
//! - Batch operations for efficient role handling
//! - Database integration with Diesel ORM
//! - CRUD operations for user-role associations
//! - Cross-database compatibility with SQLite and PostgreSQL
//! - Timestamped role assignment tracking
//! - User association through foreign key relationships

use crate::auth::{Utc, ID};
use crate::schema::user_roles;
use crate::services::database::Connection;
use diesel::insert_into;
use diesel::prelude::*;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};

/// User role entity representing role assignments to users
///
/// This establishes the many-to-many relationship between users and roles,
/// enabling role-based access control throughout the system.
#[derive(
    Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Associations, AsChangeset,
)]
#[diesel(table_name = user_roles, belongs_to(crate::auth::models::user::User))]
pub struct UserRole {
    /// User ID this role is assigned to
    pub user_id: ID,
    /// Role identifier
    pub role: String,
    /// Timestamp when role was assigned to user
    pub created_at: Utc,
}

/// Changeset for creating or updating user roles
#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = user_roles)]
pub struct UserRoleChangeset {
    /// User ID to assign role to
    pub user_id: ID,
    /// Role identifier
    pub role: String,
}

impl UserRole {
    /// Creates a new user-role association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - User role changeset with user ID and role data
    ///
    /// # Returns
    /// Result containing the created user role or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_role::{UserRole, UserRoleChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = UserRoleChangeset {
    ///     user_id: 1,
    ///     role: "admin".to_string(),
    /// };
    /// let user_role = UserRole::create(&mut db, &changeset)?;
    /// ```
    pub fn create(db: &mut Connection, item: &UserRoleChangeset) -> QueryResult<Self> {
        use crate::schema::user_roles::dsl::user_roles;

        insert_into(user_roles).values(item).get_result::<Self>(db)
    }

    /// Creates multiple user-role associations in batch (SQLite)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `items` - Vector of user role changesets
    ///
    /// # Returns
    /// Result containing number of created associations or database error
    #[cfg(feature = "database_sqlite")]
    pub fn create_many(db: &mut Connection, items: Vec<UserRoleChangeset>) -> QueryResult<usize> {
        use crate::schema::user_roles::dsl::*;

        insert_into(user_roles).values(items).execute(db)
    }

    /// Creates multiple user-role associations in batch (PostgreSQL)
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `items` - Vector of user role changesets
    ///
    /// # Returns
    /// Result containing vector of created associations or database error
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

    /// Retrieves a specific user-role association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to search for
    /// * `item_role` - Role name to search for
    ///
    /// # Returns
    /// Result containing the user role or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_role::UserRole;
    /// 
    /// let mut db = get_connection();
    /// let user_role = UserRole::read(&mut db, 1, "admin".to_string())?;
    /// ```
    pub fn read(db: &mut Connection, item_user_id: ID, item_role: String) -> QueryResult<Self> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        user_roles
            .filter(user_id.eq(item_user_id).and(role.eq(item_role)))
            .first::<Self>(db)
    }

    /// Retrieves all role assignments for a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to fetch roles for
    ///
    /// # Returns
    /// Result containing vector of user roles ordered by creation time
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_role::UserRole;
    /// 
    /// let mut db = get_connection();
    /// let roles = UserRole::read_all(&mut db, 1)?;
    /// for role in roles {
    ///     println!("User has role: {} assigned at {}", role.role, role.created_at);
    /// }
    /// ```
    pub fn read_all(db: &mut Connection, item_user_id: ID) -> QueryResult<Vec<Self>> {
        use crate::schema::user_roles::dsl::{created_at, user_id, user_roles};

        user_roles
            .filter(user_id.eq(item_user_id))
            .order(created_at)
            .load::<Self>(db)
    }

    /// Retrieves all role names for a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to fetch role names for
    ///
    /// # Returns
    /// Result containing vector of role names assigned to the user
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_role::UserRole;
    /// 
    /// let mut db = get_connection();
    /// let role_names = UserRole::read_all_roles(&mut db, 1)?;
    /// for role_name in role_names {
    ///     println!("User has role: {}", role_name);
    /// }
    /// ```
    pub fn read_all_roles(db: &mut Connection, item_user_id: ID) -> QueryResult<Vec<String>> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        user_roles
            .filter(user_id.eq(item_user_id))
            .select(role)
            .load::<String>(db)
    }

    /// Deletes a specific user-role association
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID
    /// * `item_role` - Role name
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_role::UserRole;
    /// 
    /// let mut db = get_connection();
    /// let deleted = UserRole::delete(&mut db, 1, "guest".to_string())?;
    /// println!("Deleted {} role assignments", deleted);
    /// ```
    pub fn delete(db: &mut Connection, item_user_id: ID, item_role: String) -> QueryResult<usize> {
        use crate::schema::user_roles::dsl::{role, user_id, user_roles};

        diesel::delete(user_roles.filter(user_id.eq(item_user_id).and(role.eq(item_role))))
            .execute(db)
    }

    /// Deletes multiple user-role associations in batch
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID
    /// * `item_roles` - Vector of role names to delete
    ///
    /// # Returns
    /// Result containing number of deleted associations or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_role::UserRole;
    /// 
    /// let mut db = get_connection();
    /// let roles = vec!["temp".to_string(), "guest".to_string()];
    /// let deleted = UserRole::delete_many(&mut db, 1, roles)?;
    /// println!("Deleted {} role assignments", deleted);
    /// ```
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
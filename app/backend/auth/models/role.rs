//! Role management model for user role-based access control.
//!
//! Features:
//! - User role retrieval and validation
//! - Role existence checking for validation
//! - User lookup by role assignment
//! - Database integration with Diesel ORM
//! - Efficient querying with optimized database operations

use crate::auth::models::user_role::UserRole;
use crate::auth::ID;
use crate::services::database::Connection;
use diesel::QueryResult;

/// Role entity for managing user roles and role-based operations
pub struct Role;

impl Role {
    /// Retrieves all roles assigned to a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to fetch roles for
    ///
    /// # Returns
    /// Result containing vector of role names assigned to the user
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role::Role;
    /// 
    /// let mut db = get_connection();
    /// let roles = Role::fetch_all(&mut db, 1)?;
    /// println!("User roles: {:?}", roles);
    /// ```
    pub fn fetch_all(db: &mut Connection, user_id: ID) -> QueryResult<Vec<String>> {
        UserRole::read_all_roles(db, user_id)
    }

    /// Checks if a role exists in the system
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role_name` - Name of the role to check
    ///
    /// # Returns
    /// Result containing boolean indicating if the role exists
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role::Role;
    /// 
    /// let mut db = get_connection();
    /// let exists = Role::exists(&mut db, "admin")?;
    /// if exists {
    ///     println!("Admin role exists");
    /// }
    /// ```
    #[allow(dead_code)]
    pub fn exists(db: &mut Connection, role_name: &str) -> QueryResult<bool> {
        use crate::schema::user_roles::dsl::*;
        use diesel::dsl::count;
        use diesel::prelude::*;

        let count_result: i64 = user_roles
            .filter(role.eq(role_name))
            .select(count(role))
            .first(db)?;

        Ok(count_result > 0)
    }

    /// Finds all users assigned to a specific role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role_name` - Role to search for
    ///
    /// # Returns
    /// Result containing vector of user IDs with the specified role
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::role::Role;
    /// 
    /// let mut db = get_connection();
    /// let admin_users = Role::find_users_with_role(&mut db, "admin")?;
    /// println!("Admin users: {:?}", admin_users);
    /// ```
    #[allow(dead_code)]
    pub fn find_users_with_role(db: &mut Connection, role_name: &str) -> QueryResult<Vec<ID>> {
        use crate::schema::user_roles::dsl::*;
        use diesel::prelude::*;

        user_roles
            .filter(role.eq(role_name))
            .select(user_id)
            .load::<ID>(db)
    }
}
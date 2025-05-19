// backend/auth/models/role.rs

use crate::auth::ID;
use crate::auth::models::user_role::UserRole;
use crate::services::database::Connection;
use diesel::QueryResult;

/// Role entity for managing user roles
pub struct Role;

impl Role {
    /// Fetch all roles for a user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `user_id` - User ID to fetch roles for
    ///
    /// # Returns
    /// List of roles assigned to the user
    pub fn fetch_all(db: &mut Connection, user_id: ID) -> QueryResult<Vec<String>> {
        UserRole::read_all_roles(db, user_id)
    }
    
    /// Check if a role exists
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role_name` - Name of the role to check
    ///
    /// # Returns
    /// Boolean indicating if the role exists
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
    
    /// Find all users with a specific role
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `role_name` - Role to search for
    ///
    /// # Returns
    /// List of user IDs with the specified role
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
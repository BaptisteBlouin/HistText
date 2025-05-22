//! User model for managing user accounts and authentication data.
//!
//! Features:
//! - User account creation and management
//! - Email-based user lookup for authentication
//! - Paginated user retrieval for administration
//! - Password hashing storage with Argon2
//! - Account activation status tracking
//! - Cross-database compatibility with SQLite and PostgreSQL
//! - Timestamped user tracking with creation and update times
//! - CRUD operations for complete user lifecycle management

use crate::auth::{PaginationParams, Utc, ID};
use crate::schema::users;
use crate::services::database::Connection;
use diesel::prelude::*;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};

/// User entity representing a system user account
///
/// Contains all essential user information including authentication
/// credentials, personal details, and account status.
#[derive(
    Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Identifiable, AsChangeset,
)]
#[diesel(table_name = users)]
pub struct User {
    /// User ID
    pub id: ID,
    /// User email address (unique identifier)
    pub email: String,
    /// Argon2 hashed password
    pub hash_password: String,
    /// User first name
    pub firstname: String,
    /// User last name
    pub lastname: String,
    /// Account activation status
    pub activated: bool,
    /// Timestamp when user account was created
    pub created_at: Utc,
    /// Timestamp when user account was last updated (PostgreSQL only)
    #[cfg(not(feature = "database_sqlite"))]
    pub updated_at: Utc,
}

/// Changeset for creating or updating user accounts
#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = users)]
pub struct UserChangeset {
    /// User email address
    pub email: String,
    /// Hashed password
    pub hash_password: String,
    /// User first name
    pub firstname: String,
    /// User last name
    pub lastname: String,
    /// Account activation status
    pub activated: bool,
}

impl User {
    /// Creates a new user account
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - User changeset with account data
    ///
    /// # Returns
    /// Result containing the created user or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user::{User, UserChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = UserChangeset {
    ///     email: "user@example.com".to_string(),
    ///     hash_password: "hashed_password".to_string(),
    ///     firstname: "John".to_string(),
    ///     lastname: "Doe".to_string(),
    ///     activated: false,
    /// };
    /// let user = User::create(&mut db, &changeset)?;
    /// ```
    pub fn create(db: &mut Connection, item: &UserChangeset) -> QueryResult<Self> {
        use crate::schema::users::dsl::users;

        diesel::insert_into(users)
            .values(item)
            .get_result::<Self>(db)
    }

    /// Retrieves a user by ID
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_id` - User ID to retrieve
    ///
    /// # Returns
    /// Result containing the user or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user::User;
    /// 
    /// let mut db = get_connection();
    /// let user = User::read(&mut db, 1)?;
    /// println!("User: {} {}", user.firstname, user.lastname);
    /// ```
    pub fn read(db: &mut Connection, item_id: ID) -> QueryResult<Self> {
        use crate::schema::users::dsl::{id, users};

        users.filter(id.eq(item_id)).first::<Self>(db)
    }

    /// Finds a user by email address
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_email` - Email address to search for
    ///
    /// # Returns
    /// Result containing the user or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user::User;
    /// 
    /// let mut db = get_connection();
    /// let user = User::find_by_email(&mut db, "user@example.com".to_string())?;
    /// println!("Found user: {}", user.email);
    /// ```
    pub fn find_by_email(db: &mut Connection, item_email: String) -> QueryResult<Self> {
        use crate::schema::users::dsl::{email, users};

        users.filter(email.eq(item_email)).first::<Self>(db)
    }

    /// Retrieves paginated list of all users
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `pagination` - Pagination parameters (page and page size)
    ///
    /// # Returns
    /// Result containing vector of users or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user::User;
    /// use crate::auth::PaginationParams;
    /// 
    /// let mut db = get_connection();
    /// let pagination = PaginationParams { page: 0, page_size: 10 };
    /// let users = User::read_all(&mut db, &pagination)?;
    /// for user in users {
    ///     println!("User: {} ({})", user.email, user.activated);
    /// }
    /// ```
    pub fn read_all(db: &mut Connection, pagination: &PaginationParams) -> QueryResult<Vec<Self>> {
        use crate::schema::users::dsl::{created_at, users};

        users
            .order(created_at)
            .limit(pagination.page_size)
            .offset(
                pagination.page
                    * std::cmp::max(
                        pagination.page_size,
                        i64::from(PaginationParams::MAX_PAGE_SIZE),
                    ),
            )
            .load::<Self>(db)
    }

    /// Updates an existing user account
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_id` - User ID to update
    /// * `item` - User changeset with updated data
    ///
    /// # Returns
    /// Result containing the updated user or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user::{User, UserChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = UserChangeset {
    ///     email: "updated@example.com".to_string(),
    ///     hash_password: "new_hashed_password".to_string(),
    ///     firstname: "Jane".to_string(),
    ///     lastname: "Smith".to_string(),
    ///     activated: true,
    /// };
    /// let updated_user = User::update(&mut db, 1, &changeset)?;
    /// ```
    pub fn update(db: &mut Connection, item_id: ID, item: &UserChangeset) -> QueryResult<Self> {
        use crate::schema::users::dsl::{id, users};

        diesel::update(users.filter(id.eq(item_id)))
            .set(item)
            .get_result(db)
    }

    /// Deletes a user account
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_id` - User ID to delete
    ///
    /// # Returns
    /// Result containing number of deleted users or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user::User;
    /// 
    /// let mut db = get_connection();
    /// let deleted = User::delete(&mut db, 1)?;
    /// println!("Deleted {} user account", deleted);
    /// ```
    pub fn delete(db: &mut Connection, item_id: ID) -> QueryResult<usize> {
        use crate::schema::users::dsl::{id, users};

        diesel::delete(users.filter(id.eq(item_id))).execute(db)
    }
}
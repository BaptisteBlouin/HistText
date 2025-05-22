//! User session model for managing authentication sessions.
//!
//! Features:
//! - JWT refresh token storage and management
//! - Device-aware session tracking
//! - Paginated session retrieval for user management
//! - Session lifecycle management (create, read, update, delete)
//! - Cross-database compatibility with SQLite and PostgreSQL
//! - Timestamped session tracking with creation and update times
//! - User association through foreign key relationships

use crate::auth::models::user::User;
use crate::auth::{PaginationParams, Utc, ID};
use crate::diesel::{
    insert_into, AsChangeset, Associations, ExpressionMethods, Identifiable, Insertable, QueryDsl,
    Queryable, RunQueryDsl,
};
use crate::schema::user_sessions;
use crate::services::database::Connection;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};

/// User session entity representing active authentication sessions
///
/// Sessions store refresh tokens and track device information for
/// comprehensive session management and security monitoring.
#[derive(
    Debug,
    Serialize,
    Deserialize,
    Clone,
    Queryable,
    Insertable,
    Identifiable,
    Associations,
    AsChangeset,
)]
#[diesel(table_name = user_sessions, belongs_to(User))]
pub struct UserSession {
    /// Session ID
    pub id: ID,
    /// User ID this session belongs to
    pub user_id: ID,
    /// JWT refresh token for session renewal
    pub refresh_token: String,
    /// Optional device identifier for session tracking
    pub device: Option<String>,
    /// Timestamp when session was created
    pub created_at: Utc,
    /// Timestamp when session was last updated (PostgreSQL only)
    #[cfg(not(feature = "database_sqlite"))]
    pub updated_at: Utc,
}

/// Changeset for creating or updating user sessions
#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name = user_sessions)]
pub struct UserSessionChangeset {
    /// User ID to create session for
    pub user_id: ID,
    /// Refresh token for the session
    pub refresh_token: String,
    /// Optional device identifier
    pub device: Option<String>,
}

impl UserSession {
    /// Creates a new user session
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item` - User session changeset with session data
    ///
    /// # Returns
    /// Result containing the created user session or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::{UserSession, UserSessionChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = UserSessionChangeset {
    ///     user_id: 1,
    ///     refresh_token: "jwt_token_here".to_string(),
    ///     device: Some("iPhone 12".to_string()),
    /// };
    /// let session = UserSession::create(&mut db, &changeset)?;
    /// ```
    pub fn create(db: &mut Connection, item: &UserSessionChangeset) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::user_sessions;

        insert_into(user_sessions)
            .values(item)
            .get_result::<Self>(db)
    }

    /// Retrieves a user session by ID
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_id` - Session ID to retrieve
    ///
    /// # Returns
    /// Result containing the user session or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::UserSession;
    /// 
    /// let mut db = get_connection();
    /// let session = UserSession::read(&mut db, 1)?;
    /// println!("Session for user: {}", session.user_id);
    /// ```
    pub fn read(db: &mut Connection, item_id: ID) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::{id, user_sessions};

        user_sessions.filter(id.eq(item_id)).first::<Self>(db)
    }

    /// Finds a user session by refresh token
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_refresh_token` - Refresh token to search for
    ///
    /// # Returns
    /// Result containing the user session or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::UserSession;
    /// 
    /// let mut db = get_connection();
    /// let session = UserSession::find_by_refresh_token(&mut db, "jwt_token_here")?;
    /// println!("Found session for user: {}", session.user_id);
    /// ```
    pub fn find_by_refresh_token(
        db: &mut Connection,
        item_refresh_token: &str,
    ) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::{refresh_token, user_sessions};

        user_sessions
            .filter(refresh_token.eq(item_refresh_token))
            .first::<Self>(db)
    }

    /// Retrieves paginated user sessions for a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `pagination` - Pagination parameters (page and page size)
    /// * `item_user_id` - User ID to fetch sessions for
    ///
    /// # Returns
    /// Result containing vector of user sessions or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::UserSession;
    /// use crate::auth::PaginationParams;
    /// 
    /// let mut db = get_connection();
    /// let pagination = PaginationParams { page: 0, page_size: 10 };
    /// let sessions = UserSession::read_all(&mut db, &pagination, 1)?;
    /// for session in sessions {
    ///     println!("Session device: {:?}", session.device);
    /// }
    /// ```
    pub fn read_all(
        db: &mut Connection,
        pagination: &PaginationParams,
        item_user_id: ID,
    ) -> QueryResult<Vec<Self>> {
        use crate::schema::user_sessions::dsl::{created_at, user_id, user_sessions};

        user_sessions
            .filter(user_id.eq(item_user_id))
            .order(created_at)
            .limit(pagination.page_size)
            .offset(
                pagination.page
                    * std::cmp::min(
                        pagination.page_size,
                        i64::from(PaginationParams::MAX_PAGE_SIZE),
                    ),
            )
            .load::<Self>(db)
    }

    /// Counts total number of sessions for a user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to count sessions for
    ///
    /// # Returns
    /// Result containing session count or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::UserSession;
    /// 
    /// let mut db = get_connection();
    /// let count = UserSession::count_all(&mut db, 1)?;
    /// println!("User has {} active sessions", count);
    /// ```
    pub fn count_all(db: &mut Connection, item_user_id: ID) -> QueryResult<i64> {
        use crate::schema::user_sessions::dsl::{user_id, user_sessions};

        user_sessions
            .filter(user_id.eq(item_user_id))
            .count()
            .get_result(db)
    }

    /// Updates an existing user session
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_id` - Session ID to update
    /// * `item` - User session changeset with updated data
    ///
    /// # Returns
    /// Result containing the updated user session or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::{UserSession, UserSessionChangeset};
    /// 
    /// let mut db = get_connection();
    /// let changeset = UserSessionChangeset {
    ///     user_id: 1,
    ///     refresh_token: "new_jwt_token".to_string(),
    ///     device: Some("iPhone 13".to_string()),
    /// };
    /// let updated_session = UserSession::update(&mut db, 1, &changeset)?;
    /// ```
    pub fn update(
        db: &mut Connection,
        item_id: ID,
        item: &UserSessionChangeset,
    ) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::{id, user_sessions};

        diesel::update(user_sessions.filter(id.eq(item_id)))
            .set(item)
            .get_result(db)
    }

    /// Deletes a specific user session
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_id` - Session ID to delete
    ///
    /// # Returns
    /// Result containing number of deleted sessions or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::UserSession;
    /// 
    /// let mut db = get_connection();
    /// let deleted = UserSession::delete(&mut db, 1)?;
    /// println!("Deleted {} session", deleted);
    /// ```
    pub fn delete(db: &mut Connection, item_id: ID) -> QueryResult<usize> {
        use crate::schema::user_sessions::dsl::{id, user_sessions};

        diesel::delete(user_sessions.filter(id.eq(item_id))).execute(db)
    }

    /// Deletes all sessions for a specific user
    ///
    /// # Arguments
    /// * `db` - Database connection
    /// * `item_user_id` - User ID to delete all sessions for
    ///
    /// # Returns
    /// Result containing number of deleted sessions or database error
    ///
    /// # Example
    /// ```rust
    /// use crate::auth::models::user_session::UserSession;
    /// 
    /// let mut db = get_connection();
    /// let deleted = UserSession::delete_all_for_user(&mut db, 1)?;
    /// println!("Deleted {} sessions for user", deleted);
    /// ```
    pub fn delete_all_for_user(db: &mut Connection, item_user_id: ID) -> QueryResult<usize> {
        use crate::schema::user_sessions::dsl::{user_id, user_sessions};

        diesel::delete(user_sessions.filter(user_id.eq(item_user_id))).execute(db)
    }
}
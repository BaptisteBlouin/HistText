// Modified user_session.rs with correct imports

use crate::diesel::{
    insert_into, AsChangeset, Associations, ExpressionMethods, Identifiable, Insertable, QueryDsl,
    Queryable, RunQueryDsl,
};
use crate::schema::user_sessions;

use crate::auth::models::user::User;
use crate::auth::{PaginationParams, Utc, ID};
use crate::services::database::Connection;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};

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
#[diesel(table_name=user_sessions, belongs_to(User))]
pub struct UserSession {
    pub id: ID,
    pub user_id: ID,
    pub refresh_token: String,
    pub device: Option<String>,
    pub created_at: Utc,
    #[cfg(not(feature = "database_sqlite"))]
    pub updated_at: Utc,
}

#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name=user_sessions)]
pub struct UserSessionChangeset {
    pub user_id: ID,
    pub refresh_token: String,
    pub device: Option<String>,
}

impl UserSession {
    pub fn create(db: &mut Connection, item: &UserSessionChangeset) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::user_sessions;

        insert_into(user_sessions)
            .values(item)
            .get_result::<Self>(db)
    }

    pub fn read(db: &mut Connection, item_id: ID) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::{id, user_sessions};

        user_sessions.filter(id.eq(item_id)).first::<Self>(db)
    }

    pub fn find_by_refresh_token(
        db: &mut Connection,
        item_refresh_token: &str,
    ) -> QueryResult<Self> {
        use crate::schema::user_sessions::dsl::{refresh_token, user_sessions};

        user_sessions
            .filter(refresh_token.eq(item_refresh_token))
            .first::<Self>(db)
    }

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

    pub fn count_all(db: &mut Connection, item_user_id: ID) -> QueryResult<i64> {
        use crate::schema::user_sessions::dsl::{user_id, user_sessions};

        user_sessions
            .filter(user_id.eq(item_user_id))
            .count()
            .get_result(db)
    }

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

    pub fn delete(db: &mut Connection, item_id: ID) -> QueryResult<usize> {
        use crate::schema::user_sessions::dsl::{id, user_sessions};

        diesel::delete(user_sessions.filter(id.eq(item_id))).execute(db)
    }

    pub fn delete_all_for_user(db: &mut Connection, item_user_id: ID) -> QueryResult<usize> {
        use crate::schema::user_sessions::dsl::{user_id, user_sessions};

        diesel::delete(user_sessions.filter(user_id.eq(item_user_id))).execute(db)
    }
}

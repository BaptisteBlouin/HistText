// Modified user.rs with correct imports

use crate::auth::{PaginationParams, Utc, ID};
use crate::schema::users;
use crate::services::database::Connection;
use diesel::prelude::*;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};

#[derive(
    Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Identifiable, AsChangeset,
)]
#[diesel(table_name=users)]
pub struct User {
    pub id: ID,
    pub email: String,
    pub hash_password: String,
    pub firstname: String,
    pub lastname: String,
    pub activated: bool,
    pub created_at: Utc,
    #[cfg(not(feature = "database_sqlite"))]
    pub updated_at: Utc,
}

#[derive(Debug, Serialize, Deserialize, Clone, Insertable, AsChangeset)]
#[diesel(table_name=users)]
pub struct UserChangeset {
    pub email: String,
    pub hash_password: String,
    pub firstname: String,
    pub lastname: String,
    pub activated: bool,
}

impl User {
    pub fn create(db: &mut Connection, item: &UserChangeset) -> QueryResult<Self> {
        use crate::schema::users::dsl::users;

        diesel::insert_into(users)
            .values(item)
            .get_result::<Self>(db)
    }

    pub fn read(db: &mut Connection, item_id: ID) -> QueryResult<Self> {
        use crate::schema::users::dsl::{id, users};

        users.filter(id.eq(item_id)).first::<Self>(db)
    }

    pub fn find_by_email(db: &mut Connection, item_email: String) -> QueryResult<Self> {
        use crate::schema::users::dsl::{email, users};

        users.filter(email.eq(item_email)).first::<Self>(db)
    }

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

    pub fn update(db: &mut Connection, item_id: ID, item: &UserChangeset) -> QueryResult<Self> {
        use crate::schema::users::dsl::{id, users};

        diesel::update(users.filter(id.eq(item_id)))
            .set(item)
            .get_result(db)
    }

    pub fn delete(db: &mut Connection, item_id: ID) -> QueryResult<usize> {
        use crate::schema::users::dsl::{id, users};

        diesel::delete(users.filter(id.eq(item_id))).execute(db)
    }
}

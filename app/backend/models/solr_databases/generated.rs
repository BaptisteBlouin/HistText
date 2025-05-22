/* This file is generated and managed by dsync */

use crate::diesel::*;
use crate::schema::*;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};


type Connection = crate::services::database::Connection;

#[tsync::tsync]
#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable, AsChangeset, Selectable)]
#[diesel(table_name=solr_databases, primary_key(id))]
pub struct basis {
    pub id: i32,
    pub name: String,
    pub url: String,
    pub server_port: i32,
    pub local_port: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[tsync::tsync]
#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable, AsChangeset)]
#[diesel(table_name=solr_databases)]
pub struct Createbasis {
    pub name: String,
    pub url: String,
    pub server_port: i32,
    pub local_port: i32,
}

#[tsync::tsync]
#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable, AsChangeset)]
#[diesel(table_name=solr_databases)]
pub struct Updatebasis {
    pub name: Option<String>,
    pub url: Option<String>,
    pub server_port: Option<i32>,
    pub local_port: Option<i32>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[tsync::tsync]
#[derive(Debug, Serialize)]
pub struct PaginationResult<T> {
    pub items: Vec<T>,
    pub total_items: i64,
    /// 0-based index
    pub page: i64,
    pub page_size: i64,
    pub num_pages: i64,
}

impl basis {

    pub fn create(db: &mut Connection, item: &Createbasis) -> QueryResult<Self> {
        use crate::schema::solr_databases::dsl::*;

        insert_into(solr_databases).values(item).get_result::<Self>(db)
    }

    pub fn read(db: &mut Connection, param_id: i32) -> QueryResult<Self> {
        use crate::schema::solr_databases::dsl::*;

        solr_databases.filter(id.eq(param_id)).first::<Self>(db)
    }

    /// Paginates through the table where page is a 0-based index (i.e. page 0 is the first page)
    pub fn paginate(db: &mut Connection, page: i64, page_size: i64) -> QueryResult<PaginationResult<Self>> {
        use crate::schema::solr_databases::dsl::*;

        let page_size = if page_size < 1 { 1 } else { page_size };
        let total_items = solr_databases.count().get_result(db)?;
        let items = solr_databases.limit(page_size).offset(page * page_size).load::<Self>(db)?;

        Ok(PaginationResult {
            items,
            total_items,
            page,
            page_size,
            /* ceiling division of integers */
            num_pages: total_items / page_size + i64::from(total_items % page_size != 0)
        })
    }

    pub fn update(db: &mut Connection, param_id: i32, item: &Updatebasis) -> QueryResult<Self> {
        use crate::schema::solr_databases::dsl::*;

        diesel::update(solr_databases.filter(id.eq(param_id))).set(item).get_result(db)
    }

    pub fn delete(db: &mut Connection, param_id: i32) -> QueryResult<usize> {
        use crate::schema::solr_databases::dsl::*;

        diesel::delete(solr_databases.filter(id.eq(param_id))).execute(db)
    }

}
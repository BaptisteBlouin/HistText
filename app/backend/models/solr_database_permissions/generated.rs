/* This file is generated and managed by dsync */

use crate::diesel::*;
use crate::schema::*;
use diesel::QueryResult;
use serde::{Deserialize, Serialize};
use crate::models::solr_databases::basis;

type Connection = crate::services::database::Connection;

#[tsync::tsync]
#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable, Identifiable, Associations, Selectable)]
#[diesel(table_name=solr_database_permissions, primary_key(solr_database_id,collection_name,permission), belongs_to(basis, foreign_key=solr_database_id))]
pub struct SolrDatabasePermission {
    pub solr_database_id: i32,
    pub collection_name: String,
    pub permission: String,
}

#[tsync::tsync]
#[derive(Debug, Serialize, Deserialize, Clone, Queryable, Insertable)]
#[diesel(table_name=solr_database_permissions)]
pub struct CreateSolrDatabasePermission {
    pub solr_database_id: i32,
    pub collection_name: String,
    pub permission: String,
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

impl SolrDatabasePermission {

    pub fn create(db: &mut Connection, item: &CreateSolrDatabasePermission) -> QueryResult<Self> {
        use crate::schema::solr_database_permissions::dsl::*;

        insert_into(solr_database_permissions).values(item).get_result::<Self>(db)
    }

    pub fn read(db: &mut Connection, param_solr_database_id: i32, param_collection_name: String, param_permission: String) -> QueryResult<Self> {
        use crate::schema::solr_database_permissions::dsl::*;

        solr_database_permissions.filter(solr_database_id.eq(param_solr_database_id)).filter(collection_name.eq(param_collection_name)).filter(permission.eq(param_permission)).first::<Self>(db)
    }

    /// Paginates through the table where page is a 0-based index (i.e. page 0 is the first page)
    pub fn paginate(db: &mut Connection, page: i64, page_size: i64) -> QueryResult<PaginationResult<Self>> {
        use crate::schema::solr_database_permissions::dsl::*;

        let page_size = if page_size < 1 { 1 } else { page_size };
        let total_items = solr_database_permissions.count().get_result(db)?;
        let items = solr_database_permissions.limit(page_size).offset(page * page_size).load::<Self>(db)?;

        Ok(PaginationResult {
            items,
            total_items,
            page,
            page_size,
            /* ceiling division of integers */
            num_pages: total_items / page_size + i64::from(total_items % page_size != 0)
        })
    }

    pub fn delete(db: &mut Connection, param_solr_database_id: i32, param_collection_name: String, param_permission: String) -> QueryResult<usize> {
        use crate::schema::solr_database_permissions::dsl::*;

        diesel::delete(solr_database_permissions.filter(solr_database_id.eq(param_solr_database_id)).filter(collection_name.eq(param_collection_name)).filter(permission.eq(param_permission))).execute(db)
    }

}
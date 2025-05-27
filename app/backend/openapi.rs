//! OpenAPI specification generation.
//!
//! This module defines OpenAPI documentation for the application's API endpoints,
//! organizing them into logical groups with proper security scheme definitions.
//! It uses utoipa to automatically generate documentation from code annotations.

use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

/// Security scheme modifier for OpenAPI documentation
///
/// Injects the JWT bearer token authentication scheme into the
/// generated OpenAPI components section. This ensures all API
/// endpoints show proper authentication requirements.
pub struct SecurityAddon;

impl Modify for SecurityAddon {
    /// Adds Bearer JWT security scheme to OpenAPI specification
    ///
    /// # Arguments
    /// * `openapi` - OpenAPI specification to modify
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi
            .components
            .as_mut()
            .expect("components should always be present");

        components.add_security_scheme(
            "bearer_auth",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
    }
}

/// User Management API documentation
///
/// Defines OpenAPI documentation for user-related endpoints including:
/// - User accounts (CRUD operations)
/// - User roles (role assignments)
/// - User permissions (direct permission assignments)
/// - Role permissions (permissions granted to roles)
#[derive(OpenApi)]
#[openapi(
    info(
        title = "User Management API", 
        version = "1.0.0",
        description = "API endpoints for managing users, roles, and permissions",
        contact(
            name = "HistText Support",
            email = "support@histtext.example.com"
        )
    ),
    paths(
        crate::services::users::get_users,
        crate::services::users::get_user_by_id,
        crate::services::users::create_user,
        crate::services::users::update_user,
        crate::services::users::delete_user,
        crate::services::user_roles::get_user_roles,
        crate::services::user_roles::get_user_role_by_user_id_and_role,
        crate::services::user_roles::create_user_role,
        crate::services::user_roles::delete_user_role,
        crate::services::user_permissions::get_user_permissions,
        crate::services::user_permissions::get_user_permission_by_user_id_and_permission,
        crate::services::user_permissions::create_user_permission,
        crate::services::user_permissions::delete_user_permission,
        crate::services::role_permissions::get_role_permissions,
        crate::services::role_permissions::get_role_permission_by_role_and_permission,
        crate::services::role_permissions::create_role_permission,
        crate::services::role_permissions::delete_role_permission,
    ),
    components(schemas(
        crate::services::users::User,
        crate::services::users::NewUser,
        crate::services::users::UpdateUser,
        crate::services::user_roles::UserRole,
        crate::services::user_roles::NewUserRole,
        crate::services::user_permissions::UserPermission,
        crate::services::user_permissions::NewUserPermission,
        crate::services::role_permissions::RolePermission,
        crate::services::role_permissions::NewRolePermission,
    )),
    modifiers(&SecurityAddon),
    security(
        ("bearer_auth" = [])
    ),
    tags(
        (name = "Users", description = "User account management including creation, updates, and deletion"),
    )
)]
pub struct UserApiDoc;

/// Solr Administration API documentation
///
/// Defines OpenAPI documentation for Solr-related endpoints including:
/// - Solr database configurations
/// - SSH tunnel management
/// - Collection metadata
/// - Access permissions
/// - System statistics
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Solr Administration API", 
        version = "1.0.0",
        description = "API endpoints for configuring and managing Solr databases and collections",
        contact(
            name = "HistText Support",
            email = "support@histtext.example.com"
        )
    ),
    paths(
        crate::services::solr_database::get_solr_databases,
        crate::services::solr_database::get_solr_database_by_id,
        crate::services::solr_database::create_solr_database,
        crate::services::solr_database::update_solr_database,
        crate::services::solr_database::delete_solr_database,
        crate::server::ssh::connect_solr_database_ssh,
        crate::services::solr_database_info::get_solr_database_infos,
        crate::services::solr_database_info::get_solr_database_info,
        crate::services::solr_database_info::create_solr_database_info,
        crate::services::solr_database_info::update_solr_database_info,
        crate::services::solr_database_info::delete_solr_database_info,
        crate::services::solr_database_permissions::get_solr_database_permissions,
        crate::services::solr_database_permissions::get_solr_database_permission,
        crate::services::solr_database_permissions::create_solr_database_permission,
        crate::services::solr_database_permissions::delete_solr_database_permission,
        crate::services::stats::get_dashboard_stats,
    ),
    components(schemas(
        crate::services::solr_database::SolrDatabase,
        crate::services::solr_database::NewSolrDatabase,
        crate::services::solr_database::UpdateSolrDatabase,
        crate::services::solr_database_info::SolrDatabaseInfo,
        crate::services::solr_database_info::NewSolrDatabaseInfo,
        crate::services::solr_database_info::UpdateSolrDatabaseInfo,
        crate::services::solr_database_permissions::SolrDatabasePermission,
        crate::services::solr_database_permissions::NewSolrDatabasePermission,
        crate::services::stats::DashboardStats,
    )),
    modifiers(&SecurityAddon),
    security(
        ("bearer_auth" = [])
    ),
    tags(
        (name = "SolrDatabases", description = "Solr instance connection configuration and management"),
        (name = "SolrDatabaseInfo", description = "Collection metadata and configuration"),
        (name = "SolrDatabasePermissions", description = "Collection-level access control"),
        (name = "Stats", description = "System-wide statistics and monitoring")
    )
)]
pub struct SolrApiDoc;

/// HistText Core API documentation
///
/// Defines OpenAPI documentation for text processing endpoints including:
/// - Document search and retrieval
/// - Collection metadata and schema
/// - Named entity recognition
/// - Statistical analysis
/// - Text tokenization
/// - Word embeddings and semantic similarity
#[derive(OpenApi)]
#[openapi(
    info(
        title = "HistText Core API", 
        version = "1.0.0",
        description = "API endpoints for searching, analyzing, and processing historical text data",
        contact(
            name = "HistText Support",
            email = "support@histtext.example.com"
        )
    ),
    paths(
        crate::histtext::documents::query_collection,
        crate::histtext::documents::download_csv,
        crate::histtext::metadata::get_aliases,
        crate::histtext::metadata::get_collection_metadata,
        crate::histtext::metadata::get_date_range,
        crate::histtext::ner::fetch_ner_data,
        crate::histtext::stats::calculate_statistics,
        crate::histtext::tokenizer::tokenize,
        crate::histtext::embeddings::handlers::compute_neighbors_handler,
    ),
    components(schemas(
        crate::histtext::documents::CollectionQueryParams,
        crate::histtext::metadata::MetadataQueryParams,
        crate::histtext::metadata::DatabaseIdQueryParams,
        crate::histtext::ner::PathQueryParams,
        crate::histtext::stats::PathQueryParams,
        crate::histtext::stats::DashboardStats,
        crate::histtext::tokenizer::TokenizeRequest,
        crate::histtext::tokenizer::TokenizeResponse,
        crate::histtext::embeddings::NeighborsRequest,
        crate::histtext::embeddings::NeighborsResponse,
    )),
    modifiers(&SecurityAddon),
    security(
        ("bearer_auth" = [])
    ),
    tags(
        (name = "SolrDocuments", description = "Document search and retrieval with CSV export"),
        (name = "Metadata", description = "Collection structure and schema information"),
        (name = "Named Entity Recognition", description = "Extract and analyze named entities in text"),
        (name = "Statistics", description = "Corpus statistics and distributions"),
        (name = "Text Processing", description = "Text tokenization and semantic analysis"),
        (name = "Embeddings", description = "Word vector operations and semantic similarity")
    )
)]
pub struct HistTextApiDoc;

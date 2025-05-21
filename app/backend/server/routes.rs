//! Application route configuration and endpoint registration.
//!
//! This module defines all API routes and endpoints for the application, 
//! organizing them by functional area. It also configures authentication,
//! documentation (OpenAPI/Swagger), and frontend routing.

use actix_web::web::Data;
use actix_web::{guard, web, web::ServiceConfig, HttpResponse, Scope};
use crate::app_data::{AppData, AppConfig};
use utoipa::OpenApi;
use utoipa_swagger_ui::{SwaggerUi, Url};

use crate::openapi::{HistTextApiDoc, SolrApiDoc, UserApiDoc};
use crate::server::guards::has_permission;
use crate::server::state::AppState;
use crate::server::state::DbPool;
use crate::services::database::Database;

// Import auth routes module
use crate::auth::routes;

// Import route handlers
use crate::histtext;
use crate::services::role_permissions::*;
use crate::services::solr_database::*;
use crate::services::solr_database_info::*;
use crate::services::solr_database_permissions::*;
use crate::services::stats::get_dashboard_stats;
use crate::services::user_permissions::*;
use crate::services::user_roles::*;
use crate::services::users::*;

use crate::server::ssh::connect_solr_database_ssh;

use crate::config::Config;
use crate::services::mailer::Mailer;

use actix_web::{dev::ServiceRequest, error::Error as ActixError};
use actix_web_httpauth::{
    extractors::{
        basic::{BasicAuth, Config as BasicAuthConfig},
        AuthExtractorConfig, AuthenticationError,
    },
    middleware::HttpAuthentication,
};

use crate::template::render_views;

/// Validates basic authentication credentials for OpenAPI documentation access
///
/// # Arguments
/// * `req` - The incoming service request
/// * `creds` - Basic authentication credentials extracted from the request
///
/// # Returns
/// The request if authentication succeeds, or an authentication error if it fails
async fn basic_validator(
    req: ServiceRequest,
    creds: BasicAuth,
) -> Result<ServiceRequest, (ActixError, ServiceRequest)> {
    let cfg = Config::global();

    let expected_user = cfg.openapi_login.as_str();
    let expected_pass = cfg.openapi_pwd.as_str();

    if creds.user_id() == expected_user && creds.password().unwrap_or("") == expected_pass {
        Ok(req)
    } else {
        // Get the BasicAuthConfig to determine the realm
        let config = req
            .app_data::<BasicAuthConfig>()
            .cloned()
            .unwrap_or_default();
        // Create a Basic authentication challenge
        let challenge = config.into_inner();
        // Create a 401 response with WWW-Authenticate header
        let auth_error = AuthenticationError::new(challenge);
        Err((auth_error.into(), req))
    }
}

/// Sets up all API routes for the application
///
/// This function configures all routes, middleware, and shared application data
/// including authentication, OpenAPI documentation, and API endpoints
/// organized by functional category.
///
/// # Arguments
/// * `config` - Service configuration to modify
/// * `app_state` - Application state data
/// * `db` - Database connection
/// * `db_pool` - Database connection pool
/// * `app_data` - Create-rust-app application data
/// * `schema` - GraphQL schema
pub fn configure_routes(
    config: &mut ServiceConfig,
    app_state: Data<AppState>,
    db: Data<Database>,
    db_pool: Data<DbPool>,
    app_data: Data<crate::app_data::AppData>,
    schema: Data<async_graphql::Schema<crate::graphql::QueryRoot, crate::graphql::MutationRoot, crate::graphql::SubscriptionRoot>>,
) {
    // Create app config data
    let app_config_data = Data::new(AppConfig {
        app_url: app_state.config.app_url.clone(),
    });

    // Create authentication config
    //let auth_config = Data::new(crate::auth::AuthConfig {
    //    oidc_providers: vec![create_rust_app::auth::oidc::OIDCProvider::GOOGLE(
    //        app_state.config.google_oauth2_client_id.clone(),
    //        app_state.config.google_oauth2_client_secret.clone(),
    //        format!("{}/oauth/success", app_state.config.app_url),
    //        format!("{}/oauth/error", app_state.config.app_url),
    //    )],
    //});

    // Initialize API scope - Configure auth routes
    let mut api_scope = web::scope("/api");
    
    // Configure auth routes
    api_scope = api_scope.configure(|cfg| {
        routes::configure_routes(cfg, &Config::global());
    });
    // Configure all API endpoints by category
    api_scope = configure_solr_routes(api_scope);
    api_scope = configure_hist_text_routes(api_scope);
    api_scope = configure_user_routes(api_scope);
    api_scope = configure_role_permission_routes(api_scope);
    api_scope = configure_solr_database_routes(api_scope);
    api_scope = configure_solr_database_permission_routes(api_scope);
    api_scope = configure_solr_database_info_routes(api_scope);
    api_scope = configure_user_role_routes(api_scope);
    api_scope = configure_user_permission_routes(api_scope);
    api_scope = configure_stats_routes(api_scope);
    api_scope = configure_health_routes(api_scope);

    // Configure OpenAPI documentation if enabled
    if app_state.config.do_openapi {
        // Create basic authentication config
        config.app_data(BasicAuthConfig::default().realm("Swagger UI"));

        // Register the Swagger UI with authentication
        config.service(
            web::scope("/swagger-ui")
                // Apply basic authentication middleware
                .wrap(HttpAuthentication::basic(basic_validator))
                // Register Swagger UI with OpenAPI specs
                .service(SwaggerUi::new("/{_:.*}").urls(vec![
                    (
                        Url::new("User Management API", "/api-doc/users-openapi.json"),
                        UserApiDoc::openapi(),
                    ),
                    (
                        Url::new("Solr Administration API", "/api-doc/solr-openapi.json"),
                        SolrApiDoc::openapi(),
                    ),
                    (
                        Url::new("HistText Core API", "/api-doc/histtext-openapi.json"),
                        HistTextApiDoc::openapi(),
                    ),
                ])),
        );

        // Register the OpenAPI JSON endpoints with authentication
        config.service(
            web::scope("/api-doc")
                // Apply basic authentication middleware
                .wrap(HttpAuthentication::basic(basic_validator))
                // Register all OpenAPI JSON endpoints
                .route(
                    "/users-openapi.json",
                    web::get().to(|| async { web::Json(UserApiDoc::openapi()) }),
                )
                .route(
                    "/solr-openapi.json",
                    web::get().to(|| async { web::Json(SolrApiDoc::openapi()) }),
                )
                .route(
                    "/histtext-openapi.json",
                    web::get().to(|| async { web::Json(HistTextApiDoc::openapi()) }),
                ),
        );
    }

    // Register the API scope
    config.service(api_scope);

    // Default route for frontend
    config.service(web::resource("/{_:.*}").route(web::get().to(render_views)));

    let config_global = Config::global();
    let mailer = Data::new(Mailer::from_config(&config_global));

    // Register app data
    config
        .app_data(db)
        .app_data(db_pool)
        .app_data(app_data)
        .app_data(schema)
        .app_data(app_state)
        .app_data(app_config_data)
        .app_data(mailer);
}

// Rest of your route configuration functions...

/// Configure Solr query and metadata routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with Solr routes
fn configure_solr_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/solr/aliases").route(web::get().to(histtext::metadata::get_aliases)),
        )
        .service(
            web::resource("/solr/collection_metadata")
                .route(web::get().to(histtext::metadata::get_collection_metadata)),
        )
        .service(
            web::resource("/solr/query")
                .route(web::get().to(histtext::documents::query_collection)),
        )
        .service(
            web::resource("/solr/download_csv/{filename}")
                .route(web::get().to(histtext::documents::download_csv)),
        )
        .service(web::resource("/solr/ner").route(web::get().to(histtext::ner::fetch_ner_data)))
        .service(
            web::resource("/solr/stats")
                .route(web::get().to(histtext::stats::calculate_statistics)),
        )
        .service(
            web::resource("/solr/date_range")
                .route(web::get().to(histtext::metadata::get_date_range)),
        )
}

/// Configure HistText-specific text processing routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with HistText routes
fn configure_hist_text_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(web::resource("/tokenize").route(web::post().to(histtext::tokenizer::tokenize)))
        .service(
            web::resource("/compute-neighbors")
                .route(web::post().to(histtext::embeddings::compute_neighbors)),
        )
        .service(
            web::resource("/embeddings/stats")
                .route(web::get().to(crate::services::stats::get_embeddings_stats)),
        )
        .service(
            web::resource("/embeddings/clear")
                .guard(guard::fn_guard(has_permission)) // Admin-only route
                .route(web::post().to(crate::services::stats::clear_embeddings_cache)),
        )
}

/// Configure user management routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with user routes
fn configure_user_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/users")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_users))
                .route(web::post().to(create_user)),
        )
        .service(
            web::resource("/users/{id}")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_user_by_id))
                .route(web::put().to(update_user))
                .route(web::delete().to(delete_user)),
        )
}

/// Configure role permission management routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with role permission routes
fn configure_role_permission_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/role_permissions")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_role_permissions))
                .route(web::post().to(create_role_permission)),
        )
        .service(
            web::resource("/role_permissions/{role}/{permission}")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_role_permission_by_role_and_permission))
                .route(web::delete().to(delete_role_permission)),
        )
}

/// Configure Solr database management routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with Solr database routes
fn configure_solr_database_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/solr_databases")
                .route(web::get().to(get_solr_databases))
                .route(
                    web::post()
                        .guard(guard::fn_guard(has_permission))
                        .to(create_solr_database),
                ),
        )
        .service(
            web::resource("/solr_databases/{id}")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_solr_database_by_id))
                .route(web::put().to(update_solr_database))
                .route(web::delete().to(delete_solr_database)),
        )
        .service(
            web::resource("/solr_databases/{id}/connect_ssh")
                .guard(guard::fn_guard(has_permission))
                .route(web::post().to(connect_solr_database_ssh)),
        )
}

/// Configure Solr database permission routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with Solr database permission routes
fn configure_solr_database_permission_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/solr_database_permissions")
                .route(web::get().to(get_solr_database_permissions))
                .route(web::post().to(create_solr_database_permission)),
        )
        .service(
            web::resource(
                "/solr_database_permissions/{solr_database_id}/{collection_name}/{permission}",
            )
            .guard(guard::fn_guard(has_permission))
            .route(web::get().to(get_solr_database_permission))
            .route(web::delete().to(delete_solr_database_permission)),
        )
}

/// Configure Solr database information routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with Solr database info routes
fn configure_solr_database_info_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/solr_database_info")
                .route(web::get().to(get_solr_database_infos))
                .route(
                    web::post()
                        .guard(guard::fn_guard(has_permission))
                        .to(create_solr_database_info),
                ),
        )
        .service(
            web::resource("/solr_database_info/{solr_database_id}/{collection_name}")
                .route(web::get().to(get_solr_database_info))
                .route(
                    web::put()
                        .guard(guard::fn_guard(has_permission))
                        .to(update_solr_database_info),
                )
                .route(
                    web::delete()
                        .guard(guard::fn_guard(has_permission))
                        .to(delete_solr_database_info),
                ),
        )
}

/// Configure user role assignment routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with user role routes
fn configure_user_role_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/user_roles")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_user_roles))
                .route(web::post().to(create_user_role)),
        )
        .service(
            web::resource("/user_roles/{user_id}/{role}")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_user_role_by_user_id_and_role))
                .route(web::delete().to(delete_user_role)),
        )
}

/// Configure user permission assignment routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with user permission routes
fn configure_user_permission_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(
            web::resource("/user_permissions")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_user_permissions))
                .route(web::post().to(create_user_permission)),
        )
        .service(
            web::resource("/user_permissions/{user_id}/{permission}")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_user_permission_by_user_id_and_permission))
                .route(web::delete().to(delete_user_permission)),
        )
}

/// Configure application statistics routes
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with stats routes
fn configure_stats_routes(api_scope: Scope) -> Scope {
    api_scope.service(
        web::resource("/stats")
            .guard(guard::fn_guard(has_permission))
            .route(web::get().to(get_dashboard_stats)),
    )
}

/// Configure health check endpoint
///
/// # Arguments
/// * `api_scope` - The API scope to extend
///
/// # Returns
/// Updated API scope with health check route
fn configure_health_routes(api_scope: Scope) -> Scope {
    api_scope.service(
        web::resource("/health").route(web::get().to(|| async { HttpResponse::Ok().body("OK") })),
    )
}
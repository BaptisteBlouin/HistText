//! Application route configuration and endpoint registration.
//!
//! This module defines all API routes and endpoints for the application,
//! organizing them by functional area. It also configures authentication,
//! documentation (OpenAPI/Swagger), and frontend routing.

use crate::app_data::AppConfig;
use actix_web::web::Data;
use actix_web::{guard, web, web::ServiceConfig, HttpResponse, Scope};
use utoipa::OpenApi;
use utoipa_swagger_ui::{SwaggerUi, Url};

use crate::openapi::{HistTextApiDoc, SolrApiDoc, UserApiDoc};
use crate::server::guards::{has_permission, can_access_user_resource};
use crate::server::state::AppState;
use crate::services::database::DbPool;
use crate::services::database::Database;

// Import route handlers
use crate::histtext;
use crate::services::auth::handlers as auth_handlers;
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
        let config = req
            .app_data::<BasicAuthConfig>()
            .cloned()
            .unwrap_or_default();
        let challenge = config.into_inner();
        let auth_error = AuthenticationError::new(challenge);
        Err((auth_error.into(), req))
    }
}

/// Sets up all API routes for the application
pub fn configure_routes(
    config: &mut ServiceConfig,
    app_state: Data<AppState>,
    db: Data<Database>,
    db_pool: Data<DbPool>,
    app_data: Data<crate::app_data::AppData>,
    schema: Data<
        async_graphql::Schema<
            crate::graphql::QueryRoot,
            crate::graphql::MutationRoot,
            crate::graphql::SubscriptionRoot,
        >,
    >,
) {
    // Create app config data
    let app_config_data = Data::new(AppConfig {
        app_url: app_state.config.app_url.clone(),
    });

    // Initialize API scope
    let mut api_scope = web::scope("/api");

    // Configure auth routes
    api_scope = api_scope.service(
        web::scope("/auth")
        .service(
            web::resource("/login")
                .route(web::post().to(auth_handlers::login))
        )
        .service(
            web::resource("/logout")
                .route(web::post().to(auth_handlers::logout))
        )
        .service(
            web::resource("/refresh")
                .route(web::post().to(auth_handlers::refresh))
        )
        .service(
            web::resource("/register")
                .route(web::post().to(auth_handlers::register))
        )
        .service(
            web::resource("/activate")
                .route(web::get().to(auth_handlers::activate))
        )
        .service(
            web::resource("/check")
                .route(web::post().to(auth_handlers::check))
        )
        .service(
            web::resource("/forgot")
                .route(web::post().to(auth_handlers::forgot_password))
        )
        .service(
            web::resource("/change")
                .route(web::post().to(auth_handlers::change_password))
        )
        .service(
            web::resource("/reset")
                .route(web::post().to(auth_handlers::reset_password))
        )
    );

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
    let mailer = Data::new(Mailer::from_config(config_global));

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

/// Configure Solr query and metadata routes
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
/// Configure HistText-specific text processing routes
fn configure_hist_text_routes(api_scope: Scope) -> Scope {
    api_scope
        .service(web::resource("/tokenize").route(web::post().to(histtext::tokenizer::tokenize)))
        .service(web::resource("/tokenize/batch").route(web::post().to(histtext::tokenizer::batch_tokenize)))
        // Legacy embedding endpoint for backward compatibility
        .service(
            web::resource("/compute-neighbors")
                .route(web::post().to(histtext::embeddings::compute_neighbors)),
        )
        
        // New enhanced embedding endpoints
        .service(
            web::resource("/embeddings/neighbors")
                .route(web::post().to(crate::histtext::embeddings::handlers::enhanced_neighbors)),
        )
        .service(
            web::resource("/embeddings/batch-neighbors")
                .route(web::post().to(crate::histtext::embeddings::handlers::batch_neighbors)),
        )
        .service(
            web::resource("/embeddings/similarity")
                .route(web::post().to(crate::histtext::embeddings::handlers::word_similarity)),
        )
        .service(
            web::resource("/embeddings/analogy")
                .route(web::post().to(crate::histtext::embeddings::handlers::word_analogy)),
        )
        
        // Embedding cache and statistics endpoints
        .service(
            web::resource("/embeddings/stats")
                .route(web::get().to(crate::services::stats::get_embeddings_stats)),
        )
        .service(
            web::resource("/embeddings/clear")
                .guard(guard::fn_guard(has_permission)) // Admin-only route
                .route(web::post().to(crate::services::stats::clear_embeddings_cache)),
        )
        .service(
            web::resource("/embeddings/advanced-stats")
                .route(web::get().to(crate::services::cache_monitor::get_cache_stats_advanced)),
        )
        .service(
            web::resource("/embeddings/reset-metrics")
                .guard(guard::fn_guard(has_permission)) // Admin-only route
                .route(web::post().to(crate::services::cache_monitor::reset_cache_metrics)),
        )
}

/// Configure user management routes
fn configure_user_routes(api_scope: Scope) -> Scope {
    api_scope
        // Self-access routes (any authenticated user can access their own info)
        .service(
            web::resource("/user/me")
                .route(web::get().to(get_current_user))
                .route(web::put().to(update_current_user))
        )
        // Admin-only routes for managing all users
        .service(
            web::resource("/users")
                .guard(guard::fn_guard(has_permission))
                .route(web::get().to(get_users))
                .route(web::post().to(create_user))
        )
        // Routes that allow admin access OR user accessing their own resource
        .service(
            web::resource("/users/{id}")
                .guard(guard::fn_guard(can_access_user_resource))
                .route(web::get().to(get_user_by_id))
                .route(web::put().to(update_user))
        )
        // Admin-only delete (users shouldn't be able to delete themselves via API)
        .service(
            web::resource("/users/{id}/delete")
                .guard(guard::fn_guard(has_permission))
                .route(web::delete().to(delete_user))
        )
}

/// Configure role permission management routes
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
fn configure_stats_routes(api_scope: Scope) -> Scope {
    api_scope.service(
        web::resource("/stats")
            .guard(guard::fn_guard(has_permission))
            .route(web::get().to(get_dashboard_stats)),
    )
}

/// Configure health check endpoint
fn configure_health_routes(api_scope: Scope) -> Scope {
    api_scope.service(
        web::resource("/health").route(web::get().to(|| async { HttpResponse::Ok().body("OK") })),
    )
}
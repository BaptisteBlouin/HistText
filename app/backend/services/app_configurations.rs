//! Application configuration management service.
//!
//! This module provides HTTP handlers for managing dynamic application configurations
//! that can be modified at runtime without requiring application restarts.

use actix_web::{web, HttpResponse, Result as ActixResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::app_configurations::{AppConfigurations, CreateAppConfigurations};
use crate::services::crud::execute_db_query;
use crate::services::database::Database;
use crate::services::error::AppError;

/// Response structure for configuration API endpoints
#[derive(Debug, Serialize)]
pub struct ConfigurationResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Request structure for updating configuration values
#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub config_value: String,
}

/// Request structure for creating new configuration entries
#[derive(Debug, Deserialize)]
pub struct CreateConfigRequest {
    pub config_key: String,
    pub config_value: String,
    pub config_type: String,
    pub category: String,
    pub description: Option<String>,
    pub is_system: Option<bool>,
}

/// Get all configurations grouped by category
pub async fn get_configurations(db: web::Data<Database>) -> ActixResult<HttpResponse> {
    let result = execute_db_query(db, |mut db_conn| {
        AppConfigurations::get_all_by_category(&mut db_conn)
    })
    .await;

    match result {
        Ok(configurations) => Ok(HttpResponse::Ok().json(ConfigurationResponse {
            success: true,
            message: "Configurations retrieved successfully".to_string(),
            data: Some(serde_json::to_value(configurations).unwrap_or_default()),
        })),
        Err(e) => Ok(
            HttpResponse::InternalServerError().json(ConfigurationResponse {
                success: false,
                message: format!("Failed to retrieve configurations: {}", e),
                data: None,
            }),
        ),
    }
}

/// Get a specific configuration by key
pub async fn get_configuration_by_key(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> ActixResult<HttpResponse> {
    let config_key = path.into_inner();
    let config_key_clone = config_key.clone();

    let result = execute_db_query(db, move |mut db_conn| {
        AppConfigurations::get_by_key(&mut db_conn, &config_key)
    })
    .await;

    match result {
        Ok(configuration) => Ok(HttpResponse::Ok().json(ConfigurationResponse {
            success: true,
            message: "Configuration retrieved successfully".to_string(),
            data: Some(serde_json::to_value(configuration).unwrap_or_default()),
        })),
        Err(AppError::NotFound { .. }) => {
            Ok(HttpResponse::NotFound().json(ConfigurationResponse {
                success: false,
                message: format!("Configuration '{}' not found", config_key_clone),
                data: None,
            }))
        }
        Err(e) => Ok(
            HttpResponse::InternalServerError().json(ConfigurationResponse {
                success: false,
                message: format!("Failed to retrieve configuration: {}", e),
                data: None,
            }),
        ),
    }
}

/// Update a configuration value by key
pub async fn update_configuration(
    db: web::Data<Database>,
    path: web::Path<String>,
    request: web::Json<UpdateConfigRequest>,
) -> ActixResult<HttpResponse> {
    let config_key = path.into_inner();
    let config_key_clone = config_key.clone();
    let config_value = request.config_value.clone();

    let result = execute_db_query(db, move |mut db_conn| {
        AppConfigurations::set_value(&mut db_conn, &config_key, &config_value)
    })
    .await;

    match result {
        Ok(updated_config) => Ok(HttpResponse::Ok().json(ConfigurationResponse {
            success: true,
            message: format!("Configuration '{}' updated successfully", config_key_clone),
            data: Some(serde_json::to_value(updated_config).unwrap_or_default()),
        })),
        Err(AppError::NotFound { .. }) => {
            Ok(HttpResponse::NotFound().json(ConfigurationResponse {
                success: false,
                message: format!("Configuration '{}' not found", config_key_clone),
                data: None,
            }))
        }
        Err(e) => Ok(
            HttpResponse::InternalServerError().json(ConfigurationResponse {
                success: false,
                message: format!("Failed to update configuration: {}", e),
                data: None,
            }),
        ),
    }
}

/// Create a new configuration entry
pub async fn create_configuration(
    db: web::Data<Database>,
    request: web::Json<CreateConfigRequest>,
) -> ActixResult<HttpResponse> {
    let new_config = CreateAppConfigurations {
        config_key: request.config_key.clone(),
        config_value: request.config_value.clone(),
        config_type: request.config_type.clone(),
        category: request.category.clone(),
        description: request.description.clone(),
        is_system: request.is_system.unwrap_or(false),
    };

    let result = execute_db_query(db, move |mut db_conn| {
        AppConfigurations::create(&mut db_conn, &new_config)
    })
    .await;

    match result {
        Ok(configuration) => Ok(HttpResponse::Created().json(ConfigurationResponse {
            success: true,
            message: format!(
                "Configuration '{}' created successfully",
                request.config_key
            ),
            data: Some(serde_json::to_value(configuration).unwrap_or_default()),
        })),
        Err(e) => {
            let message = if e.to_string().contains("unique constraint") {
                format!("Configuration '{}' already exists", request.config_key)
            } else {
                format!("Failed to create configuration: {}", e)
            };

            Ok(HttpResponse::BadRequest().json(ConfigurationResponse {
                success: false,
                message,
                data: None,
            }))
        }
    }
}

/// Delete a configuration entry (only non-system configurations)
pub async fn delete_configuration(
    db: web::Data<Database>,
    path: web::Path<String>,
) -> ActixResult<HttpResponse> {
    let config_key = path.into_inner();

    // First check if the configuration exists and if it's deletable
    let get_result = execute_db_query(db.clone(), {
        let config_key = config_key.clone();
        move |mut db_conn| AppConfigurations::get_by_key(&mut db_conn, &config_key)
    })
    .await;

    match get_result {
        Ok(existing_config) => {
            if existing_config.is_system {
                return Ok(HttpResponse::Forbidden().json(ConfigurationResponse {
                    success: false,
                    message: format!("Cannot delete system configuration '{}'", config_key),
                    data: None,
                }));
            }

            let config_id = existing_config.id;
            let delete_result = execute_db_query(db, move |mut db_conn| {
                AppConfigurations::delete(&mut db_conn, config_id)
            })
            .await;

            match delete_result {
                Ok(_) => Ok(HttpResponse::Ok().json(ConfigurationResponse {
                    success: true,
                    message: format!("Configuration '{}' deleted successfully", config_key),
                    data: None,
                })),
                Err(e) => Ok(
                    HttpResponse::InternalServerError().json(ConfigurationResponse {
                        success: false,
                        message: format!("Failed to delete configuration: {}", e),
                        data: None,
                    }),
                ),
            }
        }
        Err(AppError::NotFound { .. }) => {
            Ok(HttpResponse::NotFound().json(ConfigurationResponse {
                success: false,
                message: format!("Configuration '{}' not found", config_key),
                data: None,
            }))
        }
        Err(e) => Ok(
            HttpResponse::InternalServerError().json(ConfigurationResponse {
                success: false,
                message: format!("Failed to check configuration: {}", e),
                data: None,
            }),
        ),
    }
}

/// Get current frontend configuration (public endpoint)
pub async fn get_frontend_config(db: web::Data<Database>) -> ActixResult<HttpResponse> {
    // Get all configurations and filter in Rust rather than multiple DB calls
    let result = execute_db_query(db, |db_conn| {
        use crate::schema::app_configurations::dsl::*;
        use diesel::prelude::*;

        app_configurations
            .filter(category.eq("frontend").or(category.eq("system")))
            .load::<AppConfigurations>(db_conn)
    })
    .await;

    match result {
        Ok(configs) => {
            let mut frontend_config = HashMap::new();

            for config in configs {
                // Parse the value based on its type
                let parsed_value = match config.config_type.as_str() {
                    "json" => serde_json::from_str::<serde_json::Value>(&config.config_value)
                        .unwrap_or_else(|_| serde_json::Value::String(config.config_value.clone())),
                    "number" => {
                        if let Ok(num) = config.config_value.parse::<i64>() {
                            serde_json::Value::Number(serde_json::Number::from(num))
                        } else if let Ok(num) = config.config_value.parse::<f64>() {
                            serde_json::Number::from_f64(num)
                                .map(serde_json::Value::Number)
                                .unwrap_or_else(|| {
                                    serde_json::Value::String(config.config_value.clone())
                                })
                        } else {
                            serde_json::Value::String(config.config_value.clone())
                        }
                    }
                    "boolean" => config
                        .config_value
                        .parse::<bool>()
                        .map(serde_json::Value::Bool)
                        .unwrap_or_else(|_| serde_json::Value::String(config.config_value.clone())),
                    "csv" => {
                        let vec: Vec<String> = config
                            .config_value
                            .split(',')
                            .filter(|s| !s.trim().is_empty())
                            .map(|s| s.trim().to_string())
                            .collect();
                        serde_json::to_value(vec).unwrap_or_default()
                    }
                    _ => serde_json::Value::String(config.config_value.clone()),
                };

                frontend_config.insert(config.config_key, parsed_value);
            }

            Ok(HttpResponse::Ok().json(frontend_config))
        }
        Err(e) => Ok(
            HttpResponse::InternalServerError().json(ConfigurationResponse {
                success: false,
                message: format!("Failed to retrieve frontend configuration: {}", e),
                data: None,
            }),
        ),
    }
}

use super::common::ConnectionType;
use diesel::prelude::*;
use serde_json::Value;
use std::collections::HashMap;

pub mod generated;
pub use generated::*;

impl AppConfigurations {
    /// Get all configurations grouped by category
    pub fn get_all_by_category(
        db: &mut ConnectionType,
    ) -> diesel::QueryResult<HashMap<String, Vec<Self>>> {
        use crate::schema::app_configurations::dsl::*;

        let configs = app_configurations
            .order_by((category.asc(), config_key.asc()))
            .load::<Self>(db)?;

        let mut grouped = HashMap::new();
        for config in configs {
            grouped
                .entry(config.category.clone())
                .or_insert_with(Vec::new)
                .push(config);
        }

        Ok(grouped)
    }

    /// Get configuration by key
    pub fn get_by_key(db: &mut ConnectionType, key: &str) -> diesel::QueryResult<Self> {
        use crate::schema::app_configurations::dsl::*;

        app_configurations
            .filter(config_key.eq(key))
            .first::<Self>(db)
    }

    /// Get configuration value by key, parsed as specific type
    pub fn get_value<T>(db: &mut ConnectionType, key: &str) -> diesel::QueryResult<T>
    where
        T: serde::de::DeserializeOwned + Default,
    {
        let config = Self::get_by_key(db, key)?;
        Self::parse_config_value(&config).map_err(|_| diesel::result::Error::NotFound)
    }

    /// Get configuration value by key as string with fallback
    pub fn get_string_value(db: &mut ConnectionType, key: &str, default: &str) -> String {
        Self::get_by_key(db, key)
            .map(|config| config.config_value)
            .unwrap_or_else(|_| default.to_string())
    }

    /// Get configuration value by key as number with fallback
    pub fn get_number_value<T>(db: &mut ConnectionType, key: &str, default: T) -> T
    where
        T: std::str::FromStr + Clone,
    {
        Self::get_by_key(db, key)
            .ok()
            .and_then(|config| config.config_value.parse::<T>().ok())
            .unwrap_or(default)
    }

    /// Get configuration value by key as boolean with fallback
    pub fn get_bool_value(db: &mut ConnectionType, key: &str, default: bool) -> bool {
        Self::get_by_key(db, key)
            .ok()
            .and_then(|config| config.config_value.parse::<bool>().ok())
            .unwrap_or(default)
    }

    /// Set configuration value by key
    pub fn set_value(db: &mut ConnectionType, key: &str, value: &str) -> diesel::QueryResult<Self> {
        use crate::schema::app_configurations::dsl::*;

        let update_data = UpdateAppConfigurations {
            config_value: Some(value.to_string()),
            updated_at: Some(chrono::Utc::now()),
            ..Default::default()
        };

        diesel::update(app_configurations.filter(config_key.eq(key)))
            .set(&update_data)
            .get_result(db)
    }

    /// Get all configurations as a key-value map
    pub fn get_all_as_map(db: &mut ConnectionType) -> diesel::QueryResult<HashMap<String, String>> {
        use crate::schema::app_configurations::dsl::*;

        let configs = app_configurations.load::<Self>(db)?;
        let map = configs
            .into_iter()
            .map(|config| (config.config_key, config.config_value))
            .collect();

        Ok(map)
    }

    /// Parse configuration value based on its type
    pub fn parse_config_value<T>(&self) -> Result<T, serde_json::Error>
    where
        T: serde::de::DeserializeOwned,
    {
        match self.config_type.as_str() {
            "json" => serde_json::from_str(&self.config_value),
            "csv" => {
                let vec: Vec<String> = self
                    .config_value
                    .split(',')
                    .filter(|s| !s.trim().is_empty())
                    .map(|s| s.trim().to_string())
                    .collect();
                serde_json::from_value(serde_json::to_value(vec)?)
            }
            "number" => {
                if let Ok(num) = self.config_value.parse::<i64>() {
                    serde_json::from_value(Value::Number(serde_json::Number::from(num)))
                } else if let Ok(num) = self.config_value.parse::<f64>() {
                    serde_json::from_value(Value::Number(
                        serde_json::Number::from_f64(num).unwrap_or(serde_json::Number::from(0)),
                    ))
                } else {
                    Err(serde_json::Error::io(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        "Invalid number format",
                    )))
                }
            }
            "boolean" => {
                let bool_val = self.config_value.parse::<bool>().map_err(|_| {
                    serde_json::Error::io(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        "Invalid boolean format",
                    ))
                })?;
                serde_json::from_value(Value::Bool(bool_val))
            }
            _ => serde_json::from_str(&format!("\"{}\"", self.config_value)), // Default to string
        }
    }
}

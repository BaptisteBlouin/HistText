//! Document processing utilities for CSV generation and data preparation.

use actix_web::error::ErrorInternalServerError;
use actix_web::Error;
use csv::{Writer, WriterBuilder};
use serde_json::Value;
use std::collections::HashSet;
use uuid::Uuid;

use crate::config::Config;

/// Prepares a CSV writer with headers extracted from document fields
/// 
/// # Arguments
/// * `all_docs` - Collection of documents to extract field names from
/// 
/// # Returns
/// Tuple containing (Writer, headers vector, file path)
pub fn prepare_csv_writer(all_docs: &[Value]) -> Result<(Writer<std::fs::File>, Vec<String>, String), Error> {
    let config = Config::global();
    let csv_filename = format!("data_{}.csv", Uuid::new_v4());
    let csv_filepath = format!("{}/{}", config.path_store_files, csv_filename);

    let mut wtr = WriterBuilder::new()
        .has_headers(true)
        .from_path(&csv_filepath)
        .map_err(|e| ErrorInternalServerError(format!("CSV file error: {}", e)))?;

    let mut field_names = HashSet::new();
    for doc in all_docs {
        if let Some(obj) = doc.as_object() {
            for key in obj.keys() {
                if !key.starts_with('_') && !key.ends_with('_') {
                    field_names.insert(key.clone());
                }
            }
        }
    }

    let mut headers: Vec<String> = field_names.into_iter().collect();
    headers.sort_unstable();

    wtr.write_record(&headers)
        .map_err(|e| ErrorInternalServerError(format!("CSV write error: {}", e)))?;

    Ok((wtr, headers, csv_filepath))
}

/// Writes document data to CSV file
/// 
/// # Arguments
/// * `wtr` - CSV writer instance
/// * `all_docs` - Documents to write
/// * `headers` - Field headers for CSV columns
pub fn write_csv_records(
    wtr: &mut Writer<std::fs::File>,
    all_docs: &[Value],
    headers: &[String],
) -> Result<(), Error> {
    for doc in all_docs {
        let mut record = Vec::with_capacity(headers.len());
        for field in headers {
            let value = match doc.get(field) {
                Some(val) => {
                    if let Some(s) = val.as_str() {
                        s.to_string()
                    } else if val.is_number() {
                        val.to_string()
                    } else if val.is_array() {
                        let empty_vec = Vec::new();
                        let arr = val.as_array().unwrap_or(&empty_vec);
                        arr.iter()
                            .map(|v| v.as_str().unwrap_or("").to_string())
                            .collect::<Vec<String>>()
                            .join(", ")
                    } else {
                        val.to_string()
                    }
                }
                None => String::new(),
            };
            record.push(value);
        }
        wtr.write_record(&record)
            .map_err(|e| ErrorInternalServerError(format!("CSV write error: {}", e)))?;
    }
    wtr.flush()
        .map_err(|e| ErrorInternalServerError(format!("CSV flush error: {}", e)))?;
    Ok(())
}
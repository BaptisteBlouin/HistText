use serde_json::Value;
use std::collections::HashMap;

pub struct QueryOptimizer;

impl QueryOptimizer {
    pub fn optimize_solr_query(
        collection: &str,
        query: &str,
        start: u32,
        rows: u32,
    ) -> String {
        let mut optimized_query = query.to_string();
        
        if query == "*:*" {
            optimized_query = format!("{}:*", Self::get_primary_field(collection));
        }

        format!(
            "q={}&start={}&rows={}&fl=*,score&wt=json&omitHeader=true&indent=false",
            optimized_query, start, rows
        )
    }

    pub fn should_use_cursor(rows: u32, total_expected: u64) -> bool {
        rows > 1000 && total_expected > 10000
    }

    pub fn optimize_field_list(collection: &str, fields: &[String]) -> Vec<String> {
        let mut optimized = fields.to_vec();
        
        if collection.contains("large") {
            optimized.retain(|f| !f.ends_with("_txt") || f.len() < 50);
        }
        
        optimized
    }

    pub fn estimate_response_size(docs: &[Value]) -> usize {
        docs.iter()
            .map(|doc| {
                serde_json::to_string(doc)
                    .map(|s| s.len())
                    .unwrap_or(100)
            })
            .sum()
    }

    fn get_primary_field(collection: &str) -> &str {
        match collection {
            c if c.contains("text") => "content",
            c if c.contains("news") => "title",
            c if c.contains("book") => "title",
            _ => "id",
        }
    }
}
-- Create app_configurations table for dynamic application settings
CREATE TABLE app_configurations (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type VARCHAR(50) NOT NULL DEFAULT 'string', -- 'string', 'number', 'boolean', 'json', 'csv'
    category VARCHAR(100) NOT NULL DEFAULT 'general', -- 'frontend', 'backend', 'limits', 'display', 'system'
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE, -- System configs cannot be deleted
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_app_configurations_category ON app_configurations(category);
CREATE INDEX idx_app_configurations_config_key ON app_configurations(config_key);

-- Insert default configurations from config.json
INSERT INTO app_configurations (config_key, config_value, config_type, category, description, is_system) VALUES
-- Frontend configuration
('statsLevelOptions', '["All", "Medium", "None"]', 'json', 'frontend', 'Available statistics level options', TRUE),
('docLevelOptions', '["100", "500", "1000", "5000", "10000"]', 'json', 'frontend', 'Document count options for queries', TRUE),
('batch_size', '100', 'number', 'frontend', 'Default batch size for operations', TRUE),
('default_date_name', 'date_rdt', 'string', 'frontend', 'Default date field name', TRUE),
('solr_selector_sentence', 'Select a Text Base', 'string', 'frontend', 'Text for Solr database selector', FALSE),
('collection_selector_sentence', 'Select a Collection', 'string', 'frontend', 'Text for collection selector', FALSE),
('viewNERFields', '["story", "text", "answers", "Text"]', 'json', 'frontend', 'Fields to display in NER view', TRUE),
('HOME_MESSAGE', 'The application is currently in beta version. Don''t hesitate to send us your feedback.', 'string', 'frontend', 'Message displayed on home page', FALSE),
('CONTACT_ADDRESS', 'histtext@gmail.com', 'string', 'frontend', 'Contact email address', FALSE),
('HOME_URL', 'https://www.enpchina.eu/2024/09/03/poc/', 'string', 'frontend', 'Home page URL', FALSE),
('USE_HOME_LOGO', 'true', 'boolean', 'frontend', 'Whether to display home logo', FALSE),
('NER_ANALYTICS_MAX_ENTITIES', '15000', 'number', 'frontend', 'Maximum entities for NER analytics', TRUE),
('NER_ANALYTICS_WARNING_THRESHOLD', '15000', 'number', 'frontend', 'Warning threshold for NER analytics', TRUE),
('MAX_ENTITIES_FOR_FULL_ANALYSIS', '15000', 'number', 'frontend', 'Maximum entities for full analysis', TRUE),

-- Limits configuration
('limits_query_max_results', '10000', 'number', 'limits', 'Maximum number of documents to return in queries', TRUE),
('limits_document_max_size_mb', '50', 'number', 'limits', 'Maximum document size in MB', TRUE),
('limits_ner_max_ids', '1000', 'number', 'limits', 'Maximum number of document IDs to process for NER', TRUE),
('limits_metadata_max_select', '50', 'number', 'limits', 'Maximum number of values to display in metadata selection', TRUE),
('limits_query_payload_max_mb', '10', 'number', 'limits', 'Maximum size for query JSON payloads in megabytes', TRUE),
('limits_upload_max_mb', '128', 'number', 'limits', 'Maximum size for document uploads in megabytes', TRUE),

-- Cache configuration
('cache_embeddings_max_files', '3', 'number', 'backend', 'Maximum number of embedding files to cache in memory', TRUE),
('cache_ttl_seconds', '3600', 'number', 'backend', 'Default cache time-to-live in seconds', TRUE),
('cache_max_entries', '1000', 'number', 'backend', 'Maximum number of cache entries', TRUE),
('cache_enable_query_results', 'true', 'boolean', 'backend', 'Enable caching of query results', FALSE),
('cache_cleanup_interval_seconds', '300', 'number', 'backend', 'Cache cleanup interval in seconds', TRUE),

-- Response configuration
('response_enable_streaming', 'false', 'boolean', 'backend', 'Enable streaming for large dataset responses', FALSE),

-- Field exclusion configuration
('EXCLUDE_FIELD_TYPES', 'text_general,text_normalized_cjk,integer', 'csv', 'display', 'List of field types to exclude from display', TRUE),
('EXCLUDE_FIELD_NAMES', 'date_rdt', 'csv', 'display', 'List of field names to exclude from display', TRUE),
('EXCLUDE_FIELD_NAME_PATTERNS', 'wke_,wk_', 'csv', 'display', 'List of field name patterns to exclude from display', TRUE),
('EXCLUDE_REQUEST_NAME_STARTS_WITH', '_', 'string', 'display', 'Prefix to exclude for request names', TRUE),
('EXCLUDE_REQUEST_NAME_ENDS_WITH', '_', 'string', 'display', 'Suffix to exclude for request names', TRUE),
('ID_STARTS_WITH', 'id', 'string', 'display', 'Prefix for ID fields', TRUE),
('ID_ENDS_WITH', 'id', 'string', 'display', 'Suffix for ID fields', TRUE),
('MAIN_DATE_VALUE', 'date_rdt', 'string', 'display', 'Field name for main date value', TRUE),

-- System configuration
('alert_message', '', 'string', 'system', 'Alert message to display on home page (empty = no alert)', FALSE),
('alert_type', 'info', 'string', 'system', 'Type of alert (info, warning, error, success)', FALSE),
('alert_enabled', 'false', 'boolean', 'system', 'Whether to show the alert message', FALSE);

-- Insert NER labels and colors configuration
INSERT INTO app_configurations (config_key, config_value, config_type, category, description, is_system) VALUES
('NER_LABELS_COLORS', '{"P": "rgba(255, 99, 132, 1)", "N": "rgba(255, 159, 64, 1)", "F": "rgba(255, 205, 86, 1)", "O": "rgba(54, 162, 235, 1)", "G": "rgba(75, 192, 192, 1)", "L": "rgba(153, 102, 255, 1)", "PR": "rgba(201, 203, 207, 1)", "E": "rgba(255, 102, 204, 1)", "W": "rgba(102, 51, 153, 1)", "LA": "rgba(220, 20, 60, 1)", "D": "rgba(255, 215, 0, 1)", "T": "rgba(0, 191, 255, 1)", "PE": "rgba(34, 139, 34, 1)", "M": "rgba(46, 139, 87, 1)", "Q": "rgba(255, 140, 0, 1)", "OR": "rgba(138, 43, 226, 1)", "C": "rgba(100, 149, 237, 1)", "LG": "rgba(0, 206, 209, 1)", "MI": "rgba(119, 136, 153, 1)"}', 'json', 'frontend', 'Color mapping for NER labels', TRUE),
('NERLABELS2FULL', '{"P": "PERSON", "N": "NORP", "F": "FAC", "O": "ORG", "G": "GPE", "L": "LOC", "PR": "PRODUCT", "E": "EVENT", "W": "WORK_OF_ART", "LA": "LAW", "D": "DATE", "T": "TIME", "PE": "PERCENT", "M": "MONEY", "Q": "QUANTITY", "OR": "ORDINAL", "C": "CARDINAL", "LG": "LANGUAGE", "MI": "MISC"}', 'json', 'frontend', 'Full names for NER label abbreviations', TRUE);
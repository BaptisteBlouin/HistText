-- Remove authentication and performance configuration settings
DELETE FROM app_configurations WHERE config_key IN (
    'auth_access_token_ttl_seconds',
    'auth_refresh_token_ttl_hours',
    'auth_activation_token_ttl_days',
    'auth_reset_token_ttl_hours',
    'performance_cache_cleanup_interval_seconds',
    'limits_pagination_default_size',
    'ui_statistics_responsive_breakpoints',
    'performance_max_embeddings_files',
    'performance_cache_ttl_seconds',
    'performance_max_cache_size',
    'performance_enable_query_cache',
    'performance_enable_response_streaming'
);
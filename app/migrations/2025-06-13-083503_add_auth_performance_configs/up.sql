-- Add authentication and performance configuration settings
INSERT INTO app_configurations (config_key, config_value, config_type, category, description, is_system) VALUES 
-- Authentication timeout configurations
('auth_access_token_ttl_seconds', '900', 'number', 'system', 'Access token time-to-live in seconds (default: 15 minutes)', true),
('auth_refresh_token_ttl_hours', '24', 'number', 'system', 'Refresh token time-to-live in hours (default: 24 hours)', true),
('auth_activation_token_ttl_days', '30', 'number', 'system', 'Account activation token time-to-live in days (default: 30 days)', true),
('auth_reset_token_ttl_hours', '24', 'number', 'system', 'Password reset token time-to-live in hours (default: 24 hours)', true),

-- Backend pagination configuration
('backend_pagination_default_size', '10', 'number', 'backend', 'Default pagination page size for API responses', false),

-- UI responsive configurations
('ui_statistics_responsive_breakpoints', '{"mobile": 480, "tablet": 768, "desktop": 1024}', 'json', 'frontend', 'Responsive breakpoints for statistics table columns', false)

ON CONFLICT (config_key) DO NOTHING;
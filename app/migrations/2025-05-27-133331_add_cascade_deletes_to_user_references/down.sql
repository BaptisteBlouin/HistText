-- Revert CASCADE delete constraints back to RESTRICT (default behavior)
-- This undoes the changes made in up.sql

-- User Sessions: Back to RESTRICT
ALTER TABLE user_sessions 
DROP CONSTRAINT user_sessions_user_id_fkey,
ADD CONSTRAINT user_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id);

-- User Roles: Back to RESTRICT  
ALTER TABLE user_roles
DROP CONSTRAINT user_roles_user_id_fkey,
ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

-- User Permissions: Back to RESTRICT
ALTER TABLE user_permissions
DROP CONSTRAINT user_permissions_user_id_fkey, 
ADD CONSTRAINT user_permissions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

-- User OAuth2 Links: Back to RESTRICT
ALTER TABLE user_oauth2_links
DROP CONSTRAINT user_oauth2_links_user_id_fkey,
ADD CONSTRAINT user_oauth2_links_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

-- Security Events: Back to RESTRICT
ALTER TABLE security_events
DROP CONSTRAINT security_events_user_id_fkey,
ADD CONSTRAINT security_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id);

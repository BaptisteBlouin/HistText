-- Add CASCADE delete constraints to user foreign keys
-- This will automatically delete related records when a user is deleted

-- User Sessions: DELETE CASCADE (sessions should be deleted with user)
ALTER TABLE user_sessions 
DROP CONSTRAINT user_sessions_user_id_fkey,
ADD CONSTRAINT user_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- User Roles: DELETE CASCADE (role assignments should be deleted with user)
ALTER TABLE user_roles
DROP CONSTRAINT user_roles_user_id_fkey,
ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- User Permissions: DELETE CASCADE (direct permissions should be deleted with user)
ALTER TABLE user_permissions
DROP CONSTRAINT user_permissions_user_id_fkey, 
ADD CONSTRAINT user_permissions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- User OAuth2 Links: DELETE CASCADE (OAuth links should be deleted with user)
ALTER TABLE user_oauth2_links
DROP CONSTRAINT user_oauth2_links_user_id_fkey,
ADD CONSTRAINT user_oauth2_links_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Security Events: SET NULL (preserve audit logs but nullify user reference)
-- This is important for maintaining audit trails even after user deletion
ALTER TABLE security_events
DROP CONSTRAINT security_events_user_id_fkey,
ADD CONSTRAINT security_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

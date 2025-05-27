-- Remove FreeUser role assignments
DELETE FROM user_roles WHERE role = 'FreeUser';

-- Remove FreeUser role permissions
DELETE FROM role_permissions WHERE role = 'FreeUser';

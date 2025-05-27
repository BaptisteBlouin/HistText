INSERT INTO role_permissions (role, permission) VALUES 
    ('FreeUser', 'free')
ON CONFLICT (role, permission) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT u.id, 'FreeUser'
FROM users u
WHERE u.activated = true
  AND u.id NOT IN (
    SELECT ur.user_id 
    FROM user_roles ur 
    WHERE ur.role = 'FreeUser'
  )
ON CONFLICT (user_id, role) DO NOTHING;

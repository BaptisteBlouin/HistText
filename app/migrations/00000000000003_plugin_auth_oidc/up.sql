CREATE TABLE user_oauth2_links (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL,

  -- all attempts at oauth2 will create a record with these properties
  csrf_token TEXT NOT NULL,
  nonce TEXT NOT NULL,
  pkce_secret TEXT NOT NULL,

  -- when oauth2 attempts succeed, either a user is created or the oauth2 attempt is discarded
  -- depending on whether or not the user ends up linking the account or not
  refresh_token TEXT,
  access_token TEXT,
  subject_id TEXT UNIQUE,
  user_id INT REFERENCES users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SELECT manage_updated_at('user_oauth2_links');

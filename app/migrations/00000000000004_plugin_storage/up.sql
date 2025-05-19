CREATE TABLE attachment_blobs(
  id SERIAL PRIMARY KEY,

  key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  byte_size BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  service_name TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attachments(
  id SERIAL PRIMARY KEY,

  name TEXT NOT NULL,
  record_type TEXT NOT NULL,
  record_id SERIAL NOT NULL,
  blob_id SERIAL REFERENCES attachment_blobs(id) NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

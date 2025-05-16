CREATE TABLE solr_databases (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    server_port INT NOT NULL,
    local_port INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE solr_database_permissions (
    solr_database_id INT4 NOT NULL,
    collection_name TEXT NOT NULL,
    permission TEXT NOT NULL,
    PRIMARY KEY (solr_database_id, collection_name, permission),
    FOREIGN KEY (solr_database_id) REFERENCES solr_databases(id) ON DELETE CASCADE
);

CREATE TABLE solr_database_info (
    solr_database_id INT4 NOT NULL,
    collection_name TEXT NOT NULL,
    description TEXT NOT NULL,
    embeddings TEXT NOT NULL,
    lang TEXT DEFAULT NULL,
    text_field TEXT DEFAULT NULL,
    tokenizer TEXT DEFAULT NULL,
    to_not_display TEXT[] DEFAULT NULL,
    PRIMARY KEY (solr_database_id, collection_name),
    FOREIGN KEY (solr_database_id) REFERENCES solr_databases(id) ON DELETE CASCADE
);
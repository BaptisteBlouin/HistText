// @generated automatically by Diesel CLI.

pub mod sql_types {
    #[derive(diesel::sql_types::SqlType)]
    #[diesel(postgres_type(name = "fang_task_state"))]
    pub struct FangTaskState;
}

diesel::table! {
    attachment_blobs (id) {
        id -> Int4,
        key -> Text,
        file_name -> Text,
        content_type -> Nullable<Text>,
        byte_size -> Int8,
        checksum -> Text,
        service_name -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    attachments (id) {
        id -> Int4,
        name -> Text,
        record_type -> Text,
        record_id -> Int4,
        blob_id -> Int4,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    use diesel::sql_types::*;
    use super::sql_types::FangTaskState;

    fang_tasks (id) {
        id -> Uuid,
        metadata -> Jsonb,
        error_message -> Nullable<Text>,
        state -> FangTaskState,
        task_type -> Varchar,
        #[max_length = 64]
        uniq_hash -> Nullable<Bpchar>,
        retries -> Int4,
        scheduled_at -> Timestamptz,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    role_permissions (role, permission) {
        role -> Text,
        permission -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    security_events (id) {
        id -> Int4,
        #[max_length = 50]
        event_type -> Varchar,
        user_id -> Nullable<Int4>,
        #[max_length = 255]
        user_email -> Nullable<Varchar>,
        description -> Text,
        #[max_length = 20]
        severity -> Varchar,
        #[max_length = 45]
        ip_address -> Nullable<Varchar>,
        user_agent -> Nullable<Text>,
        created_at -> Timestamp,
    }
}

diesel::table! {
    solr_database_info (solr_database_id, collection_name) {
        solr_database_id -> Int4,
        collection_name -> Text,
        description -> Text,
        embeddings -> Text,
        lang -> Nullable<Text>,
        text_field -> Nullable<Text>,
        tokenizer -> Nullable<Text>,
        to_not_display -> Nullable<Array<Nullable<Text>>>,
    }
}

diesel::table! {
    solr_database_permissions (solr_database_id, collection_name, permission) {
        solr_database_id -> Int4,
        collection_name -> Text,
        permission -> Text,
    }
}

diesel::table! {
    solr_databases (id) {
        id -> Int4,
        name -> Text,
        url -> Text,
        server_port -> Int4,
        local_port -> Int4,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    todos (id) {
        id -> Int4,
        text -> Text,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    user_oauth2_links (id) {
        id -> Int4,
        provider -> Text,
        csrf_token -> Text,
        nonce -> Text,
        pkce_secret -> Text,
        refresh_token -> Nullable<Text>,
        access_token -> Nullable<Text>,
        subject_id -> Nullable<Text>,
        user_id -> Nullable<Int4>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    user_permissions (user_id, permission) {
        user_id -> Int4,
        permission -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    user_roles (user_id, role) {
        user_id -> Int4,
        role -> Text,
        created_at -> Timestamptz,
    }
}

diesel::table! {
    user_sessions (id) {
        id -> Int4,
        user_id -> Int4,
        refresh_token -> Text,
        device -> Nullable<Text>,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::table! {
    users (id) {
        id -> Int4,
        email -> Text,
        hash_password -> Text,
        firstname -> Text,
        lastname -> Text,
        activated -> Bool,
        created_at -> Timestamptz,
        updated_at -> Timestamptz,
    }
}

diesel::joinable!(attachments -> attachment_blobs (blob_id));
diesel::joinable!(security_events -> users (user_id));
diesel::joinable!(solr_database_info -> solr_databases (solr_database_id));
diesel::joinable!(solr_database_permissions -> solr_databases (solr_database_id));
diesel::joinable!(user_oauth2_links -> users (user_id));
diesel::joinable!(user_permissions -> users (user_id));
diesel::joinable!(user_roles -> users (user_id));
diesel::joinable!(user_sessions -> users (user_id));

diesel::allow_tables_to_appear_in_same_query!(
    attachment_blobs,
    attachments,
    fang_tasks,
    role_permissions,
    security_events,
    solr_database_info,
    solr_database_permissions,
    solr_databases,
    todos,
    user_oauth2_links,
    user_permissions,
    user_roles,
    user_sessions,
    users,
);

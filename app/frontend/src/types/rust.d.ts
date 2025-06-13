/* This file is generated and managed by tsync */

/** Struct representing a row in table `app_configurations` */
interface AppConfigurations {
  /** Field representing column `id` */
  id: number;
  /** Field representing column `config_key` */
  config_key: string;
  /** Field representing column `config_value` */
  config_value: string;
  /** Field representing column `config_type` */
  config_type: string;
  /** Field representing column `category` */
  category: string;
  /** Field representing column `description` */
  description?: string;
  /** Field representing column `is_system` */
  is_system: boolean;
  /** Field representing column `created_at` */
  created_at: Date;
  /** Field representing column `updated_at` */
  updated_at: Date;
}

/** Create Struct for a row in table `app_configurations` for [`AppConfigurations`] */
interface CreateAppConfigurations {
  /** Field representing column `config_key` */
  config_key: string;
  /** Field representing column `config_value` */
  config_value: string;
  /** Field representing column `config_type` */
  config_type: string;
  /** Field representing column `category` */
  category: string;
  /** Field representing column `description` */
  description?: string;
  /** Field representing column `is_system` */
  is_system: boolean;
}

/** Update Struct for a row in table `app_configurations` for [`AppConfigurations`] */
interface UpdateAppConfigurations {
  /** Field representing column `config_key` */
  config_key?: string;
  /** Field representing column `config_value` */
  config_value?: string;
  /** Field representing column `config_type` */
  config_type?: string;
  /** Field representing column `category` */
  category?: string;
  /** Field representing column `description` */
  description?: string;
  /** Field representing column `is_system` */
  is_system?: boolean;
  /** Field representing column `created_at` */
  created_at?: Date;
  /** Field representing column `updated_at` */
  updated_at?: Date;
}

/** Result of a `.paginate` function */
interface PaginationResult<T> {
  /** Resulting items that are from the current page */
  items: Array<T>;
  /** The count of total items there are */
  total_items: number;
  /** Current page, 0-based index */
  page: number;
  /** Size of a page */
  page_size: number;
  /** Number of total possible pages, given the `page_size` and `total_items` */
  num_pages: number;
}

/** Struct representing a row in table `security_events` */
interface SecurityEvents {
  /** Field representing column `id` */
  id: number;
  /** Field representing column `event_type` */
  event_type: string;
  /** Field representing column `user_id` */
  user_id?: number;
  /** Field representing column `user_email` */
  user_email?: string;
  /** Field representing column `description` */
  description: string;
  /** Field representing column `severity` */
  severity: string;
  /** Field representing column `ip_address` */
  ip_address?: string;
  /** Field representing column `user_agent` */
  user_agent?: string;
  /** Field representing column `created_at` */
  created_at: Date;
}

/** Create Struct for a row in table `security_events` for [`SecurityEvents`] */
interface CreateSecurityEvents {
  /** Field representing column `event_type` */
  event_type: string;
  /** Field representing column `user_id` */
  user_id?: number;
  /** Field representing column `user_email` */
  user_email?: string;
  /** Field representing column `description` */
  description: string;
  /** Field representing column `severity` */
  severity: string;
  /** Field representing column `ip_address` */
  ip_address?: string;
  /** Field representing column `user_agent` */
  user_agent?: string;
}

/** Update Struct for a row in table `security_events` for [`SecurityEvents`] */
interface UpdateSecurityEvents {
  /** Field representing column `event_type` */
  event_type?: string;
  /** Field representing column `user_id` */
  user_id?: number;
  /** Field representing column `user_email` */
  user_email?: string;
  /** Field representing column `description` */
  description?: string;
  /** Field representing column `severity` */
  severity?: string;
  /** Field representing column `ip_address` */
  ip_address?: string;
  /** Field representing column `user_agent` */
  user_agent?: string;
  /** Field representing column `created_at` */
  created_at?: Date;
}

interface SolrDatabasePermission {
  solr_database_id: number;
  collection_name: string;
  permission: string;
}

interface CreateSolrDatabasePermission {
  solr_database_id: number;
  collection_name: string;
  permission: string;
}

interface PaginationResult<T> {
  items: Array<T>;
  total_items: number;
  /** 0-based index */
  page: number;
  page_size: number;
  num_pages: number;
}

interface basis {
  id: number;
  name: string;
  url: string;
  server_port: number;
  local_port: number;
  created_at: Date;
  updated_at: Date;
}

interface Createbasis {
  name: string;
  url: string;
  server_port: number;
  local_port: number;
}

interface Updatebasis {
  name?: string;
  url?: string;
  server_port?: number;
  local_port?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface PaginationResult<T> {
  items: Array<T>;
  total_items: number;
  /** 0-based index */
  page: number;
  page_size: number;
  num_pages: number;
}

/** Struct representing a row in table `_sqlx_migrations` */
interface SqlxMigrations {
  /** Field representing column `version` */
  version: number;
  /** Field representing column `description` */
  description: string;
  /** Field representing column `installed_on` */
  installed_on: Date;
  /** Field representing column `success` */
  success: boolean;
  /** Field representing column `checksum` */
  checksum: Array<number>;
  /** Field representing column `execution_time` */
  execution_time: number;
}

/** Create Struct for a row in table `_sqlx_migrations` for [`SqlxMigrations`] */
interface CreateSqlxMigrations {
  /** Field representing column `version` */
  version: number;
  /** Field representing column `description` */
  description: string;
  /** Field representing column `installed_on` */
  installed_on: Date;
  /** Field representing column `success` */
  success: boolean;
  /** Field representing column `checksum` */
  checksum: Array<number>;
  /** Field representing column `execution_time` */
  execution_time: number;
}

/** Update Struct for a row in table `_sqlx_migrations` for [`SqlxMigrations`] */
interface UpdateSqlxMigrations {
  /** Field representing column `description` */
  description?: string;
  /** Field representing column `installed_on` */
  installed_on?: Date;
  /** Field representing column `success` */
  success?: boolean;
  /** Field representing column `checksum` */
  checksum?: Array<number>;
  /** Field representing column `execution_time` */
  execution_time?: number;
}

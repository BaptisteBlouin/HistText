/* This file is generated and managed by tsync */

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

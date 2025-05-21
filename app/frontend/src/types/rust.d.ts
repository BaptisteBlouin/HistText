/* This file is generated and managed by tsync */

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

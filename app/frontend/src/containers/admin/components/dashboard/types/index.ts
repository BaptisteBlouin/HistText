export interface LegacyStats {
    total_docs: number;
    total_collections: number;
    total_users: number;
    active_collections: number;
  }
  
  export interface SolrDatabaseStatus {
    id: number;
    name: string;
    status: 'online' | 'offline' | 'error';
    document_count?: number;
    collections: CollectionStatus[];
    response_time_ms?: number;
    error_message?: string;
  }
  
  export interface CollectionStatus {
    name: string;
    document_count?: number;
    has_embeddings: boolean;
    embedding_path?: string;
  }
  
  export interface EmbeddingSummary {
    total_cached_embeddings: number;
    cache_hit_ratio: number;
    memory_usage_mb: number;
    memory_usage_percent: number;
    cached_collections: number;
  }
  
  export interface ComprehensiveStats {
    total_documents: number;
    total_collections: number;
    total_users: number;
    active_collections: number;
    active_sessions: number;
    recent_registrations_24h: number;
    solr_databases: SolrDatabaseStatus[];
    embedding_summary: EmbeddingSummary;
  }
  
  export interface DetailedEmbeddingStats {
    collection_cache_entries: number;
    path_cache_entries: number;
    total_embeddings_loaded: number;
    memory_usage_bytes: number;
    memory_limit_bytes: number;
    memory_usage_percent: number;
    hit_ratio: number;
    total_hits: number;
    total_misses: number;
    total_evictions: number;
    last_eviction?: string;
    uptime_seconds: number;
  }
  
  export interface AdvancedCacheStats {
    cache: {
      entries_count: number;
      memory_usage: number;
      max_memory: number;
      hit_ratio: number;
      total_hits: number;
      total_misses: number;
      total_evictions: number;
      total_embeddings_loaded: number;
    };
    performance: {
      avg_similarity_time_us: number;
      avg_search_time_ms: number;
      total_similarity_computations: number;
      total_searches: number;
      peak_memory_bytes: number;
      samples_collected: number;
    };
    system_info: {
      cpu_cores: number;
      total_memory_bytes: number;
      architecture: string;
      operating_system: string;
    };
    timestamp: string;
  }
  
  export interface RequestAnalytics {
    endpoint_stats: Record<string, EndpointStats>;
    error_stats: Record<string, number>;
    hourly_requests: HourlyRequestCount[];
    top_slow_endpoints: SlowEndpoint[];
    total_requests_24h: number;
    average_response_time_ms: number;
    error_rate_percent: number;
    last_updated: number;
  }
  
  export interface EndpointStats {
    path_pattern: string;
    method: string;
    request_count: number;
    total_response_time_ms: number;
    average_response_time_ms: number;
    error_count: number;
    last_accessed: number;
    success_rate_percent: number;
  }
  
  export interface HourlyRequestCount {
    hour: number;
    request_count: number;
    error_count: number;
  }
  
  export interface SlowEndpoint {
    path: string;
    method: string;
    average_response_time_ms: number;
    request_count: number;
  }
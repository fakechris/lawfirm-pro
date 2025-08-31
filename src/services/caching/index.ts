// Caching Services
export { CacheServiceImplementation } from './CacheService';

// Service interfaces
export interface CachingManager {
  createCache(config: CacheConfig): Promise<string>;
  deleteCache(cacheId: string): Promise<void>;
  getCache(cacheId: string): Promise<CacheService | null>;
  listCaches(): Promise<CacheInfo[]>;
  getGlobalMetrics(): Promise<GlobalCacheMetrics>;
  optimizeCaches(): Promise<OptimizationResult>;
}

// Cache configuration interfaces
export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  strategy: 'LRU' | 'FIFO' | 'TTL';
  cleanupInterval: number;
  compression: boolean;
  persistence?: PersistenceConfig;
  replication?: ReplicationConfig;
}

export interface PersistenceConfig {
  enabled: boolean;
  type: 'file' | 'database' | 'redis';
  connectionString?: string;
  syncInterval: number;
  compression: boolean;
}

export interface ReplicationConfig {
  enabled: boolean;
  mode: 'master' | 'slave' | 'cluster';
  nodes: string[];
  syncMode: 'sync' | 'async';
  healthCheckInterval: number;
}

export interface CacheInfo {
  id: string;
  name: string;
  config: CacheConfig;
  status: 'active' | 'inactive' | 'error';
  metrics: CacheMetrics;
  createdAt: Date;
  lastAccessed: Date;
}

export interface GlobalCacheMetrics {
  totalCaches: number;
  activeCaches: number;
  totalEntries: number;
  totalMemoryUsage: number;
  globalHitRate: number;
  globalMissRate: number;
  averageResponseTime: number;
  uptime: number;
}

export interface OptimizationResult {
  optimized: boolean;
  recommendations: OptimizationRecommendation[];
  actionsTaken: OptimizationAction[];
  beforeMetrics: GlobalCacheMetrics;
  afterMetrics: GlobalCacheMetrics;
  timeTaken: number;
}

export interface OptimizationRecommendation {
  type: 'size' | 'ttl' | 'strategy' | 'compression' | 'persistence';
  cacheId?: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  estimatedImprovement: number;
}

export interface OptimizationAction {
  type: 'resize' | 'retune' | 'compress' | 'cleanup' | 'replicate';
  cacheId?: string;
  description: string;
  result: 'success' | 'failed' | 'skipped';
  details?: string;
}

// Advanced caching strategies
export interface CacheStrategy {
  name: string;
  description: string;
  shouldEvict(entry: CacheEntry, cache: Map<string, CacheEntry>): boolean;
  selectVictim(cache: Map<string, CacheEntry>): string | null;
  onAccess(entry: CacheEntry): void;
  onInsert(entry: CacheEntry): void;
}

export interface CacheWarmer {
  warmupKeys: string[];
  warmupInterval: number;
  concurrency: number;
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface CacheInvalidationRule {
  id: string;
  pattern: string;
  type: 'exact' | 'prefix' | 'suffix' | 'regex';
  conditions: InvalidationCondition[];
  action: 'delete' | 'refresh' | 'tag';
}

export interface InvalidationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt';
  value: any;
}

// Import types from models
import type {
  CacheService,
  CacheEntry,
  CacheMetrics
} from '../../models/integration';
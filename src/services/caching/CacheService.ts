import { 
  CacheService, 
  CacheConfig, 
  CacheEntry, 
  CacheMetrics 
} from '../../models/integration';
import { IntegrationLoggerImplementation } from '../integration/logger';

export class CacheServiceImplementation implements CacheService {
  private logger: IntegrationLoggerImplementation;
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private metrics: CacheMetrics = this.initializeMetrics();

  constructor(config?: Partial<CacheConfig>) {
    this.logger = new IntegrationLoggerImplementation();
    this.config = this.mergeConfig(config);
    this.startCleanupInterval();
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const actualTTL = ttl || this.config.defaultTTL;
      const entry: CacheEntry = {
        key,
        value,
        ttl: actualTTL,
        createdAt: new Date(),
        accessedAt: new Date(),
        hitCount: 0,
        metadata: {
          size: this.calculateSize(value),
          compressed: this.config.compression
        }
      };

      // Check if we need to evict entries
      if (this.cache.size >= this.config.maxSize) {
        await this.evictEntries();
      }

      this.cache.set(key, entry);
      this.updateMetrics('set', entry);

      this.logger.debug(`Cache entry set`, {
        key,
        ttl: actualTTL,
        size: entry.metadata?.size
      });

    } catch (error) {
      this.logger.error(`Failed to set cache entry`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.updateMetrics('miss');
        return null;
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.updateMetrics('miss');
        this.logger.debug(`Cache entry expired`, { key });
        return null;
      }

      // Update access info
      entry.accessedAt = new Date();
      entry.hitCount++;
      
      this.updateMetrics('hit', entry);
      
      this.logger.debug(`Cache entry retrieved`, {
        key,
        hitCount: entry.hitCount,
        age: Date.now() - entry.createdAt.getTime()
      });

      return entry.value;

    } catch (error) {
      this.logger.error(`Failed to get cache entry`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      const entry = this.cache.get(key);
      
      if (entry) {
        this.cache.delete(key);
        this.updateMetrics('delete', entry);
        
        this.logger.debug(`Cache entry deleted`, { key });
      } else {
        this.logger.debug(`Cache entry not found for deletion`, { key });
      }

    } catch (error) {
      this.logger.error(`Failed to delete cache entry`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const size = this.cache.size;
      this.cache.clear();
      this.resetMetrics();
      
      this.logger.info(`Cache cleared`, { entriesRemoved: size });

    } catch (error) {
      this.logger.error(`Failed to clear cache`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return false;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error(`Failed to check cache entry existence`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return -1;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return -1;
      }

      const now = Date.now();
      const age = (now - entry.createdAt.getTime()) / 1000;
      const remaining = Math.max(0, entry.ttl - age);
      
      return Math.floor(remaining);

    } catch (error) {
      this.logger.error(`Failed to get cache entry TTL`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return -1;
    }
  }

  async getMetrics(): Promise<CacheMetrics> {
    return { ...this.metrics };
  }

  // Advanced cache operations
  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    
    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        result[key] = value;
      }
    }
    
    return result;
  }

  async setMultiple(entries: Record<string, { value: any; ttl?: number }>): Promise<void> {
    for (const [key, entry] of Object.entries(entries)) {
      await this.set(key, entry.value, entry.ttl);
    }
  }

  async increment(key: string, delta: number = 1): Promise<number> {
    try {
      const currentValue = await this.get(key);
      const newValue = (typeof currentValue === 'number' ? currentValue : 0) + delta;
      
      await this.set(key, newValue);
      return newValue;
      
    } catch (error) {
      this.logger.error(`Failed to increment cache value`, {
        key,
        delta,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    return this.increment(key, -delta);
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        return;
      }

      // Update TTL
      const now = Date.now();
      const age = (now - entry.createdAt.getTime()) / 1000;
      entry.ttl = ttl + age;
      
      this.logger.debug(`Cache entry TTL updated`, {
        key,
        newTTL: entry.ttl
      });

    } catch (error) {
      this.logger.error(`Failed to expire cache entry`, {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async persist(key: string): Promise<void> {
    try {
      const entry = this.cache.get(key);
      
      if (entry) {
        entry.ttl = -1; // Infinite TTL
        this.logger.debug(`Cache entry persisted`, { key });
      }

    } catch (error) {
      this.logger.error(`Failed to persist cache entry`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async scan(pattern: string, count: number = 10): Promise<string[]> {
    try {
      const regex = this.patternToRegex(pattern);
      const keys: string[] = [];
      
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keys.push(key);
          if (keys.length >= count) {
            break;
          }
        }
      }
      
      return keys;
      
    } catch (error) {
      this.logger.error(`Failed to scan cache keys`, {
        pattern,
        count,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async cleanup(): Promise<void> {
    try {
      const beforeSize = this.cache.size;
      const expiredKeys: string[] = [];
      
      for (const [key, entry] of this.cache.entries()) {
        if (this.isExpired(entry)) {
          expiredKeys.push(key);
        }
      }
      
      for (const key of expiredKeys) {
        this.cache.delete(key);
      }
      
      const afterSize = this.cache.size;
      this.metrics.lastCleanup = new Date();
      
      this.logger.info(`Cache cleanup completed`, {
        entriesRemoved: expiredKeys.length,
        beforeSize,
        afterSize
      });

    } catch (error) {
      this.logger.error(`Failed to cleanup cache`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods
  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === -1) return false; // Persistent entry
    
    const now = Date.now();
    const age = (now - entry.createdAt.getTime()) / 1000;
    return age > entry.ttl;
  }

  private async evictEntries(): Promise<void> {
    const entriesToEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1)); // Evict 10% of entries
    
    switch (this.config.strategy) {
      case 'LRU':
        await this.evictLRU(entriesToEvict);
        break;
      case 'FIFO':
        await this.evictFIFO(entriesToEvict);
        break;
      case 'TTL':
        await this.evictTTL(entriesToEvict);
        break;
      default:
        await this.evictLRU(entriesToEvict);
    }
  }

  private async evictLRU(count: number): Promise<void> {
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].accessedAt.getTime() - b[1].accessedAt.getTime());
    
    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      this.cache.delete(sortedEntries[i][0]);
    }
  }

  private async evictFIFO(count: number): Promise<void> {
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    
    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      this.cache.delete(sortedEntries[i][0]);
    }
  }

  private async evictTTL(count: number): Promise<void> {
    const sortedEntries = Array.from(this.cache.entries())
      .sort((a, b) => {
        const aAge = (Date.now() - a[1].createdAt.getTime()) / 1000;
        const bAge = (Date.now() - b[1].createdAt.getTime()) / 1000;
        const aTTLRatio = aAge / a[1].ttl;
        const bTTLRatio = bAge / b[1].ttl;
        return aTTLRatio - bTTLRatio;
      });
    
    for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
      this.cache.delete(sortedEntries[i][0]);
    }
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch (error) {
      return 0;
    }
  }

  private updateMetrics(operation: string, entry?: CacheEntry): void {
    switch (operation) {
      case 'hit':
        this.metrics.hitCount++;
        break;
      case 'miss':
        this.metrics.missCount++;
        break;
      case 'set':
        this.metrics.totalEntries = this.cache.size;
        if (entry?.metadata?.size) {
          this.metrics.memoryUsage += entry.metadata.size;
        }
        break;
      case 'delete':
        this.metrics.totalEntries = this.cache.size;
        if (entry?.metadata?.size) {
          this.metrics.memoryUsage = Math.max(0, this.metrics.memoryUsage - entry.metadata.size);
        }
        break;
    }

    // Update rates
    const total = this.metrics.hitCount + this.metrics.missCount;
    if (total > 0) {
      this.metrics.hitRate = this.metrics.hitCount / total;
      this.metrics.missRate = this.metrics.missCount / total;
    }

    // Update average TTL
    if (this.cache.size > 0) {
      const totalTTL = Array.from(this.cache.values())
        .reduce((sum, entry) => sum + entry.ttl, 0);
      this.metrics.averageTTL = totalTTL / this.cache.size;
    }
  }

  private resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): CacheMetrics {
    return {
      totalEntries: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      missRate: 0,
      averageTTL: 0,
      memoryUsage: 0,
      lastCleanup: new Date()
    };
  }

  private mergeConfig(config?: Partial<CacheConfig>): CacheConfig {
    return {
      maxSize: config?.maxSize || 10000,
      defaultTTL: config?.defaultTTL || 3600,
      strategy: config?.strategy || 'LRU',
      cleanupInterval: config?.cleanupInterval || 300000, // 5 minutes
      compression: config?.compression !== false // Default to true
    };
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        this.logger.error(`Cache cleanup interval failed`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.cleanupInterval);
  }

  private patternToRegex(pattern: string): RegExp {
    // Convert simple wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`);
  }

  // Lifecycle management
  async destroy(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }
      
      await this.clear();
      
      this.logger.info(`Cache service destroyed`);
      
    } catch (error) {
      this.logger.error(`Failed to destroy cache service`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Debug and utility methods
  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      totalEntries: this.cache.size,
      memoryUsage: this.metrics.memoryUsage,
      hitRate: this.metrics.hitRate,
      missRate: this.metrics.missRate,
      averageTTL: this.metrics.averageTTL,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.createdAt.getTime())) : null,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.createdAt.getTime())) : null,
      expiredEntries: entries.filter(e => this.isExpired(e)).length,
      compressionEnabled: this.config.compression,
      evictionStrategy: this.config.strategy,
      lastCleanup: this.metrics.lastCleanup
    };
  }

  async exportData(): Promise<CacheExport> {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      ttl: entry.ttl,
      createdAt: entry.createdAt.toISOString(),
      accessedAt: entry.accessedAt.toISOString(),
      hitCount: entry.hitCount,
      metadata: entry.metadata
    }));

    return {
      entries,
      config: this.config,
      metrics: this.metrics,
      exportedAt: new Date().toISOString()
    };
  }

  async importData(data: CacheExport): Promise<void> {
    try {
      await this.clear();
      
      this.config = data.config;
      this.metrics = data.metrics;
      
      for (const entry of data.entries) {
        await this.set(entry.key, entry.value, entry.ttl);
      }
      
      this.logger.info(`Cache data imported`, {
        entriesImported: data.entries.length
      });

    } catch (error) {
      this.logger.error(`Failed to import cache data`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Additional interfaces for advanced features
export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  averageTTL: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  expiredEntries: number;
  compressionEnabled: boolean;
  evictionStrategy: string;
  lastCleanup: Date;
}

export interface CacheExport {
  entries: CacheExportEntry[];
  config: CacheConfig;
  metrics: CacheMetrics;
  exportedAt: string;
}

export interface CacheExportEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: string;
  accessedAt: string;
  hitCount: number;
  metadata?: Record<string, any>;
}
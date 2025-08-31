"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheServiceImplementation = void 0;
const logger_1 = require("../integration/logger");
class CacheServiceImplementation {
    constructor(config) {
        this.cache = new Map();
        this.metrics = this.initializeMetrics();
        this.logger = new logger_1.IntegrationLoggerImplementation();
        this.config = this.mergeConfig(config);
        this.startCleanupInterval();
    }
    async set(key, value, ttl) {
        try {
            const actualTTL = ttl || this.config.defaultTTL;
            const entry = {
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
        }
        catch (error) {
            this.logger.error(`Failed to set cache entry`, {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async get(key) {
        try {
            const entry = this.cache.get(key);
            if (!entry) {
                this.updateMetrics('miss');
                return null;
            }
            if (this.isExpired(entry)) {
                this.cache.delete(key);
                this.updateMetrics('miss');
                this.logger.debug(`Cache entry expired`, { key });
                return null;
            }
            entry.accessedAt = new Date();
            entry.hitCount++;
            this.updateMetrics('hit', entry);
            this.logger.debug(`Cache entry retrieved`, {
                key,
                hitCount: entry.hitCount,
                age: Date.now() - entry.createdAt.getTime()
            });
            return entry.value;
        }
        catch (error) {
            this.logger.error(`Failed to get cache entry`, {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async del(key) {
        try {
            const entry = this.cache.get(key);
            if (entry) {
                this.cache.delete(key);
                this.updateMetrics('delete', entry);
                this.logger.debug(`Cache entry deleted`, { key });
            }
            else {
                this.logger.debug(`Cache entry not found for deletion`, { key });
            }
        }
        catch (error) {
            this.logger.error(`Failed to delete cache entry`, {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async clear() {
        try {
            const size = this.cache.size;
            this.cache.clear();
            this.resetMetrics();
            this.logger.info(`Cache cleared`, { entriesRemoved: size });
        }
        catch (error) {
            this.logger.error(`Failed to clear cache`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async exists(key) {
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
        }
        catch (error) {
            this.logger.error(`Failed to check cache entry existence`, {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
    async ttl(key) {
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
        }
        catch (error) {
            this.logger.error(`Failed to get cache entry TTL`, {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return -1;
        }
    }
    async getMetrics() {
        return { ...this.metrics };
    }
    async getMultiple(keys) {
        const result = {};
        for (const key of keys) {
            const value = await this.get(key);
            if (value !== null) {
                result[key] = value;
            }
        }
        return result;
    }
    async setMultiple(entries) {
        for (const [key, entry] of Object.entries(entries)) {
            await this.set(key, entry.value, entry.ttl);
        }
    }
    async increment(key, delta = 1) {
        try {
            const currentValue = await this.get(key);
            const newValue = (typeof currentValue === 'number' ? currentValue : 0) + delta;
            await this.set(key, newValue);
            return newValue;
        }
        catch (error) {
            this.logger.error(`Failed to increment cache value`, {
                key,
                delta,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async decrement(key, delta = 1) {
        return this.increment(key, -delta);
    }
    async expire(key, ttl) {
        try {
            const entry = this.cache.get(key);
            if (!entry) {
                return;
            }
            if (this.isExpired(entry)) {
                this.cache.delete(key);
                return;
            }
            const now = Date.now();
            const age = (now - entry.createdAt.getTime()) / 1000;
            entry.ttl = ttl + age;
            this.logger.debug(`Cache entry TTL updated`, {
                key,
                newTTL: entry.ttl
            });
        }
        catch (error) {
            this.logger.error(`Failed to expire cache entry`, {
                key,
                ttl,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async persist(key) {
        try {
            const entry = this.cache.get(key);
            if (entry) {
                entry.ttl = -1;
                this.logger.debug(`Cache entry persisted`, { key });
            }
        }
        catch (error) {
            this.logger.error(`Failed to persist cache entry`, {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async scan(pattern, count = 10) {
        try {
            const regex = this.patternToRegex(pattern);
            const keys = [];
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    keys.push(key);
                    if (keys.length >= count) {
                        break;
                    }
                }
            }
            return keys;
        }
        catch (error) {
            this.logger.error(`Failed to scan cache keys`, {
                pattern,
                count,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async keys() {
        return Array.from(this.cache.keys());
    }
    async size() {
        return this.cache.size;
    }
    async cleanup() {
        try {
            const beforeSize = this.cache.size;
            const expiredKeys = [];
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
        }
        catch (error) {
            this.logger.error(`Failed to cleanup cache`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    isExpired(entry) {
        if (entry.ttl === -1)
            return false;
        const now = Date.now();
        const age = (now - entry.createdAt.getTime()) / 1000;
        return age > entry.ttl;
    }
    async evictEntries() {
        const entriesToEvict = Math.max(1, Math.floor(this.config.maxSize * 0.1));
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
    async evictLRU(count) {
        const sortedEntries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].accessedAt.getTime() - b[1].accessedAt.getTime());
        for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
            this.cache.delete(sortedEntries[i][0]);
        }
    }
    async evictFIFO(count) {
        const sortedEntries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
        for (let i = 0; i < Math.min(count, sortedEntries.length); i++) {
            this.cache.delete(sortedEntries[i][0]);
        }
    }
    async evictTTL(count) {
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
    calculateSize(value) {
        try {
            return JSON.stringify(value).length;
        }
        catch (error) {
            return 0;
        }
    }
    updateMetrics(operation, entry) {
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
        const total = this.metrics.hitCount + this.metrics.missCount;
        if (total > 0) {
            this.metrics.hitRate = this.metrics.hitCount / total;
            this.metrics.missRate = this.metrics.missCount / total;
        }
        if (this.cache.size > 0) {
            const totalTTL = Array.from(this.cache.values())
                .reduce((sum, entry) => sum + entry.ttl, 0);
            this.metrics.averageTTL = totalTTL / this.cache.size;
        }
    }
    resetMetrics() {
        this.metrics = this.initializeMetrics();
    }
    initializeMetrics() {
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
    mergeConfig(config) {
        return {
            maxSize: config?.maxSize || 10000,
            defaultTTL: config?.defaultTTL || 3600,
            strategy: config?.strategy || 'LRU',
            cleanupInterval: config?.cleanupInterval || 300000,
            compression: config?.compression !== false
        };
    }
    startCleanupInterval() {
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.cleanup();
            }
            catch (error) {
                this.logger.error(`Cache cleanup interval failed`, {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }, this.config.cleanupInterval);
    }
    patternToRegex(pattern) {
        const regexPattern = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regexPattern}$`);
    }
    async destroy() {
        try {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = undefined;
            }
            await this.clear();
            this.logger.info(`Cache service destroyed`);
        }
        catch (error) {
            this.logger.error(`Failed to destroy cache service`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getStats() {
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
    async exportData() {
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
    async importData(data) {
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
        }
        catch (error) {
            this.logger.error(`Failed to import cache data`, {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}
exports.CacheServiceImplementation = CacheServiceImplementation;
//# sourceMappingURL=CacheService.js.map
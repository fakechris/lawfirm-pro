import { Database } from '../../utils/database';
import { IntegrationLoggerImplementation } from '../integration/logger';
import { 
  DataSyncEngine, 
  DataSource, 
  DataTarget, 
  SyncResult, 
  Conflict, 
  ResolutionResult, 
  ResolutionStrategy, 
  DataTransformer,
  ValidationRule,
  SyncMetrics,
  HealthStatus,
  HealthCheck,
  CacheEntry
} from '../../models/integration';

export class DataSyncEngineImplementation implements DataSyncEngine {
  private database: Database;
  private logger: IntegrationLoggerImplementation;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: SyncMetrics = this.initializeMetrics();
  private isActive: boolean = true;

  constructor() {
    this.database = new Database();
    this.logger = new IntegrationLoggerImplementation();
  }

  async syncData(source: DataSource, target: DataTarget): Promise<SyncResult> {
    const syncId = this.generateId();
    const startTime = new Date();
    
    try {
      this.logger.info(`Starting sync from ${source.name} to ${target.name}`, {
        syncId,
        sourceId: source.id,
        targetId: target.id
      });

      // Retrieve source data
      const sourceData = await this.retrieveSourceData(source);
      
      // Retrieve target data for conflict detection
      const targetData = await this.retrieveTargetData(target);
      
      // Detect conflicts
      const conflicts = await this.detectConflicts(sourceData, targetData);
      
      // Process data with conflict resolution
      const processResult = await this.processSyncData(
        sourceData, 
        target, 
        conflicts,
        source,
        target
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: SyncResult = {
        id: syncId,
        success: true,
        sourceId: source.id,
        targetId: target.id,
        recordsProcessed: processResult.processed,
        recordsSucceeded: processResult.succeeded,
        recordsFailed: processResult.failed,
        conflicts,
        startTime,
        endTime,
        duration,
        metadata: {
          batchSize: processResult.batchSize,
          retries: processResult.retries,
          conflictsResolved: processResult.conflictsResolved
        }
      };

      // Update metrics
      this.updateMetrics(result);
      
      // Cache result
      await this.cacheData(`sync:${syncId}`, result, 3600);

      this.logger.info(`Sync completed successfully`, {
        syncId,
        duration,
        recordsProcessed: result.recordsProcessed,
        successRate: result.recordsSucceeded / result.recordsProcessed
      });

      return result;

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: SyncResult = {
        id: syncId,
        success: false,
        sourceId: source.id,
        targetId: target.id,
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        conflicts: [],
        startTime,
        endTime,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.logger.error(`Sync failed`, {
        syncId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async resolveConflicts(conflicts: Conflict[], strategy: ResolutionStrategy): Promise<ResolutionResult[]> {
    const resolutions: ResolutionResult[] = [];
    
    for (const conflict of conflicts) {
      try {
        const resolution = await this.resolveSingleConflict(conflict, strategy);
        resolutions.push(resolution);
        
        this.logger.info(`Conflict resolved`, {
          conflictId: conflict.id,
          strategy,
          resolution: resolution.resolvedValue
        });
        
      } catch (error) {
        this.logger.error(`Failed to resolve conflict`, {
          conflictId: conflict.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Add failed resolution
        resolutions.push({
          strategy,
          resolvedValue: null,
          resolvedAt: new Date(),
          resolvedBy: 'system',
          notes: `Failed to resolve: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    return resolutions;
  }

  async transformData(data: any, transformer: DataTransformer): Promise<any> {
    try {
      this.logger.info(`Transforming data using ${transformer.name}`, {
        transformerId: transformer.id,
        sourceFormat: transformer.sourceFormat,
        targetFormat: transformer.targetFormat
      });

      let transformedData = Array.isArray(data) ? data : [data];
      
      // Apply transformation rules
      for (const rule of transformer.transformation.sort((a, b) => a.order - b.order)) {
        transformedData = await this.applyTransformationRule(transformedData, rule);
      }

      return Array.isArray(data) ? transformedData : transformedData[0];
      
    } catch (error) {
      this.logger.error(`Data transformation failed`, {
        transformerId: transformer.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async cacheData(key: string, data: any, ttl: number = 3600): Promise<void> {
    try {
      const entry: CacheEntry = {
        key,
        value: data,
        ttl,
        createdAt: new Date(),
        accessedAt: new Date(),
        hitCount: 0
      };

      this.cache.set(key, entry);
      
      // Cleanup old entries if cache is too large
      if (this.cache.size > 10000) {
        await this.cleanupCache();
      }
      
    } catch (error) {
      this.logger.error(`Failed to cache data`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCachedData(key: string): Promise<any> {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        return null;
      }

      // Check TTL
      const now = new Date();
      const age = (now.getTime() - entry.createdAt.getTime()) / 1000;
      
      if (age > entry.ttl) {
        this.cache.delete(key);
        return null;
      }

      // Update access info
      entry.accessedAt = now;
      entry.hitCount++;
      
      return entry.value;
      
    } catch (error) {
      this.logger.error(`Failed to get cached data`, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  async validateData(data: any, rules: ValidationRule[]): Promise<boolean> {
    try {
      const dataToValidate = Array.isArray(data) ? data : [data];
      
      for (const item of dataToValidate) {
        for (const rule of rules) {
          if (!await this.validateField(item, rule)) {
            return false;
          }
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.error(`Data validation failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async getSyncMetrics(): Promise<SyncMetrics> {
    return { ...this.metrics };
  }

  async healthCheck(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    const startTime = Date.now();

    // Database health check
    const dbCheck = await this.performDatabaseHealthCheck();
    checks.push(dbCheck);

    // Cache health check
    const cacheCheck = await this.performCacheHealthCheck();
    checks.push(cacheCheck);

    // Engine health check
    const engineCheck = await this.performEngineHealthCheck();
    checks.push(engineCheck);

    const allPassed = checks.every(check => check.status === 'pass');
    const hasWarnings = checks.some(check => check.status === 'warn');

    const duration = Date.now() - startTime;

    return {
      status: allPassed ? 'healthy' : hasWarnings ? 'degraded' : 'unhealthy',
      timestamp: new Date(),
      checks,
      metrics: await this.getSyncMetrics()
    };
  }

  // Private helper methods
  private async retrieveSourceData(source: DataSource): Promise<any[]> {
    switch (source.type) {
      case 'database':
        return this.retrieveFromDatabase(source);
      case 'api':
        return this.retrieveFromAPI(source);
      case 'file':
        return this.retrieveFromFile(source);
      case 'external_service':
        return this.retrieveFromExternalService(source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  private async retrieveTargetData(target: DataTarget): Promise<any[]> {
    switch (target.type) {
      case 'database':
        return this.retrieveFromDatabase(target);
      case 'api':
        return this.retrieveFromAPI(target);
      case 'file':
        return this.retrieveFromFile(target);
      case 'external_service':
        return this.retrieveFromExternalService(target);
      default:
        throw new Error(`Unsupported target type: ${target.type}`);
    }
  }

  private async retrieveFromDatabase(source: DataSource): Promise<any[]> {
    const db = this.database.client;
    const config = source.config;
    
    try {
      if (config.table && config.schema) {
        return await db.$queryRawUnsafe(`
          SELECT * FROM ${config.schema}.${config.table}
          ${config.query ? `WHERE ${config.query}` : ''}
        `);
      } else if (config.query) {
        return await db.$queryRawUnsafe(config.query);
      } else {
        throw new Error('Database configuration missing table or query');
      }
    } catch (error) {
      this.logger.error(`Failed to retrieve from database`, {
        sourceId: source.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async retrieveFromAPI(source: DataSource): Promise<any[]> {
    const config = source.config;
    
    try {
      const response = await fetch(`${config.baseUrl}${config.query || ''}`, {
        headers: this.createHeaders(config.authentication),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [data];
      
    } catch (error) {
      this.logger.error(`Failed to retrieve from API`, {
        sourceId: source.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async retrieveFromFile(source: DataSource): Promise<any[]> {
    // Implementation would depend on file system access
    // For now, return empty array
    this.logger.warn(`File source retrieval not implemented`, {
      sourceId: source.id
    });
    return [];
  }

  private async retrieveFromExternalService(source: DataSource): Promise<any[]> {
    // Implementation would use external service integration
    // For now, return empty array
    this.logger.warn(`External service retrieval not implemented`, {
      sourceId: source.id
    });
    return [];
  }

  private async detectConflicts(sourceData: any[], targetData: any[]): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    try {
      // Simple conflict detection based on record matching
      const sourceMap = new Map(sourceData.map(item => [item.id, item]));
      const targetMap = new Map(targetData.map(item => [item.id, item]));
      
      // Check for mismatches
      for (const [id, sourceItem] of sourceMap) {
        const targetItem = targetMap.get(id);
        
        if (targetItem) {
          // Compare fields
          const conflictsForRecord = await this.compareRecords(sourceItem, targetItem);
          conflicts.push(...conflictsForRecord);
        } else {
          // Missing record in target
          conflicts.push({
            id: this.generateId(),
            recordId: id,
            field: 'record',
            sourceValue: sourceItem,
            targetValue: null,
            type: 'missing_record',
            severity: 'medium',
            detectedAt: new Date()
          });
        }
      }
      
      // Check for records only in target
      for (const [id, targetItem] of targetMap) {
        if (!sourceMap.has(id)) {
          conflicts.push({
            id: this.generateId(),
            recordId: id,
            field: 'record',
            sourceValue: null,
            targetValue: targetItem,
            type: 'missing_record',
            severity: 'low',
            detectedAt: new Date()
          });
        }
      }
      
      return conflicts;
      
    } catch (error) {
      this.logger.error(`Conflict detection failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async compareRecords(sourceItem: any, targetItem: any): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    for (const [field, sourceValue] of Object.entries(sourceItem)) {
      const targetValue = targetItem[field];
      
      if (JSON.stringify(sourceValue) !== JSON.stringify(targetValue)) {
        conflicts.push({
          id: this.generateId(),
          recordId: sourceItem.id,
          field,
          sourceValue,
          targetValue,
          type: 'data_mismatch',
          severity: this.getConflictSeverity(field, sourceValue, targetValue),
          detectedAt: new Date()
        });
      }
    }
    
    return conflicts;
  }

  private getConflictSeverity(field: string, sourceValue: any, targetValue: any): 'low' | 'medium' | 'high' | 'critical' {
    // Simple severity determination logic
    const criticalFields = ['id', 'email', 'ssn', 'phone'];
    const highFields = ['name', 'address', 'amount'];
    const mediumFields = ['description', 'notes', 'metadata'];
    
    if (criticalFields.includes(field.toLowerCase())) {
      return 'critical';
    } else if (highFields.includes(field.toLowerCase())) {
      return 'high';
    } else if (mediumFields.includes(field.toLowerCase())) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private async resolveSingleConflict(conflict: Conflict, strategy: ResolutionStrategy): Promise<ResolutionResult> {
    let resolvedValue: any;
    
    switch (strategy) {
      case 'source_wins':
        resolvedValue = conflict.sourceValue;
        break;
      case 'target_wins':
        resolvedValue = conflict.targetValue;
        break;
      case 'newest_wins':
        resolvedValue = conflict.sourceValue; // Assume source is newer
        break;
      case 'oldest_wins':
        resolvedValue = conflict.targetValue; // Assume target is older
        break;
      case 'merge':
        resolvedValue = this.mergeValues(conflict.sourceValue, conflict.targetValue);
        break;
      case 'manual':
      case 'custom':
        // For manual/custom, return source value as default
        resolvedValue = conflict.sourceValue;
        break;
      default:
        resolvedValue = conflict.sourceValue;
    }
    
    return {
      strategy,
      resolvedValue,
      resolvedAt: new Date(),
      resolvedBy: 'automatic',
      notes: `Resolved using ${strategy} strategy`
    };
  }

  private mergeValues(sourceValue: any, targetValue: any): any {
    // Simple merge logic - can be enhanced
    if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
      return { ...targetValue, ...sourceValue };
    }
    return sourceValue;
  }

  private async applyTransformationRule(data: any[], rule: any): Promise<any[]> {
    // Implementation of transformation rules
    // This is a simplified version - actual implementation would be more complex
    try {
      switch (rule.type) {
        case 'map':
          return data.map(item => this.mapField(item, rule.config));
        case 'transform':
          return data.map(item => this.transformField(item, rule));
        case 'calculate':
          return data.map(item => this.calculateField(item, rule));
        case 'validate':
          return data.filter(item => this.validateField(item, rule.config));
        case 'format':
          return data.map(item => this.formatField(item, rule));
        default:
          return data;
      }
    } catch (error) {
      this.logger.error(`Failed to apply transformation rule`, {
        ruleType: rule.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private mapField(item: any, config: any): any {
    // Field mapping logic
    if (config.mapping) {
      const mapped = { ...item };
      for (const [sourceField, targetField] of Object.entries(config.mapping)) {
        if (item[sourceField] !== undefined) {
          mapped[targetField as string] = item[sourceField];
          delete mapped[sourceField];
        }
      }
      return mapped;
    }
    return item;
  }

  private transformField(item: any, rule: any): any {
    // Field transformation logic
    // Simplified implementation
    return item;
  }

  private calculateField(item: any, rule: any): any {
    // Field calculation logic
    // Simplified implementation
    return item;
  }

  private validateField(item: any, rule: ValidationRule): boolean {
    // Field validation logic
    try {
      switch (rule.type) {
        case 'required':
          return item[rule.config.field] !== undefined && item[rule.config.field] !== null;
        case 'type':
          return typeof item[rule.config.field] === rule.config.expectedType;
        case 'length':
          const value = item[rule.config.field];
          return value && value.length >= rule.config.minLength && value.length <= rule.config.maxLength;
        case 'pattern':
          const pattern = new RegExp(rule.config.pattern);
          return pattern.test(item[rule.config.field]);
        case 'range':
          const num = item[rule.config.field];
          return num >= rule.config.min && num <= rule.config.max;
        default:
          return true;
      }
    } catch (error) {
      return false;
    }
  }

  private formatField(item: any, rule: any): any {
    // Field formatting logic
    // Simplified implementation
    return item;
  }

  private async processSyncData(
    sourceData: any[], 
    target: DataTarget, 
    conflicts: Conflict[],
    source: DataSource,
    targetConfig: DataTarget
  ): Promise<any> {
    const batchSize = targetConfig.config.batchSize || 100;
    const maxRetries = targetConfig.config.maxRetries || 3;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let conflictsResolved = 0;
    let retries = 0;

    // Apply conflict resolutions
    const resolutions = await this.resolveConflicts(
      conflicts, 
      targetConfig.config.conflictResolution as ResolutionStrategy || 'source_wins'
    );
    
    conflictsResolved = resolutions.filter(r => r.resolvedValue !== null).length;

    // Process data in batches
    for (let i = 0; i < sourceData.length; i += batchSize) {
      const batch = sourceData.slice(i, i + batchSize);
      processed += batch.length;

      try {
        const batchResult = await this.processBatch(batch, target, resolutions);
        succeeded += batchResult;
        
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          i -= batchSize; // Retry this batch
          continue;
        } else {
          failed += batch.length;
          this.logger.error(`Batch processing failed after ${maxRetries} retries`, {
            batchSize,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return {
      processed,
      succeeded,
      failed,
      conflictsResolved,
      batchSize,
      retries
    };
  }

  private async processBatch(batch: any[], target: DataTarget, resolutions: ResolutionResult[]): Promise<number> {
    // Process a single batch of data
    try {
      switch (target.type) {
        case 'database':
          return await this.saveToDatabase(batch, target);
        case 'api':
          return await this.saveToAPI(batch, target);
        case 'file':
          return await this.saveToFile(batch, target);
        case 'external_service':
          return await this.saveToExternalService(batch, target);
        default:
          throw new Error(`Unsupported target type: ${target.type}`);
      }
    } catch (error) {
      this.logger.error(`Batch processing failed`, {
        batchSize: batch.length,
        targetType: target.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private async saveToDatabase(batch: any[], target: DataTarget): Promise<number> {
    const db = this.database.client;
    const config = target.config;
    
    if (!config.table) {
      throw new Error('Database configuration missing table');
    }

    // Simplified database insertion
    // In production, this would use proper ORM operations
    let successCount = 0;
    
    for (const item of batch) {
      try {
        await db.$queryRawUnsafe(`
          INSERT INTO ${config.schema || 'public'}.${config.table} 
          (${Object.keys(item).join(', ')}) 
          VALUES (${Object.values(item).map(v => `'${v}'`).join(', ')})
          ON CONFLICT (id) DO UPDATE SET 
          ${Object.entries(item).map(([key, value]) => `${key} = '${value}'`).join(', ')}
        `);
        successCount++;
      } catch (error) {
        this.logger.error(`Failed to save record to database`, {
          itemId: item.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return successCount;
  }

  private async saveToAPI(batch: any[], target: DataTarget): Promise<number> {
    const config = target.config;
    let successCount = 0;
    
    for (const item of batch) {
      try {
        const response = await fetch(`${config.baseUrl}/records`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.createHeaders(config.authentication)
          },
          body: JSON.stringify(item)
        });

        if (response.ok) {
          successCount++;
        } else {
          throw new Error(`API request failed: ${response.statusText}`);
        }
      } catch (error) {
        this.logger.error(`Failed to save record to API`, {
          itemId: item.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return successCount;
  }

  private async saveToFile(batch: any[], target: DataTarget): Promise<number> {
    // Implementation would depend on file system access
    this.logger.warn(`File save not implemented`, {
      batchSize: batch.length
    });
    return batch.length;
  }

  private async saveToExternalService(batch: any[], target: DataTarget): Promise<number> {
    // Implementation would use external service integration
    this.logger.warn(`External service save not implemented`, {
      batchSize: batch.length
    });
    return batch.length;
  }

  private createHeaders(authConfig?: any): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (!authConfig) return headers;
    
    switch (authConfig.type) {
      case 'api_key':
        headers['Authorization'] = `Bearer ${authConfig.credentials.apiKey}`;
        break;
      case 'basic':
        const { username, password } = authConfig.credentials;
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.credentials.token}`;
        break;
    }
    
    return headers;
  }

  private async cleanupCache(): Promise<void> {
    const now = new Date();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const age = (now.getTime() - entry.createdAt.getTime()) / 1000;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    this.logger.info(`Cache cleanup completed`, {
      entriesRemoved: keysToDelete.length,
      remainingEntries: this.cache.size
    });
  }

  private updateMetrics(result: SyncResult): void {
    if (result.success) {
      this.metrics.completedJobs++;
    } else {
      this.metrics.failedJobs++;
    }
    
    this.metrics.lastSyncTime = result.endTime;
    this.metrics.conflicts.total += result.conflicts.length;
    
    // Update performance metrics
    if (result.recordsProcessed > 0) {
      const recordsPerSecond = (result.recordsProcessed / result.duration) * 1000;
      this.metrics.performance.recordsPerSecond = 
        (this.metrics.performance.recordsPerSecond + recordsPerSecond) / 2;
    }
  }

  private initializeMetrics(): SyncMetrics {
    return {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageDuration: 0,
      dataSources: 0,
      dataTargets: 0,
      conflicts: {
        total: 0,
        resolved: 0,
        pending: 0
      },
      performance: {
        recordsPerSecond: 0,
        averageResponseTime: 0,
        errorRate: 0
      }
    };
  }

  private async performDatabaseHealthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      await this.database.healthCheck();
      
      return {
        name: 'database',
        status: 'pass',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async performCacheHealthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple cache health check
      const testKey = 'health_check';
      const testValue = { test: true };
      
      await this.cacheData(testKey, testValue, 60);
      const retrieved = await this.getCachedData(testKey);
      
      if (retrieved && retrieved.test === true) {
        return {
          name: 'cache',
          status: 'pass',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      } else {
        return {
          name: 'cache',
          status: 'fail',
          message: 'Cache retrieval failed',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      return {
        name: 'cache',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private async performEngineHealthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      if (this.isActive) {
        return {
          name: 'engine',
          status: 'pass',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      } else {
        return {
          name: 'engine',
          status: 'fail',
          message: 'Engine is not active',
          timestamp: new Date(),
          duration: Date.now() - startTime
        };
      }
    } catch (error) {
      return {
        name: 'engine',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
    }
  }

  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
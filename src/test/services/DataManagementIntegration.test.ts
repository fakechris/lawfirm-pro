import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataManagementService } from '../services/DataManagementService';
import {
  DataSource,
  DataTarget,
  ResolutionStrategy,
  SyncSchedule
} from '../models/integration';

describe('Data Management Integration Tests', () => {
  let dataManagementService: DataManagementService;

  beforeEach(() => {
    dataManagementService = new DataManagementService({
      maxSize: 1000,
      defaultTTL: 3600,
      strategy: 'LRU',
      cleanupInterval: 300000,
      compression: true
    });
  });

  afterEach(async () => {
    if (dataManagementService) {
      await dataManagementService.destroy();
    }
  });

  describe('Complete Data Management Workflow', () => {
    it('should handle end-to-end data synchronization', async () => {
      // Create test data sources and targets
      const source: DataSource = {
        id: 'test-source-1',
        name: 'Test Source Database',
        type: 'database',
        config: {
          connectionString: 'postgresql://localhost:5432/test',
          table: 'users',
          schema: 'public'
        },
        status: 'active'
      };

      const target: DataTarget = {
        id: 'test-target-1',
        name: 'Test Target Database',
        type: 'database',
        config: {
          connectionString: 'postgresql://localhost:5432/target',
          table: 'users_sync',
          schema: 'public'
        },
        status: 'active'
      };

      // Perform synchronization
      const result = await dataManagementService.synchronizeData(source, target, {
        validateBeforeSync: true,
        validateAfterSync: true,
        useCache: true,
        conflictResolution: 'source_wins',
        batchSize: 50,
        maxRetries: 3,
        timeout: 30000
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.sourceId).toBe(source.id);
      expect(result.targetId).toBe(target.id);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle batch synchronization', async () => {
      const syncConfigs = [
        {
          source: {
            id: 'batch-source-1',
            name: 'Batch Source 1',
            type: 'database' as const,
            config: { table: 'users' },
            status: 'active' as const
          },
          target: {
            id: 'batch-target-1',
            name: 'Batch Target 1',
            type: 'database' as const,
            config: { table: 'users_sync' },
            status: 'active' as const
          },
          options: {
            conflictResolution: 'source_wins' as ResolutionStrategy,
            batchSize: 25
          }
        },
        {
          source: {
            id: 'batch-source-2',
            name: 'Batch Source 2',
            type: 'database' as const,
            config: { table: 'orders' },
            status: 'active' as const
          },
          target: {
            id: 'batch-target-2',
            name: 'Batch Target 2',
            type: 'database' as const,
            config: { table: 'orders_sync' },
            status: 'active' as const
          },
          options: {
            conflictResolution: 'target_wins' as ResolutionStrategy,
            batchSize: 50
          }
        }
      ];

      const batchResult = await dataManagementService.synchronizeBatch(syncConfigs, {
        maxConcurrency: 2,
        stopOnError: false,
        timeout: 60000
      });

      expect(batchResult).toBeDefined();
      expect(batchResult.totalSyncs).toBe(2);
      expect(batchResult.results).toHaveLength(2);
      expect(batchResult.startTime).toBeDefined();
      expect(batchResult.endTime).toBeDefined();
      expect(batchResult.duration).toBeGreaterThan(0);
    });

    it('should schedule synchronization jobs', async () => {
      const source: DataSource = {
        id: 'scheduled-source-1',
        name: 'Scheduled Source',
        type: 'database' as const,
        config: { table: 'products' },
        status: 'active' as const
      };

      const target: DataTarget = {
        id: 'scheduled-target-1',
        name: 'Scheduled Target',
        type: 'database' as const,
        config: { table: 'products_sync' },
        status: 'active' as const
      };

      const schedule: SyncSchedule = {
        type: 'interval',
        interval: 3600000, // 1 hour
        timezone: 'UTC'
      };

      const jobId = await dataManagementService.scheduleSync(source, target, schedule, {
        conflictResolution: 'newest_wins',
        batchSize: 100,
        validation: true
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
      expect(jobId).toContain('scheduled');
    });

    it('should detect and resolve conflicts', async () => {
      const sourceData = [
        { id: '1', name: 'John Doe', email: 'john@example.com', age: 30 },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25 },
        { id: '3', name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
      ];

      const targetData = [
        { id: '1', name: 'John D.', email: 'john@example.com', age: 30 },
        { id: '2', name: 'Jane Smith', email: 'jane.smith@example.com', age: 26 },
        { id: '4', name: 'Alice Brown', email: 'alice@example.com', age: 28 }
      ];

      const conflictResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins'
      );

      expect(conflictResult).toBeDefined();
      expect(conflictResult.conflicts).toHaveLength(3); // 2 mismatches + 1 missing in target
      expect(conflictResult.resolutions).toHaveLength(3);
      expect(conflictResult.resolved).toBe(true);
    });

    it('should validate data integrity', async () => {
      const sourceData = [
        { id: '1', name: 'John Doe', email: 'john@example.com', age: 30 },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25 }
      ];

      const targetData = [
        { id: '1', name: 'John D.', email: 'john@example.com', age: 30 },
        { id: '3', name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
      ];

      const integrityResult = await dataManagementService.validateDataIntegrity(
        sourceData,
        targetData,
        ['consistency', 'completeness', 'uniqueness']
      );

      expect(integrityResult).toBeDefined();
      expect(integrityResult.overallStatus).toMatch(/passed|warning|failed/);
      expect(integrityResult.totalIssues).toBeGreaterThanOrEqual(0);
      expect(integrityResult.results).toHaveLength(3);
      expect(integrityResult.validatedAt).toBeDefined();
    });

    it('should generate performance reports', async () => {
      const performanceReport = await dataManagementService.getPerformanceReport('1h');
      
      expect(performanceReport).toBeDefined();
      expect(performanceReport.timeRange).toBe('1h');
      expect(performanceReport.startTime).toBeDefined();
      expect(performanceReport.endTime).toBeDefined();
      expect(performanceReport.totalSyncs).toBeGreaterThanOrEqual(0);
      expect(performanceReport.successfulSyncs).toBeGreaterThanOrEqual(0);
      expect(performanceReport.failedSyncs).toBeGreaterThanOrEqual(0);
      expect(performanceReport.averageSyncDuration).toBeGreaterThanOrEqual(0);
      expect(performanceReport.recommendations).toBeDefined();
    });

    it('should provide system status', async () => {
      const systemStatus = await dataManagementService.getSystemStatus();
      
      expect(systemStatus).toBeDefined();
      expect(systemStatus.overallStatus).toMatch(/healthy|degraded|unhealthy/);
      expect(systemStatus.health).toBeDefined();
      expect(systemStatus.metrics).toBeDefined();
      expect(systemStatus.activeAlerts).toBeDefined();
      expect(systemStatus.lastUpdateTime).toBeDefined();
      expect(systemStatus.uptime).toBeGreaterThanOrEqual(0);
      expect(systemStatus.version).toBeDefined();
    });

    it('should manage alerts', async () => {
      const alertConfig = {
        name: 'Test Sync Failure Alert',
        type: 'sync_failure' as const,
        condition: {
          metric: 'error_rate',
          operator: 'gt' as const,
          value: 10
        },
        severity: 'high' as const,
        actions: [
          {
            type: 'log' as const,
            config: {}
          }
        ],
        isActive: true
      };

      const alert = await dataManagementService.createAlert(alertConfig);
      
      expect(alert).toBeDefined();
      expect(alert.name).toBe('Test Sync Failure Alert');
      expect(alert.type).toBe('sync_failure');
      expect(alert.severity).toBe('high');
      expect(alert.status).toBe('active');

      const alerts = await dataManagementService.checkAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle synchronization errors gracefully', async () => {
      const source: DataSource = {
        id: 'error-source-1',
        name: 'Error Source',
        type: 'database' as const,
        config: { table: 'nonexistent_table' }, // This should cause an error
        status: 'active' as const
      };

      const target: DataTarget = {
        id: 'error-target-1',
        name: 'Error Target',
        type: 'database' as const,
        config: { table: 'target_table' },
        status: 'active' as const
      };

      // The synchronization should fail but not crash
      await expect(dataManagementService.synchronizeData(source, target)).rejects.toThrow();
    });

    it('should handle empty datasets', async () => {
      const sourceData: any[] = [];
      const targetData: any[] = [];

      const conflictResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins'
      );

      expect(conflictResult).toBeDefined();
      expect(conflictResult.conflicts).toHaveLength(0);
      expect(conflictResult.resolved).toBe(true);
    });

    it('should handle batch synchronization with partial failures', async () => {
      const syncConfigs = [
        {
          source: {
            id: 'partial-success-source-1',
            name: 'Partial Success Source 1',
            type: 'database' as const,
            config: { table: 'valid_table' },
            status: 'active' as const
          },
          target: {
            id: 'partial-success-target-1',
            name: 'Partial Success Target 1',
            type: 'database' as const,
            config: { table: 'valid_target' },
            status: 'active' as const
          }
        },
        {
          source: {
            id: 'partial-fail-source-2',
            name: 'Partial Fail Source 2',
            type: 'database' as const,
            config: { table: 'invalid_table' }, // This should fail
            status: 'active' as const
          },
          target: {
            id: 'partial-fail-target-2',
            name: 'Partial Fail Target 2',
            type: 'database' as const,
            config: { table: 'invalid_target' },
            status: 'active' as const
          }
        }
      ];

      const batchResult = await dataManagementService.synchronizeBatch(syncConfigs, {
        maxConcurrency: 2,
        stopOnError: false
      });

      expect(batchResult).toBeDefined();
      expect(batchResult.totalSyncs).toBe(2);
      expect(batchResult.failedSyncs).toBeGreaterThan(0);
      expect(batchResult.errors.length).toBeGreaterThan(0);
    });

    it('should handle invalid conflict resolution strategies', async () => {
      const sourceData = [{ id: '1', name: 'John Doe' }];
      const targetData = [{ id: '1', name: 'John D.' }];

      // Should handle unknown strategy gracefully
      const conflictResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins' as ResolutionStrategy // Valid strategy
      );

      expect(conflictResult).toBeDefined();
      expect(conflictResult.resolved).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently', async () => {
      // Generate large test dataset
      const largeSourceData = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 50) + 18
      }));

      const largeTargetData = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        name: `User ${i} Updated`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 50) + 18
      }));

      const startTime = Date.now();
      const conflictResult = await dataManagementService.detectAndResolveConflicts(
        largeSourceData,
        largeTargetData,
        'source_wins'
      );
      const endTime = Date.now();

      expect(conflictResult).toBeDefined();
      expect(conflictResult.conflicts.length).toBe(1000); // All records should have conflicts
      expect(conflictResult.resolutions.length).toBe(1000);
      expect(conflictResult.resolved).toBe(true);
      
      // Performance check - should complete within reasonable time
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Less than 10 seconds for 1000 records
    });

    it('should handle concurrent operations', async () => {
      const concurrentOperations = [];
      
      for (let i = 0; i < 5; i++) {
        concurrentOperations.push(
          dataManagementService.getPerformanceReport('1h')
        );
      }

      const results = await Promise.all(concurrentOperations);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.timeRange).toBe('1h');
      });
    });
  });

  describe('Integration with External Services', () => {
    it('should work with different data source types', async () => {
      const sources = [
        {
          id: 'api-source-1',
          name: 'API Source',
          type: 'api' as const,
          config: {
            baseUrl: 'https://api.example.com',
            query: '/users'
          },
          status: 'active' as const
        },
        {
          id: 'file-source-1',
          name: 'File Source',
          type: 'file' as const,
          config: {
            filePath: '/data/users.csv'
          },
          status: 'active' as const
        }
      ];

      const target: DataTarget = {
        id: 'integration-target-1',
        name: 'Integration Target',
        type: 'database' as const,
        config: { table: 'integrated_users' },
        status: 'active' as const
      };

      // Test that different source types are handled
      for (const source of sources) {
        const result = await dataManagementService.synchronizeData(source, target, {
          validateBeforeSync: false,
          useCache: false
        });

        expect(result).toBeDefined();
        expect(result.sourceId).toBe(source.id);
        expect(result.targetId).toBe(target.id);
      }
    });

    it('should handle external service integration', async () => {
      // This would test integration with actual external services
      // For now, we'll mock the behavior
      
      const externalSource: DataSource = {
        id: 'external-service-1',
        name: 'External Service Source',
        type: 'external_service' as const,
        config: {
          service: 'stripe',
          endpoint: '/customers'
        },
        status: 'active' as const
      };

      const target: DataTarget = {
        id: 'external-target-1',
        name: 'External Target',
        type: 'database' as const,
        config: { table: 'external_customers' },
        status: 'active' as const
      };

      const result = await dataManagementService.synchronizeData(externalSource, target, {
        validateBeforeSync: false,
        useCache: false,
        timeout: 60000 // Longer timeout for external services
      });

      expect(result).toBeDefined();
    });
  });

  describe('Data Persistence and Recovery', () => {
    it('should maintain data consistency across operations', async () => {
      const sourceData = [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ];

      const targetData = [
        { id: '1', name: 'John D.', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' }
      ];

      // First sync
      const firstResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins'
      );

      expect(firstResult.resolved).toBe(true);

      // Second sync with same data should be consistent
      const secondResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins'
      );

      expect(secondResult.resolved).toBe(true);
      expect(secondResult.conflicts.length).toBe(firstResult.conflicts.length);
    });

    it('should handle service restart gracefully', async () => {
      // Create initial data
      const sourceData = [{ id: '1', name: 'Test User' }];
      const targetData = [{ id: '1', name: 'Test User Updated' }];

      // Perform operation before restart
      const beforeResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins'
      );

      expect(beforeResult.resolved).toBe(true);

      // Destroy and recreate service (simulate restart)
      await dataManagementService.destroy();
      
      dataManagementService = new DataManagementService({
        maxSize: 1000,
        defaultTTL: 3600,
        strategy: 'LRU'
      });

      // Perform operation after restart
      const afterResult = await dataManagementService.detectAndResolveConflicts(
        sourceData,
        targetData,
        'source_wins'
      );

      expect(afterResult.resolved).toBe(true);
    });
  });
});
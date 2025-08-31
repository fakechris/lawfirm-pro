// Data Synchronization Services
export { DataSyncEngineImplementation } from './DataSyncEngine';
export { ConflictResolverImplementation } from './ConflictResolver';
export { SyncMonitorImplementation } from './SyncMonitor';

// Service interfaces
export interface SyncService {
  createDataSource(source: Omit<DataSource, 'id' | 'lastSync'>): Promise<DataSource>;
  updateDataSource(id: string, updates: Partial<DataSource>): Promise<DataSource>;
  deleteDataSource(id: string): Promise<void>;
  getDataSources(): Promise<DataSource[]>;
  
  createDataTarget(target: Omit<DataTarget, 'id'>): Promise<DataTarget>;
  updateDataTarget(id: string, updates: Partial<DataTarget>): Promise<DataTarget>;
  deleteDataTarget(id: string): Promise<void>;
  getDataTargets(): Promise<DataTarget[]>;
  
  createSyncJob(job: Omit<SyncJob, 'id' | 'lastRun' | 'nextRun'>): Promise<SyncJob>;
  updateSyncJob(id: string, updates: Partial<SyncJob>): Promise<SyncJob>;
  deleteSyncJob(id: string): Promise<void>;
  getSyncJobs(): Promise<SyncJob[]>;
  executeSyncJob(id: string): Promise<SyncResult>;
  
  getSyncHistory(sourceId?: string, targetId?: string, limit?: number): Promise<SyncResult[]>;
  getConflicts(status?: 'resolved' | 'pending', severity?: string): Promise<Conflict[]>;
  resolveConflicts(conflictIds: string[], strategy: ResolutionStrategy): Promise<ResolutionResult[]>;
}

// Import types from models
import type {
  DataSource,
  DataTarget,
  SyncJob,
  SyncResult,
  Conflict,
  ResolutionResult,
  ResolutionStrategy,
  SyncMetrics,
  HealthStatus
} from '../../models/integration';
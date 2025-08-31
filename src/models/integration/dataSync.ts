// Data synchronization and management models
export interface DataSource {
  id: string;
  name: string;
  type: 'database' | 'api' | 'file' | 'external_service';
  config: DataSourceConfig;
  status: 'active' | 'inactive' | 'error';
  lastSync?: Date;
  metadata?: Record<string, any>;
}

export interface DataTarget {
  id: string;
  name: string;
  type: 'database' | 'api' | 'file' | 'external_service';
  config: DataTargetConfig;
  status: 'active' | 'inactive' | 'error';
  metadata?: Record<string, any>;
}

export interface DataSourceConfig {
  connectionString?: string;
  baseUrl?: string;
  apiKey?: string;
  authentication?: AuthConfig;
  query?: string;
  parameters?: Record<string, any>;
  schema?: string;
  table?: string;
}

export interface DataTargetConfig {
  connectionString?: string;
  baseUrl?: string;
  apiKey?: string;
  authentication?: AuthConfig;
  table?: string;
  schema?: string;
  mapping?: FieldMapping[];
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api_key' | 'oauth';
  credentials: Record<string, string>;
  tokenUrl?: string;
  scopes?: string[];
}

export interface SyncResult {
  id: string;
  success: boolean;
  sourceId: string;
  targetId: string;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  conflicts: Conflict[];
  startTime: Date;
  endTime: Date;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface Conflict {
  id: string;
  recordId: string;
  field: string;
  sourceValue: any;
  targetValue: any;
  type: 'data_mismatch' | 'missing_record' | 'duplicate_record' | 'constraint_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution?: ResolutionResult;
  detectedAt: Date;
}

export interface ResolutionResult {
  strategy: ResolutionStrategy;
  resolvedValue: any;
  resolvedAt: Date;
  resolvedBy: 'system' | 'user' | 'automatic';
  notes?: string;
}

export type ResolutionStrategy = 
  | 'source_wins' 
  | 'target_wins' 
  | 'newest_wins' 
  | 'oldest_wins' 
  | 'manual' 
  | 'merge' 
  | 'custom';

export interface DataTransformer {
  id: string;
  name: string;
  sourceFormat: string;
  targetFormat: string;
  transformation: TransformationRule[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformationRule {
  field: string;
  type: 'map' | 'transform' | 'calculate' | 'validate' | 'format';
  config: TransformationConfig;
  required: boolean;
  order: number;
}

export interface TransformationConfig {
  mapping?: Record<string, string>;
  function?: string;
  parameters?: Record<string, any>;
  validation?: ValidationRule;
  format?: string;
}

export interface ValidationRule {
  type: 'required' | 'type' | 'length' | 'pattern' | 'range' | 'custom';
  config: Record<string, any>;
  message: string;
}

export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  accessedAt: Date;
  hitCount: number;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  strategy: 'LRU' | 'FIFO' | 'TTL';
  cleanupInterval: number;
  compression: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  sourceId: string;
  targetId: string;
  schedule: SyncSchedule;
  transformerId?: string;
  conflictResolution: ResolutionStrategy;
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  config: SyncJobConfig;
}

export interface SyncSchedule {
  type: 'immediate' | 'cron' | 'interval' | 'manual';
  expression?: string;
  interval?: number;
  timezone?: string;
}

export interface SyncJobConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  parallelProcessing: boolean;
  errorHandling: 'stop' | 'continue' | 'skip';
  validation: boolean;
  logging: boolean;
}

export interface SyncMetrics {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageDuration: number;
  lastSyncTime?: Date;
  dataSources: number;
  dataTargets: number;
  conflicts: {
    total: number;
    resolved: number;
    pending: number;
  };
  performance: {
    recordsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheck[];
  metrics: SyncMetrics;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  timestamp: Date;
  duration: number;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
  required: boolean;
  defaultValue?: any;
}

export interface NormalizationRule {
  field: string;
  type: 'uppercase' | 'lowercase' | 'trim' | 'normalize_whitespace' | 'remove_special_chars' | 'custom';
  config?: Record<string, any>;
}

export interface DataIntegrityReport {
  id: string;
  dataSourceId: string;
  dataTargetId: string;
  checkType: 'consistency' | 'completeness' | 'validity' | 'uniqueness';
  status: 'passed' | 'failed' | 'warning';
  issues: IntegrityIssue[];
  checkedAt: Date;
  duration: number;
}

export interface IntegrityIssue {
  id: string;
  type: 'missing_data' | 'invalid_data' | 'duplicate_data' | 'constraint_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  field?: string;
  recordId?: string;
  message: string;
  suggestedFix?: string;
}

export interface WebhookEvent {
  id: string;
  type: 'sync_completed' | 'sync_failed' | 'conflict_detected' | 'data_validated';
  source: string;
  data: any;
  timestamp: Date;
  delivered: boolean;
  deliveryAttempts: number;
  lastDeliveryAttempt?: Date;
}

export interface DataSyncEngine {
  syncData(source: DataSource, target: DataTarget): Promise<SyncResult>;
  resolveConflicts(conflicts: Conflict[], strategy: ResolutionStrategy): Promise<ResolutionResult[]>;
  transformData(data: any, transformer: DataTransformer): Promise<any>;
  cacheData(key: string, data: any, ttl?: number): Promise<void>;
  getCachedData(key: string): Promise<any>;
  validateData(data: any, rules: ValidationRule[]): Promise<boolean>;
  getSyncMetrics(): Promise<SyncMetrics>;
  healthCheck(): Promise<HealthStatus>;
}

export interface ConflictResolver {
  detectConflicts(sourceData: any[], targetData: any[]): Promise<Conflict[]>;
  resolveConflict(conflict: Conflict, strategy: ResolutionStrategy): Promise<ResolutionResult>;
  applyResolution(resolution: ResolutionResult, target: DataTarget): Promise<void>;
}

export interface DataTransformerService {
  transform(source: any, transformer: DataTransformer): Promise<any>;
  validateSchema(data: any, schema: any): Promise<boolean>;
  mapFields(source: any, fieldMapping: FieldMapping[]): Promise<any>;
  normalizeData(data: any, rules: NormalizationRule[]): Promise<any>;
  createTransformation(config: TransformationConfig): Promise<DataTransformer>;
  updateTransformation(id: string, config: TransformationConfig): Promise<DataTransformer>;
  deleteTransformation(id: string): Promise<void>;
}

export interface CacheService {
  set(key: string, value: any, ttl?: number): Promise<void>;
  get(key: string): Promise<any>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  getMetrics(): Promise<CacheMetrics>;
}

export interface CacheMetrics {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageTTL: number;
  memoryUsage: number;
  lastCleanup: Date;
}

export interface SyncMonitor {
  logSyncStart(jobId: string): Promise<void>;
  logSyncComplete(jobId: string, result: SyncResult): Promise<void>;
  logSyncError(jobId: string, error: Error): Promise<void>;
  logConflictDetected(conflict: Conflict): Promise<void>;
  logConflictResolved(conflict: Conflict, resolution: ResolutionResult): Promise<void>;
  getMetrics(): Promise<SyncMetrics>;
  getHealthStatus(): Promise<HealthStatus>;
  createAlert(config: AlertConfig): Promise<Alert>;
  checkAlerts(): Promise<Alert[]>;
}

export interface AlertConfig {
  name: string;
  type: 'sync_failure' | 'conflict_threshold' | 'performance_degradation' | 'data_integrity';
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: AlertAction[];
  isActive: boolean;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value: number;
  duration?: number;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log' | 'notification';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  name: string;
  type: string;
  severity: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'acknowledged';
  message: string;
  data: Record<string, any>;
}
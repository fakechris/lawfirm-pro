import { Document, EvidenceItem } from '@prisma/client';

// Storage Configuration Types
export interface StorageConfig {
  provider: 'local' | 's3' | 'azure' | 'gcs';
  basePath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyRotationDays: number;
  };
  compression: {
    enabled: boolean;
    algorithm: string;
    threshold: number; // size in bytes
  };
  backup: {
    enabled: boolean;
    schedule: string; // cron expression
    retention: number; // days
    destination: string;
  };
  versioning: {
    enabled: boolean;
    maxVersions: number;
    retention: number; // days
  };
}

// Storage Organization Types
export interface StorageOrganization {
  basePath: string;
  structure: {
    documents: string;
    versions: string;
    templates: string;
    evidence: string;
    thumbnails: string;
    temp: string;
    backups: string;
  };
  naming: {
    documents: 'uuid' | 'timestamp' | 'hash' | 'custom';
    versions: 'sequential' | 'timestamp' | 'hash';
    templates: 'uuid' | 'timestamp' | 'custom';
  };
}

// File Storage Types
export interface FileStorageResult {
  success: boolean;
  filePath: string;
  filename: string;
  size: number;
  mimeType: string;
  checksum: string;
  thumbnailPath?: string;
  error?: string;
  warnings?: string[];
}

export interface FileRetrievalResult {
  success: boolean;
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  mimeType?: string;
  size?: number;
  checksum?: string;
  error?: string;
}

export interface FileDeletionResult {
  success: boolean;
  deletedFiles: string[];
  errors?: string[];
}

// Storage Service Types
export interface StorageService {
  uploadFile(file: Buffer, options: FileUploadOptions): Promise<FileStorageResult>;
  downloadFile(filePath: string): Promise<FileRetrievalResult>;
  deleteFile(filePath: string): Promise<FileDeletionResult>;
  moveFile(sourcePath: string, destinationPath: string): Promise<boolean>;
  copyFile(sourcePath: string, destinationPath: string): Promise<boolean>;
  fileExists(filePath: string): Promise<boolean>;
  getFileSize(filePath: string): Promise<number>;
  getFileChecksum(filePath: string): Promise<string>;
  generateThumbnail(filePath: string): Promise<string>;
  getStorageUsage(): Promise<StorageUsage>;
  cleanupTempFiles(): Promise<CleanupResult>;
}

export interface FileUploadOptions {
  filename: string;
  mimeType: string;
  category: 'documents' | 'versions' | 'templates' | 'evidence' | 'thumbnails' | 'temp';
  subcategory?: string;
  generateChecksum?: boolean;
  generateThumbnail?: boolean;
  encrypt?: boolean;
  compress?: boolean;
  overwrite?: boolean;
  metadata?: Record<string, unknown>;
}

// Storage Usage Types
export interface StorageUsage {
  totalUsed: number;
  totalAvailable: number;
  usedPercentage: number;
  byCategory: Record<string, {
    used: number;
    fileCount: number;
    averageSize: number;
  }>;
  byType: Record<string, {
    used: number;
    fileCount: number;
  }>;
  largestFiles: Array<{
    filePath: string;
    size: number;
    mimeType: string;
    lastModified: Date;
  }>;
  growth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

// Cleanup Types
export interface CleanupResult {
  success: boolean;
  deletedFiles: number;
  freedSpace: number;
  errors?: string[];
  details: {
    tempFiles: number;
    oldVersions: number;
    duplicates: number;
    corrupted: number;
  };
}

export interface CleanupOptions {
  tempFilesOlderThan?: number; // hours
  versionsOlderThan?: number; // days
  duplicates?: boolean;
  corrupted?: boolean;
  dryRun?: boolean;
}

// Backup Types
export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention: number; // days
  compression: boolean;
  encryption: boolean;
  includeVersions: boolean;
  includeThumbnails: boolean;
  destination: {
    type: 'local' | 's3' | 'azure' | 'gcs';
    path: string;
    credentials?: Record<string, string>;
  };
  notifications: {
    onSuccess?: boolean;
    onFailure?: boolean;
    recipients?: string[];
  };
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  size?: number;
  filesCount?: number;
  error?: string;
  warnings?: string[];
}

export interface BackupJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  progress?: number;
  size?: number;
  filesCount?: number;
  error?: string;
  config: BackupConfig;
}

// Security Types
export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyId?: string;
  keyRotationDays: number;
  ivLength: number;
}

export interface EncryptionResult {
  success: boolean;
  encryptedData?: Buffer;
  iv?: Buffer;
  keyId?: string;
  algorithm?: string;
  error?: string;
}

export interface DecryptionResult {
  success: boolean;
  decryptedData?: Buffer;
  error?: string;
}

// Compression Types
export interface CompressionConfig {
  enabled: boolean;
  algorithm: string;
  threshold: number; // size in bytes
  level: number; // 1-9
}

export interface CompressionResult {
  success: boolean;
  compressedData?: Buffer;
  originalSize?: number;
  compressedSize?: number;
  ratio?: number;
  error?: string;
}

// Validation Types
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  mimeType?: {
    detected: string;
    expected?: string;
    matches: boolean;
  };
  extension?: {
    detected: string;
    allowed: boolean;
  };
  size?: {
    actual: number;
    maximum: number;
    withinLimit: boolean;
  };
  content?: {
    isReadable: boolean;
    isCorrupted: boolean;
    format?: string;
  };
}

// Monitoring Types
export interface StorageMetrics {
  uploads: {
    total: number;
    successful: number;
    failed: number;
    averageSize: number;
    averageTime: number;
  };
  downloads: {
    total: number;
    successful: number;
    failed: number;
    averageSize: number;
    averageTime: number;
  };
  errors: Array<{
    code: string;
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  storage: StorageUsage;
}

export interface StorageAlert {
  id: string;
  type: 'usage' | 'error' | 'performance' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// Event Types
export interface StorageEvent {
  type: 'upload' | 'download' | 'delete' | 'move' | 'copy' | 'backup' | 'cleanup';
  filePath: string;
  userId?: string;
  timestamp: Date;
  success: boolean;
  size?: number;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Integration Types
export interface StorageWebhookPayload {
  event: string;
  filePath: string;
  user?: {
    id: string;
    name: string;
  };
  timestamp: Date;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// Utility Types
export interface FileMetadata {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string;
  checksum: string;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
  version?: number;
  isEncrypted: boolean;
  isCompressed: boolean;
  category?: string;
  tags?: string[];
  custom?: Record<string, unknown>;
}

export interface DirectoryInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt: Date;
  children?: DirectoryInfo[];
}

export interface StorageQuota {
  used: number;
  available: number;
  total: number;
  percentage: number;
  softLimit?: number;
  hardLimit?: number;
  warnings: {
    softLimitReached?: boolean;
    hardLimitReached?: boolean;
    recommendations: string[];
  };
}
import fs from 'fs/promises';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { config } from '../config';
import { DocumentStorageService } from '../services/documents/storage';

export interface OptimizationOptions {
  cleanupTempFiles?: boolean;
  cleanupOldVersions?: boolean;
  cleanupDuplicates?: boolean;
  cleanupCorruptedFiles?: boolean;
  optimizeDatabase?: boolean;
  generateIndex?: boolean;
  compressLargeFiles?: boolean;
  defragmentStorage?: boolean;
  dryRun?: boolean;
  maxAge?: {
    tempFiles?: number; // hours
    versions?: number; // days
    backups?: number; // days
  };
  sizeThresholds?: {
    largeFile?: number; // bytes
    versionCleanup?: number; // bytes
    duplicateDetection?: number; // bytes
  };
}

export interface OptimizationResult {
  success: boolean;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  summary: {
    filesProcessed: number;
    filesDeleted: number;
    filesOptimized: number;
    spaceFreed: number;
    spaceSaved: number;
  };
  details: {
    tempFiles: {
      deleted: number;
      spaceFreed: number;
    };
    oldVersions: {
      deleted: number;
      spaceFreed: number;
    };
    duplicates: {
      deleted: number;
      spaceFreed: number;
    };
    corrupted: {
      deleted: number;
      spaceFreed: number;
    };
    compressed: {
      optimized: number;
      spaceSaved: number;
    };
    database: {
      optimized: boolean;
      timeTaken?: number;
    };
  };
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface StorageMetrics {
  totalFiles: number;
  totalSize: number;
  averageFileSize: number;
  largestFiles: Array<{
    path: string;
    size: number;
    lastModified: Date;
  }>;
  byCategory: Record<string, {
    count: number;
    size: number;
    averageSize: number;
  }>;
  byType: Record<string, {
    count: number;
    size: number;
  }>;
  growth: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  health: {
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  };
}

export class StorageOptimizationService {
  private basePath: string;
  private baseStorageService: DocumentStorageService;
  private optimizationHistory: Array<{
    timestamp: Date;
    result: OptimizationResult;
  }> = [];

  constructor() {
    this.basePath = config.storage.basePath;
    this.baseStorageService = new DocumentStorageService();
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async scanDirectory(
    dirPath: string,
    callback: (filePath: string, stats: any) => void,
    options: {
      recursive?: boolean;
      includeDirectories?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory() && options.recursive !== false) {
          await this.scanDirectory(filePath, callback, options);
        } else if (!stats.isDirectory() || options.includeDirectories) {
          callback(filePath, stats);
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${dirPath}:`, error);
    }
  }

  async performOptimization(options: OptimizationOptions = {}): Promise<OptimizationResult> {
    const startTime = new Date();
    
    const result: OptimizationResult = {
      success: false,
      startTime,
      summary: {
        filesProcessed: 0,
        filesDeleted: 0,
        filesOptimized: 0,
        spaceFreed: 0,
        spaceSaved: 0
      },
      details: {
        tempFiles: { deleted: 0, spaceFreed: 0 },
        oldVersions: { deleted: 0, spaceFreed: 0 },
        duplicates: { deleted: 0, spaceFreed: 0 },
        corrupted: { deleted: 0, spaceFreed: 0 },
        compressed: { optimized: 0, spaceSaved: 0 },
        database: { optimized: false }
      },
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      if (options.dryRun) {
        result.warnings.push('Running in dry-run mode - no actual changes will be made');
      }

      // Clean up temporary files
      if (options.cleanupTempFiles !== false) {
        const tempResult = await this.cleanupTempFiles(options);
        result.details.tempFiles = tempResult;
        result.summary.filesDeleted += tempResult.deleted;
        result.summary.spaceFreed += tempResult.spaceFreed;
      }

      // Clean up old versions
      if (options.cleanupOldVersions !== false) {
        const versionsResult = await this.cleanupOldVersions(options);
        result.details.oldVersions = versionsResult;
        result.summary.filesDeleted += versionsResult.deleted;
        result.summary.spaceFreed += versionsResult.spaceFreed;
      }

      // Clean up duplicate files
      if (options.cleanupDuplicates !== false) {
        const duplicatesResult = await this.cleanupDuplicates(options);
        result.details.duplicates = duplicatesResult;
        result.summary.filesDeleted += duplicatesResult.deleted;
        result.summary.spaceFreed += duplicatesResult.spaceFreed;
      }

      // Clean up corrupted files
      if (options.cleanupCorruptedFiles !== false) {
        const corruptedResult = await this.cleanupCorruptedFiles(options);
        result.details.corrupted = corruptedResult;
        result.summary.filesDeleted += corruptedResult.deleted;
        result.summary.spaceFreed += corruptedResult.spaceFreed;
      }

      // Compress large files
      if (options.compressLargeFiles !== false) {
        const compressionResult = await this.compressLargeFiles(options);
        result.details.compressed = compressionResult;
        result.summary.filesOptimized += compressionResult.optimized;
        result.summary.spaceSaved += compressionResult.spaceSaved;
      }

      // Optimize database (placeholder)
      if (options.optimizeDatabase !== false) {
        const dbResult = await this.optimizeDatabase(options);
        result.details.database = dbResult;
      }

      // Generate storage health report and recommendations
      const metrics = await this.getStorageMetrics();
      this.generateRecommendations(metrics, result);

      result.success = result.errors.length === 0;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.summary.filesProcessed = 
        result.details.tempFiles.deleted +
        result.details.oldVersions.deleted +
        result.details.duplicates.deleted +
        result.details.corrupted.deleted +
        result.details.compressed.optimized;

      // Save optimization history
      this.optimizationHistory.push({
        timestamp: new Date(),
        result: { ...result }
      });

      return result;

    } catch (error) {
      result.errors.push(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      result.success = false;
      return result;
    }
  }

  private async cleanupTempFiles(options: OptimizationOptions): Promise<{ deleted: number; spaceFreed: number }> {
    const result = { deleted: 0, spaceFreed: 0 };
    const maxAge = options.maxAge?.tempFiles || 24; // hours
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);

    try {
      const tempDir = path.join(this.basePath, config.storage.paths.temp.uploads);
      
      if (await this.baseStorageService.fileExists(tempDir)) {
        await this.scanDirectory(tempDir, async (filePath, stats) => {
          if (stats.mtime < cutoffTime) {
            if (!options.dryRun) {
              await fs.unlink(filePath);
            }
            result.deleted++;
            result.spaceFreed += stats.size;
          }
        });
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }

    return result;
  }

  private async cleanupOldVersions(options: OptimizationOptions): Promise<{ deleted: number; spaceFreed: number }> {
    const result = { deleted: 0, spaceFreed: 0 };
    const maxAge = options.maxAge?.versions || 90; // days
    const cutoffTime = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    const sizeThreshold = options.sizeThresholds?.versionCleanup || 10 * 1024 * 1024; // 10MB

    try {
      const versionsDir = path.join(this.basePath, config.storage.paths.documents.versions);
      
      if (await this.baseStorageService.fileExists(versionsDir)) {
        await this.scanDirectory(versionsDir, async (filePath, stats) => {
          if (stats.mtime < cutoffTime && stats.size > sizeThreshold) {
            if (!options.dryRun) {
              await fs.unlink(filePath);
            }
            result.deleted++;
            result.spaceFreed += stats.size;
          }
        });
      }
    } catch (error) {
      console.error('Error cleaning up old versions:', error);
    }

    return result;
  }

  private async cleanupDuplicates(options: OptimizationOptions): Promise<{ deleted: number; spaceFreed: number }> {
    const result = { deleted: 0, spaceFreed: 0 };
    const sizeThreshold = options.sizeThresholds?.duplicateDetection || 1024 * 1024; // 1MB
    const checksumMap = new Map<string, string[]>();

    try {
      // Scan all files and build checksum map
      for (const category of Object.values(config.storage.paths)) {
        for (const subcategory of Object.values(category)) {
          const dirPath = path.join(this.basePath, subcategory);
          
          if (await this.baseStorageService.fileExists(dirPath)) {
            await this.scanDirectory(dirPath, async (filePath, stats) => {
              if (stats.size >= sizeThreshold) {
                try {
                  const checksum = await this.calculateFileHash(filePath);
                  if (!checksumMap.has(checksum)) {
                    checksumMap.set(checksum, []);
                  }
                  checksumMap.get(checksum)!.push(filePath);
                } catch (error) {
                  console.warn(`Could not calculate checksum for ${filePath}:`, error);
                }
              }
            });
          }
        }
      }

      // Remove duplicates (keep the newest file)
      for (const [checksum, files] of checksumMap.entries()) {
        if (files.length > 1) {
          // Sort by modification time (newest first)
          files.sort((a, b) => {
            return fs.stat(b).then(statsB => 
              fs.stat(a).then(statsA => statsB.mtime.getTime() - statsA.mtime.getTime())
            );
          });

          // Keep the newest file, delete others
          for (let i = 1; i < files.length; i++) {
            try {
              const stats = await fs.stat(files[i]);
              if (!options.dryRun) {
                await fs.unlink(files[i]);
              }
              result.deleted++;
              result.spaceFreed += stats.size;
            } catch (error) {
              console.warn(`Could not delete duplicate file ${files[i]}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
    }

    return result;
  }

  private async cleanupCorruptedFiles(options: OptimizationOptions): Promise<{ deleted: number; spaceFreed: number }> {
    const result = { deleted: 0, spaceFreed: 0 };

    try {
      for (const category of Object.values(config.storage.paths)) {
        for (const subcategory of Object.values(category)) {
          const dirPath = path.join(this.basePath, subcategory);
          
          if (await this.baseStorageService.fileExists(dirPath)) {
            await this.scanDirectory(dirPath, async (filePath, stats) => {
              if (await this.isCorruptedFile(filePath)) {
                if (!options.dryRun) {
                  await fs.unlink(filePath);
                }
                result.deleted++;
                result.spaceFreed += stats.size;
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up corrupted files:', error);
    }

    return result;
  }

  private async isCorruptedFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check for empty files
      if (stats.size === 0) {
        return true;
      }

      // Check file extension specific corruption
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.pdf') {
        const buffer = await fs.readFile(filePath, { start: 0, end: 10 });
        return !buffer.toString('ascii').includes('%PDF');
      }

      if (['.jpg', '.jpeg'].includes(ext)) {
        const buffer = await fs.readFile(filePath, { start: 0, end: 4 });
        return buffer.toString('hex') !== 'ffd8ffe0';
      }

      if (ext === '.png') {
        const buffer = await fs.readFile(filePath, { start: 0, end: 8 });
        return buffer.toString('hex') !== '89504e470d0a1a0a';
      }

      // For other files, just check if we can read it
      await fs.readFile(filePath, { start: 0, end: Math.min(1024, stats.size) });
      return false;

    } catch (error) {
      return true;
    }
  }

  private async compressLargeFiles(options: OptimizationOptions): Promise<{ optimized: number; spaceSaved: number }> {
    const result = { optimized: 0, spaceSaved: 0 };
    const sizeThreshold = options.sizeThresholds?.largeFile || 50 * 1024 * 1024; // 50MB

    try {
      for (const category of Object.values(config.storage.paths)) {
        for (const subcategory of Object.values(category)) {
          const dirPath = path.join(this.basePath, subcategory);
          
          if (await this.baseStorageService.fileExists(dirPath)) {
            await this.scanDirectory(dirPath, async (filePath, stats) => {
              if (stats.size > sizeThreshold) {
                const compressionResult = await this.compressFile(filePath, options.dryRun);
                if (compressionResult.spaceSaved > 0) {
                  result.optimized++;
                  result.spaceSaved += compressionResult.spaceSaved;
                }
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error compressing large files:', error);
    }

    return result;
  }

  private async compressFile(filePath: string, dryRun: boolean): Promise<{ spaceSaved: number }> {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      // Only compress certain file types
      const compressibleTypes = ['.txt', '.csv', '.json', '.xml', '.log'];
      if (!compressibleTypes.includes(ext)) {
        return { spaceSaved: 0 };
      }

      // For now, just estimate potential compression
      // In production, you would use actual compression libraries
      const estimatedCompressionRatio = 0.3; // 30% reduction
      const estimatedSpaceSaved = Math.floor(stats.size * estimatedCompressionRatio);

      if (!dryRun && estimatedSpaceSaved > 0) {
        // Placeholder for actual compression
        console.log(`Would compress ${filePath}, estimated space saved: ${estimatedSpaceSaved} bytes`);
      }

      return { spaceSaved: dryRun ? 0 : estimatedSpaceSaved };

    } catch (error) {
      console.warn(`Could not compress file ${filePath}:`, error);
      return { spaceSaved: 0 };
    }
  }

  private async optimizeDatabase(options: OptimizationOptions): Promise<{ optimized: boolean; timeTaken?: number }> {
    const startTime = Date.now();
    
    try {
      // Placeholder for database optimization
      // In production, you would run VACUUM, ANALYZE, REINDEX, etc.
      console.log('Database optimization would be performed here');
      
      return {
        optimized: true,
        timeTaken: Date.now() - startTime
      };

    } catch (error) {
      console.error('Error optimizing database:', error);
      return { optimized: false };
    }
  }

  private generateRecommendations(metrics: StorageMetrics, result: OptimizationResult): void {
    // Storage health recommendations
    if (metrics.health.score < 70) {
      result.recommendations.push('Storage health score is low - consider immediate optimization');
    }

    if (metrics.totalSize > 0.9 * (1024 * 1024 * 1024 * 1024)) { // 90% of 1TB
      result.recommendations.push('Storage usage is high - consider cleanup or expansion');
    }

    if (metrics.growth.daily > 100 * 1024 * 1024) { // 100MB per day
      result.recommendations.push('High daily growth rate - monitor storage capacity');
    }

    // Duplicate file recommendations
    if (result.details.duplicates.deleted > 10) {
      result.recommendations.push('Many duplicate files found - consider implementing automatic deduplication');
    }

    // Large file recommendations
    if (metrics.largestFiles.length > 0 && metrics.largestFiles[0].size > 500 * 1024 * 1024) {
      result.recommendations.push('Very large files detected - consider compression or archival');
    }

    // Version cleanup recommendations
    if (result.details.oldVersions.deleted > 5) {
      result.recommendations.push('Many old versions cleaned up - consider adjusting version retention policy');
    }

    // Performance recommendations
    if (metrics.averageFileSize > 10 * 1024 * 1024) { // 10MB average
      result.recommendations.push('Large average file size - consider implementing file compression');
    }
  }

  async getStorageMetrics(): Promise<StorageMetrics> {
    const metrics: StorageMetrics = {
      totalFiles: 0,
      totalSize: 0,
      averageFileSize: 0,
      largestFiles: [],
      byCategory: {},
      byType: {},
      growth: {
        daily: 0,
        weekly: 0,
        monthly: 0
      },
      health: {
        score: 100,
        issues: [],
        recommendations: []
      }
    };

    try {
      // Scan all storage directories
      for (const [category, paths] of Object.entries(config.storage.paths)) {
        let categorySize = 0;
        let categoryCount = 0;

        for (const subcategory of Object.values(paths)) {
          const dirPath = path.join(this.basePath, subcategory);
          
          if (await this.baseStorageService.fileExists(dirPath)) {
            await this.scanDirectory(dirPath, (filePath, stats) => {
              if (!stats.isDirectory()) {
                metrics.totalFiles++;
                metrics.totalSize += stats.size;
                categorySize += stats.size;
                categoryCount++;

                // Track largest files
                metrics.largestFiles.push({
                  path: filePath,
                  size: stats.size,
                  lastModified: stats.mtime
                });

                // Track by file type
                const ext = path.extname(filePath).toLowerCase();
                if (!metrics.byType[ext]) {
                  metrics.byType[ext] = { count: 0, size: 0 };
                }
                metrics.byType[ext].count++;
                metrics.byType[ext].size += stats.size;
              }
            });
          }
        }

        metrics.byCategory[category] = {
          count: categoryCount,
          size: categorySize,
          averageSize: categoryCount > 0 ? categorySize / categoryCount : 0
        };
      }

      // Calculate average file size
      metrics.averageFileSize = metrics.totalFiles > 0 ? metrics.totalSize / metrics.totalFiles : 0;

      // Sort and limit largest files
      metrics.largestFiles.sort((a, b) => b.size - a.size);
      metrics.largestFiles = metrics.largestFiles.slice(0, 10);

      // Calculate growth (simplified - would need historical data)
      metrics.growth.daily = metrics.totalSize * 0.001; // Placeholder
      metrics.growth.weekly = metrics.growth.daily * 7;
      metrics.growth.monthly = metrics.growth.daily * 30;

      // Calculate health score
      this.calculateHealthScore(metrics);

    } catch (error) {
      console.error('Error getting storage metrics:', error);
      metrics.health.score = 0;
      metrics.health.issues.push('Could not calculate storage metrics');
    }

    return metrics;
  }

  private calculateHealthScore(metrics: StorageMetrics): void {
    let score = 100;

    // Deduct for storage usage (simplified)
    const usagePercentage = metrics.totalSize / (1024 * 1024 * 1024 * 1024); // Assuming 1TB total
    if (usagePercentage > 0.8) score -= 20;
    else if (usagePercentage > 0.6) score -= 10;

    // Deduct for too many duplicates
    const duplicateRatio = this.estimateDuplicateRatio(metrics);
    if (duplicateRatio > 0.1) score -= 15;

    // Deduct for corrupted files
    const corruptedRatio = this.estimateCorruptedRatio(metrics);
    if (corruptedRatio > 0.05) score -= 25;

    // Deduct for old versions
    const oldVersionRatio = this.estimateOldVersionRatio(metrics);
    if (oldVersionRatio > 0.2) score -= 10;

    metrics.health.score = Math.max(0, score);
  }

  private estimateDuplicateRatio(metrics: StorageMetrics): number {
    // Simplified estimation - in production, you would use actual checksum comparison
    return Math.min(0.1, metrics.totalFiles / 10000 * 0.01);
  }

  private estimateCorruptedRatio(metrics: StorageMetrics): number {
    // Simplified estimation
    return Math.min(0.05, metrics.totalFiles / 20000 * 0.01);
  }

  private estimateOldVersionRatio(metrics: StorageMetrics): number {
    const versionCount = metrics.byCategory.versions?.count || 0;
    const totalDocumentCount = metrics.byCategory.documents?.count || 0;
    
    return totalDocumentCount > 0 ? Math.min(0.5, versionCount / totalDocumentCount) : 0;
  }

  async getOptimizationHistory(limit: number = 10): Promise<Array<{
    timestamp: Date;
    result: OptimizationResult;
  }>> {
    return this.optimizationHistory.slice(-limit);
  }

  async scheduleOptimization(
    schedule: string, // cron expression
    options: OptimizationOptions = {}
  ): Promise<string> {
    const scheduleId = `opt_${Date.now()}_${randomBytes(4).toString('hex')}`;
    
    // Placeholder for scheduling implementation
    // In production, you would use a proper cron library
    console.log(`Optimization scheduled with ID: ${scheduleId}, schedule: ${schedule}`);
    
    return scheduleId;
  }

  async cancelScheduledOptimization(scheduleId: string): Promise<boolean> {
    // Placeholder for cancellation
    console.log(`Scheduled optimization ${scheduleId} would be cancelled`);
    return true;
  }
}

export const storageOptimizationService = new StorageOptimizationService();
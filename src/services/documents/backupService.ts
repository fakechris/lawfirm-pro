import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { config } from '../config';
import { DocumentStorageService } from '../services/documents/storage';

const pipelineAsync = promisify(pipeline);

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  compression: boolean;
  encryption: boolean;
  includeVersions: boolean;
  includeThumbnails: boolean;
  retention: number; // days
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
  checksum?: string;
  backupPath?: string;
}

export interface BackupJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: BackupConfig;
  startTime?: Date;
  endTime?: Date;
  progress?: number;
  size?: number;
  filesCount?: number;
  error?: string;
  result?: BackupResult;
}

export interface RestoreResult {
  success: boolean;
  restoreId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  filesRestored: number;
  errors: string[];
  warnings: string[];
  integrityVerified: boolean;
}

export interface BackupSchedule {
  id: string;
  name: string;
  config: BackupConfig;
  lastRun?: Date;
  nextRun?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BackupService {
  private basePath: string;
  private backupPath: string;
  private baseStorageService: DocumentStorageService;
  private activeBackups: Map<string, BackupJob> = new Map();
  private backupSchedules: Map<string, BackupSchedule> = new Map();

  constructor() {
    this.basePath = config.storage.basePath;
    this.backupPath = path.join(this.basePath, 'backups');
    this.baseStorageService = new DocumentStorageService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.ensureDirectoryExists(this.backupPath);
      await this.loadBackupSchedules();
      this.startBackupScheduler();
    } catch (error) {
      console.error('Error initializing backup service:', error);
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async loadBackupSchedules(): Promise<void> {
    try {
      const schedulesFile = path.join(this.backupPath, 'schedules.json');
      if (await this.baseStorageService.fileExists(schedulesFile)) {
        const data = await fs.readFile(schedulesFile, 'utf-8');
        const schedules = JSON.parse(data) as BackupSchedule[];
        
        schedules.forEach(schedule => {
          this.backupSchedules.set(schedule.id, schedule);
        });
      }
    } catch (error) {
      console.warn('Could not load backup schedules:', error);
    }
  }

  private async saveBackupSchedules(): Promise<void> {
    try {
      const schedulesFile = path.join(this.backupPath, 'schedules.json');
      const schedules = Array.from(this.backupSchedules.values());
      await fs.writeFile(schedulesFile, JSON.stringify(schedules, null, 2));
    } catch (error) {
      console.error('Error saving backup schedules:', error);
    }
  }

  private startBackupScheduler(): void {
    // Check every minute for scheduled backups
    setInterval(() => {
      this.checkAndRunScheduledBackups();
    }, 60 * 1000);
  }

  private async checkAndRunScheduledBackups(): Promise<void> {
    const now = new Date();
    
    for (const schedule of this.backupSchedules.values()) {
      if (!schedule.isActive) continue;
      
      if (!schedule.nextRun || now >= schedule.nextRun) {
        try {
          await this.runScheduledBackup(schedule);
        } catch (error) {
          console.error(`Error running scheduled backup ${schedule.id}:`, error);
        }
      }
    }
  }

  private async runScheduledBackup(schedule: BackupSchedule): Promise<void> {
    const backupJob: BackupJob = {
      id: `backup_${Date.now()}_${randomBytes(4).toString('hex')}`,
      status: 'running',
      config: schedule.config,
      startTime: new Date()
    };

    this.activeBackups.set(backupJob.id, backupJob);

    try {
      const result = await this.performBackup(schedule.config, backupJob.id);
      
      backupJob.status = result.success ? 'completed' : 'failed';
      backupJob.endTime = new Date();
      backupJob.result = result;
      
      if (result.success) {
        schedule.lastRun = new Date();
        schedule.nextRun = this.calculateNextRun(schedule.config.schedule);
      }

    } catch (error) {
      backupJob.status = 'failed';
      backupJob.endTime = new Date();
      backupJob.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.activeBackups.delete(backupJob.id);
    await this.saveBackupSchedules();
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser - in production, use a proper cron library
    const now = new Date();
    const [minute, hour, day, month, weekday] = cronExpression.split(' ');
    
    // For now, just add 24 hours for daily backups
    const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return nextRun;
  }

  async performBackup(backupConfig: BackupConfig, backupId?: string): Promise<BackupResult> {
    const startTime = new Date();
    const actualBackupId = backupId || `backup_${Date.now()}_${randomBytes(4).toString('hex')}`;
    
    const result: BackupResult = {
      success: false,
      backupId: actualBackupId,
      startTime,
      warnings: []
    };

    try {
      const backupDir = path.join(this.backupPath, actualBackupId);
      await this.ensureDirectoryExists(backupDir);

      // Backup metadata
      const metadata = {
        backupId: actualBackupId,
        startTime: startTime.toISOString(),
        config: backupConfig,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        }
      };

      await fs.writeFile(
        path.join(backupDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      let totalSize = 0;
      let filesCount = 0;
      const backedUpFiles: string[] = [];

      // Backup documents
      const documentsBackupPath = path.join(backupDir, 'documents');
      await this.backupDirectory(
        path.join(this.basePath, config.storage.paths.documents.original),
        documentsBackupPath,
        backedUpFiles,
        (size) => { totalSize += size; filesCount++; }
      );

      // Backup versions if included
      if (backupConfig.includeVersions) {
        const versionsBackupPath = path.join(backupDir, 'versions');
        await this.backupDirectory(
          path.join(this.basePath, config.storage.paths.documents.versions),
          versionsBackupPath,
          backedUpFiles,
          (size) => { totalSize += size; filesCount++; }
        );
      }

      // Backup templates
      const templatesBackupPath = path.join(backupDir, 'templates');
      await this.backupDirectory(
        path.join(this.basePath, config.storage.paths.templates.active),
        templatesBackupPath,
        backedUpFiles,
        (size) => { totalSize += size; filesCount++; }
      );

      // Backup evidence
      const evidenceBackupPath = path.join(backupDir, 'evidence');
      await this.backupDirectory(
        path.join(this.basePath, config.storage.paths.evidence.original),
        evidenceBackupPath,
        backedUpFiles,
        (size) => { totalSize += size; filesCount++; }
      );

      // Backup thumbnails if included
      if (backupConfig.includeThumbnails) {
        const thumbnailsBackupPath = path.join(backupDir, 'thumbnails');
        await this.backupDirectory(
          path.join(this.basePath, config.storage.paths.evidence.thumbnails),
          thumbnailsBackupPath,
          backedUpFiles,
          (size) => { totalSize += size; filesCount++; }
        );
      }

      // Create file manifest
      const manifest = {
        files: backedUpFiles,
        totalSize,
        filesCount,
        backupTime: new Date().toISOString()
      };

      await fs.writeFile(
        path.join(backupDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Calculate backup checksum
      const checksum = await this.calculateBackupChecksum(backupDir);
      result.checksum = checksum;

      // Compress backup if requested
      if (backupConfig.compression) {
        await this.compressBackup(backupDir);
      }

      // Encrypt backup if requested
      if (backupConfig.encryption) {
        await this.encryptBackup(backupDir);
      }

      result.success = true;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.size = totalSize;
      result.filesCount = filesCount;
      result.backupPath = backupDir;

      // Cleanup old backups based on retention policy
      await this.cleanupOldBackups(backupConfig.retention);

      return result;

    } catch (error) {
      result.error = `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      
      // Clean up failed backup
      try {
        const backupDir = path.join(this.backupPath, actualBackupId);
        if (await this.baseStorageService.fileExists(backupDir)) {
          await fs.rm(backupDir, { recursive: true });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up failed backup:', cleanupError);
      }

      return result;
    }
  }

  private async backupDirectory(
    sourceDir: string,
    targetDir: string,
    backedUpFiles: string[],
    onFileBackup: (size: number) => void
  ): Promise<void> {
    try {
      await this.ensureDirectoryExists(targetDir);

      const files = await fs.readdir(sourceDir);
      
      for (const file of files) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        const stats = await fs.stat(sourcePath);

        if (stats.isDirectory()) {
          await this.backupDirectory(sourcePath, targetPath, backedUpFiles, onFileBackup);
        } else {
          await fs.copyFile(sourcePath, targetPath);
          backedUpFiles.push(sourcePath);
          onFileBackup(stats.size);
        }
      }
    } catch (error) {
      console.warn(`Could not backup directory ${sourceDir}:`, error);
    }
  }

  private async calculateBackupChecksum(backupDir: string): Promise<string> {
    const hash = createHash('sha256');
    const manifestPath = path.join(backupDir, 'manifest.json');
    
    if (await this.baseStorageService.fileExists(manifestPath)) {
      const manifestData = await fs.readFile(manifestPath);
      hash.update(manifestData);
    }

    return hash.digest('hex');
  }

  private async compressBackup(backupDir: string): Promise<void> {
    // Placeholder for compression implementation
    // In production, you would use libraries like archiver
    console.log(`Compression would be applied to backup: ${backupDir}`);
  }

  private async encryptBackup(backupDir: string): Promise<void> {
    // Placeholder for encryption implementation
    // In production, you would use proper encryption libraries
    console.log(`Encryption would be applied to backup: ${backupDir}`);
  }

  private async cleanupOldBackups(retentionDays: number): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const backups = await fs.readdir(this.backupPath);

      for (const backup of backups) {
        const backupPath = path.join(this.backupPath, backup);
        const stats = await fs.stat(backupPath);

        if (stats.isDirectory() && stats.birthtime < cutoffDate) {
          await fs.rm(backupPath, { recursive: true });
          console.log(`Cleaned up old backup: ${backup}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  async restoreFromBackup(backupId: string, options?: {
    overwrite?: boolean;
    validateIntegrity?: boolean;
    dryRun?: boolean;
  }): Promise<RestoreResult> {
    const startTime = new Date();
    const restoreId = `restore_${Date.now()}_${randomBytes(4).toString('hex')}`;
    
    const result: RestoreResult = {
      success: false,
      restoreId,
      startTime,
      filesRestored: 0,
      errors: [],
      warnings: [],
      integrityVerified: false
    };

    try {
      const backupDir = path.join(this.backupPath, backupId);
      
      if (!await this.baseStorageService.fileExists(backupDir)) {
        result.errors.push(`Backup not found: ${backupId}`);
        return result;
      }

      // Load backup metadata
      const metadataPath = path.join(backupDir, 'metadata.json');
      const manifestPath = path.join(backupDir, 'manifest.json');

      if (!await this.baseStorageService.fileExists(metadataPath)) {
        result.errors.push('Backup metadata not found');
        return result;
      }

      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

      // Validate backup integrity
      if (options?.validateIntegrity !== false) {
        const currentChecksum = await this.calculateBackupChecksum(backupDir);
        if (currentChecksum !== manifest.checksum) {
          result.errors.push('Backup integrity check failed - checksum mismatch');
          return result;
        }
        result.integrityVerified = true;
      }

      if (options?.dryRun) {
        result.warnings.push('Dry run mode - no files will be restored');
        result.success = true;
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
        return result;
      }

      // Restore files
      for (const filePath of manifest.files) {
        try {
          const relativePath = path.relative(backupDir, filePath);
          const targetPath = path.join(this.basePath, relativePath);
          
          await this.ensureDirectoryExists(path.dirname(targetPath));
          
          if (options?.overwrite !== false || !await this.baseStorageService.fileExists(targetPath)) {
            await fs.copyFile(filePath, targetPath);
            result.filesRestored++;
          } else {
            result.warnings.push(`File already exists and overwrite is false: ${relativePath}`);
          }
        } catch (error) {
          result.errors.push(`Failed to restore ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      result.success = result.errors.length === 0;
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();

      return result;

    } catch (error) {
      result.errors.push(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - startTime.getTime();
      return result;
    }
  }

  async listBackups(): Promise<Array<{
    id: string;
    date: Date;
    size: number;
    filesCount: number;
    config: BackupConfig;
  }>> {
    try {
      const backups = await fs.readdir(this.backupPath);
      const backupList: Array<{
        id: string;
        date: Date;
        size: number;
        filesCount: number;
        config: BackupConfig;
      }> = [];

      for (const backup of backups) {
        const backupPath = path.join(this.backupPath, backup);
        const stats = await fs.stat(backupPath);

        if (stats.isDirectory()) {
          try {
            const metadataPath = path.join(backupPath, 'metadata.json');
            const manifestPath = path.join(backupPath, 'manifest.json');

            if (await this.baseStorageService.fileExists(metadataPath) && 
                await this.baseStorageService.fileExists(manifestPath)) {
              
              const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
              const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

              backupList.push({
                id: backup,
                date: stats.birthtime,
                size: manifest.totalSize || 0,
                filesCount: manifest.filesCount || 0,
                config: metadata.config
              });
            }
          } catch (error) {
            console.warn(`Could not read backup metadata for ${backup}:`, error);
          }
        }
      }

      return backupList.sort((a, b) => b.date.getTime() - a.date.getTime());

    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  async getBackupInfo(backupId: string): Promise<{
    exists: boolean;
    metadata?: any;
    manifest?: any;
    integrity?: {
      isValid: boolean;
      checksum?: string;
      issues: string[];
    };
  }> {
    try {
      const backupDir = path.join(this.backupPath, backupId);
      
      if (!await this.baseStorageService.fileExists(backupDir)) {
        return { exists: false };
      }

      const metadataPath = path.join(backupDir, 'metadata.json');
      const manifestPath = path.join(backupDir, 'manifest.json');

      if (!await this.baseStorageService.fileExists(metadataPath) || 
          !await this.baseStorageService.fileExists(manifestPath)) {
        return { exists: true, metadata: null, manifest: null };
      }

      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

      // Check integrity
      const currentChecksum = await this.calculateBackupChecksum(backupDir);
      const isValid = currentChecksum === manifest.checksum;

      return {
        exists: true,
        metadata,
        manifest,
        integrity: {
          isValid,
          checksum: currentChecksum,
          issues: isValid ? [] : ['Checksum mismatch detected']
        }
      };

    } catch (error) {
      console.error('Error getting backup info:', error);
      return { exists: false };
    }
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backupDir = path.join(this.backupPath, backupId);
      
      if (!await this.baseStorageService.fileExists(backupDir)) {
        return false;
      }

      await fs.rm(backupDir, { recursive: true });
      return true;

    } catch (error) {
      console.error('Error deleting backup:', error);
      return false;
    }
  }

  // Backup Schedule Management
  async createBackupSchedule(name: string, config: BackupConfig): Promise<BackupSchedule> {
    const schedule: BackupSchedule = {
      id: `schedule_${Date.now()}_${randomBytes(4).toString('hex')}`,
      name,
      config,
      nextRun: this.calculateNextRun(config.schedule),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.backupSchedules.set(schedule.id, schedule);
    await this.saveBackupSchedules();

    return schedule;
  }

  async updateBackupSchedule(scheduleId: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule | null> {
    const schedule = this.backupSchedules.get(scheduleId);
    if (!schedule) return null;

    const updatedSchedule = {
      ...schedule,
      ...updates,
      updatedAt: new Date()
    };

    if (updates.config?.schedule) {
      updatedSchedule.nextRun = this.calculateNextRun(updates.config.schedule);
    }

    this.backupSchedules.set(scheduleId, updatedSchedule);
    await this.saveBackupSchedules();

    return updatedSchedule;
  }

  async deleteBackupSchedule(scheduleId: string): Promise<boolean> {
    if (!this.backupSchedules.has(scheduleId)) return false;

    this.backupSchedules.delete(scheduleId);
    await this.saveBackupSchedules();

    return true;
  }

  async getBackupSchedules(): Promise<BackupSchedule[]> {
    return Array.from(this.backupSchedules.values());
  }

  // Monitoring
  async getActiveBackups(): Promise<BackupJob[]> {
    return Array.from(this.activeBackups.values());
  }

  async getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    schedules: {
      total: number;
      active: number;
    };
  }> {
    try {
      const backups = await this.listBackups();
      const schedules = await this.getBackupSchedules();

      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const oldestBackup = backups.length > 0 ? backups[backups.length - 1].date : undefined;
      const newestBackup = backups.length > 0 ? backups[0].date : undefined;

      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup,
        newestBackup,
        schedules: {
          total: schedules.length,
          active: schedules.filter(s => s.isActive).length
        }
      };

    } catch (error) {
      console.error('Error getting backup stats:', error);
      return {
        totalBackups: 0,
        totalSize: 0,
        schedules: { total: 0, active: 0 }
      };
    }
  }
}

export const backupService = new BackupService();
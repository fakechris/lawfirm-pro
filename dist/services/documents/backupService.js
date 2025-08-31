"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupService = exports.BackupService = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const stream_1 = require("stream");
const util_1 = require("util");
const config_1 = require("../config");
const storage_1 = require("../services/documents/storage");
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
class BackupService {
    constructor() {
        this.activeBackups = new Map();
        this.backupSchedules = new Map();
        this.basePath = config_1.config.storage.basePath;
        this.backupPath = path_1.default.join(this.basePath, 'backups');
        this.baseStorageService = new storage_1.DocumentStorageService();
        this.initialize();
    }
    async initialize() {
        try {
            await this.ensureDirectoryExists(this.backupPath);
            await this.loadBackupSchedules();
            this.startBackupScheduler();
        }
        catch (error) {
            console.error('Error initializing backup service:', error);
        }
    }
    async ensureDirectoryExists(dirPath) {
        try {
            await promises_1.default.access(dirPath);
        }
        catch {
            await promises_1.default.mkdir(dirPath, { recursive: true });
        }
    }
    async loadBackupSchedules() {
        try {
            const schedulesFile = path_1.default.join(this.backupPath, 'schedules.json');
            if (await this.baseStorageService.fileExists(schedulesFile)) {
                const data = await promises_1.default.readFile(schedulesFile, 'utf-8');
                const schedules = JSON.parse(data);
                schedules.forEach(schedule => {
                    this.backupSchedules.set(schedule.id, schedule);
                });
            }
        }
        catch (error) {
            console.warn('Could not load backup schedules:', error);
        }
    }
    async saveBackupSchedules() {
        try {
            const schedulesFile = path_1.default.join(this.backupPath, 'schedules.json');
            const schedules = Array.from(this.backupSchedules.values());
            await promises_1.default.writeFile(schedulesFile, JSON.stringify(schedules, null, 2));
        }
        catch (error) {
            console.error('Error saving backup schedules:', error);
        }
    }
    startBackupScheduler() {
        setInterval(() => {
            this.checkAndRunScheduledBackups();
        }, 60 * 1000);
    }
    async checkAndRunScheduledBackups() {
        const now = new Date();
        for (const schedule of this.backupSchedules.values()) {
            if (!schedule.isActive)
                continue;
            if (!schedule.nextRun || now >= schedule.nextRun) {
                try {
                    await this.runScheduledBackup(schedule);
                }
                catch (error) {
                    console.error(`Error running scheduled backup ${schedule.id}:`, error);
                }
            }
        }
    }
    async runScheduledBackup(schedule) {
        const backupJob = {
            id: `backup_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`,
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
        }
        catch (error) {
            backupJob.status = 'failed';
            backupJob.endTime = new Date();
            backupJob.error = error instanceof Error ? error.message : 'Unknown error';
        }
        this.activeBackups.delete(backupJob.id);
        await this.saveBackupSchedules();
    }
    calculateNextRun(cronExpression) {
        const now = new Date();
        const [minute, hour, day, month, weekday] = cronExpression.split(' ');
        const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return nextRun;
    }
    async performBackup(backupConfig, backupId) {
        const startTime = new Date();
        const actualBackupId = backupId || `backup_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
        const result = {
            success: false,
            backupId: actualBackupId,
            startTime,
            warnings: []
        };
        try {
            const backupDir = path_1.default.join(this.backupPath, actualBackupId);
            await this.ensureDirectoryExists(backupDir);
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
            await promises_1.default.writeFile(path_1.default.join(backupDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
            let totalSize = 0;
            let filesCount = 0;
            const backedUpFiles = [];
            const documentsBackupPath = path_1.default.join(backupDir, 'documents');
            await this.backupDirectory(path_1.default.join(this.basePath, config_1.config.storage.paths.documents.original), documentsBackupPath, backedUpFiles, (size) => { totalSize += size; filesCount++; });
            if (backupConfig.includeVersions) {
                const versionsBackupPath = path_1.default.join(backupDir, 'versions');
                await this.backupDirectory(path_1.default.join(this.basePath, config_1.config.storage.paths.documents.versions), versionsBackupPath, backedUpFiles, (size) => { totalSize += size; filesCount++; });
            }
            const templatesBackupPath = path_1.default.join(backupDir, 'templates');
            await this.backupDirectory(path_1.default.join(this.basePath, config_1.config.storage.paths.templates.active), templatesBackupPath, backedUpFiles, (size) => { totalSize += size; filesCount++; });
            const evidenceBackupPath = path_1.default.join(backupDir, 'evidence');
            await this.backupDirectory(path_1.default.join(this.basePath, config_1.config.storage.paths.evidence.original), evidenceBackupPath, backedUpFiles, (size) => { totalSize += size; filesCount++; });
            if (backupConfig.includeThumbnails) {
                const thumbnailsBackupPath = path_1.default.join(backupDir, 'thumbnails');
                await this.backupDirectory(path_1.default.join(this.basePath, config_1.config.storage.paths.evidence.thumbnails), thumbnailsBackupPath, backedUpFiles, (size) => { totalSize += size; filesCount++; });
            }
            const manifest = {
                files: backedUpFiles,
                totalSize,
                filesCount,
                backupTime: new Date().toISOString()
            };
            await promises_1.default.writeFile(path_1.default.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
            const checksum = await this.calculateBackupChecksum(backupDir);
            result.checksum = checksum;
            if (backupConfig.compression) {
                await this.compressBackup(backupDir);
            }
            if (backupConfig.encryption) {
                await this.encryptBackup(backupDir);
            }
            result.success = true;
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - result.startTime.getTime();
            result.size = totalSize;
            result.filesCount = filesCount;
            result.backupPath = backupDir;
            await this.cleanupOldBackups(backupConfig.retention);
            return result;
        }
        catch (error) {
            result.error = `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - result.startTime.getTime();
            try {
                const backupDir = path_1.default.join(this.backupPath, actualBackupId);
                if (await this.baseStorageService.fileExists(backupDir)) {
                    await promises_1.default.rm(backupDir, { recursive: true });
                }
            }
            catch (cleanupError) {
                console.error('Error cleaning up failed backup:', cleanupError);
            }
            return result;
        }
    }
    async backupDirectory(sourceDir, targetDir, backedUpFiles, onFileBackup) {
        try {
            await this.ensureDirectoryExists(targetDir);
            const files = await promises_1.default.readdir(sourceDir);
            for (const file of files) {
                const sourcePath = path_1.default.join(sourceDir, file);
                const targetPath = path_1.default.join(targetDir, file);
                const stats = await promises_1.default.stat(sourcePath);
                if (stats.isDirectory()) {
                    await this.backupDirectory(sourcePath, targetPath, backedUpFiles, onFileBackup);
                }
                else {
                    await promises_1.default.copyFile(sourcePath, targetPath);
                    backedUpFiles.push(sourcePath);
                    onFileBackup(stats.size);
                }
            }
        }
        catch (error) {
            console.warn(`Could not backup directory ${sourceDir}:`, error);
        }
    }
    async calculateBackupChecksum(backupDir) {
        const hash = (0, crypto_1.createHash)('sha256');
        const manifestPath = path_1.default.join(backupDir, 'manifest.json');
        if (await this.baseStorageService.fileExists(manifestPath)) {
            const manifestData = await promises_1.default.readFile(manifestPath);
            hash.update(manifestData);
        }
        return hash.digest('hex');
    }
    async compressBackup(backupDir) {
        console.log(`Compression would be applied to backup: ${backupDir}`);
    }
    async encryptBackup(backupDir) {
        console.log(`Encryption would be applied to backup: ${backupDir}`);
    }
    async cleanupOldBackups(retentionDays) {
        try {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const backups = await promises_1.default.readdir(this.backupPath);
            for (const backup of backups) {
                const backupPath = path_1.default.join(this.backupPath, backup);
                const stats = await promises_1.default.stat(backupPath);
                if (stats.isDirectory() && stats.birthtime < cutoffDate) {
                    await promises_1.default.rm(backupPath, { recursive: true });
                    console.log(`Cleaned up old backup: ${backup}`);
                }
            }
        }
        catch (error) {
            console.error('Error cleaning up old backups:', error);
        }
    }
    async restoreFromBackup(backupId, options) {
        const startTime = new Date();
        const restoreId = `restore_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`;
        const result = {
            success: false,
            restoreId,
            startTime,
            filesRestored: 0,
            errors: [],
            warnings: [],
            integrityVerified: false
        };
        try {
            const backupDir = path_1.default.join(this.backupPath, backupId);
            if (!await this.baseStorageService.fileExists(backupDir)) {
                result.errors.push(`Backup not found: ${backupId}`);
                return result;
            }
            const metadataPath = path_1.default.join(backupDir, 'metadata.json');
            const manifestPath = path_1.default.join(backupDir, 'manifest.json');
            if (!await this.baseStorageService.fileExists(metadataPath)) {
                result.errors.push('Backup metadata not found');
                return result;
            }
            const metadata = JSON.parse(await promises_1.default.readFile(metadataPath, 'utf-8'));
            const manifest = JSON.parse(await promises_1.default.readFile(manifestPath, 'utf-8'));
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
            for (const filePath of manifest.files) {
                try {
                    const relativePath = path_1.default.relative(backupDir, filePath);
                    const targetPath = path_1.default.join(this.basePath, relativePath);
                    await this.ensureDirectoryExists(path_1.default.dirname(targetPath));
                    if (options?.overwrite !== false || !await this.baseStorageService.fileExists(targetPath)) {
                        await promises_1.default.copyFile(filePath, targetPath);
                        result.filesRestored++;
                    }
                    else {
                        result.warnings.push(`File already exists and overwrite is false: ${relativePath}`);
                    }
                }
                catch (error) {
                    result.errors.push(`Failed to restore ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            result.success = result.errors.length === 0;
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - startTime.getTime();
            return result;
        }
        catch (error) {
            result.errors.push(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - startTime.getTime();
            return result;
        }
    }
    async listBackups() {
        try {
            const backups = await promises_1.default.readdir(this.backupPath);
            const backupList = [];
            for (const backup of backups) {
                const backupPath = path_1.default.join(this.backupPath, backup);
                const stats = await promises_1.default.stat(backupPath);
                if (stats.isDirectory()) {
                    try {
                        const metadataPath = path_1.default.join(backupPath, 'metadata.json');
                        const manifestPath = path_1.default.join(backupPath, 'manifest.json');
                        if (await this.baseStorageService.fileExists(metadataPath) &&
                            await this.baseStorageService.fileExists(manifestPath)) {
                            const metadata = JSON.parse(await promises_1.default.readFile(metadataPath, 'utf-8'));
                            const manifest = JSON.parse(await promises_1.default.readFile(manifestPath, 'utf-8'));
                            backupList.push({
                                id: backup,
                                date: stats.birthtime,
                                size: manifest.totalSize || 0,
                                filesCount: manifest.filesCount || 0,
                                config: metadata.config
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`Could not read backup metadata for ${backup}:`, error);
                    }
                }
            }
            return backupList.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        catch (error) {
            console.error('Error listing backups:', error);
            return [];
        }
    }
    async getBackupInfo(backupId) {
        try {
            const backupDir = path_1.default.join(this.backupPath, backupId);
            if (!await this.baseStorageService.fileExists(backupDir)) {
                return { exists: false };
            }
            const metadataPath = path_1.default.join(backupDir, 'metadata.json');
            const manifestPath = path_1.default.join(backupDir, 'manifest.json');
            if (!await this.baseStorageService.fileExists(metadataPath) ||
                !await this.baseStorageService.fileExists(manifestPath)) {
                return { exists: true, metadata: null, manifest: null };
            }
            const metadata = JSON.parse(await promises_1.default.readFile(metadataPath, 'utf-8'));
            const manifest = JSON.parse(await promises_1.default.readFile(manifestPath, 'utf-8'));
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
        }
        catch (error) {
            console.error('Error getting backup info:', error);
            return { exists: false };
        }
    }
    async deleteBackup(backupId) {
        try {
            const backupDir = path_1.default.join(this.backupPath, backupId);
            if (!await this.baseStorageService.fileExists(backupDir)) {
                return false;
            }
            await promises_1.default.rm(backupDir, { recursive: true });
            return true;
        }
        catch (error) {
            console.error('Error deleting backup:', error);
            return false;
        }
    }
    async createBackupSchedule(name, config) {
        const schedule = {
            id: `schedule_${Date.now()}_${(0, crypto_1.randomBytes)(4).toString('hex')}`,
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
    async updateBackupSchedule(scheduleId, updates) {
        const schedule = this.backupSchedules.get(scheduleId);
        if (!schedule)
            return null;
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
    async deleteBackupSchedule(scheduleId) {
        if (!this.backupSchedules.has(scheduleId))
            return false;
        this.backupSchedules.delete(scheduleId);
        await this.saveBackupSchedules();
        return true;
    }
    async getBackupSchedules() {
        return Array.from(this.backupSchedules.values());
    }
    async getActiveBackups() {
        return Array.from(this.activeBackups.values());
    }
    async getBackupStats() {
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
        }
        catch (error) {
            console.error('Error getting backup stats:', error);
            return {
                totalBackups: 0,
                totalSize: 0,
                schedules: { total: 0, active: 0 }
            };
        }
    }
}
exports.BackupService = BackupService;
exports.backupService = new BackupService();
//# sourceMappingURL=backupService.js.map
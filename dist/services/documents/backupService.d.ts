export interface BackupConfig {
    enabled: boolean;
    schedule: string;
    compression: boolean;
    encryption: boolean;
    includeVersions: boolean;
    includeThumbnails: boolean;
    retention: number;
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
export declare class BackupService {
    private basePath;
    private backupPath;
    private baseStorageService;
    private activeBackups;
    private backupSchedules;
    constructor();
    private initialize;
    private ensureDirectoryExists;
    private loadBackupSchedules;
    private saveBackupSchedules;
    private startBackupScheduler;
    private checkAndRunScheduledBackups;
    private runScheduledBackup;
    private calculateNextRun;
    performBackup(backupConfig: BackupConfig, backupId?: string): Promise<BackupResult>;
    private backupDirectory;
    private calculateBackupChecksum;
    private compressBackup;
    private encryptBackup;
    private cleanupOldBackups;
    restoreFromBackup(backupId: string, options?: {
        overwrite?: boolean;
        validateIntegrity?: boolean;
        dryRun?: boolean;
    }): Promise<RestoreResult>;
    listBackups(): Promise<Array<{
        id: string;
        date: Date;
        size: number;
        filesCount: number;
        config: BackupConfig;
    }>>;
    getBackupInfo(backupId: string): Promise<{
        exists: boolean;
        metadata?: any;
        manifest?: any;
        integrity?: {
            isValid: boolean;
            checksum?: string;
            issues: string[];
        };
    }>;
    deleteBackup(backupId: string): Promise<boolean>;
    createBackupSchedule(name: string, config: BackupConfig): Promise<BackupSchedule>;
    updateBackupSchedule(scheduleId: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule | null>;
    deleteBackupSchedule(scheduleId: string): Promise<boolean>;
    getBackupSchedules(): Promise<BackupSchedule[]>;
    getActiveBackups(): Promise<BackupJob[]>;
    getBackupStats(): Promise<{
        totalBackups: number;
        totalSize: number;
        oldestBackup?: Date;
        newestBackup?: Date;
        schedules: {
            total: number;
            active: number;
        };
    }>;
}
export declare const backupService: BackupService;
//# sourceMappingURL=backupService.d.ts.map
export interface Configuration {
    id: string;
    service: string;
    version: number;
    data: Record<string, any>;
    encrypted: boolean;
    checksum: string;
    createdBy: string;
    createdAt: Date;
    updatedBy?: string;
    updatedAt?: Date;
    metadata?: Record<string, any>;
}
export interface ConfigUpdateRequest {
    service: string;
    data: Record<string, any>;
    updatedBy: string;
    reason?: string;
    encrypt?: boolean;
}
export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface ConfigAuditLog {
    id: string;
    configId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROTATE' | 'VIEW';
    userId: string;
    timestamp: Date;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}
export interface CredentialRotationPolicy {
    service: string;
    rotationInterval: number;
    warningDays: number;
    autoRotate: boolean;
    notifyBeforeRotation: boolean;
    notificationChannels: string[];
}
export interface ConfigBackup {
    id: string;
    configId: string;
    service: string;
    data: Record<string, any>;
    createdAt: Date;
    createdBy: string;
    checksum: string;
}
export declare class ConfigurationManager {
    private logger;
    private configurations;
    private auditLogs;
    private backups;
    private rotationPolicies;
    private encryptionKey;
    private sensitiveFields;
    constructor();
    createConfiguration(service: string, data: Record<string, any>, createdBy: string, options?: {
        encrypt?: boolean;
        metadata?: Record<string, any>;
    }): Promise<Configuration>;
    updateConfiguration(service: string, update: ConfigUpdateRequest): Promise<Configuration>;
    getConfiguration(service: string, userId?: string): Promise<Configuration | null>;
    getAllConfigurations(userId?: string): Promise<Configuration[]>;
    deleteConfiguration(service: string, deletedBy: string): Promise<void>;
    rotateCredentials(service: string, rotatedBy: string): Promise<Configuration>;
    validateConfiguration(service: string, data: Record<string, any>): Promise<ConfigValidationResult>;
    getAuditLogs(configId?: string, service?: string, action?: ConfigAuditLog['action'], limit?: number): Promise<ConfigAuditLog[]>;
    getBackups(service: string, limit?: number): Promise<ConfigBackup[]>;
    restoreBackup(service: string, backupId: string, restoredBy: string): Promise<Configuration>;
    setRotationPolicy(policy: CredentialRotationPolicy): Promise<void>;
    getRotationPolicies(): Promise<CredentialRotationPolicy[]>;
    getCredentialRotationStatus(): Promise<Array<{
        service: string;
        daysUntilRotation: number;
        status: 'OK' | 'WARNING' | 'OVERDUE';
        lastRotation?: Date;
    }>>;
    private validateStripeConfig;
    private validatePacerConfig;
    private validateTwilioConfig;
    private validateSendGridConfig;
    private validateGenericConfig;
    private encryptData;
    private decryptData;
    private encryptValue;
    private decryptValue;
    private calculateChecksum;
    private generateNewCredentials;
    private generateSecureToken;
    private createBackup;
    private logAuditEvent;
    private initializeDefaultConfigs;
    private startPeriodicTasks;
    private checkCredentialRotation;
    private cleanupOldAuditLogs;
    private cleanupOldBackups;
    private generateConfigId;
    private generateBackupId;
    private generateAuditId;
}
//# sourceMappingURL=ConfigurationManager.d.ts.map
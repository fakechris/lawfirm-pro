import { Document, DocumentVersion, DocumentTemplate, EvidenceItem } from '@prisma/client';
import { FileStorageResult } from '../services/documents/storage';
import { BackupConfig, BackupResult } from '../services/documents/backupService';
import { OptimizationOptions, OptimizationResult } from '../services/documents/optimizationService';
export interface DocumentManagementConfig {
    storage: {
        basePath: string;
        maxFileSize: number;
        allowedMimeTypes: string[];
        allowedExtensions: string[];
    };
    versioning: {
        enabled: boolean;
        maxVersions: number;
        autoCleanup: boolean;
        retentionDays: number;
    };
    backup: {
        enabled: boolean;
        schedule: string;
        compression: boolean;
        encryption: boolean;
        retentionDays: number;
    };
    optimization: {
        enabled: boolean;
        schedule: string;
        cleanupTempFiles: boolean;
        cleanupOldVersions: boolean;
        cleanupDuplicates: boolean;
        compressLargeFiles: boolean;
    };
    security: {
        encryptionEnabled: boolean;
        virusScanEnabled: boolean;
        checksumValidation: boolean;
    };
}
export interface DocumentUploadRequest {
    file: Buffer;
    filename: string;
    mimeType: string;
    caseId?: string;
    clientId?: string;
    category?: string;
    description?: string;
    tags?: string[];
    isConfidential?: boolean;
    uploadedBy: string;
    generateThumbnail?: boolean;
    validateChecksum?: boolean;
}
export interface DocumentCreateResult {
    success: boolean;
    document?: Document;
    error?: string;
    warnings?: string[];
    storageResult?: FileStorageResult;
}
export interface DocumentVersionRequest {
    documentId: string;
    file: Buffer;
    filename: string;
    mimeType: string;
    changeDescription?: string;
    createdBy: string;
    generateChecksum?: boolean;
}
export interface TemplateCreateRequest {
    name: string;
    description?: string;
    category?: string;
    file: Buffer;
    filename: string;
    mimeType: string;
    variables?: Array<{
        name: string;
        type: string;
        description?: string;
        defaultValue?: string;
        required: boolean;
    }>;
    isPublic?: boolean;
    createdBy: string;
}
export interface EvidenceCreateRequest {
    title: string;
    description?: string;
    type: string;
    caseId: string;
    file: Buffer;
    filename: string;
    mimeType: string;
    collectedBy: string;
    location?: string;
    tags?: string[];
    generateChecksum?: boolean;
}
export interface DocumentSearchRequest {
    query?: string;
    caseId?: string;
    clientId?: string;
    category?: string;
    tags?: string[];
    uploadedBy?: string;
    dateFrom?: Date;
    dateTo?: Date;
    isConfidential?: boolean;
    limit?: number;
    offset?: number;
}
export interface DocumentListResult {
    data: Document[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    filters: Record<string, unknown>;
}
export declare class DocumentManagementService {
    private prisma;
    private storageService;
    private versionService;
    private evidenceService;
    private backupService;
    private optimizationService;
    private config;
    constructor(config?: Partial<DocumentManagementConfig>);
    private initializeServices;
    private setupBackupSchedule;
    private setupOptimizationSchedule;
    uploadDocument(request: DocumentUploadRequest): Promise<DocumentCreateResult>;
    getDocument(id: string): Promise<Document | null>;
    searchDocuments(request: DocumentSearchRequest): Promise<DocumentListResult>;
    updateDocument(id: string, updates: Partial<Document>): Promise<Document | null>;
    deleteDocument(id: string, permanent?: boolean): Promise<boolean>;
    createDocumentVersion(request: DocumentVersionRequest): Promise<DocumentVersion | null>;
    private cleanupOldVersions;
    createTemplate(request: TemplateCreateRequest): Promise<DocumentTemplate | null>;
    createEvidence(request: EvidenceCreateRequest): Promise<EvidenceItem | null>;
    performBackup(config?: Partial<BackupConfig>): Promise<BackupResult>;
    restoreFromBackup(backupId: string, options?: {
        overwrite?: boolean;
        validateIntegrity?: boolean;
        dryRun?: boolean;
    }): Promise<any>;
    performOptimization(options?: OptimizationOptions): Promise<OptimizationResult>;
    getStorageMetrics(): Promise<any>;
    getBackupInfo(backupId: string): Promise<any>;
    verifyEvidenceIntegrity(evidenceId: string): Promise<any>;
    dispose(): Promise<void>;
}
export declare const documentManagementService: DocumentManagementService;
//# sourceMappingURL=documentManagementService.d.ts.map
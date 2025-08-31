export interface VersionedFileUploadOptions {
    filename: string;
    mimeType: string;
    category: 'documents' | 'versions' | 'templates' | 'evidence' | 'thumbnails' | 'temp';
    subcategory?: 'original' | 'processed' | 'active' | 'archive' | 'uploads';
    versionNumber?: number;
    changeDescription?: string;
    generateChecksum?: boolean;
    generateThumbnail?: boolean;
    encrypt?: boolean;
    compress?: boolean;
    overwrite?: boolean;
    metadata?: Record<string, unknown>;
    userId?: string;
}
export interface VersionedFileStorageResult {
    success: boolean;
    filePath: string;
    filename: string;
    size: number;
    mimeType: string;
    versionNumber: number;
    checksum?: string;
    thumbnailPath?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    warnings?: string[];
    processingTime?: number;
}
export interface VersionComparisonResult {
    hasChanges: boolean;
    changes: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    similarity: number;
}
export declare class VersionControlStorageService {
    private basePath;
    private maxFileSize;
    private allowedMimeTypes;
    private maxVersions;
    private baseStorageService;
    constructor();
    private ensureDirectoryExists;
    private generateVersionFilename;
    private getStoragePath;
    private calculateFileHash;
    private getFileChecksum;
    private compareFiles;
    private calculateSimilarity;
    private createDeltaPatch;
    private applyDeltaPatch;
    uploadVersion(fileBuffer: Buffer, originalName: string, options: VersionedFileUploadOptions): Promise<VersionedFileStorageResult>;
    createVersionFromPrevious(previousVersionPath: string, newFileBuffer: Buffer, originalName: string, options: VersionedFileUploadOptions): Promise<VersionedFileStorageResult>;
    listVersions(documentId: string): Promise<Array<{
        versionNumber: number;
        filePath: string;
        size: number;
        checksum: string;
        createdAt: Date;
        changeDescription?: string;
    }>>;
    getVersion(documentId: string, versionNumber: number): Promise<VersionedFileStorageResult>;
    getLatestVersion(documentId: string): Promise<VersionedFileStorageResult>;
    compareVersions(documentId: string, version1: number, version2: number): Promise<VersionComparisonResult>;
    deleteVersion(documentId: string, versionNumber: number): Promise<boolean>;
    cleanupOldVersions(documentId: string, keepCount?: number): Promise<{
        success: boolean;
        deletedVersions: number;
        freedSpace: number;
    }>;
    createVersionSummary(documentId: string): Promise<{
        totalVersions: number;
        totalSize: number;
        latestVersion: number;
        oldestVersion: number;
        averageSize: number;
        growthTrend: 'increasing' | 'decreasing' | 'stable';
    }>;
    rollbackToVersion(documentId: string, targetVersion: number): Promise<VersionedFileStorageResult>;
}
export declare const versionControlStorageService: VersionControlStorageService;
//# sourceMappingURL=versionStorage.d.ts.map
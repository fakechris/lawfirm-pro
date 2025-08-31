export interface FileUploadOptions {
    filename: string;
    mimeType: string;
    category: 'documents' | 'versions' | 'templates' | 'evidence' | 'thumbnails' | 'temp';
    subcategory?: 'original' | 'processed' | 'active' | 'archive' | 'uploads';
    generateChecksum?: boolean;
    generateThumbnail?: boolean;
    encrypt?: boolean;
    compress?: boolean;
    overwrite?: boolean;
    metadata?: Record<string, unknown>;
    userId?: string;
}
export interface FileValidationOptions {
    validateMimeType?: boolean;
    validateSize?: boolean;
    validateExtension?: boolean;
    virusScan?: boolean;
    checkDuplicates?: boolean;
}
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
    virusScan?: {
        isClean: boolean;
        threats?: string[];
    };
    duplicates?: {
        exists: boolean;
        existingFiles?: string[];
    };
}
export interface FileStorageResult {
    success: boolean;
    filePath: string;
    filename: string;
    size: number;
    mimeType: string;
    checksum?: string;
    thumbnailPath?: string;
    metadata?: Record<string, unknown>;
    error?: string;
    warnings?: string[];
    processingTime?: number;
}
export interface FileRetrievalOptions {
    decrypt?: boolean;
    decompress?: boolean;
    validateChecksum?: boolean;
    includeMetadata?: boolean;
}
export interface FileRetrievalResult {
    success: boolean;
    buffer?: Buffer;
    stream?: NodeJS.ReadableStream;
    filePath?: string;
    size?: number;
    mimeType?: string;
    checksum?: string;
    metadata?: Record<string, unknown>;
    error?: string;
}
export interface StorageUsageInfo {
    totalUsed: number;
    totalAvailable: number;
    usedPercentage: number;
    byCategory: Record<string, {
        used: number;
        fileCount: number;
        averageSize: number;
    }>;
    largestFiles: Array<{
        filePath: string;
        size: number;
        mimeType: string;
        lastModified: Date;
    }>;
}
export interface CleanupOptions {
    tempFilesOlderThan?: number;
    versionsOlderThan?: number;
    duplicates?: boolean;
    corrupted?: boolean;
    dryRun?: boolean;
    includeThumbnails?: boolean;
}
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
        thumbnails: number;
    };
}
export declare class DocumentStorageService {
    private basePath;
    private maxFileSize;
    private allowedMimeTypes;
    private allowedExtensions;
    constructor();
    private ensureDirectoryExists;
    private generateUniqueFilename;
    private generateSecureFilename;
    private getStoragePath;
    private calculateFileHash;
    private getFileChecksum;
    private detectMimeType;
    private validateFile;
    private findFilesByChecksum;
    private generateThumbnail;
    uploadFile(fileBuffer: Buffer, originalName: string, options: FileUploadOptions): Promise<FileStorageResult>;
    downloadFile(filePath: string, options?: FileRetrievalOptions): Promise<FileRetrievalResult>;
    getFileStream(filePath: string, options?: FileRetrievalOptions): Promise<FileRetrievalResult>;
    deleteFile(filePath: string, deleteThumbnails?: boolean): Promise<boolean>;
    moveFile(sourcePath: string, destinationPath: string): Promise<boolean>;
    copyFile(sourcePath: string, destinationPath: string): Promise<boolean>;
    fileExists(filePath: string): Promise<boolean>;
    getFileSize(filePath: string): Promise<number>;
    getStorageUsage(): Promise<StorageUsageInfo>;
    private scanDirectory;
    cleanup(options?: CleanupOptions): Promise<CleanupResult>;
    createDirectoryStructure(): Promise<void>;
    validateStorageHealth(): Promise<{
        healthy: boolean;
        issues: string[];
        usage: StorageUsageInfo;
    }>;
}
export declare const documentStorageService: DocumentStorageService;
//# sourceMappingURL=storage.d.ts.map
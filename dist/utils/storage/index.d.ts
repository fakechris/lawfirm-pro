export interface StorageOptions {
    category: 'documents' | 'templates' | 'evidence' | 'temp';
    subcategory?: 'original' | 'versions' | 'processed' | 'active' | 'archive' | 'thumbnails' | 'uploads';
    filename?: string;
    mimeType?: string;
}
export declare class StorageService {
    private basePath;
    constructor();
    ensureDirectoryExists(dirPath: string): Promise<void>;
    generateUniqueFilename(originalName: string): string;
    getStoragePath(options: StorageOptions): string;
    saveFile(fileBuffer: Buffer, originalName: string, options: StorageOptions): Promise<{
        filePath: string;
        filename: string;
        size: number;
    }>;
    getFile(filePath: string): Promise<Buffer>;
    deleteFile(filePath: string): Promise<void>;
    fileExists(filePath: string): Promise<boolean>;
    getFileSize(filePath: string): Promise<number>;
    copyFile(sourcePath: string, destinationPath: string): Promise<void>;
    moveFile(sourcePath: string, destinationPath: string): Promise<void>;
    calculateChecksum(buffer: Buffer): string;
    cleanupTempFiles(maxAge?: number): Promise<void>;
    validateMimeType(mimeType: string): boolean;
    validateFileSize(size: number): boolean;
    createDirectoryStructure(): Promise<void>;
}
export declare const storageService: StorageService;
//# sourceMappingURL=index.d.ts.map
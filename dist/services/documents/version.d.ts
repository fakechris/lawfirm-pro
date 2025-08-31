import { PrismaClient } from '@prisma/client';
import { DocumentVersionWithDetails, VersionComparisonResult, VersionHistoryOptions, DocumentProcessingResult } from '../../models/documents';
export interface VersionControlOptions {
    autoSave?: boolean;
    maxVersions?: number;
    compressionEnabled?: boolean;
    deltaEncoding?: boolean;
    changeTracking?: boolean;
    approvalRequired?: boolean;
}
export interface VersionCreateOptions {
    documentId: string;
    fileBuffer: Buffer;
    originalName: string;
    mimeType: string;
    changeDescription?: string;
    createdBy: string;
    isMajor?: boolean;
    tags?: string[];
    metadata?: Record<string, unknown>;
}
export interface VersionUpdateOptions {
    versionId: string;
    changeDescription?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    updatedBy: string;
}
export interface VersionRestoreOptions {
    documentId: string;
    versionNumber: number;
    restoreAsNew?: boolean;
    changeDescription?: string;
    restoredBy: string;
}
export interface VersionComparisonOptions {
    showLineNumbers?: boolean;
    showContext?: number;
    ignoreWhitespace?: boolean;
    ignoreCase?: boolean;
    ignoreComments?: boolean;
}
export declare class DocumentVersionService {
    private prisma;
    private options;
    constructor(prisma: PrismaClient, options?: VersionControlOptions);
    createVersion(options: VersionCreateOptions): Promise<DocumentProcessingResult>;
    getVersion(documentId: string, versionNumber: number): Promise<DocumentVersionWithDetails | null>;
    getVersions(documentId: string, options?: VersionHistoryOptions): Promise<DocumentVersionWithDetails[]>;
    getLatestVersion(documentId: string): Promise<DocumentVersionWithDetails | null>;
    restoreVersion(options: VersionRestoreOptions): Promise<DocumentProcessingResult>;
    compareVersions(documentId: string, version1Number: number, version2Number: number, options?: VersionComparisonOptions): Promise<VersionComparisonResult>;
    private compareTextFiles;
    private compareBinaryFiles;
    private calculateSimilarity;
    private calculateEditDistance;
    private generateComparisonSummary;
    getVersionHistory(documentId: string, options?: VersionHistoryOptions): Promise<{
        versions: DocumentVersionWithDetails[];
        statistics: {
            totalVersions: number;
            totalSize: number;
            averageSize: number;
            firstVersion: Date;
            lastVersion: Date;
            contributors: Array<{
                userId: string;
                name: string;
                versionCount: number;
            }>;
        };
    }>;
    private cleanupOldVersions;
    deleteVersion(documentId: string, versionNumber: number): Promise<boolean>;
    getVersionStats(documentId: string): Promise<{
        totalVersions: number;
        totalSize: number;
        latestVersion: number;
        lastModified: Date;
        contributors: number;
    }>;
}
export declare const documentVersionService: DocumentVersionService;
//# sourceMappingURL=version.d.ts.map
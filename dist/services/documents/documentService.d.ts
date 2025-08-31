import { PrismaClient } from '@prisma/client';
import { DocumentUpdateInput, DocumentWithDetails, DocumentProcessingResult } from '../types';
export declare class DocumentService {
    private documentRepository;
    private prisma;
    constructor(prisma: PrismaClient);
    uploadDocument(fileBuffer: Buffer, originalName: string, mimeType: string, options: {
        caseId?: string;
        isConfidential?: boolean;
        isTemplate?: boolean;
        category?: string;
        description?: string;
        tags?: string[];
        metadata?: Record<string, unknown>;
        uploadedBy: string;
    }): Promise<DocumentProcessingResult>;
    getDocument(id: string): Promise<DocumentWithDetails | null>;
    getDocuments(params: {
        caseId?: string;
        category?: string;
        status?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
    }): Promise<DocumentWithDetails[]>;
    updateDocument(id: string, data: DocumentUpdateInput): Promise<DocumentWithDetails>;
    deleteDocument(id: string): Promise<void>;
    createVersion(documentId: string, fileBuffer: Buffer, originalName: string, mimeType: string, changeDescription?: string): Promise<DocumentProcessingResult>;
    getDocumentVersions(documentId: string): Promise<any>;
    getDocumentVersion(documentId: string, versionNumber: number): Promise<any>;
    downloadDocument(id: string, versionNumber?: number): Promise<{
        buffer: Buffer;
        filename: string;
        mimeType: string;
    } | null>;
    searchDocuments(query: string, options?: {
        caseId?: string;
        category?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
    }): Promise<DocumentWithDetails[]>;
    getDocumentsByCase(caseId: string): Promise<DocumentWithDetails[]>;
    getDocumentsByUser(userId: string): Promise<DocumentWithDetails[]>;
    getDocumentStats(): Promise<any>;
    getStorageUsage(): Promise<{
        totalUsed: number;
        totalAvailable: number;
        byCategory: {
            documents: {
                used: number;
                fileCount: number;
            };
            templates: {
                used: number;
                fileCount: number;
            };
            evidence: {
                used: number;
                fileCount: number;
            };
            temp: {
                used: number;
                fileCount: number;
            };
        };
    }>;
    reprocessOCR(documentId: string): Promise<{
        success: boolean;
        extractedText?: string;
        confidence?: number;
        error?: string;
    }>;
    searchByOCRText(query: string, options?: {
        caseId?: string;
        category?: string;
        limit?: number;
        offset?: number;
    }): Promise<DocumentWithDetails[]>;
    getOCRStats(): Promise<{
        totalDocuments: number;
        documentsWithOCR: number;
        averageConfidence: number;
        byLanguage: Record<string, number>;
        processingTimes: {
            min: number;
            max: number;
            average: number;
        };
    }>;
    validateOCRQuality(documentId: string): Promise<{
        isValid: boolean;
        issues: string[];
        suggestions: string[];
    }>;
}
//# sourceMappingURL=documentService.d.ts.map
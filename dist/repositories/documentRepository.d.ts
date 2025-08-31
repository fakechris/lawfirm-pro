import { PrismaClient } from '@prisma/client';
import { Document, DocumentVersion, DocumentWithDetails, DocumentUploadInput, DocumentUpdateInput, DocumentVersionInput } from '../../types';
export declare class DocumentRepository {
    private prisma;
    constructor(prisma: PrismaClient);
    create(data: DocumentUploadInput & {
        path: string;
        checksum: string;
        uploadedBy: string;
    }): Promise<Document>;
    findById(id: string): Promise<Document | null>;
    findMany(params: {
        caseId?: string;
        category?: string;
        status?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
    }): Promise<DocumentWithDetails[]>;
    update(id: string, data: DocumentUpdateInput): Promise<Document>;
    delete(id: string): Promise<Document>;
    createVersion(data: DocumentVersionInput): Promise<DocumentVersion>;
    getVersions(documentId: string): Promise<DocumentVersion[]>;
    getVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null>;
    findByChecksum(checksum: string): Promise<Document | null>;
    getStats(): Promise<{
        totalDocuments: number;
        totalSize: number;
        byCategory: Record<string, number>;
        byStatus: Record<string, number>;
        recentUploads: number;
    }>;
    search(params: {
        query: string;
        caseId?: string;
        category?: string;
        tags?: string[];
        limit?: number;
        offset?: number;
    }): Promise<DocumentWithDetails[]>;
    getDocumentsByCase(caseId: string): Promise<DocumentWithDetails[]>;
    getDocumentsByUser(userId: string): Promise<DocumentWithDetails[]>;
}
//# sourceMappingURL=documentRepository.d.ts.map
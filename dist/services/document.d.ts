import { Database } from '../utils/database';
import { WebSocketService } from './websocket';
import { DocumentResponse } from '../types';
export declare class DocumentService {
    private db;
    private wsService;
    constructor(db: Database, wsService: WebSocketService);
    uploadDocument(file: Express.Multer.File, caseId: string, uploadedBy: string, isConfidential?: boolean): Promise<DocumentResponse>;
    getDocumentsByCaseId(caseId: string, userId: string): Promise<DocumentResponse[]>;
    getDocumentById(documentId: string, userId: string): Promise<DocumentResponse>;
    downloadDocument(documentId: string, userId: string): Promise<{
        filePath: string;
        filename: string;
        mimeType: string;
    }>;
    updateDocument(documentId: string, updates: {
        isConfidential?: boolean;
    }, userId: string): Promise<DocumentResponse>;
    deleteDocument(documentId: string, userId: string): Promise<void>;
    grantDocumentAccess(documentId: string, userId: string, grantedBy: string): Promise<void>;
    revokeDocumentAccess(documentId: string, userId: string, revokedBy: string): Promise<void>;
    getDocumentAccess(documentId: string, userId: string): Promise<any[]>;
    searchDocuments(userId: string, query: string, caseId?: string): Promise<DocumentResponse[]>;
    getDocumentStats(userId: string): Promise<{
        total: number;
        totalSize: number;
        byType: Record<string, number>;
        recentUploads: DocumentResponse[];
    }>;
    private validateFile;
    private generateUniqueFilename;
    private verifyCaseAccess;
    private transformDocumentResponse;
}
//# sourceMappingURL=document.d.ts.map
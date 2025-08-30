import { PrismaClient } from '@prisma/client';
import { DocumentSearchOptions, SearchResult } from '../types';
export interface DocumentSearchIndex {
    id: string;
    documentId: string;
    content: string;
    metadata: {
        title: string;
        category?: string;
        mimeType: string;
        tags: string[];
        uploadedAt: Date;
        uploadedBy: string;
        caseId?: string;
    };
    vector?: number[];
    relevanceScore?: number;
}
export declare class DocumentSearchService {
    private prisma;
    private indexCache;
    constructor(prisma: PrismaClient);
    indexDocument(documentId: string): Promise<void>;
    searchDocuments(query: string, options?: DocumentSearchOptions): Promise<SearchResult[]>;
    searchByVector(queryVector: number[], limit?: number): Promise<SearchResult[]>;
    bulkIndexDocuments(documentIds: string[]): Promise<void>;
    reindexAllDocuments(): Promise<void>;
    removeFromIndex(documentId: string): Promise<void>;
    getSearchStats(): Promise<{
        totalIndexed: number;
        averageContentLength: number;
        lastIndexed: Date | null;
        byCategory: Record<string, number>;
    }>;
    private prepareSearchableContent;
    private generateVectorEmbedding;
    private simpleHash;
    private generateExcerpt;
    private calculateRelevanceScore;
}
export declare const documentSearchService: DocumentSearchService;
//# sourceMappingURL=searchService.d.ts.map
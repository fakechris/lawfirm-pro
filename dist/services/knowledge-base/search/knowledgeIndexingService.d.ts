import { KnowledgeIndexingOptions } from './knowledgeSearchEngine';
export interface IndexingJob {
    id: string;
    type: 'knowledge_article' | 'document' | 'template' | 'batch';
    entityId?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    options?: KnowledgeIndexingOptions;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
}
export interface IndexingStats {
    totalDocuments: number;
    indexedDocuments: number;
    failedDocuments: number;
    averageProcessingTime: number;
    lastIndexingTime: Date;
    indexingQueueSize: number;
}
export declare class KnowledgeIndexingService {
    private indexingQueue;
    private isProcessing;
    private processingInterval?;
    constructor();
    indexKnowledgeArticle(articleId: string, options?: KnowledgeIndexingOptions): Promise<void>;
    indexDocument(documentId: string, options?: KnowledgeIndexingOptions): Promise<void>;
    addToIndexingQueue(type: IndexingJob['type'], entityId?: string, priority?: IndexingJob['priority'], options?: KnowledgeIndexingOptions): Promise<string>;
    processBatchIndexing(documentIds: string[], options?: KnowledgeIndexingOptions): Promise<{
        success: string[];
        failed: {
            id: string;
            error: string;
        }[];
    }>;
    reindexAllKnowledgeContent(): Promise<void>;
    removeFromIndex(entityId: string): Promise<void>;
    getIndexingStats(): Promise<IndexingStats>;
    getIndexingQueue(): Promise<IndexingJob[]>;
    cancelIndexingJob(jobId: string): Promise<boolean>;
    private startProcessing;
    private processNextJob;
    private processBatchJob;
    private sortQueueByPriority;
    stopProcessing(): void;
}
export declare const knowledgeIndexingService: KnowledgeIndexingService;
//# sourceMappingURL=knowledgeIndexingService.d.ts.map
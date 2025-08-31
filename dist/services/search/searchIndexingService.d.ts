export interface SearchDocument {
    id: string;
    entityId: string;
    entityType: 'document' | 'template' | 'evidence' | 'case' | 'user';
    title: string;
    content: string;
    metadata: Record<string, any>;
    tags: string[];
    language: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SearchQuery {
    query: string;
    filters?: SearchFilters;
    sortBy?: SearchSort;
    pagination?: SearchPagination;
}
export interface SearchFilters {
    entityType?: string[];
    tags?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    createdBy?: string[];
    mimeType?: string[];
    sizeRange?: {
        min: number;
        max: number;
    };
    customFilters?: Record<string, any>;
}
export interface SearchSort {
    field: 'relevance' | 'date' | 'title' | 'size';
    order: 'asc' | 'desc';
}
export interface SearchPagination {
    page: number;
    limit: number;
}
export interface SearchResult {
    documents: SearchDocument[];
    total: number;
    page: number;
    limit: number;
    facets: SearchFacets;
    query: string;
    processingTime: number;
}
export interface SearchFacets {
    entityType: Record<string, number>;
    tags: Record<string, number>;
    mimeType: Record<string, number>;
    dateRange: {
        min: Date;
        max: Date;
    };
}
export interface IndexingOptions {
    extractKeywords?: boolean;
    generateSummary?: boolean;
    analyzeSentiment?: boolean;
    extractEntities?: boolean;
    categorizeContent?: boolean;
}
export declare class SearchIndexingService {
    private tokenizer;
    private stemmer;
    private tfidf;
    private stopWords;
    constructor();
    indexDocument(document: SearchDocument, options?: IndexingOptions): Promise<void>;
    search(query: SearchQuery): Promise<SearchResult>;
    reindexAllDocuments(): Promise<void>;
    deleteFromIndex(documentId: string): Promise<void>;
    getSearchSuggestions(query: string, limit?: number): Promise<string[]>;
    private processContent;
    private extractKeywords;
    private generateSummary;
    private analyzeSentiment;
    private extractEntities;
    private categorizeContent;
    private generateVector;
    private processSearchQuery;
    private buildWhereClause;
    private buildOrderBy;
    private calculateRelevanceScores;
    private generateFacets;
}
export declare const searchIndexingService: SearchIndexingService;
//# sourceMappingURL=searchIndexingService.d.ts.map
export interface KnowledgeSearchDocument {
    id: string;
    entityId: string;
    entityType: 'knowledge_article' | 'document' | 'template' | 'case' | 'user';
    title: string;
    content: string;
    summary?: string;
    tags: string[];
    categories: string[];
    language: string;
    contentType?: string;
    accessLevel: string;
    authorId?: string;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface KnowledgeSearchQuery {
    query: string;
    filters?: KnowledgeSearchFilters;
    sortBy?: KnowledgeSearchSort;
    pagination?: KnowledgeSearchPagination;
    userId?: string;
}
export interface KnowledgeSearchFilters {
    contentType?: string[];
    categories?: string[];
    tags?: string[];
    accessLevel?: string[];
    authorId?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    language?: string[];
}
export interface KnowledgeSearchSort {
    field: 'relevance' | 'date' | 'title' | 'views' | 'likes';
    order: 'asc' | 'desc';
}
export interface KnowledgeSearchPagination {
    page: number;
    limit: number;
}
export interface KnowledgeSearchResult {
    documents: KnowledgeSearchDocument[];
    total: number;
    page: number;
    limit: number;
    facets: KnowledgeSearchFacets;
    query: string;
    processingTime: number;
    suggestions: string[];
}
export interface KnowledgeSearchFacets {
    contentType: Record<string, number>;
    categories: Record<string, number>;
    tags: Record<string, number>;
    accessLevel: Record<string, number>;
    authors: Record<string, number>;
    dateRange: {
        min: Date;
        max: Date;
    };
}
export interface KnowledgeIndexingOptions {
    extractKeywords?: boolean;
    generateSummary?: boolean;
    categorizeContent?: boolean;
    analyzeReadability?: boolean;
    extractLegalEntities?: boolean;
    generateEmbeddings?: boolean;
}
export declare class KnowledgeSearchEngine {
    private stemmer;
    private tfidf;
    private stopWords;
    private legalKeywords;
    constructor();
    indexKnowledgeDocument(document: KnowledgeSearchDocument, options?: KnowledgeIndexingOptions): Promise<void>;
    searchKnowledge(query: KnowledgeSearchQuery): Promise<KnowledgeSearchResult>;
    reindexKnowledgeContent(): Promise<void>;
    getKnowledgeRecommendations(userId: string, documentId?: string, limit?: number): Promise<KnowledgeSearchDocument[]>;
    private processKnowledgeContent;
    private extractLegalKeywords;
    private generateChineseSummary;
    private analyzeReadability;
    private extractLegalEntities;
    private generateEmbeddings;
    private simpleHash;
    private processKnowledgeQuery;
    private buildKnowledgeWhereClause;
    private buildKnowledgeOrderBy;
    private calculateKnowledgeRelevanceScores;
    private mapToSearchDocument;
    private generateKnowledgeFacets;
    private getKnowledgeSuggestions;
    private extractUserInterests;
    private scoreRecommendations;
    private logSearchAnalytics;
}
export declare const knowledgeSearchEngine: KnowledgeSearchEngine;
//# sourceMappingURL=knowledgeSearchEngine.d.ts.map
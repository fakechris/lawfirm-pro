export interface SearchQueryAnalysis {
    originalQuery: string;
    processedQuery: string;
    tokens: string[];
    keywords: string[];
    entities: SearchEntity[];
    intent: SearchIntent;
    language: 'zh' | 'en' | 'mixed';
    complexity: number;
}
export interface SearchEntity {
    type: 'legal_term' | 'date' | 'amount' | 'person' | 'organization' | 'location' | 'case_reference';
    value: string;
    confidence: number;
    start: number;
    end: number;
}
export interface SearchIntent {
    type: 'informational' | 'navigational' | 'transactional' | 'commercial';
    confidence: number;
    category?: string;
}
export interface SearchSuggestion {
    text: string;
    type: 'query' | 'keyword' | 'entity' | 'category';
    score: number;
    frequency: number;
}
export interface SearchResultHighlight {
    field: string;
    text: string;
    highlights: {
        start: number;
        end: number;
        text: string;
    }[];
}
export declare class SearchTextUtils {
    private legalTerms;
    private legalPatterns;
    constructor();
    analyzeSearchQuery(query: string): SearchQueryAnalysis;
    generateSuggestions(query: string, history?: string[], popularTerms?: string[]): SearchSuggestion[];
    highlightSearchResults(text: string, query: string, maxFragments?: number, fragmentLength?: number): SearchResultHighlight[];
    calculateRelevanceScore(document: {
        title: string;
        content: string;
        tags: string[];
        metadata?: any;
    }, query: string, queryAnalysis: SearchQueryAnalysis): number;
    private detectLanguage;
    private tokenizeQuery;
    private extractKeywords;
    private extractEntities;
    private mapPatternToEntityType;
    private determineSearchIntent;
    private calculateQueryComplexity;
    private normalizeQuery;
    private getQueryCompletions;
    private getKeywordSuggestions;
    private getEntitySuggestions;
    private deduplicateSuggestions;
    private escapeRegExp;
    private groupOverlappingMatches;
    private generateFragments;
}
export declare const searchTextUtils: SearchTextUtils;
//# sourceMappingURL=searchTextUtils.d.ts.map
import { KnowledgeSearchDocument } from '../search/knowledgeSearchEngine';
export interface UserProfile {
    id: string;
    role: string;
    department?: string;
    practiceAreas?: string[];
    searchHistory: SearchHistory[];
    viewHistory: ViewHistory[];
    preferences: UserPreferences;
}
export interface SearchHistory {
    query: string;
    timestamp: Date;
    resultsCount: number;
    clickedResults: string[];
}
export interface ViewHistory {
    documentId: string;
    timestamp: Date;
    duration: number;
    completionRate: number;
}
export interface UserPreferences {
    contentTypes: string[];
    categories: string[];
    tags: string[];
    language: string;
    updateFrequency: 'daily' | 'weekly' | 'monthly';
}
export interface Recommendation {
    document: KnowledgeSearchDocument;
    score: number;
    reason: string;
    type: 'content_based' | 'collaborative' | 'trending' | 'similar_users' | 'recent';
}
export interface RecommendationRequest {
    userId: string;
    currentDocumentId?: string;
    limit: number;
    context?: {
        currentCase?: string;
        currentTask?: string;
        timeOfDay?: string;
        location?: string;
    };
}
export interface RecommendationAnalytics {
    userId: string;
    recommendations: Recommendation[];
    clicked: string[];
    viewed: string[];
    conversionRate: number;
    timestamp: Date;
}
export declare class KnowledgeRecommendationEngine {
    private userProfiles;
    private trendingContent;
    private contentSimilarity;
    constructor();
    getPersonalizedRecommendations(request: RecommendationRequest): Promise<Recommendation[]>;
    getContentBasedRecommendations(userProfile: UserProfile, excludeDocumentId?: string, limit?: number): Promise<Recommendation[]>;
    getCollaborativeRecommendations(userProfile: UserProfile, limit?: number): Promise<Recommendation[]>;
    getTrendingRecommendations(userProfile: UserProfile, limit?: number): Promise<Recommendation[]>;
    getSimilarUsersRecommendations(userProfile: UserProfile, limit?: number): Promise<Recommendation[]>;
    recordUserAction(userId: string, action: {
        type: 'search' | 'view' | 'like' | 'share' | 'bookmark';
        documentId?: string;
        query?: string;
        duration?: number;
    }): Promise<void>;
    private getUserProfile;
    private getUserSearchHistory;
    private getUserViewHistory;
    private getUserPreferences;
    private updateUserPreferences;
    private extractUserInterests;
    private calculateContentBasedScore;
    private generateContentBasedReason;
    private findSimilarUsers;
    private calculateCollaborativeScore;
    private calculateTrendingScore;
    private calculateSimilarUserScore;
    private mapToSearchDocument;
    private applyContextualScoring;
    private deduplicateRecommendations;
    private logRecommendationAnalytics;
    private initializeTrendingContent;
    private updateTrendingContent;
    private startPeriodicUpdates;
    private updateContentSimilarity;
}
export declare const knowledgeRecommendationEngine: KnowledgeRecommendationEngine;
//# sourceMappingURL=recommendationEngine.d.ts.map
export interface KnowledgeBaseArticle {
    id: string;
    title: string;
    slug: string;
    content: string;
    summary?: string;
    contentType: KnowledgeBaseContentType;
    status: KnowledgeBaseStatus;
    accessLevel: KnowledgeBaseAccessLevel;
    language: string;
    tags: string[];
    categories: string[];
    authorId: string;
    reviewerId?: string;
    publishedAt?: Date;
    viewCount: number;
    likeCount: number;
    isFeatured: boolean;
    metadata?: any;
    createdAt: Date;
    updatedAt: Date;
    author?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    reviewer?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}
export interface KnowledgeBaseCategory {
    id: string;
    name: string;
    description?: string;
    slug: string;
    parentId?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    articleCount?: number;
}
export interface KnowledgeBaseComment {
    id: string;
    articleId: string;
    authorId: string;
    content: string;
    isResolved: boolean;
    createdAt: Date;
    updatedAt: Date;
    author?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}
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
export declare enum KnowledgeBaseContentType {
    BEST_PRACTICE = "BEST_PRACTICE",
    CASE_STUDY = "CASE_STUDY",
    LEGAL_GUIDE = "LEGAL_GUIDE",
    TEMPLATE = "TEMPLATE",
    TRAINING_MATERIAL = "TRAINING_MATERIAL",
    POLICY = "POLICY",
    PROCEDURE = "PROCEDURE",
    RESEARCH_NOTE = "RESEARCH_NOTE",
    LEGAL_OPINION = "LEGAL_OPINION",
    CHECKLIST = "CHECKLIST",
    WORKFLOW = "WORKFLOW",
    RESOURCE = "RESOURCE"
}
export declare enum KnowledgeBaseAccessLevel {
    PUBLIC = "PUBLIC",
    INTERNAL = "INTERNAL",
    RESTRICTED = "RESTRICTED",
    CONFIDENTIAL = "CONFIDENTIAL"
}
export declare enum KnowledgeBaseStatus {
    DRAFT = "DRAFT",
    REVIEW = "REVIEW",
    PUBLISHED = "PUBLISHED",
    ARCHIVED = "ARCHIVED",
    DEPRECATED = "DEPRECATED"
}
export interface KnowledgeArticleFormData {
    title: string;
    content: string;
    summary?: string;
    contentType: KnowledgeBaseContentType;
    accessLevel: KnowledgeBaseAccessLevel;
    tags: string[];
    categories: string[];
    isFeatured: boolean;
    reviewerId?: string;
}
export interface KnowledgeArticleFilters {
    category?: string;
    tags?: string[];
    contentType?: string[];
    accessLevel?: string[];
    authorId?: string[];
    status?: KnowledgeBaseStatus;
    dateRange?: {
        start: Date;
        end: Date;
    };
    search?: string;
}
export interface KnowledgeAnalytics {
    totalArticles: number;
    totalViews: number;
    totalLikes: number;
    popularArticles: KnowledgeBaseArticle[];
    recentArticles: KnowledgeBaseArticle[];
    categoryStats: Array<{
        category: string;
        count: number;
        views: number;
    }>;
    contentTypeStats: Array<{
        type: string;
        count: number;
        views: number;
    }>;
    userEngagement: Array<{
        userId: string;
        userName: string;
        views: number;
        likes: number;
        comments: number;
    }>;
}
//# sourceMappingURL=knowledge-base.d.ts.map
import { PrismaClient } from '@prisma/client';
import { KnowledgeBaseContent, KnowledgeBaseContentVersion, KnowledgeBaseCategory, KnowledgeBaseTag, CreateContentInput, UpdateContentInput, CreateContentVersionInput, ContentQuery, PaginationParams, PaginatedResult, ContentSearchResult } from '../../../models/knowledge-base';
export declare class ContentManagementService {
    private prisma;
    private documentService;
    private searchService;
    constructor(prisma: PrismaClient);
    createContent(input: CreateContentInput): Promise<KnowledgeBaseContent>;
    getContentById(id: string): Promise<KnowledgeBaseContent | null>;
    updateContent(id: string, input: UpdateContentInput, userId: string): Promise<KnowledgeBaseContent>;
    deleteContent(id: string): Promise<void>;
    queryContent(query: ContentQuery, pagination?: PaginationParams): Promise<PaginatedResult<KnowledgeBaseContent>>;
    searchContent(query: string, filters?: any): Promise<ContentSearchResult[]>;
    createContentVersion(input: CreateContentVersionInput): Promise<KnowledgeBaseContentVersion>;
    getContentVersions(contentId: string): Promise<KnowledgeBaseContentVersion[]>;
    getContentVersion(contentId: string, version: number): Promise<KnowledgeBaseContentVersion | null>;
    revertToVersion(contentId: string, version: number, userId: string): Promise<KnowledgeBaseContent>;
    createCategory(name: string, description?: string, parentId?: string): Promise<KnowledgeBaseCategory>;
    getCategories(): Promise<KnowledgeBaseCategory[]>;
    updateCategory(id: string, updates: any): Promise<KnowledgeBaseCategory>;
    createTag(name: string, description?: string): Promise<KnowledgeBaseTag>;
    getTags(): Promise<KnowledgeBaseTag[]>;
    updateTagUsage(tagName: string): Promise<void>;
    private generateSearchVector;
    private generateExcerpt;
    private calculateRelevanceScore;
    private generateHighlights;
    getContentAnalytics(contentId: string): Promise<any>;
    getGlobalAnalytics(): Promise<any>;
}
//# sourceMappingURL=contentManagementService.d.ts.map
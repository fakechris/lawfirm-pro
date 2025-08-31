import type { KnowledgeBaseArticle, KnowledgeBaseCategory, KnowledgeArticleFilters } from '../../types/knowledge-base';
interface UseKnowledgeBaseProps {
    initialFilters?: Partial<KnowledgeArticleFilters>;
}
interface UseKnowledgeBaseReturn {
    articles: KnowledgeBaseArticle[];
    categories: KnowledgeBaseCategory[];
    tags: string[];
    loading: boolean;
    error: string | null;
    fetchArticles: (filters?: KnowledgeArticleFilters) => Promise<void>;
    fetchCategories: () => Promise<void>;
    fetchTags: () => Promise<void>;
    createArticle: (data: any) => Promise<KnowledgeBaseArticle>;
    updateArticle: (id: string, data: any) => Promise<KnowledgeBaseArticle>;
    deleteArticle: (id: string) => Promise<void>;
    refetch: () => Promise<void>;
}
export declare const useKnowledgeBase: (props?: UseKnowledgeBaseProps) => UseKnowledgeBaseReturn;
export {};
//# sourceMappingURL=useKnowledgeBase.d.ts.map
import React from 'react';
import type { KnowledgeBaseArticle } from '../../../types/knowledge-base';
interface ArticleListProps {
    articles: KnowledgeBaseArticle[];
    onEdit: (article: KnowledgeBaseArticle) => void;
    onDelete: (articleId: string) => void;
    onCreate: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    statusFilter: string;
    onStatusFilterChange: (status: string) => void;
}
export declare const ArticleList: React.FC<ArticleListProps>;
export {};
//# sourceMappingURL=ArticleList.d.ts.map
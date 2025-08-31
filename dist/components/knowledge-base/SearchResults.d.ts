import React from 'react';
import type { KnowledgeBaseArticle } from '../../../types/knowledge-base';
interface SearchResultsProps {
    articles: KnowledgeBaseArticle[];
    viewMode: 'grid' | 'list';
    onArticleSelect: (article: KnowledgeBaseArticle) => void;
    isLoading?: boolean;
    totalResults?: number;
    searchQuery?: string;
}
export declare const SearchResults: React.FC<SearchResultsProps>;
export {};
//# sourceMappingURL=SearchResults.d.ts.map
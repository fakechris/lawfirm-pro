import React from 'react';
import type { KnowledgeBaseArticle, KnowledgeBaseCategory } from '../../../types/knowledge-base';
interface ContentNavigationProps {
    onArticleSelect?: (article: KnowledgeBaseArticle) => void;
    onCategorySelect?: (category: KnowledgeBaseCategory) => void;
}
export declare const ContentNavigation: React.FC<ContentNavigationProps>;
export {};
//# sourceMappingURL=ContentNavigation.d.ts.map
import React from 'react';
import type { SearchFilters, KnowledgeBaseArticle } from '../../../types/knowledge-base';
interface AdvancedSearchProps {
    onSearch: (results: KnowledgeBaseArticle[], filters: SearchFilters) => void;
    onClose: () => void;
}
export declare const AdvancedSearch: React.FC<AdvancedSearchProps>;
export {};
//# sourceMappingURL=AdvancedSearch.d.ts.map
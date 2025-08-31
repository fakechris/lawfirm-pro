import React from 'react';
import type { KnowledgeBaseCategory } from '../../../types/knowledge-base';
interface CategoryManagerProps {
    categories: KnowledgeBaseCategory[];
    onCategoriesUpdated: () => Promise<void>;
}
export declare const CategoryManager: React.FC<CategoryManagerProps>;
export {};
//# sourceMappingURL=CategoryManager.d.ts.map
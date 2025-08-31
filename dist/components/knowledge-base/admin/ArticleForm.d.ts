import React from 'react';
import type { KnowledgeBaseArticle, KnowledgeArticleFormData, KnowledgeBaseCategory } from '../../../types/knowledge-base';
interface ArticleFormProps {
    article?: KnowledgeBaseArticle;
    onSubmit: (data: KnowledgeArticleFormData) => Promise<void>;
    onCancel: () => void;
    categories: KnowledgeBaseCategory[];
    availableTags: string[];
}
export declare const ArticleForm: React.FC<ArticleFormProps>;
export {};
//# sourceMappingURL=ArticleForm.d.ts.map
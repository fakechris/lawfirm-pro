import React from 'react';
import type { KnowledgeBaseArticle } from '../../types/knowledge-base';
interface KnowledgeCardProps {
    article: KnowledgeBaseArticle;
    onClick: () => void;
    contentTypeLabel: string;
    accessLevelLabel: string;
}
export declare const KnowledgeCard: React.FC<KnowledgeCardProps>;
export {};
//# sourceMappingURL=KnowledgeCard.d.ts.map
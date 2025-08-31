import { KnowledgeIndexingOptions } from '../search/knowledgeSearchEngine';
export interface ContentProcessor {
    canProcess(contentType: string): boolean;
    process(content: string, options?: any): Promise<ProcessedContent>;
}
export interface ProcessedContent {
    text: string;
    metadata: Record<string, any>;
    structure?: ContentStructure;
}
export interface ContentStructure {
    sections: ContentSection[];
    headings: string[];
    links: string[];
    tables: TableData[];
    images: ImageData[];
}
export interface ContentSection {
    title: string;
    content: string;
    level: number;
}
export interface TableData {
    headers: string[];
    rows: string[][];
    caption?: string;
}
export interface ImageData {
    src: string;
    alt: string;
    caption?: string;
}
export declare class DocumentContentProcessor implements ContentProcessor {
    canProcess(contentType: string): boolean;
    process(content: string, options?: any): Promise<ProcessedContent>;
}
export declare class HTMLContentProcessor implements ContentProcessor {
    canProcess(contentType: string): boolean;
    process(content: string, options?: any): Promise<ProcessedContent>;
    private extractSections;
    private extractHeadings;
    private extractLinks;
    private extractTables;
    private extractImages;
    private getMetaContent;
}
export declare class MarkdownContentProcessor implements ContentProcessor {
    canProcess(contentType: string): boolean;
    process(content: string, options?: any): Promise<ProcessedContent>;
}
export declare class JSONContentProcessor implements ContentProcessor {
    canProcess(contentType: string): boolean;
    process(content: string, options?: any): Promise<ProcessedContent>;
    private extractJSONStructure;
    private extractKeys;
    private calculateDepth;
}
export declare class KnowledgeBaseContentIndexer {
    private processors;
    constructor();
    indexContent(entityId: string, entityType: string, content: string, metadata: Record<string, any>, options?: KnowledgeIndexingOptions): Promise<void>;
    batchIndexContent(items: Array<{
        entityId: string;
        entityType: string;
        content: string;
        metadata: Record<string, any>;
    }>, options?: KnowledgeIndexingOptions): Promise<{
        success: string[];
        failed: {
            id: string;
            error: string;
        }[];
    }>;
    reindexEntityType(entityType: string, options?: KnowledgeIndexingOptions): Promise<void>;
    private getProcessor;
}
export declare const knowledgeBaseContentIndexer: KnowledgeBaseContentIndexer;
//# sourceMappingURL=contentIndexer.d.ts.map
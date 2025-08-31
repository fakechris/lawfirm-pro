import { PrismaClient } from '@prisma/client';
import { DocumentProcessingResult } from '../../models/documents';
export interface MetadataExtractionOptions {
    enableOCR?: boolean;
    enableTextExtraction?: boolean;
    enableMetadataExtraction?: boolean;
    enableIndexing?: boolean;
    ocrLanguage?: string;
    maxFileSize?: number;
    processingTimeout?: number;
}
export interface ExtractedText {
    content: string;
    language?: string;
    confidence?: number;
    pages?: number;
    wordCount?: number;
    charCount?: number;
}
export interface DocumentAnalysis {
    type: string;
    category: string;
    language: string;
    wordCount: number;
    charCount: number;
    pageCount?: number;
    readabilityScore?: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
    keywords: string[];
    entities: Array<{
        type: string;
        text: string;
        confidence: number;
        start: number;
        end: number;
    }>;
}
export declare class DocumentMetadataService {
    private prisma;
    private options;
    constructor(prisma: PrismaClient, options?: MetadataExtractionOptions);
    extractMetadata(documentId: string, filePath: string, mimeType: string, options?: Partial<MetadataExtractionOptions>): Promise<DocumentProcessingResult>;
    bulkExtractMetadata(documentIds: string[], options?: Partial<MetadataExtractionOptions>): Promise<{
        success: number;
        failed: number;
        results: DocumentProcessingResult[];
        errors: string[];
    }>;
    reprocessFailedDocuments(options?: Partial<MetadataExtractionOptions>): Promise<{
        processed: number;
        success: number;
        failed: number;
    }>;
    getProcessingStats(): Promise<{
        totalDocuments: number;
        processedDocuments: number;
        failedDocuments: number;
        pendingDocuments: number;
        averageProcessingTime: number;
        byMimeType: Record<string, {
            total: number;
            processed: number;
            failed: number;
        }>;
    }>;
    private extractAllMetadata;
    private extractTextContent;
    private extractPdfText;
    private extractDocxText;
    private extractOcrText;
    private isImageFile;
    private detectLanguage;
    private extractFileMetadata;
    private extractPdfMetadata;
    private extractImageMetadata;
    private analyzeDocument;
    private extractEntities;
    private classifyDocumentType;
    private categorizeDocument;
    private calculateReadabilityScore;
    private analyzeSentiment;
}
export declare const documentMetadataService: DocumentMetadataService;
//# sourceMappingURL=metadata.d.ts.map
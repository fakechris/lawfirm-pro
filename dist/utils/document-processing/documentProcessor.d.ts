export interface ProcessedDocument {
    content: string;
    metadata: DocumentMetadata;
    text: string;
    language?: string;
    processingTime: number;
}
export interface DocumentMetadata {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
    pageCount?: number;
    wordCount?: number;
    charCount?: number;
    fileSize?: number;
    mimeType?: string;
    filename?: string;
    custom?: Record<string, any>;
}
export interface ProcessingOptions {
    extractMetadata?: boolean;
    extractImages?: boolean;
    extractTables?: boolean;
    languageDetection?: boolean;
    maxFileSize?: number;
    allowedMimeTypes?: string[];
}
export declare class DocumentProcessor {
    private supportedFormats;
    processFile(filePath: string, userId?: string, options?: ProcessingOptions): Promise<ProcessedDocument>;
    private detectMimeType;
    private processByMimeType;
    private processPdf;
    private processWordDocument;
    private processExcelDocument;
    private processTextFile;
    private processHtmlFile;
    private processCsvFile;
    private processImage;
    private detectLanguage;
    private countWords;
    private hasCsvHeaders;
    isFormatSupported(mimeType: string): boolean;
    getSupportedFormats(): string[];
    extractImagesFromPdf(buffer: Buffer): Promise<Buffer[]>;
    extractTablesFromPdf(buffer: Buffer): Promise<string[][][]>;
}
export declare const documentProcessor: DocumentProcessor;
//# sourceMappingURL=documentProcessor.d.ts.map
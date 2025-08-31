export interface OCRResult {
    text: string;
    confidence: number;
    language: string;
    pages: OCRPage[];
    processingTime: number;
}
export interface OCRPage {
    pageNumber: number;
    text: string;
    confidence: number;
    blocks: OCRBlock[];
}
export interface OCRBlock {
    type: 'text' | 'table' | 'image';
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    text: string;
    confidence: number;
}
export interface OCRProcessingOptions {
    languages?: string[];
    autoRotate?: boolean;
    preserveFormatting?: boolean;
    extractTables?: boolean;
    dpi?: number;
}
export declare class OCRService {
    private worker;
    initialize(): Promise<void>;
    processDocument(filePath: string, options?: OCRProcessingOptions): Promise<OCRResult>;
    processBatch(filePaths: string[], options?: OCRProcessingOptions): Promise<OCRResult[]>;
    extractTextFromImage(imageBuffer: Buffer, options?: OCRProcessingOptions): Promise<string>;
    detectLanguage(text: string): Promise<string>;
    terminate(): Promise<void>;
    private extractBlocks;
    validateOCRQuality(result: OCRResult): Promise<{
        isValid: boolean;
        issues: string[];
        suggestions: string[];
    }>;
    getSupportedFormats(): Promise<string[]>;
    isFormatSupported(mimeType: string): Promise<boolean>;
}
export declare const ocrService: OCRService;
//# sourceMappingURL=ocrService.d.ts.map
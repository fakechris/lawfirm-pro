export interface ConversionOptions {
    quality?: number;
    compression?: number;
    format?: string;
    width?: number;
    height?: number;
    dpi?: number;
    preserveMetadata?: boolean;
}
export interface ConversionResult {
    convertedFile: string;
    originalFile: string;
    conversionTime: number;
    fileSize: number;
    format: string;
    metadata?: any;
}
export declare class DocumentConverter {
    private supportedConversions;
    convertFile(sourcePath: string, targetFormat: string, options?: ConversionOptions): Promise<ConversionResult>;
    convertImage(buffer: Buffer, sourceFormat: string, targetFormat: string, options?: ConversionOptions): Promise<Buffer>;
    convertToPdf(buffer: Buffer, sourceFormat: string, options?: ConversionOptions): Promise<Buffer>;
    createArchive(filePaths: string[], archiveFormat?: 'zip' | 'tar' | '7z', options?: {
        compressionLevel?: number;
        password?: string;
    }): Promise<Buffer>;
    extractArchive(archivePath: string, extractTo: string): Promise<string[]>;
    batchConvert(filePaths: string[], targetFormat: string, options?: ConversionOptions): Promise<ConversionResult[]>;
    private detectMimeType;
    private isConversionSupported;
    private performConversion;
    private getExtensionFromMimeType;
    private extractMetadata;
    getSupportedConversions(): Record<string, string[]>;
    isFormatSupported(format: string): boolean;
}
export declare const documentConverter: DocumentConverter;
//# sourceMappingURL=documentConverter.d.ts.map
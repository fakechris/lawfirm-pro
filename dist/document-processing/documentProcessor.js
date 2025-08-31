import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import sharp from 'sharp';
import { storageService } from '../storage';
import { logger } from '../logger';
import { DocumentProcessingError, FormatNotSupportedError, ValidationError, handleProcessingError, createErrorContext, withRetry, } from '../errorHandler';
export class DocumentProcessor {
    constructor() {
        this.supportedFormats = new Set([
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/html',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/tiff',
            'image/bmp',
            'image/gif',
        ]);
    }
    async processFile(filePath, userId, options = {}) {
        const startTime = Date.now();
        const defaultOptions = {
            extractMetadata: true,
            extractImages: false,
            extractTables: true,
            languageDetection: true,
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedMimeTypes: Array.from(this.supportedFormats),
        };
        const finalOptions = { ...defaultOptions, ...options };
        const context = createErrorContext('processFile', userId, undefined, undefined, { filePath });
        return withRetry(async () => {
            try {
                logger.info('Starting document processing', context);
                // Get file info
                const fileBuffer = await storageService.getFile(filePath);
                const fileSize = fileBuffer.length;
                const filename = path.basename(filePath);
                // Validate file size
                if (fileSize > (finalOptions.maxFileSize || 0)) {
                    throw new ValidationError(`File size ${fileSize} exceeds maximum allowed size of ${finalOptions.maxFileSize} bytes`, context);
                }
                // Detect MIME type
                const mimeType = await this.detectMimeType(fileBuffer, filename);
                // Validate MIME type
                if (!this.isFormatSupported(mimeType)) {
                    throw new FormatNotSupportedError(mimeType, context);
                }
                // Process based on MIME type
                const result = await this.processByMimeType(fileBuffer, mimeType, finalOptions, context);
                const processingTime = Date.now() - startTime;
                logger.logDocumentOperation('processed', filePath, userId, {
                    fileSize,
                    mimeType,
                    processingTime,
                    language: result.language,
                });
                return {
                    content: result.content,
                    metadata: {
                        ...result.metadata,
                        fileSize,
                        mimeType,
                        filename,
                    },
                    text: result.text,
                    language: result.language,
                    processingTime,
                };
            }
            catch (error) {
                const processedError = handleProcessingError(error, context);
                logger.error('Document processing failed', processedError, context);
                throw processedError;
            }
        }, 2, 1000, context);
    }
    async detectMimeType(buffer, filename) {
        const ext = path.extname(filename).toLowerCase();
        // Map extensions to MIME types
        const extToMime = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.htm': 'text/html',
            '.csv': 'text/csv',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
            '.bmp': 'image/bmp',
            '.gif': 'image/gif',
        };
        return extToMime[ext] || 'application/octet-stream';
    }
    async processByMimeType(buffer, mimeType, options, context) {
        try {
            switch (mimeType) {
                case 'application/pdf':
                    return await this.processPdf(buffer, options, context);
                case 'application/msword':
                case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    return await this.processWordDocument(buffer, options, context);
                case 'application/vnd.ms-excel':
                case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                    return await this.processExcelDocument(buffer, options, context);
                case 'text/plain':
                    return await this.processTextFile(buffer, options, context);
                case 'text/html':
                    return await this.processHtmlFile(buffer, options, context);
                case 'text/csv':
                    return await this.processCsvFile(buffer, options, context);
                case 'image/jpeg':
                case 'image/png':
                case 'image/tiff':
                case 'image/bmp':
                case 'image/gif':
                    return await this.processImage(buffer, options, context);
                default:
                    throw new FormatNotSupportedError(mimeType, context);
            }
        }
        catch (error) {
            logger.error(`Failed to process ${mimeType} document`, error, context);
            throw handleProcessingError(error, context);
        }
    }
    async processPdf(buffer, options, context) {
        try {
            const data = await pdfParse(buffer);
            const metadata = {
                title: data.info?.Title,
                author: data.info?.Author,
                subject: data.info?.Subject,
                keywords: data.info?.Keywords,
                creator: data.info?.Creator,
                producer: data.info?.Producer,
                creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
                modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
                pageCount: data.numpages,
                wordCount: this.countWords(data.text),
                charCount: data.text.length,
            };
            return {
                content: data.text,
                metadata,
                text: data.text,
                language: options.languageDetection ? await this.detectLanguage(data.text) : undefined,
            };
        }
        catch (error) {
            logger.error('PDF processing failed', error, context);
            throw new DocumentProcessingError(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PDF_PROCESSING_ERROR', 500, context, true);
        }
    }
    async processWordDocument(buffer, options) {
        const result = await mammoth.extractRawText({ buffer });
        const metadata = {
            wordCount: this.countWords(result.value),
            charCount: result.value.length,
        };
        return {
            content: result.value,
            metadata,
            text: result.value,
            language: options.languageDetection ? await this.detectLanguage(result.value) : undefined,
        };
    }
    async processExcelDocument(buffer, options) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        let content = '';
        let text = '';
        // Process each sheet
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_txt(worksheet);
            content += `Sheet: ${sheetName}\n${sheetData}\n\n`;
            text += sheetData;
        }
        const metadata = {
            custom: {
                sheetCount: workbook.SheetNames.length,
                sheets: workbook.SheetNames,
            },
            wordCount: this.countWords(text),
            charCount: text.length,
        };
        return {
            content,
            metadata,
            text,
            language: options.languageDetection ? await this.detectLanguage(text) : undefined,
        };
    }
    async processTextFile(buffer, options) {
        const text = buffer.toString('utf8');
        const metadata = {
            wordCount: this.countWords(text),
            charCount: text.length,
        };
        return {
            content: text,
            metadata,
            text,
            language: options.languageDetection ? await this.detectLanguage(text) : undefined,
        };
    }
    async processHtmlFile(buffer, options) {
        const { convert } = await import('html-to-text');
        const text = convert(buffer.toString('utf8'), {
            wordwrap: false,
            selectors: [
                { selector: 'a', options: { ignoreHref: true } },
                { selector: 'img', format: 'skip' },
            ],
        });
        const metadata = {
            wordCount: this.countWords(text),
            charCount: text.length,
        };
        return {
            content: text,
            metadata,
            text,
            language: options.languageDetection ? await this.detectLanguage(text) : undefined,
        };
    }
    async processCsvFile(buffer, options) {
        const text = buffer.toString('utf8');
        const metadata = {
            custom: {
                rowCount: text.split('\n').length,
                hasHeaders: this.hasCsvHeaders(text),
            },
            wordCount: this.countWords(text),
            charCount: text.length,
        };
        return {
            content: text,
            metadata,
            text,
            language: options.languageDetection ? await this.detectLanguage(text) : undefined,
        };
    }
    async processImage(buffer, options) {
        const metadata = await sharp(buffer).metadata();
        const documentMetadata = {
            custom: {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                channels: metadata.channels,
                density: metadata.density,
                hasAlpha: metadata.hasAlpha,
            },
            charCount: 0,
        };
        return {
            content: '',
            metadata: documentMetadata,
            text: '',
            language: undefined,
        };
    }
    async detectLanguage(text) {
        // Simple language detection based on character patterns
        const chineseRegex = /[\u4e00-\u9fff]/;
        const englishRegex = /^[a-zA-Z\s\d.,!?;:'"()-]+$/;
        if (chineseRegex.test(text)) {
            return 'chi_sim';
        }
        else if (englishRegex.test(text)) {
            return 'eng';
        }
        else {
            return 'eng'; // Default to English
        }
    }
    countWords(text) {
        // Handle both English and Chinese word counting
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
        return englishWords.length + chineseChars.length;
    }
    hasCsvHeaders(text) {
        const firstLine = text.split('\n')[0];
        const headerPattern = /^[a-zA-Z_][a-zA-Z0-9_]*([,\t][a-zA-Z_][a-zA-Z0-9_]*)*$/;
        return headerPattern.test(firstLine);
    }
    isFormatSupported(mimeType) {
        return this.supportedFormats.has(mimeType);
    }
    getSupportedFormats() {
        return Array.from(this.supportedFormats);
    }
    async extractImagesFromPdf(buffer) {
        // This is a simplified implementation
        // In a real implementation, you would use a library like pdf-poppler
        return [];
    }
    async extractTablesFromPdf(buffer) {
        // This is a simplified implementation
        // In a real implementation, you would use a library like pdf-table-extractor
        return [];
    }
}
export const documentProcessor = new DocumentProcessor();

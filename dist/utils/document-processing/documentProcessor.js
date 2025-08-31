"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentProcessor = exports.DocumentProcessor = void 0;
const path_1 = __importDefault(require("path"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const XLSX = __importStar(require("xlsx"));
const sharp_1 = __importDefault(require("sharp"));
const storage_1 = require("../storage");
const logger_1 = require("../logger");
const errorHandler_1 = require("../errorHandler");
class DocumentProcessor {
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
            maxFileSize: 100 * 1024 * 1024,
            allowedMimeTypes: Array.from(this.supportedFormats),
        };
        const finalOptions = { ...defaultOptions, ...options };
        const context = (0, errorHandler_1.createErrorContext)('processFile', userId, undefined, undefined, { filePath });
        return (0, errorHandler_1.withRetry)(async () => {
            try {
                logger_1.logger.info('Starting document processing', context);
                const fileBuffer = await storage_1.storageService.getFile(filePath);
                const fileSize = fileBuffer.length;
                const filename = path_1.default.basename(filePath);
                if (fileSize > (finalOptions.maxFileSize || 0)) {
                    throw new errorHandler_1.ValidationError(`File size ${fileSize} exceeds maximum allowed size of ${finalOptions.maxFileSize} bytes`, context);
                }
                const mimeType = await this.detectMimeType(fileBuffer, filename);
                if (!this.isFormatSupported(mimeType)) {
                    throw new errorHandler_1.FormatNotSupportedError(mimeType, context);
                }
                const result = await this.processByMimeType(fileBuffer, mimeType, finalOptions, context);
                const processingTime = Date.now() - startTime;
                logger_1.logger.logDocumentOperation('processed', filePath, userId, {
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
                const processedError = (0, errorHandler_1.handleProcessingError)(error, context);
                logger_1.logger.error('Document processing failed', processedError, context);
                throw processedError;
            }
        }, 2, 1000, context);
    }
    async detectMimeType(buffer, filename) {
        const ext = path_1.default.extname(filename).toLowerCase();
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
                    throw new errorHandler_1.FormatNotSupportedError(mimeType, context);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to process ${mimeType} document`, error, context);
            throw (0, errorHandler_1.handleProcessingError)(error, context);
        }
    }
    async processPdf(buffer, options, context) {
        try {
            const data = await (0, pdf_parse_1.default)(buffer);
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
            logger_1.logger.error('PDF processing failed', error, context);
            throw new errorHandler_1.DocumentProcessingError(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'PDF_PROCESSING_ERROR', 500, context, true);
        }
    }
    async processWordDocument(buffer, options) {
        const result = await mammoth_1.default.extractRawText({ buffer });
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
        const { convert } = await Promise.resolve().then(() => __importStar(require('html-to-text')));
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
        const metadata = await (0, sharp_1.default)(buffer).metadata();
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
        const chineseRegex = /[\u4e00-\u9fff]/;
        const englishRegex = /^[a-zA-Z\s\d.,!?;:'"()-]+$/;
        if (chineseRegex.test(text)) {
            return 'chi_sim';
        }
        else if (englishRegex.test(text)) {
            return 'eng';
        }
        else {
            return 'eng';
        }
    }
    countWords(text) {
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
        return [];
    }
    async extractTablesFromPdf(buffer) {
        return [];
    }
}
exports.DocumentProcessor = DocumentProcessor;
exports.documentProcessor = new DocumentProcessor();
//# sourceMappingURL=documentProcessor.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrService = exports.OCRService = void 0;
const tesseract_js_1 = require("tesseract.js");
const storage_1 = require("../storage");
class OCRService {
    constructor() {
        this.worker = null;
    }
    async initialize() {
        try {
            this.worker = await (0, tesseract_js_1.createWorker)({
                logger: (m) => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('OCR Progress:', m);
                    }
                },
            });
        }
        catch (error) {
            console.error('Failed to initialize OCR worker:', error);
            throw new Error('OCR initialization failed');
        }
    }
    async processDocument(filePath, options = {}) {
        if (!this.worker) {
            await this.initialize();
        }
        const startTime = Date.now();
        const defaultOptions = {
            languages: ['eng', 'chi_sim'],
            autoRotate: true,
            preserveFormatting: true,
            extractTables: false,
            dpi: 300,
        };
        const finalOptions = { ...defaultOptions, ...options };
        try {
            const fileBuffer = await storage_1.storageService.getFile(filePath);
            await this.worker.loadLanguages(finalOptions.languages || ['eng']);
            await this.worker.initialize(finalOptions.languages?.[0] || 'eng');
            const { data: { text, confidence } } = await this.worker.recognize(fileBuffer);
            const pages = [{
                    pageNumber: 1,
                    text,
                    confidence,
                    blocks: this.extractBlocks(text, confidence),
                }];
            const processingTime = Date.now() - startTime;
            return {
                text,
                confidence,
                language: finalOptions.languages?.[0] || 'eng',
                pages,
                processingTime,
            };
        }
        catch (error) {
            console.error('OCR processing failed:', error);
            throw new Error('Failed to process document with OCR');
        }
    }
    async processBatch(filePaths, options = {}) {
        const results = [];
        for (const filePath of filePaths) {
            try {
                const result = await this.processDocument(filePath, options);
                results.push(result);
            }
            catch (error) {
                console.error(`Failed to process ${filePath}:`, error);
                results.push({
                    text: '',
                    confidence: 0,
                    language: '',
                    pages: [],
                    processingTime: 0,
                });
            }
        }
        return results;
    }
    async extractTextFromImage(imageBuffer, options = {}) {
        if (!this.worker) {
            await this.initialize();
        }
        const defaultOptions = {
            languages: ['eng', 'chi_sim'],
            autoRotate: true,
            preserveFormatting: false,
            extractTables: false,
        };
        const finalOptions = { ...defaultOptions, ...options };
        try {
            await this.worker.loadLanguages(finalOptions.languages || ['eng']);
            await this.worker.initialize(finalOptions.languages?.[0] || 'eng');
            const { data: { text } } = await this.worker.recognize(imageBuffer);
            return text;
        }
        catch (error) {
            console.error('Image OCR failed:', error);
            throw new Error('Failed to extract text from image');
        }
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
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
    extractBlocks(text, confidence) {
        const lines = text.split('\n').filter(line => line.trim());
        return lines.map((line, index) => ({
            type: 'text',
            boundingBox: {
                x: 0,
                y: index * 20,
                width: line.length * 10,
                height: 20,
            },
            text: line.trim(),
            confidence,
        }));
    }
    async validateOCRQuality(result) {
        const issues = [];
        const suggestions = [];
        if (result.confidence < 70) {
            issues.push('Low confidence score');
            suggestions.push('Consider rescanning the document at higher DPI');
        }
        if (result.text.length < 50) {
            issues.push('Very little text extracted');
            suggestions.push('Check if document is text-based or properly scanned');
        }
        const commonErrors = [
            /\s{2,}/g,
            /[0-9]+[oO]/g,
            /[lI|]/g,
        ];
        commonErrors.forEach((error, index) => {
            if (error.test(result.text)) {
                issues.push(`Potential OCR error pattern ${index + 1}`);
                suggestions.push('Manual review recommended');
            }
        });
        return {
            isValid: issues.length === 0,
            issues,
            suggestions,
        };
    }
    async getSupportedFormats() {
        return [
            'image/png',
            'image/jpeg',
            'image/tiff',
            'image/bmp',
            'application/pdf',
        ];
    }
    async isFormatSupported(mimeType) {
        const supportedFormats = await this.getSupportedFormats();
        return supportedFormats.includes(mimeType);
    }
}
exports.OCRService = OCRService;
exports.ocrService = new OCRService();
//# sourceMappingURL=ocrService.js.map
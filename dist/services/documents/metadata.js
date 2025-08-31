"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentMetadataService = exports.DocumentMetadataService = void 0;
const client_1 = require("@prisma/client");
const storage_1 = require("./storage");
const searchService_1 = require("./searchService");
const config_1 = require("../../config");
class DocumentMetadataService {
    constructor(prisma, options = {}) {
        this.prisma = prisma;
        this.options = {
            enableOCR: config_1.config.ocr.enabled,
            enableTextExtraction: true,
            enableMetadataExtraction: true,
            enableIndexing: true,
            ocrLanguage: config_1.config.ocr.language,
            maxFileSize: config_1.config.storage.maxFileSize,
            processingTimeout: config_1.config.ocr.timeout,
            ...options
        };
    }
    async extractMetadata(documentId, filePath, mimeType, options) {
        const startTime = Date.now();
        const mergedOptions = { ...this.options, ...options };
        const result = {
            success: false,
            filePath,
            filename: '',
            size: 0,
            mimeType,
            checksum: ''
        };
        try {
            const document = await this.prisma.document.findUnique({
                where: { id: documentId }
            });
            if (!document) {
                result.error = 'Document not found';
                return result;
            }
            const downloadResult = await storage_1.documentStorageService.downloadFile(filePath);
            if (!downloadResult.success || !downloadResult.buffer) {
                result.error = 'Failed to download file for processing';
                return result;
            }
            const fileBuffer = downloadResult.buffer;
            result.size = fileBuffer.length;
            result.filename = document.filename;
            const extractedData = await this.extractAllMetadata(fileBuffer, document.originalName, mimeType, mergedOptions);
            const updateData = {
                extractedText: extractedData.text?.content || null,
                extractedMetadata: extractedData.metadata,
                language: extractedData.analysis?.language || null,
                wordCount: extractedData.analysis?.wordCount || 0,
                charCount: extractedData.analysis?.charCount || 0,
                processingStatus: 'PROCESSED',
                processedAt: new Date()
            };
            await this.prisma.document.update({
                where: { id: documentId },
                data: updateData
            });
            if (mergedOptions.enableIndexing) {
                await searchService_1.documentSearchService.indexDocument(documentId);
            }
            result.success = true;
            result.processingTime = Date.now() - startTime;
            result.extractedMetadata = extractedData.metadata;
            result.extractedText = extractedData.text?.content;
            return result;
        }
        catch (error) {
            console.error(`Metadata extraction failed for document ${documentId}:`, error);
            await this.prisma.document.update({
                where: { id: documentId },
                data: {
                    processingStatus: 'FAILED',
                    processingError: error instanceof Error ? error.message : 'Unknown error'
                }
            });
            result.error = `Metadata extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return result;
        }
    }
    async bulkExtractMetadata(documentIds, options) {
        const results = [];
        const errors = [];
        let success = 0;
        let failed = 0;
        for (const documentId of documentIds) {
            try {
                const document = await this.prisma.document.findUnique({
                    where: { id: documentId }
                });
                if (!document) {
                    errors.push(`Document not found: ${documentId}`);
                    failed++;
                    continue;
                }
                const result = await this.extractMetadata(documentId, document.path, document.mimeType, options);
                results.push(result);
                if (result.success) {
                    success++;
                }
                else {
                    failed++;
                    errors.push(`Failed to process document ${documentId}: ${result.error}`);
                }
            }
            catch (error) {
                failed++;
                errors.push(`Error processing document ${documentId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        return { success, failed, results, errors };
    }
    async reprocessFailedDocuments(options) {
        const failedDocuments = await this.prisma.document.findMany({
            where: { processingStatus: 'FAILED' },
            select: { id: true, path: true, mimeType: true }
        });
        let processed = 0;
        let success = 0;
        let failed = 0;
        for (const doc of failedDocuments) {
            const result = await this.extractMetadata(doc.id, doc.path, doc.mimeType, options);
            processed++;
            if (result.success) {
                success++;
            }
            else {
                failed++;
            }
        }
        return { processed, success, failed };
    }
    async getProcessingStats() {
        const stats = await this.prisma.document.groupBy({
            by: ['mimeType', 'processingStatus'],
            _count: { id: true },
            _avg: {
                processingTime: true
            }
        });
        const byMimeType = {};
        let totalProcessed = 0;
        let totalFailed = 0;
        let totalProcessingTime = 0;
        let processedCount = 0;
        stats.forEach(stat => {
            const mimeType = stat.mimeType;
            const status = stat.processingStatus;
            const count = stat._count.id;
            if (!byMimeType[mimeType]) {
                byMimeType[mimeType] = {
                    total: 0,
                    processed: 0,
                    failed: 0
                };
            }
            byMimeType[mimeType].total += count;
            if (status === 'PROCESSED') {
                byMimeType[mimeType].processed += count;
                totalProcessed += count;
                if (stat._avg.processingTime) {
                    totalProcessingTime += stat._avg.processingTime;
                    processedCount++;
                }
            }
            else if (status === 'FAILED') {
                byMimeType[mimeType].failed += count;
                totalFailed += count;
            }
        });
        const totalDocuments = Object.values(byMimeType).reduce((sum, stat) => sum + stat.total, 0);
        const pendingDocuments = totalDocuments - totalProcessed - totalFailed;
        const averageProcessingTime = processedCount > 0 ? totalProcessingTime / processedCount : 0;
        return {
            totalDocuments,
            processedDocuments: totalProcessed,
            failedDocuments: totalFailed,
            pendingDocuments,
            averageProcessingTime,
            byMimeType
        };
    }
    async extractAllMetadata(fileBuffer, filename, mimeType, options) {
        const result = {};
        if (options.enableTextExtraction) {
            result.text = await this.extractTextContent(fileBuffer, mimeType, options);
        }
        if (options.enableMetadataExtraction) {
            result.metadata = await this.extractFileMetadata(fileBuffer, filename, mimeType);
        }
        if (result.text) {
            result.analysis = await this.analyzeDocument(result.text.content, mimeType);
        }
        return result;
    }
    async extractTextContent(fileBuffer, mimeType, options) {
        try {
            let content = '';
            if (mimeType === 'text/plain') {
                content = fileBuffer.toString('utf-8');
            }
            else if (mimeType === 'application/pdf') {
                content = await this.extractPdfText(fileBuffer, options);
            }
            else if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') {
                content = await this.extractDocxText(fileBuffer);
            }
            else if (options.enableOCR && this.isImageFile(mimeType)) {
                content = await this.extractOcrText(fileBuffer, options);
            }
            else {
                return null;
            }
            if (!content.trim()) {
                return null;
            }
            const words = content.split(/\s+/).filter(word => word.length > 0);
            const charCount = content.length;
            return {
                content: content.trim(),
                language: this.detectLanguage(content),
                confidence: 0.8,
                wordCount: words.length,
                charCount
            };
        }
        catch (error) {
            console.error('Text extraction failed:', error);
            return null;
        }
    }
    async extractPdfText(fileBuffer, options) {
        try {
            const text = fileBuffer.toString('latin1');
            const textMatches = text.match(/\(([^)]*)\)/g);
            if (textMatches) {
                return textMatches
                    .map(match => match.slice(1, -1))
                    .join(' ')
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r');
            }
            if (options.enableOCR) {
                return await this.extractOcrText(fileBuffer, options);
            }
            return '';
        }
        catch (error) {
            console.error('PDF text extraction failed:', error);
            return '';
        }
    }
    async extractDocxText(fileBuffer) {
        try {
            const text = fileBuffer.toString('utf-8');
            const textMatches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
            if (textMatches) {
                return textMatches
                    .map(match => match.replace(/<w:t[^>]*>|<\/w:t>/g, ''))
                    .join(' ')
                    .replace(/\\n/g, '\n');
            }
            return '';
        }
        catch (error) {
            console.error('DOCX text extraction failed:', error);
            return '';
        }
    }
    async extractOcrText(fileBuffer, options) {
        if (!options.enableOCR) {
            return '';
        }
        try {
            return 'OCR text extraction would be implemented here with proper OCR libraries';
        }
        catch (error) {
            console.error('OCR text extraction failed:', error);
            return '';
        }
    }
    isImageFile(mimeType) {
        return mimeType.startsWith('image/') &&
            ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'].includes(mimeType);
    }
    detectLanguage(text) {
        const chineseRegex = /[\u4e00-\u9fff]/;
        const englishRegex = /^[a-zA-Z\s.,!?'"-]+$/;
        if (chineseRegex.test(text)) {
            return 'zh';
        }
        else if (englishRegex.test(text.substring(0, 100))) {
            return 'en';
        }
        return 'unknown';
    }
    async extractFileMetadata(fileBuffer, filename, mimeType) {
        const metadata = {
            filename,
            mimeType,
            fileSize: fileBuffer.length,
            createdAt: new Date(),
            modifiedAt: new Date()
        };
        const extension = filename.split('.').pop()?.toLowerCase();
        if (extension) {
            metadata.extension = extension;
        }
        metadata.checksum = await storage_1.documentStorageService.calculateFileHash(fileBuffer);
        if (mimeType === 'application/pdf') {
            Object.assign(metadata, this.extractPdfMetadata(fileBuffer));
        }
        else if (mimeType.includes('image/')) {
            Object.assign(metadata, this.extractImageMetadata(fileBuffer));
        }
        return metadata;
    }
    extractPdfMetadata(fileBuffer) {
        try {
            const text = fileBuffer.toString('latin1');
            const metadata = {};
            const titleMatch = text.match(/Title\s*\(([^)]*)\)/);
            const authorMatch = text.match(/Author\s*\(([^)]*)\)/);
            const creatorMatch = text.match(/Creator\s*\(([^)]*)\)/);
            const createdMatch = text.match(/CreationDate\s*\(([^)]*)\)/);
            if (titleMatch)
                metadata.title = titleMatch[1];
            if (authorMatch)
                metadata.author = authorMatch[1];
            if (creatorMatch)
                metadata.creator = creatorMatch[1];
            if (createdMatch)
                metadata.createdAt = new Date(createdMatch[1]);
            return metadata;
        }
        catch (error) {
            console.error('PDF metadata extraction failed:', error);
            return {};
        }
    }
    extractImageMetadata(fileBuffer) {
        try {
            const metadata = {};
            return metadata;
        }
        catch (error) {
            console.error('Image metadata extraction failed:', error);
            return {};
        }
    }
    async analyzeDocument(content, mimeType) {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        const charCount = content.length;
        const wordFreq = new Map();
        words.forEach(word => {
            const cleanWord = word.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
            if (cleanWord.length > 2) {
                wordFreq.set(cleanWord, (wordFreq.get(cleanWord) || 0) + 1);
            }
        });
        const keywords = Array.from(wordFreq.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word]) => word);
        const entities = this.extractEntities(content);
        const documentType = this.classifyDocumentType(content, mimeType);
        return {
            type: documentType,
            category: this.categorizeDocument(documentType),
            language: this.detectLanguage(content),
            wordCount: words.length,
            charCount,
            readabilityScore: this.calculateReadabilityScore(content),
            sentiment: this.analyzeSentiment(content),
            keywords,
            entities
        };
    }
    extractEntities(content) {
        const entities = [];
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        let match;
        while ((match = emailRegex.exec(content)) !== null) {
            entities.push({
                type: 'email',
                text: match[0],
                confidence: 0.9,
                start: match.index,
                end: match.index + match[0].length
            });
        }
        const phoneRegex = /(\+86\s?)?1[3-9]\d{9}/g;
        while ((match = phoneRegex.exec(content)) !== null) {
            entities.push({
                type: 'phone',
                text: match[0],
                confidence: 0.8,
                start: match.index,
                end: match.index + match[0].length
            });
        }
        const dateRegex = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g;
        while ((match = dateRegex.exec(content)) !== null) {
            entities.push({
                type: 'date',
                text: match[0],
                confidence: 0.7,
                start: match.index,
                end: match.index + match[0].length
            });
        }
        return entities;
    }
    classifyDocumentType(content, mimeType) {
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes('合同') || lowerContent.includes('协议') || lowerContent.includes('contract')) {
            return 'CONTRACT';
        }
        if (lowerContent.includes('起诉') || lowerContent.includes('诉讼') || lowerContent.includes('lawsuit')) {
            return 'LAWSUIT';
        }
        if (lowerContent.includes('证据') || lowerContent.includes('evidence')) {
            return 'EVIDENCE';
        }
        if (lowerContent.includes('判决') || lowerContent.includes('judgment')) {
            return 'JUDGMENT';
        }
        if (lowerContent.includes('委托') || lowerContent.includes('authorization')) {
            return 'AUTHORIZATION';
        }
        if (mimeType.includes('pdf'))
            return 'PDF_DOCUMENT';
        if (mimeType.includes('word'))
            return 'WORD_DOCUMENT';
        if (mimeType.includes('image'))
            return 'IMAGE_DOCUMENT';
        return 'OTHER';
    }
    categorizeDocument(type) {
        const categoryMap = {
            'CONTRACT': 'CONTRACT',
            'LAWSUIT': 'COURT_FILING',
            'EVIDENCE': 'EVIDENCE',
            'JUDGMENT': 'COURT_FILING',
            'AUTHORIZATION': 'LEGAL_BRIEF',
            'PDF_DOCUMENT': 'OTHER',
            'WORD_DOCUMENT': 'OTHER',
            'IMAGE_DOCUMENT': 'EVIDENCE',
            'OTHER': 'OTHER'
        };
        return categoryMap[type] || 'OTHER';
    }
    calculateReadabilityScore(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.split(/\s+/).filter(w => w.length > 0);
        if (sentences.length === 0 || words.length === 0)
            return 0;
        const avgWordsPerSentence = words.length / sentences.length;
        const avgCharsPerWord = content.length / words.length;
        const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * (avgCharsPerWord / 100));
        return Math.max(0, Math.min(100, score));
    }
    analyzeSentiment(content) {
        const positiveWords = ['好', '优秀', '成功', '满意', '同意', '批准', '通过', 'good', 'excellent', 'success', 'approved'];
        const negativeWords = ['坏', '失败', '拒绝', '反对', '问题', '错误', 'bad', 'failed', 'rejected', 'error'];
        const lowerContent = content.toLowerCase();
        let positiveScore = 0;
        let negativeScore = 0;
        positiveWords.forEach(word => {
            positiveScore += (lowerContent.match(new RegExp(word, 'g')) || []).length;
        });
        negativeWords.forEach(word => {
            negativeScore += (lowerContent.match(new RegExp(word, 'g')) || []).length;
        });
        if (positiveScore > negativeScore)
            return 'positive';
        if (negativeScore > positiveScore)
            return 'negative';
        return 'neutral';
    }
}
exports.DocumentMetadataService = DocumentMetadataService;
exports.documentMetadataService = new DocumentMetadataService(new client_1.PrismaClient());
//# sourceMappingURL=metadata.js.map
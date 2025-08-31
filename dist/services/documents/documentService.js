"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const documentRepository_1 = require("../repositories/documentRepository");
const storage_1 = require("../utils/storage");
const validation_1 = require("../utils/validation");
const ocrService_1 = require("../utils/document-processing/ocrService");
class DocumentService {
    constructor(prisma) {
        this.prisma = prisma;
        this.documentRepository = new documentRepository_1.DocumentRepository(prisma);
    }
    async uploadDocument(fileBuffer, originalName, mimeType, options) {
        try {
            if (!validation_1.DocumentValidator.validateMimeType(mimeType)) {
                throw new Error(`Unsupported MIME type: ${mimeType}`);
            }
            if (!validation_1.DocumentValidator.validateFileSize(fileBuffer.length)) {
                throw new Error('File size exceeds maximum limit');
            }
            if (!validation_1.DocumentValidator.validateFileExtension(originalName)) {
                throw new Error('Unsupported file extension');
            }
            if (options.tags && !validation_1.DocumentValidator.validateTags(options.tags)) {
                throw new Error('Invalid tags provided');
            }
            const sanitizedFilename = validation_1.DocumentValidator.sanitizeFilename(originalName);
            const checksum = storage_1.storageService.calculateChecksum(fileBuffer);
            const existingDocument = await this.documentRepository.findByChecksum(checksum);
            if (existingDocument) {
                return {
                    success: false,
                    filePath: '',
                    filename: '',
                    size: 0,
                    mimeType: '',
                    checksum: '',
                    error: 'Duplicate file detected'
                };
            }
            const storageResult = await storage_1.storageService.saveFile(fileBuffer, sanitizedFilename, {
                category: 'documents',
                subcategory: 'original'
            });
            const documentData = {
                filename: storageResult.filename,
                originalName: sanitizedFilename,
                path: storageResult.filePath,
                size: storageResult.size,
                mimeType,
                checksum,
                uploadedBy: options.uploadedBy,
                caseId: options.caseId,
                isConfidential: options.isConfidential || false,
                isTemplate: options.isTemplate || false,
                category: options.category,
                description: options.description,
                tags: options.tags || [],
                metadata: options.metadata
            };
            const document = await this.documentRepository.create(documentData);
            await this.documentRepository.createVersion({
                documentId: document.id,
                filePath: storageResult.filePath,
                fileSize: storageResult.size,
                checksum,
                changeDescription: 'Initial version'
            });
            let extractedText = '';
            if (await ocrService_1.ocrService.isFormatSupported(mimeType)) {
                try {
                    const ocrResult = await ocrService_1.ocrService.processDocument(storageResult.filePath, {
                        languages: ['eng', 'chi_sim'],
                        autoRotate: true,
                        preserveFormatting: true,
                    });
                    extractedText = ocrResult.text;
                    await this.documentRepository.update(document.id, {
                        extractedText,
                        metadata: {
                            ...options.metadata,
                            ocrConfidence: ocrResult.confidence,
                            ocrLanguage: ocrResult.language,
                            ocrProcessingTime: ocrResult.processingTime,
                        }
                    });
                }
                catch (error) {
                    console.error('OCR processing failed:', error);
                }
            }
            return {
                success: true,
                filePath: storageResult.filePath,
                filename: storageResult.filename,
                size: storageResult.size,
                mimeType,
                checksum,
                extractedText
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: '',
                filename: '',
                size: 0,
                mimeType: '',
                checksum: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getDocument(id) {
        return await this.documentRepository.findById(id);
    }
    async getDocuments(params) {
        return await this.documentRepository.findMany(params);
    }
    async updateDocument(id, data) {
        if (data.tags && !validation_1.DocumentValidator.validateTags(data.tags)) {
            throw new Error('Invalid tags provided');
        }
        const document = await this.documentRepository.update(id, data);
        return await this.getDocument(id);
    }
    async deleteDocument(id) {
        await this.documentRepository.delete(id);
    }
    async createVersion(documentId, fileBuffer, originalName, mimeType, changeDescription) {
        try {
            const document = await this.documentRepository.findById(documentId);
            if (!document) {
                throw new Error('Document not found');
            }
            if (!validation_1.DocumentValidator.validateMimeType(mimeType)) {
                throw new Error(`Unsupported MIME type: ${mimeType}`);
            }
            if (!validation_1.DocumentValidator.validateFileSize(fileBuffer.length)) {
                throw new Error('File size exceeds maximum limit');
            }
            const sanitizedFilename = validation_1.DocumentValidator.sanitizeFilename(originalName);
            const checksum = storage_1.storageService.calculateChecksum(fileBuffer);
            const storageResult = await storage_1.storageService.saveFile(fileBuffer, sanitizedFilename, {
                category: 'documents',
                subcategory: 'versions'
            });
            await this.documentRepository.createVersion({
                documentId,
                filePath: storageResult.filePath,
                fileSize: storageResult.size,
                checksum,
                changeDescription
            });
            await this.documentRepository.update(documentId, {
                version: (document.version || 1) + 1
            });
            return {
                success: true,
                filePath: storageResult.filePath,
                filename: storageResult.filename,
                size: storageResult.size,
                mimeType,
                checksum
            };
        }
        catch (error) {
            return {
                success: false,
                filePath: '',
                filename: '',
                size: 0,
                mimeType: '',
                checksum: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getDocumentVersions(documentId) {
        return await this.documentRepository.getVersions(documentId);
    }
    async getDocumentVersion(documentId, versionNumber) {
        return await this.documentRepository.getVersion(documentId, versionNumber);
    }
    async downloadDocument(id, versionNumber) {
        try {
            if (versionNumber) {
                const version = await this.documentRepository.getVersion(id, versionNumber);
                if (!version) {
                    return null;
                }
                const buffer = await storage_1.storageService.getFile(version.filePath);
                return {
                    buffer,
                    filename: `v${versionNumber}_${version.filePath.split('/').pop()}`,
                    mimeType: 'application/octet-stream'
                };
            }
            else {
                const document = await this.documentRepository.findById(id);
                if (!document) {
                    return null;
                }
                const buffer = await storage_1.storageService.getFile(document.path);
                return {
                    buffer,
                    filename: document.originalName,
                    mimeType: document.mimeType
                };
            }
        }
        catch (error) {
            return null;
        }
    }
    async searchDocuments(query, options) {
        return await this.documentRepository.search({
            query,
            ...options
        });
    }
    async getDocumentsByCase(caseId) {
        return await this.documentRepository.getDocumentsByCase(caseId);
    }
    async getDocumentsByUser(userId) {
        return await this.documentRepository.getDocumentsByUser(userId);
    }
    async getDocumentStats() {
        return await this.documentRepository.getStats();
    }
    async getStorageUsage() {
        return {
            totalUsed: 0,
            totalAvailable: 0,
            byCategory: {
                documents: { used: 0, fileCount: 0 },
                templates: { used: 0, fileCount: 0 },
                evidence: { used: 0, fileCount: 0 },
                temp: { used: 0, fileCount: 0 }
            }
        };
    }
    async reprocessOCR(documentId) {
        try {
            const document = await this.getDocument(documentId);
            if (!document) {
                return { success: false, error: 'Document not found' };
            }
            if (!(await ocrService_1.ocrService.isFormatSupported(document.mimeType))) {
                return { success: false, error: 'Unsupported format for OCR' };
            }
            const ocrResult = await ocrService_1.ocrService.processDocument(document.path, {
                languages: ['eng', 'chi_sim'],
                autoRotate: true,
                preserveFormatting: true,
            });
            await this.documentRepository.update(documentId, {
                extractedText: ocrResult.text,
                metadata: {
                    ...document.metadata,
                    ocrConfidence: ocrResult.confidence,
                    ocrLanguage: ocrResult.language,
                    ocrProcessingTime: ocrResult.processingTime,
                    lastOCRTimestamp: new Date().toISOString(),
                }
            });
            return {
                success: true,
                extractedText: ocrResult.text,
                confidence: ocrResult.confidence,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async searchByOCRText(query, options) {
        const { caseId, category, limit = 20, offset = 0 } = options || {};
        const where = {
            extractedText: {
                contains: query,
                mode: 'insensitive'
            }
        };
        if (caseId)
            where.caseId = caseId;
        if (category)
            where.category = category;
        return await this.prisma.document.findMany({
            where,
            include: {
                case: true,
                versions: {
                    orderBy: { versionNumber: 'desc' },
                    take: 1
                },
                _count: {
                    select: {
                        versions: true
                    }
                }
            },
            orderBy: { uploadedAt: 'desc' },
            take: limit,
            skip: offset
        });
    }
    async getOCRStats() {
        const documents = await this.prisma.document.findMany({
            where: {
                extractedText: {
                    not: ''
                }
            },
            select: {
                metadata: true,
                extractedText: true
            }
        });
        const totalDocuments = await this.prisma.document.count();
        const documentsWithOCR = documents.length;
        let totalConfidence = 0;
        let totalProcessingTime = 0;
        const languageCounts = {};
        const processingTimes = [];
        documents.forEach(doc => {
            const metadata = doc.metadata;
            if (metadata.ocrConfidence) {
                totalConfidence += metadata.ocrConfidence;
            }
            if (metadata.ocrProcessingTime) {
                processingTimes.push(metadata.ocrProcessingTime);
                totalProcessingTime += metadata.ocrProcessingTime;
            }
            if (metadata.ocrLanguage) {
                languageCounts[metadata.ocrLanguage] = (languageCounts[metadata.ocrLanguage] || 0) + 1;
            }
        });
        const averageConfidence = documentsWithOCR > 0 ? totalConfidence / documentsWithOCR : 0;
        return {
            totalDocuments,
            documentsWithOCR,
            averageConfidence,
            byLanguage: languageCounts,
            processingTimes: {
                min: processingTimes.length > 0 ? Math.min(...processingTimes) : 0,
                max: processingTimes.length > 0 ? Math.max(...processingTimes) : 0,
                average: processingTimes.length > 0 ? totalProcessingTime / processingTimes.length : 0,
            }
        };
    }
    async validateOCRQuality(documentId) {
        try {
            const document = await this.getDocument(documentId);
            if (!document || !document.extractedText) {
                return {
                    isValid: false,
                    issues: ['No OCR text available'],
                    suggestions: ['Run OCR processing first']
                };
            }
            const metadata = document.metadata;
            const confidence = metadata.ocrConfidence || 0;
            const ocrResult = {
                text: document.extractedText,
                confidence,
                language: metadata.ocrLanguage || 'eng',
                pages: [{
                        pageNumber: 1,
                        text: document.extractedText,
                        confidence,
                        blocks: []
                    }],
                processingTime: metadata.ocrProcessingTime || 0
            };
            return await ocrService_1.ocrService.validateOCRQuality(ocrResult);
        }
        catch (error) {
            return {
                isValid: false,
                issues: ['Validation failed'],
                suggestions: ['Try reprocessing OCR']
            };
        }
    }
}
exports.DocumentService = DocumentService;
//# sourceMappingURL=documentService.js.map
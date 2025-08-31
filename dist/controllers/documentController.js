"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentController = exports.DocumentController = void 0;
const documents_1 = require("../services/documents");
const documentRepository_1 = require("../repositories/documentRepository");
const client_1 = require("@prisma/client");
class DocumentController {
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.repository = new documentRepository_1.DocumentRepository(this.prisma);
    }
    async uploadDocument(req, res, next) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'NO_FILE',
                        message: 'No file uploaded'
                    }
                });
                return;
            }
            const { caseId, clientId, category, description, tags, isConfidential, isTemplate } = req.body;
            const validationResult = await documents_1.documentStorageService.validateFile(req.file.buffer, req.file.originalname, req.file.mimetype);
            if (!validationResult.isValid) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_FILE',
                        message: validationResult.error || 'File validation failed'
                    }
                });
                return;
            }
            const checksum = await documents_1.documentStorageService.calculateFileHash(req.file.buffer);
            const existingDocument = await this.repository.findByChecksum(checksum);
            if (existingDocument) {
                res.status(409).json({
                    success: false,
                    error: {
                        code: 'DUPLICATE_FILE',
                        message: 'A document with this content already exists',
                        data: {
                            documentId: existingDocument.id,
                            filename: existingDocument.originalName
                        }
                    }
                });
                return;
            }
            const storageResult = await documents_1.documentStorageService.uploadFile(req.file.buffer, req.file.originalname, {
                filename: req.file.originalname,
                mimeType: req.file.mimetype,
                category: 'documents',
                subcategory: 'original',
                metadata: {
                    uploadedBy: req.user.id,
                    caseId,
                    clientId,
                    category
                }
            });
            if (!storageResult.success) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 'STORAGE_ERROR',
                        message: storageResult.error || 'Failed to store file'
                    }
                });
                return;
            }
            const documentData = {
                filename: storageResult.filename,
                originalName: req.file.originalname,
                path: storageResult.filePath,
                size: storageResult.size,
                mimeType: req.file.mimetype,
                checksum,
                uploadedBy: req.user.id,
                caseId: caseId || undefined,
                clientId: clientId || undefined,
                category,
                description,
                tags: tags ? JSON.parse(tags) : undefined,
                isConfidential: isConfidential === 'true',
                isTemplate: isTemplate === 'true'
            };
            const document = await this.repository.create(documentData);
            documents_1.documentMetadataService.extractMetadata(document.id, storageResult.filePath, req.file.mimetype).catch(error => {
                console.error(`Metadata extraction failed for document ${document.id}:`, error);
            });
            documents_1.documentSearchService.indexDocument(document.id).catch(error => {
                console.error(`Search indexing failed for document ${document.id}:`, error);
            });
            res.status(201).json({
                success: true,
                data: {
                    id: document.id,
                    filename: document.filename,
                    originalName: document.originalName,
                    size: document.size,
                    mimeType: document.mimeType,
                    category: document.category,
                    uploadedAt: document.uploadedAt,
                    message: 'Document uploaded successfully'
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getDocument(req, res, next) {
        try {
            const { id } = req.params;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const document = await this.repository.findById(id);
            if (!document) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found'
                    }
                });
                return;
            }
            const hasAccess = await this.repository.isAccessible(id, req.user.id, req.user.role);
            if (!hasAccess) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Access denied to this document'
                    }
                });
                return;
            }
            res.json({
                success: true,
                data: document
            });
        }
        catch (error) {
            next(error);
        }
    }
    async downloadDocument(req, res, next) {
        try {
            const { id } = req.params;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const document = await this.repository.findById(id);
            if (!document) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found'
                    }
                });
                return;
            }
            const hasAccess = await this.repository.isAccessible(id, req.user.id, req.user.role);
            if (!hasAccess) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Access denied to this document'
                    }
                });
                return;
            }
            const downloadResult = await documents_1.documentStorageService.downloadFile(document.path);
            if (!downloadResult.success || !downloadResult.buffer) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 'DOWNLOAD_ERROR',
                        message: downloadResult.error || 'Failed to download file'
                    }
                });
                return;
            }
            res.setHeader('Content-Type', document.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
            res.setHeader('Content-Length', downloadResult.buffer.length.toString());
            res.send(downloadResult.buffer);
            console.log(`Document ${document.id} downloaded by user ${req.user.id}`);
        }
        catch (error) {
            next(error);
        }
    }
    async updateDocument(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const existingDocument = await this.repository.findById(id);
            if (!existingDocument) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found'
                    }
                });
                return;
            }
            if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only document owner or admin can update document'
                    }
                });
                return;
            }
            const updatedDocument = await this.repository.update(id, updateData);
            if (updateData.tags || updateData.category || updateData.description) {
                documents_1.documentSearchService.indexDocument(id).catch(error => {
                    console.error(`Search re-indexing failed for document ${id}:`, error);
                });
            }
            res.json({
                success: true,
                data: updatedDocument,
                message: 'Document updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteDocument(req, res, next) {
        try {
            const { id } = req.params;
            const { permanent = false } = req.query;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const existingDocument = await this.repository.findById(id);
            if (!existingDocument) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found'
                    }
                });
                return;
            }
            if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only document owner or admin can delete document'
                    }
                });
                return;
            }
            await this.repository.delete(id, permanent === true);
            documents_1.documentSearchService.removeFromIndex(id).catch(error => {
                console.error(`Search index removal failed for document ${id}:`, error);
            });
            res.json({
                success: true,
                message: permanent ? 'Document permanently deleted' : 'Document moved to trash'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async listDocuments(req, res, next) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const { caseId, clientId, category, status, tags, limit = 20, offset = 0, sortBy = 'uploadedAt', sortOrder = 'desc' } = req.query;
            const result = await this.repository.findMany({
                caseId: caseId,
                clientId: clientId,
                category: category,
                status: status,
                tags: tags ? JSON.parse(tags) : undefined,
                limit: parseInt(limit),
                offset: parseInt(offset),
                orderBy: {
                    field: sortBy,
                    order: sortOrder
                }
            });
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            next(error);
        }
    }
    async createVersion(req, res, next) {
        try {
            const { id } = req.params;
            const { file, changeDescription, isMajor = false } = req.body;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const existingDocument = await this.repository.findById(id);
            if (!existingDocument) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found'
                    }
                });
                return;
            }
            if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only document owner or admin can create versions'
                    }
                });
                return;
            }
            const versionResult = await documents_1.documentVersionService.createVersion({
                documentId: id,
                fileBuffer: Buffer.from(file, 'base64'),
                originalName: existingDocument.originalName,
                mimeType: existingDocument.mimeType,
                changeDescription,
                createdBy: req.user.id,
                isMajor: isMajor === true
            });
            if (!versionResult.success) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 'VERSION_ERROR',
                        message: versionResult.error || 'Failed to create version'
                    }
                });
                return;
            }
            res.json({
                success: true,
                data: {
                    versionNumber: versionResult.versionNumber,
                    filePath: versionResult.filePath,
                    message: 'Version created successfully'
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getVersions(req, res, next) {
        try {
            const { id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const hasAccess = await this.repository.isAccessible(id, req.user.id, req.user.role);
            if (!hasAccess) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Access denied to this document'
                    }
                });
                return;
            }
            const versions = await this.repository.getVersions(id, {
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            res.json({
                success: true,
                data: versions
            });
        }
        catch (error) {
            next(error);
        }
    }
    async searchDocuments(req, res, next) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const { query, caseId, clientId, category, tags, mimeType, language, dateFrom, dateTo, fuzzySearch = true, searchInContent = true, searchInMetadata = true, limit = 20, offset = 0, sortBy = 'relevance', sortOrder = 'desc' } = req.query;
            const searchOptions = {
                query: query,
                caseId: caseId,
                clientId: clientId,
                category: category,
                tags: tags ? JSON.parse(tags) : undefined,
                mimeType: mimeType,
                language: language,
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                dateTo: dateTo ? new Date(dateTo) : undefined,
                fuzzySearch: fuzzySearch === 'true',
                searchInContent: searchInContent === 'true',
                searchInMetadata: searchInMetadata === 'true',
                limit: parseInt(limit),
                offset: parseInt(offset),
                sortBy: sortBy,
                sortOrder: sortOrder
            };
            const results = await documents_1.documentSearchService.searchDocuments(searchOptions.query || '', searchOptions);
            res.json({
                success: true,
                data: {
                    results,
                    total: results.length,
                    query: searchOptions.query,
                    filters: searchOptions
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getSearchSuggestions(req, res, next) {
        try {
            const { query, limit = 10 } = req.query;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const suggestions = await documents_1.documentSearchService.getSearchSuggestions(query, parseInt(limit));
            res.json({
                success: true,
                data: suggestions
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getDocumentStats(req, res, next) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Insufficient permissions to access statistics'
                    }
                });
                return;
            }
            const stats = await this.repository.getDocumentStats();
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserDocuments(req, res, next) {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const { limit = 20, offset = 0, status } = req.query;
            const documents = await this.repository.getUserDocuments(req.user.id, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                status: status
            });
            res.json({
                success: true,
                data: documents
            });
        }
        catch (error) {
            next(error);
        }
    }
    async reprocessDocument(req, res, next) {
        try {
            const { id } = req.params;
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    }
                });
                return;
            }
            const existingDocument = await this.repository.findById(id);
            if (!existingDocument) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'Document not found'
                    }
                });
                return;
            }
            if (existingDocument.uploadedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCESS_DENIED',
                        message: 'Only document owner or admin can reprocess document'
                    }
                });
                return;
            }
            const result = await documents_1.documentMetadataService.extractMetadata(id, existingDocument.path, existingDocument.mimeType);
            if (!result.success) {
                res.status(500).json({
                    success: false,
                    error: {
                        code: 'PROCESSING_ERROR',
                        message: result.error || 'Failed to reprocess document'
                    }
                });
                return;
            }
            documents_1.documentSearchService.indexDocument(id).catch(error => {
                console.error(`Search re-indexing failed for document ${id}:`, error);
            });
            res.json({
                success: true,
                data: {
                    processingTime: result.processingTime,
                    extractedMetadata: result.extractedMetadata,
                    message: 'Document reprocessed successfully'
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static handleError(error, req, res, next) {
        console.error('Document Controller Error:', error);
        if (error.code === 'P2002') {
            res.status(409).json({
                success: false,
                error: {
                    code: 'DUPLICATE_ENTRY',
                    message: 'A duplicate entry was found'
                }
            });
            return;
        }
        if (error.code === 'P2025') {
            res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Requested resource not found'
                }
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An internal server error occurred'
            }
        });
    }
}
exports.DocumentController = DocumentController;
exports.documentController = new DocumentController();
//# sourceMappingURL=documentController.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = void 0;
const tsyringe_1 = require("tsyringe");
const document_1 = require("../services/document");
const audit_1 = require("../middleware/audit");
class DocumentController {
    constructor() {
        this.documentService = tsyringe_1.container.resolve(document_1.DocumentService);
    }
    async uploadDocument(req, res) {
        try {
            const userId = req.user.id;
            const { caseId, isConfidential } = req.body;
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    message: 'No file uploaded',
                });
                return;
            }
            if (!caseId) {
                res.status(400).json({
                    success: false,
                    message: 'Case ID is required',
                });
                return;
            }
            const result = await this.documentService.uploadDocument(req.file, caseId, userId, isConfidential === 'true' || isConfidential === true);
            await audit_1.AuditMiddleware.createAuditLog(req, 'DOCUMENT_UPLOAD', 'document', result.id, null, {
                filename: result.originalName,
                size: result.size,
                caseId: result.caseId,
                isConfidential: result.isConfidential
            });
            res.status(201).json({
                success: true,
                data: result,
                message: 'Document uploaded successfully',
            });
        }
        catch (error) {
            console.error('Upload document error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to upload document',
            });
        }
    }
    async getCaseDocuments(req, res) {
        try {
            const { caseId } = req.params;
            const userId = req.user.id;
            const documents = await this.documentService.getDocumentsByCaseId(caseId, userId);
            res.json({
                success: true,
                data: documents,
                message: 'Documents retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get case documents error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve documents',
            });
        }
    }
    async getDocumentById(req, res) {
        try {
            const { documentId } = req.params;
            const userId = req.user.id;
            const document = await this.documentService.getDocumentById(documentId, userId);
            res.json({
                success: true,
                data: document,
                message: 'Document retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get document error:', error);
            res.status(404).json({
                success: false,
                message: error instanceof Error ? error.message : 'Document not found',
            });
        }
    }
    async downloadDocument(req, res) {
        try {
            const { documentId } = req.params;
            const userId = req.user.id;
            const { filePath, filename, mimeType } = await this.documentService.downloadDocument(documentId, userId);
            res.download(filePath, filename, (err) => {
                if (err) {
                    console.error('Download error:', err);
                    res.status(500).json({
                        success: false,
                        message: 'Failed to download document',
                    });
                }
            });
            await audit_1.AuditMiddleware.createAuditLog(req, 'DOCUMENT_DOWNLOAD', 'document', documentId, null, { filename });
        }
        catch (error) {
            console.error('Download document error:', error);
            res.status(404).json({
                success: false,
                message: error instanceof Error ? error.message : 'Document not found',
            });
        }
    }
    async updateDocument(req, res) {
        try {
            const { documentId } = req.params;
            const { isConfidential } = req.body;
            const userId = req.user.id;
            const result = await this.documentService.updateDocument(documentId, { isConfidential }, userId);
            await audit_1.AuditMiddleware.createAuditLog(req, 'DOCUMENT_UPDATE', 'document', documentId, null, { isConfidential: result.isConfidential });
            res.json({
                success: true,
                data: result,
                message: 'Document updated successfully',
            });
        }
        catch (error) {
            console.error('Update document error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to update document',
            });
        }
    }
    async deleteDocument(req, res) {
        try {
            const { documentId } = req.params;
            const userId = req.user.id;
            await this.documentService.deleteDocument(documentId, userId);
            await audit_1.AuditMiddleware.createAuditLog(req, 'DOCUMENT_DELETE', 'document', documentId, null, { deletedBy: userId });
            res.json({
                success: true,
                message: 'Document deleted successfully',
            });
        }
        catch (error) {
            console.error('Delete document error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to delete document',
            });
        }
    }
    async grantDocumentAccess(req, res) {
        try {
            const { documentId } = req.params;
            const { userId } = req.body;
            const grantedBy = req.user.id;
            await this.documentService.grantDocumentAccess(documentId, userId, grantedBy);
            await audit_1.AuditMiddleware.createAuditLog(req, 'DOCUMENT_ACCESS_GRANT', 'document_access', undefined, null, { documentId, userId, grantedBy });
            res.json({
                success: true,
                message: 'Document access granted successfully',
            });
        }
        catch (error) {
            console.error('Grant document access error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to grant document access',
            });
        }
    }
    async revokeDocumentAccess(req, res) {
        try {
            const { documentId } = req.params;
            const { userId } = req.body;
            const revokedBy = req.user.id;
            await this.documentService.revokeDocumentAccess(documentId, userId, revokedBy);
            await audit_1.AuditMiddleware.createAuditLog(req, 'DOCUMENT_ACCESS_REVOKE', 'document_access', undefined, null, { documentId, userId, revokedBy });
            res.json({
                success: true,
                message: 'Document access revoked successfully',
            });
        }
        catch (error) {
            console.error('Revoke document access error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to revoke document access',
            });
        }
    }
    async getDocumentAccess(req, res) {
        try {
            const { documentId } = req.params;
            const userId = req.user.id;
            const accessList = await this.documentService.getDocumentAccess(documentId, userId);
            res.json({
                success: true,
                data: accessList,
                message: 'Document access list retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get document access error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve document access',
            });
        }
    }
    async searchDocuments(req, res) {
        try {
            const { q: query, caseId } = req.query;
            const userId = req.user.id;
            if (!query || typeof query !== 'string') {
                res.status(400).json({
                    success: false,
                    message: 'Search query is required',
                });
                return;
            }
            const documents = await this.documentService.searchDocuments(userId, query, caseId);
            res.json({
                success: true,
                data: documents,
                message: 'Documents searched successfully',
            });
        }
        catch (error) {
            console.error('Search documents error:', error);
            res.status(400).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to search documents',
            });
        }
    }
    async getDocumentStats(req, res) {
        try {
            const userId = req.user.id;
            const stats = await this.documentService.getDocumentStats(userId);
            res.json({
                success: true,
                data: stats,
                message: 'Document statistics retrieved successfully',
            });
        }
        catch (error) {
            console.error('Get document stats error:', error);
            res.status(500).json({
                success: false,
                message: error instanceof Error ? error.message : 'Failed to retrieve document statistics',
            });
        }
    }
}
exports.DocumentController = DocumentController;
//# sourceMappingURL=document.js.map
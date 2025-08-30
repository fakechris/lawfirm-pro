"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const document_1 = require("../controllers/document");
const auth_1 = require("../middleware/auth");
const audit_1 = require("../middleware/audit");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
const documentController = new document_1.DocumentController();
router.post('/upload', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, upload_1.uploadSingle, upload_1.handleUploadError, audit_1.AuditMiddleware.logUserAction('CLIENT_DOCUMENT_UPLOAD', 'client_document'), documentController.uploadDocument.bind(documentController));
router.get('/case/:caseId', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, documentController.getCaseDocuments.bind(documentController));
router.get('/:documentId', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, documentController.getDocumentById.bind(documentController));
router.get('/:documentId/download', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, audit_1.AuditMiddleware.logUserAction('CLIENT_DOCUMENT_DOWNLOAD', 'client_document'), documentController.downloadDocument.bind(documentController));
router.patch('/:documentId', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, audit_1.AuditMiddleware.logDataModification('CLIENT_DOCUMENT_UPDATE', 'client_document'), documentController.updateDocument.bind(documentController));
router.delete('/:documentId', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, audit_1.AuditMiddleware.logUserAction('CLIENT_DOCUMENT_DELETE', 'client_document'), documentController.deleteDocument.bind(documentController));
router.get('/search', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, documentController.searchDocuments.bind(documentController));
router.get('/stats', auth_1.AuthMiddleware.authenticate, auth_1.AuthMiddleware.clientOnly, documentController.getDocumentStats.bind(documentController));
exports.default = router;
//# sourceMappingURL=document.js.map
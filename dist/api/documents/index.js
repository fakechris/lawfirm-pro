"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const documentService_1 = require("../../services/documents/documentService");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../../middleware/auth");
const validation_1 = require("../../utils/validation");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});
const prisma = new client_1.PrismaClient();
const documentService = new documentService_1.DocumentService(prisma);
router.use(auth_1.authMiddleware);
const uploadDocumentSchema = zod_1.z.object({
    caseId: zod_1.z.string().optional(),
    isConfidential: zod_1.z.boolean().optional().default(false),
    isTemplate: zod_1.z.boolean().optional().default(false),
    category: zod_1.z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
});
const updateDocumentSchema = zod_1.z.object({
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    isConfidential: zod_1.z.boolean().optional(),
    category: zod_1.z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional()
});
const searchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1),
    caseId: zod_1.z.string().optional(),
    category: zod_1.z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.number().min(0).optional().default(0)
});
const shareDocumentSchema = zod_1.z.object({
    sharedWith: zod_1.z.string(),
    permission: zod_1.z.enum(['VIEW', 'COMMENT', 'EDIT', 'DOWNLOAD']),
    expiresAt: zod_1.z.date().optional(),
    message: zod_1.z.string().optional()
});
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const validation = uploadDocumentSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Invalid input', details: validation.error.issues });
        }
        const { user } = req;
        const file = req.file;
        const result = await documentService.uploadDocument(file.buffer, file.originalname, file.mimetype, {
            ...validation.data,
            uploadedBy: user.id
        });
        if (result.success) {
            res.status(201).json({
                message: 'Document uploaded successfully',
                document: result
            });
        }
        else {
            res.status(400).json({ error: result.error });
        }
    }
    catch (error) {
        console.error('Document upload failed:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const hasAccess = await checkDocumentAccess(req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({ document });
    }
    catch (error) {
        console.error('Failed to get document:', error);
        res.status(500).json({ error: 'Failed to get document' });
    }
});
router.put('/:id', (0, validation_1.validateRequest)(updateDocumentSchema), async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const user = req.user;
        if (document.uploadedBy !== user.id && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const updatedDocument = await documentService.updateDocument(req.params.id, req.body);
        res.json({ document: updatedDocument });
    }
    catch (error) {
        console.error('Failed to update document:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const user = req.user;
        if (document.uploadedBy !== user.id && user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }
        await documentService.deleteDocument(req.params.id);
        res.json({ message: 'Document deleted successfully' });
    }
    catch (error) {
        console.error('Failed to delete document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});
router.get('/', (0, validation_1.validateRequest)(zod_1.z.object({
    caseId: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    status: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.number().min(0).optional().default(0)
})), async (req, res) => {
    try {
        const documents = await documentService.getDocuments(req.query);
        res.json({ documents });
    }
    catch (error) {
        console.error('Failed to list documents:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});
router.post('/search', (0, validation_1.validateRequest)(searchSchema), async (req, res) => {
    try {
        const results = await documentService.searchDocuments(req.body.query, req.body);
        res.json({ results });
    }
    catch (error) {
        console.error('Document search failed:', error);
        res.status(500).json({ error: 'Failed to search documents' });
    }
});
router.post('/search-ocr', (0, validation_1.validateRequest)(searchSchema), async (req, res) => {
    try {
        const results = await documentService.searchByOCRText(req.body.query, req.body);
        res.json({ results });
    }
    catch (error) {
        console.error('OCR search failed:', error);
        res.status(500).json({ error: 'Failed to search OCR text' });
    }
});
router.post('/:id/versions', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (document.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const result = await documentService.createVersion(req.params.id, req.file.buffer, req.file.originalname, req.file.mimetype, req.body.changeDescription);
        if (result.success) {
            res.status(201).json({
                message: 'Document version created successfully',
                version: result
            });
        }
        else {
            res.status(400).json({ error: result.error });
        }
    }
    catch (error) {
        console.error('Failed to create document version:', error);
        res.status(500).json({ error: 'Failed to create document version' });
    }
});
router.get('/:id/versions', async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const hasAccess = await checkDocumentAccess(req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const versions = await documentService.getDocumentVersions(req.params.id);
        res.json({ versions });
    }
    catch (error) {
        console.error('Failed to get document versions:', error);
        res.status(500).json({ error: 'Failed to get document versions' });
    }
});
router.get('/:id/download', async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const hasAccess = await checkDocumentAccess(req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const versionNumber = req.query.version ? parseInt(req.query.version) : undefined;
        const downloadResult = await documentService.downloadDocument(req.params.id, versionNumber);
        if (!downloadResult) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.setHeader('Content-Type', downloadResult.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.filename}"`);
        res.send(downloadResult.buffer);
    }
    catch (error) {
        console.error('Failed to download document:', error);
        res.status(500).json({ error: 'Failed to download document' });
    }
});
router.post('/:id/reprocess-ocr', async (req, res) => {
    try {
        const result = await documentService.reprocessOCR(req.params.id);
        if (result.success) {
            res.json({ message: 'OCR reprocessing completed', result });
        }
        else {
            res.status(400).json({ error: result.error });
        }
    }
    catch (error) {
        console.error('Failed to reprocess OCR:', error);
        res.status(500).json({ error: 'Failed to reprocess OCR' });
    }
});
router.get('/:id/ocr-quality', async (req, res) => {
    try {
        const quality = await documentService.validateOCRQuality(req.params.id);
        res.json(quality);
    }
    catch (error) {
        console.error('Failed to validate OCR quality:', error);
        res.status(500).json({ error: 'Failed to validate OCR quality' });
    }
});
router.post('/:id/share', (0, validation_1.validateRequest)(shareDocumentSchema), async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (document.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const { sharedWith, permission, expiresAt, message } = req.body;
        const share = await prisma.documentShare.create({
            data: {
                documentId: req.params.id,
                sharedBy: req.user.id,
                sharedWith,
                permission,
                expiresAt,
                message,
                accessKey: Math.random().toString(36).substring(2, 15)
            }
        });
        res.json({
            message: 'Document shared successfully',
            share: {
                id: share.id,
                accessKey: share.accessKey,
                permission: share.permission,
                expiresAt: share.expiresAt
            }
        });
    }
    catch (error) {
        console.error('Failed to share document:', error);
        res.status(500).json({ error: 'Failed to share document' });
    }
});
router.get('/:id/shares', async (req, res) => {
    try {
        const document = await documentService.getDocument(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (document.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const shares = await prisma.documentShare.findMany({
            where: { documentId: req.params.id },
            include: {
                sharedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                sharedWithUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ shares });
    }
    catch (error) {
        console.error('Failed to get document shares:', error);
        res.status(500).json({ error: 'Failed to get document shares' });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const stats = await documentService.getDocumentStats();
        const ocrStats = await documentService.getOCRStats();
        res.json({
            documentStats: stats,
            ocrStats
        });
    }
    catch (error) {
        console.error('Failed to get document statistics:', error);
        res.status(500).json({ error: 'Failed to get document statistics' });
    }
});
async function checkDocumentAccess(documentId, userId) {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
            uploadedBy: true,
            caseId: true
        }
    });
    if (!document)
        return false;
    if (document.uploadedBy === userId)
        return true;
    if (document.caseId) {
        const caseAccess = await prisma.case.findFirst({
            where: {
                id: document.caseId,
                OR: [
                    { clientId: userId },
                    { attorneyId: userId }
                ]
            }
        });
        if (caseAccess)
            return true;
    }
    const sharedAccess = await prisma.documentShare.findFirst({
        where: {
            documentId,
            sharedWith: userId,
            expiresAt: {
                gt: new Date()
            }
        }
    });
    return !!sharedAccess;
}
exports.default = router;
//# sourceMappingURL=index.js.map
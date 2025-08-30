"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const createDocumentSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1, 'Filename is required'),
    originalName: zod_1.z.string().min(1, 'Original name is required'),
    path: zod_1.z.string().min(1, 'Path is required'),
    size: zod_1.z.number().min(0, 'Size must be non-negative'),
    mimeType: zod_1.z.string().min(1, 'MIME type is required'),
    caseId: zod_1.z.string().optional(),
    isConfidential: zod_1.z.boolean().optional().default(false),
    category: zod_1.z.enum([
        'LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE',
        'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER'
    ]).optional(),
    status: zod_1.z.enum(['ACTIVE', 'ARCHIVED', 'DELETED', 'UNDER_REVIEW']).optional().default('ACTIVE'),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const updateDocumentSchema = zod_1.z.object({
    filename: zod_1.z.string().min(1, 'Filename is required').optional(),
    originalName: zod_1.z.string().min(1, 'Original name is required').optional(),
    path: zod_1.z.string().min(1, 'Path is required').optional(),
    size: zod_1.z.number().min(0, 'Size must be non-negative').optional(),
    mimeType: zod_1.z.string().min(1, 'MIME type is required').optional(),
    caseId: zod_1.z.string().optional(),
    isConfidential: zod_1.z.boolean().optional(),
    category: zod_1.z.enum([
        'LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE',
        'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER'
    ]).optional(),
    status: zod_1.z.enum(['ACTIVE', 'ARCHIVED', 'DELETED', 'UNDER_REVIEW']).optional(),
    description: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
router.get('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const db = new database_1.Database();
    await db.connect();
    let documents;
    if (req.user.role === 'ADMIN') {
        documents = await db.client.document.findMany({
            include: {
                case: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }
    else {
        const userCases = await db.client.case.findMany({
            where: {
                OR: [
                    { attorney: { userId: req.user.id } },
                    { client: { userId: req.user.id } },
                ],
            },
            select: { id: true },
        });
        const caseIds = userCases.map(c => c.id);
        documents = await db.client.document.findMany({
            where: {
                OR: [
                    { uploadedBy: req.user.id },
                    { caseId: { in: caseIds } },
                ],
            },
            include: {
                case: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }
    await db.disconnect();
    res.json({
        success: true,
        data: { documents },
    });
}));
router.get('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const document = await db.client.document.findUnique({
        where: { id },
        include: {
            case: {
                include: {
                    attorney: {
                        select: { userId: true },
                    },
                    client: {
                        select: { userId: true },
                    },
                },
            },
        },
    });
    await db.disconnect();
    if (!document) {
        throw (0, errorHandler_1.createError)('Document not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        document.uploadedBy === req.user.id ||
        (document.case && ((req.user.role === 'ATTORNEY' && document.case.attorney.userId === req.user.id) ||
            (req.user.role === 'CLIENT' && document.case.client.userId === req.user.id)));
    if (!hasAccess) {
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    res.json({
        success: true,
        data: { document },
    });
}));
router.post('/', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const validatedData = createDocumentSchema.parse(req.body);
    const db = new database_1.Database();
    await db.connect();
    if (validatedData.caseId) {
        const caseRecord = await db.client.case.findUnique({
            where: { id: validatedData.caseId },
            include: {
                attorney: {
                    select: { userId: true },
                },
                client: {
                    select: { userId: true },
                },
            },
        });
        if (!caseRecord) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Case not found', 404);
        }
        const hasAccess = req.user.role === 'ADMIN' ||
            (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
            (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);
        if (!hasAccess) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Access denied', 403);
        }
    }
    const document = await db.client.document.create({
        data: {
            ...validatedData,
            uploadedBy: req.user.id,
        },
        include: {
            case: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
    });
    await db.disconnect();
    res.status(201).json({
        success: true,
        message: 'Document created successfully',
        data: { document },
    });
}));
router.put('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const validatedData = updateDocumentSchema.parse(req.body);
    const db = new database_1.Database();
    await db.connect();
    const existingDocument = await db.client.document.findUnique({
        where: { id },
        include: {
            case: {
                include: {
                    attorney: {
                        select: { userId: true },
                    },
                    client: {
                        select: { userId: true },
                    },
                },
            },
        },
    });
    if (!existingDocument) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Document not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        existingDocument.uploadedBy === req.user.id ||
        (existingDocument.case && ((req.user.role === 'ATTORNEY' && existingDocument.case.attorney.userId === req.user.id) ||
            (req.user.role === 'CLIENT' && existingDocument.case.client.userId === req.user.id)));
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    if (validatedData.caseId) {
        const caseRecord = await db.client.case.findUnique({
            where: { id: validatedData.caseId },
            include: {
                attorney: {
                    select: { userId: true },
                },
                client: {
                    select: { userId: true },
                },
            },
        });
        if (!caseRecord) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Case not found', 404);
        }
        const caseAccess = req.user.role === 'ADMIN' ||
            (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
            (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);
        if (!caseAccess) {
            await db.disconnect();
            throw (0, errorHandler_1.createError)('Access denied to new case', 403);
        }
    }
    const document = await db.client.document.update({
        where: { id },
        data: validatedData,
        include: {
            case: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'Document updated successfully',
        data: { document },
    });
}));
router.delete('/:id', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const existingDocument = await db.client.document.findUnique({
        where: { id },
        include: {
            case: {
                include: {
                    attorney: {
                        select: { userId: true },
                    },
                },
            },
        },
    });
    if (!existingDocument) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Document not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        existingDocument.uploadedBy === req.user.id ||
        (existingDocument.case && req.user.role === 'ATTORNEY' && existingDocument.case.attorney.userId === req.user.id);
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    await db.client.document.delete({
        where: { id },
    });
    await db.disconnect();
    res.json({
        success: true,
        message: 'Document deleted successfully',
    });
}));
router.get('/case/:caseId', auth_1.authenticate, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { caseId } = req.params;
    const db = new database_1.Database();
    await db.connect();
    const caseRecord = await db.client.case.findUnique({
        where: { id: caseId },
        include: {
            attorney: {
                select: { userId: true },
            },
            client: {
                select: { userId: true },
            },
        },
    });
    if (!caseRecord) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Case not found', 404);
    }
    const hasAccess = req.user.role === 'ADMIN' ||
        (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
        (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);
    if (!hasAccess) {
        await db.disconnect();
        throw (0, errorHandler_1.createError)('Access denied', 403);
    }
    const documents = await db.client.document.findMany({
        where: { caseId },
        include: {
            case: {
                select: {
                    id: true,
                    title: true,
                },
            },
        },
        orderBy: { uploadedAt: 'desc' },
    });
    await db.disconnect();
    res.json({
        success: true,
        data: { documents },
    });
}));
exports.default = router;
//# sourceMappingURL=documents.js.map
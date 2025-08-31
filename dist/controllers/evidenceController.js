"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evidenceController = exports.EvidenceController = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const errorHandler_1 = require("../middleware/errorHandler");
const documents_1 = require("../services/documents");
const prisma = new client_1.PrismaClient();
const createEvidenceSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Evidence title is required'),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['PHYSICAL', 'DIGITAL', 'DOCUMENT', 'TESTIMONY', 'EXPERT_REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'OTHER']),
    caseId: zod_1.z.string().min(1, 'Case ID is required'),
    collectedBy: zod_1.z.string().optional(),
    collectedAt: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    chainOfCustody: zod_1.z.array(zod_1.z.object({
        transferredTo: zod_1.z.string(),
        transferredBy: zod_1.z.string(),
        transferDate: zod_1.z.string(),
        reason: zod_1.z.string(),
        notes: zod_1.z.string().optional()
    })).optional().default([]),
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional().default({}),
    isConfidential: zod_1.z.boolean().optional().default(false)
});
const updateEvidenceSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Evidence title is required').optional(),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum(['PHYSICAL', 'DIGITAL', 'DOCUMENT', 'TESTIMONY', 'EXPERT_REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'OTHER']).optional(),
    collectedBy: zod_1.z.string().optional(),
    collectedAt: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    isConfidential: zod_1.z.boolean().optional(),
    status: zod_1.z.enum(['ACTIVE', 'ARCHIVED', 'DESTROYED', 'RELEASED']).optional()
});
const evidenceQuerySchema = zod_1.z.object({
    caseId: zod_1.z.string().optional(),
    type: zod_1.z.enum(['PHYSICAL', 'DIGITAL', 'DOCUMENT', 'TESTIMONY', 'EXPERT_REPORT', 'PHOTO', 'VIDEO', 'AUDIO', 'OTHER']).optional(),
    status: zod_1.z.enum(['ACTIVE', 'ARCHIVED', 'DESTROYED', 'RELEASED']).optional(),
    collectedBy: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    search: zod_1.z.string().optional(),
    isConfidential: zod_1.z.boolean().optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.number().min(0).optional().default(0),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'title', 'collectedAt']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc')
});
const chainOfCustodySchema = zod_1.z.object({
    transferredTo: zod_1.z.string().min(1, 'Transfer recipient is required'),
    transferDate: zod_1.z.string().min(1, 'Transfer date is required'),
    reason: zod_1.z.string().min(1, 'Transfer reason is required'),
    notes: zod_1.z.string().optional()
});
class EvidenceController {
    async createEvidence(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const validatedData = createEvidenceSchema.parse(req.body);
            const caseRecord = await prisma.case.findUnique({
                where: { id: validatedData.caseId },
                include: {
                    attorney: {
                        select: { userId: true }
                    },
                    client: {
                        select: { userId: true }
                    }
                }
            });
            if (!caseRecord) {
                throw (0, errorHandler_1.createError)('Case not found', 404);
            }
            const hasAccess = req.user.role === 'ADMIN' ||
                (req.user.role === 'ATTORNEY' && caseRecord.attorney.userId === req.user.id) ||
                (req.user.role === 'CLIENT' && caseRecord.client.userId === req.user.id);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to add evidence to this case', 403);
            }
            let filePath = null;
            let fileSize = 0;
            let mimeType = null;
            let checksum = null;
            if (req.file) {
                const validationResult = await documents_1.documentStorageService.validateFile(req.file.buffer, req.file.originalname, req.file.mimetype);
                if (!validationResult.isValid) {
                    throw (0, errorHandler_1.createError)(validationResult.error || 'File validation failed', 400);
                }
                const storageResult = await documents_1.documentStorageService.uploadFile(req.file.buffer, req.file.originalname, {
                    filename: req.file.originalname,
                    mimeType: req.file.mimetype,
                    category: 'evidence',
                    subcategory: validatedData.type.toLowerCase(),
                    metadata: {
                        caseId: validatedData.caseId,
                        evidenceType: validatedData.type,
                        uploadedBy: req.user.id
                    }
                });
                if (!storageResult.success) {
                    throw (0, errorHandler_1.createError)(storageResult.error || 'Failed to store evidence file', 500);
                }
                filePath = storageResult.filePath;
                fileSize = storageResult.size;
                mimeType = req.file.mimetype;
                checksum = await documents_1.documentStorageService.calculateFileHash(req.file.buffer);
            }
            const evidenceData = {
                ...validatedData,
                filePath,
                fileSize,
                mimeType,
                checksum,
                collectedBy: validatedData.collectedBy || req.user.id,
                collectedAt: validatedData.collectedAt ? new Date(validatedData.collectedAt) : new Date(),
                createdBy: req.user.id
            };
            const evidence = await prisma.evidenceItem.create({
                data: evidenceData,
                include: {
                    case: {
                        select: {
                            id: true,
                            title: true,
                            caseNumber: true
                        }
                    },
                    collectedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            res.status(201).json({
                success: true,
                data: evidence,
                message: 'Evidence created successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getEvidence(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const evidence = await prisma.evidenceItem.findUnique({
                where: { id },
                include: {
                    case: {
                        select: {
                            id: true,
                            title: true,
                            caseNumber: true
                        }
                    },
                    collectedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    chainOfCustody: {
                        orderBy: { transferDate: 'desc' },
                        include: {
                            transferredToUser: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            },
                            transferredByUser: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
            if (!evidence) {
                throw (0, errorHandler_1.createError)('Evidence not found', 404);
            }
            const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to this evidence', 403);
            }
            res.json({
                success: true,
                data: evidence
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateEvidence(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const validatedData = updateEvidenceSchema.parse(req.body);
            const existingEvidence = await prisma.evidenceItem.findUnique({
                where: { id },
                include: {
                    case: {
                        include: {
                            attorney: {
                                select: { userId: true }
                            },
                            client: {
                                select: { userId: true }
                            }
                        }
                    }
                }
            });
            if (!existingEvidence) {
                throw (0, errorHandler_1.createError)('Evidence not found', 404);
            }
            const hasAccess = await this.checkEvidenceAccess(existingEvidence, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to update this evidence', 403);
            }
            const updatedEvidence = await prisma.evidenceItem.update({
                where: { id },
                data: validatedData,
                include: {
                    case: {
                        select: {
                            id: true,
                            title: true,
                            caseNumber: true
                        }
                    },
                    collectedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            res.json({
                success: true,
                data: updatedEvidence,
                message: 'Evidence updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteEvidence(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const existingEvidence = await prisma.evidenceItem.findUnique({
                where: { id },
                include: {
                    case: {
                        include: {
                            attorney: {
                                select: { userId: true }
                            }
                        }
                    }
                }
            });
            if (!existingEvidence) {
                throw (0, errorHandler_1.createError)('Evidence not found', 404);
            }
            const hasAccess = req.user.role === 'ADMIN' ||
                (req.user.role === 'ATTORNEY' && existingEvidence.case.attorney.userId === req.user.id) ||
                existingEvidence.createdBy === req.user.id;
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to delete this evidence', 403);
            }
            if (existingEvidence.filePath) {
                await documents_1.documentStorageService.deleteFile(existingEvidence.filePath);
            }
            await prisma.evidenceItem.delete({
                where: { id }
            });
            res.json({
                success: true,
                message: 'Evidence deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async searchEvidence(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const validatedQuery = evidenceQuerySchema.parse(req.query);
            const where = {};
            if (validatedQuery.caseId) {
                where.caseId = validatedQuery.caseId;
            }
            if (validatedQuery.type) {
                where.type = validatedQuery.type;
            }
            if (validatedQuery.status) {
                where.status = validatedQuery.status;
            }
            if (validatedQuery.collectedBy) {
                where.collectedBy = validatedQuery.collectedBy;
            }
            if (validatedQuery.isConfidential !== undefined) {
                where.isConfidential = validatedQuery.isConfidential;
            }
            if (validatedQuery.tags && validatedQuery.tags.length > 0) {
                where.tags = {
                    hasSome: validatedQuery.tags
                };
            }
            if (validatedQuery.search) {
                where.OR = [
                    { title: { contains: validatedQuery.search, mode: 'insensitive' } },
                    { description: { contains: validatedQuery.search, mode: 'insensitive' } },
                    { location: { contains: validatedQuery.search, mode: 'insensitive' } }
                ];
            }
            const userCases = await this.getUserAccessibleCases(req.user.id, req.user.role);
            const accessibleCaseIds = userCases.map(c => c.id);
            if (!where.caseId) {
                where.caseId = { in: accessibleCaseIds };
            }
            else if (!accessibleCaseIds.includes(where.caseId)) {
                throw (0, errorHandler_1.createError)('Access denied to search evidence in this case', 403);
            }
            const [evidence, total] = await Promise.all([
                prisma.evidenceItem.findMany({
                    where,
                    include: {
                        case: {
                            select: {
                                id: true,
                                title: true,
                                caseNumber: true
                            }
                        },
                        collectedByUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },
                        createdByUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        }
                    },
                    orderBy: {
                        [validatedQuery.sortBy]: validatedQuery.sortOrder
                    },
                    skip: validatedQuery.offset,
                    take: validatedQuery.limit
                }),
                prisma.evidenceItem.count({ where })
            ]);
            res.json({
                success: true,
                data: {
                    evidence,
                    pagination: {
                        total,
                        limit: validatedQuery.limit,
                        offset: validatedQuery.offset,
                        totalPages: Math.ceil(total / validatedQuery.limit)
                    }
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async addToChainOfCustody(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const validatedData = chainOfCustodySchema.parse(req.body);
            const evidence = await prisma.evidenceItem.findUnique({
                where: { id },
                include: {
                    case: {
                        include: {
                            attorney: {
                                select: { userId: true }
                            }
                        }
                    }
                }
            });
            if (!evidence) {
                throw (0, errorHandler_1.createError)('Evidence not found', 404);
            }
            const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to modify this evidence', 403);
            }
            const chainEntry = await prisma.evidenceChainOfCustody.create({
                data: {
                    evidenceId: id,
                    transferredTo: validatedData.transferredTo,
                    transferredBy: req.user.id,
                    transferDate: new Date(validatedData.transferDate),
                    reason: validatedData.reason,
                    notes: validatedData.notes
                },
                include: {
                    transferredToUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    transferredByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            res.status(201).json({
                success: true,
                data: chainEntry,
                message: 'Chain of custody entry added successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getChainOfCustody(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const evidence = await prisma.evidenceItem.findUnique({
                where: { id }
            });
            if (!evidence) {
                throw (0, errorHandler_1.createError)('Evidence not found', 404);
            }
            const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to view this evidence', 403);
            }
            const chainOfCustody = await prisma.evidenceChainOfCustody.findMany({
                where: { evidenceId: id },
                orderBy: { transferDate: 'desc' },
                include: {
                    transferredToUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    transferredByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            res.json({
                success: true,
                data: chainOfCustody
            });
        }
        catch (error) {
            next(error);
        }
    }
    async downloadEvidence(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const evidence = await prisma.evidenceItem.findUnique({
                where: { id }
            });
            if (!evidence) {
                throw (0, errorHandler_1.createError)('Evidence not found', 404);
            }
            if (!evidence.filePath) {
                throw (0, errorHandler_1.createError)('No file associated with this evidence', 404);
            }
            const hasAccess = await this.checkEvidenceAccess(evidence, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to download this evidence', 403);
            }
            const downloadResult = await documents_1.documentStorageService.downloadFile(evidence.filePath);
            if (!downloadResult.success || !downloadResult.buffer) {
                throw (0, errorHandler_1.createError)(downloadResult.error || 'Failed to download evidence file', 500);
            }
            res.setHeader('Content-Type', evidence.mimeType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${evidence.title}.${evidence.filePath.split('.').pop()}"`);
            res.setHeader('Content-Length', downloadResult.buffer.length.toString());
            res.send(downloadResult.buffer);
            console.log(`Evidence ${evidence.id} downloaded by user ${req.user.id}`);
        }
        catch (error) {
            next(error);
        }
    }
    async checkEvidenceAccess(evidence, userId, userRole) {
        if (userRole === 'ADMIN') {
            return true;
        }
        const caseAccess = await prisma.case.findFirst({
            where: {
                id: evidence.caseId,
                OR: [
                    { attorney: { userId } },
                    { client: { userId } }
                ]
            }
        });
        return !!caseAccess;
    }
    async getUserAccessibleCases(userId, userRole) {
        if (userRole === 'ADMIN') {
            return await prisma.case.findMany({
                select: { id: true }
            });
        }
        return await prisma.case.findMany({
            where: {
                OR: [
                    { attorney: { userId } },
                    { client: { userId } }
                ]
            },
            select: { id: true }
        });
    }
}
exports.EvidenceController = EvidenceController;
exports.evidenceController = new EvidenceController();
//# sourceMappingURL=evidenceController.js.map
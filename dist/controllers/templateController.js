"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateController = exports.TemplateController = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const errorHandler_1 = require("../middleware/errorHandler");
const documents_1 = require("../services/documents");
const prisma = new client_1.PrismaClient();
const createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Template name is required'),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
    file: zod_1.z.any().refine((file) => file !== undefined, 'Template file is required'),
    variableSchema: zod_1.z.record(zod_1.z.unknown()).optional().default({}),
    isPublic: zod_1.z.boolean().optional().default(false)
});
const updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Template name is required').optional(),
    description: zod_1.z.string().optional(),
    category: zod_1.z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
    variableSchema: zod_1.z.record(zod_1.z.unknown()).optional(),
    isPublic: zod_1.z.boolean().optional()
});
const generateFromTemplateSchema = zod_1.z.object({
    variables: zod_1.z.record(zod_1.z.unknown()),
    outputFilename: zod_1.z.string().optional(),
    caseId: zod_1.z.string().optional(),
    clientId: zod_1.z.string().optional()
});
const templateQuerySchema = zod_1.z.object({
    category: zod_1.z.enum(['LEGAL_BRIEF', 'CONTRACT', 'EVIDENCE', 'CORRESPONDENCE', 'COURT_FILING', 'RESEARCH', 'FINANCIAL', 'MEDICAL', 'OTHER']).optional(),
    isPublic: zod_1.z.boolean().optional(),
    search: zod_1.z.string().optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.number().min(0).optional().default(0),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'name', 'category']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc')
});
class TemplateController {
    async createTemplate(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            if (!req.file) {
                throw (0, errorHandler_1.createError)('Template file is required', 400);
            }
            const validatedData = createTemplateSchema.parse({
                ...req.body,
                file: req.file
            });
            const validationResult = await documents_1.documentStorageService.validateFile(req.file.buffer, req.file.originalname, req.file.mimetype);
            if (!validationResult.isValid) {
                throw (0, errorHandler_1.createError)(validationResult.error || 'File validation failed', 400);
            }
            const storageResult = await documents_1.documentStorageService.uploadFile(req.file.buffer, req.file.originalname, {
                filename: req.file.originalname,
                mimeType: req.file.mimetype,
                category: 'templates',
                subcategory: 'original',
                metadata: {
                    uploadedBy: req.user.id,
                    category: validatedData.category,
                    isTemplate: true
                }
            });
            if (!storageResult.success) {
                throw (0, errorHandler_1.createError)(storageResult.error || 'Failed to store template file', 500);
            }
            const templateData = {
                name: validatedData.name,
                description: validatedData.description,
                category: validatedData.category,
                filePath: storageResult.filePath,
                variableSchema: validatedData.variableSchema,
                isPublic: validatedData.isPublic,
                createdBy: req.user.id
            };
            const template = await prisma.documentTemplate.create({
                data: templateData,
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            generatedDocuments: true
                        }
                    }
                }
            });
            res.status(201).json({
                success: true,
                data: template,
                message: 'Template created successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getTemplates(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const validatedQuery = templateQuerySchema.parse(req.query);
            const where = {};
            if (validatedQuery.category) {
                where.category = validatedQuery.category;
            }
            if (validatedQuery.isPublic !== undefined) {
                where.isPublic = validatedQuery.isPublic;
            }
            else {
                where.OR = [
                    { isPublic: true },
                    { createdBy: req.user.id }
                ];
            }
            if (validatedQuery.search) {
                where.OR = [
                    { name: { contains: validatedQuery.search, mode: 'insensitive' } },
                    { description: { contains: validatedQuery.search, mode: 'insensitive' } }
                ];
            }
            const [templates, total] = await Promise.all([
                prisma.documentTemplate.findMany({
                    where,
                    include: {
                        createdByUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },
                        _count: {
                            select: {
                                generatedDocuments: true
                            }
                        }
                    },
                    orderBy: {
                        [validatedQuery.sortBy]: validatedQuery.sortOrder
                    },
                    skip: validatedQuery.offset,
                    take: validatedQuery.limit
                }),
                prisma.documentTemplate.count({ where })
            ]);
            res.json({
                success: true,
                data: {
                    templates,
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
    async getTemplate(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const template = await prisma.documentTemplate.findUnique({
                where: { id },
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    generatedDocuments: {
                        select: {
                            id: true,
                            filename: true,
                            originalName: true,
                            createdAt: true,
                            case: {
                                select: {
                                    id: true,
                                    title: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    },
                    _count: {
                        select: {
                            generatedDocuments: true
                        }
                    }
                }
            });
            if (!template) {
                throw (0, errorHandler_1.createError)('Template not found', 404);
            }
            if (!template.isPublic && template.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Access denied to this template', 403);
            }
            res.json({
                success: true,
                data: template
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateTemplate(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const validatedData = updateTemplateSchema.parse(req.body);
            const existingTemplate = await prisma.documentTemplate.findUnique({
                where: { id },
                include: {
                    createdByUser: {
                        select: { id: true }
                    }
                }
            });
            if (!existingTemplate) {
                throw (0, errorHandler_1.createError)('Template not found', 404);
            }
            if (existingTemplate.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Access denied to update this template', 403);
            }
            const updatedTemplate = await prisma.documentTemplate.update({
                where: { id },
                data: validatedData,
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            generatedDocuments: true
                        }
                    }
                }
            });
            res.json({
                success: true,
                data: updatedTemplate,
                message: 'Template updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteTemplate(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const existingTemplate = await prisma.documentTemplate.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            generatedDocuments: true
                        }
                    }
                }
            });
            if (!existingTemplate) {
                throw (0, errorHandler_1.createError)('Template not found', 404);
            }
            if (existingTemplate.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Access denied to delete this template', 403);
            }
            if (existingTemplate._count.generatedDocuments > 0) {
                throw (0, errorHandler_1.createError)('Cannot delete template that has been used to generate documents', 400);
            }
            await documents_1.documentStorageService.deleteFile(existingTemplate.filePath);
            await prisma.documentTemplate.delete({
                where: { id }
            });
            res.json({
                success: true,
                message: 'Template deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async generateFromTemplate(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const validatedData = generateFromTemplateSchema.parse(req.body);
            const template = await prisma.documentTemplate.findUnique({
                where: { id }
            });
            if (!template) {
                throw (0, errorHandler_1.createError)('Template not found', 404);
            }
            if (!template.isPublic && template.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Access denied to this template', 403);
            }
            const validationErrors = [];
            const schema = template.variableSchema;
            for (const [key, config] of Object.entries(schema)) {
                if (config.required && validatedData.variables[key] === undefined) {
                    validationErrors.push(`Required variable '${key}' is missing`);
                }
            }
            if (validationErrors.length > 0) {
                throw (0, errorHandler_1.createError)(`Variable validation failed: ${validationErrors.join(', ')}`, 400);
            }
            const generationResult = await this.generateDocumentFromTemplate(template, validatedData.variables, validatedData.outputFilename, req.user.id, validatedData.caseId, validatedData.clientId);
            if (!generationResult.success) {
                throw (0, errorHandler_1.createError)(generationResult.errors?.join(', ') || 'Failed to generate document', 500);
            }
            res.status(201).json({
                success: true,
                data: {
                    documentId: generationResult.documentId,
                    filename: generationResult.filename,
                    message: 'Document generated successfully from template'
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    async generateDocumentFromTemplate(template, variables, outputFilename, uploadedById, caseId, clientId) {
        try {
            const templateContent = await documents_1.documentStorageService.readFile(template.filePath);
            let processedContent = templateContent.toString();
            for (const [key, value] of Object.entries(variables)) {
                const placeholder = `{{${key}}}`;
                processedContent = processedContent.replace(new RegExp(placeholder, 'g'), String(value));
            }
            const filename = outputFilename || `generated_${template.name}_${Date.now()}.docx`;
            const storageResult = await documents_1.documentStorageService.uploadFile(Buffer.from(processedContent), filename, {
                filename,
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                category: 'documents',
                subcategory: 'generated',
                metadata: {
                    uploadedBy: uploadedById,
                    caseId,
                    clientId,
                    templateId: template.id,
                    generatedFrom: template.name
                }
            });
            if (!storageResult.success) {
                return {
                    success: false,
                    errors: [storageResult.error || 'Failed to store generated document']
                };
            }
            const document = await prisma.document.create({
                data: {
                    filename: storageResult.filename,
                    originalName: filename,
                    path: storageResult.filePath,
                    size: storageResult.size,
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    type: 'GENERATED',
                    caseId,
                    clientId,
                    uploadedBy: uploadedById || '',
                    category: template.category,
                    description: `Generated from template: ${template.name}`,
                    isTemplate: false,
                    checksum: await documents_1.documentStorageService.calculateFileHash(Buffer.from(processedContent))
                }
            });
            return {
                success: true,
                documentId: document.id,
                filePath: storageResult.filePath,
                filename: storageResult.filename
            };
        }
        catch (error) {
            return {
                success: false,
                errors: [error instanceof Error ? error.message : 'Unknown error occurred']
            };
        }
    }
    async downloadTemplate(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id } = req.params;
            const template = await prisma.documentTemplate.findUnique({
                where: { id }
            });
            if (!template) {
                throw (0, errorHandler_1.createError)('Template not found', 404);
            }
            if (!template.isPublic && template.createdBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Access denied to this template', 403);
            }
            const downloadResult = await documents_1.documentStorageService.downloadFile(template.filePath);
            if (!downloadResult.success || !downloadResult.buffer) {
                throw (0, errorHandler_1.createError)(downloadResult.error || 'Failed to download template', 500);
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${template.name}.docx"`);
            res.setHeader('Content-Length', downloadResult.buffer.length.toString());
            res.send(downloadResult.buffer);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.TemplateController = TemplateController;
exports.templateController = new TemplateController();
//# sourceMappingURL=templateController.js.map
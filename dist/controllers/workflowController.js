"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowController = exports.WorkflowController = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const errorHandler_1 = require("../middleware/errorHandler");
const prisma = new client_1.PrismaClient();
const createWorkflowSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Workflow name is required'),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional().default('PENDING'),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
    dueDate: zod_1.z.string().optional(),
    steps: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Step name is required'),
        description: zod_1.z.string().optional(),
        assignedTo: zod_1.z.string().optional(),
        dueDate: zod_1.z.string().optional(),
        order: zod_1.z.number().min(0, 'Step order is required')
    })).optional().default([])
});
const updateWorkflowSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Workflow name is required').optional(),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    dueDate: zod_1.z.string().optional()
});
const addWorkflowStepSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Step name is required'),
    description: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    order: zod_1.z.number().min(0, 'Step order is required')
});
const updateWorkflowStepSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Step name is required').optional(),
    description: zod_1.z.string().optional(),
    assignedTo: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).optional(),
    action: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    completedAt: zod_1.z.string().optional()
});
const workflowQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedTo: zod_1.z.string().optional(),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    offset: zod_1.z.number().min(0).optional().default(0),
    sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority']).optional().default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc')
});
class WorkflowController {
    async createWorkflow(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: documentId } = req.params;
            const validatedData = createWorkflowSchema.parse(req.body);
            const document = await prisma.document.findUnique({
                where: { id: documentId },
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
            if (!document) {
                throw (0, errorHandler_1.createError)('Document not found', 404);
            }
            const hasAccess = await this.checkDocumentAccess(document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to create workflow for this document', 403);
            }
            const existingWorkflow = await prisma.documentWorkflow.findFirst({
                where: {
                    documentId,
                    status: { in: ['PENDING', 'IN_PROGRESS'] }
                }
            });
            if (existingWorkflow) {
                throw (0, errorHandler_1.createError)('Document already has an active workflow', 400);
            }
            const workflowData = {
                documentId,
                name: validatedData.name,
                description: validatedData.description,
                status: validatedData.status,
                priority: validatedData.priority,
                dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
                startedBy: req.user.id
            };
            const workflow = await prisma.documentWorkflow.create({
                data: workflowData,
                include: {
                    document: {
                        select: {
                            id: true,
                            filename: true,
                            originalName: true
                        }
                    },
                    startedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    steps: {
                        orderBy: { order: 'asc' },
                        include: {
                            assignedToUser: {
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
            if (validatedData.steps && validatedData.steps.length > 0) {
                const stepsData = validatedData.steps.map((step, index) => ({
                    workflowId: workflow.id,
                    name: step.name,
                    description: step.description,
                    assignedTo: step.assignedTo,
                    dueDate: step.dueDate ? new Date(step.dueDate) : null,
                    order: step.order
                }));
                await prisma.documentWorkflowStep.createMany({
                    data: stepsData
                });
                const workflowWithSteps = await prisma.documentWorkflow.findUnique({
                    where: { id: workflow.id },
                    include: {
                        document: {
                            select: {
                                id: true,
                                filename: true,
                                originalName: true
                            }
                        },
                        startedByUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },
                        steps: {
                            orderBy: { order: 'asc' },
                            include: {
                                assignedToUser: {
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
                res.status(201).json({
                    success: true,
                    data: workflowWithSteps,
                    message: 'Workflow created successfully'
                });
            }
            else {
                res.status(201).json({
                    success: true,
                    data: workflow,
                    message: 'Workflow created successfully'
                });
            }
        }
        catch (error) {
            next(error);
        }
    }
    async getWorkflow(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: workflowId } = req.params;
            const workflow = await prisma.documentWorkflow.findUnique({
                where: { id: workflowId },
                include: {
                    document: {
                        select: {
                            id: true,
                            filename: true,
                            originalName: true
                        }
                    },
                    startedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    steps: {
                        orderBy: { order: 'asc' },
                        include: {
                            assignedToUser: {
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
            if (!workflow) {
                throw (0, errorHandler_1.createError)('Workflow not found', 404);
            }
            const hasAccess = await this.checkDocumentAccess(workflow.document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to this workflow', 403);
            }
            res.json({
                success: true,
                data: workflow
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateWorkflow(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: workflowId } = req.params;
            const validatedData = updateWorkflowSchema.parse(req.body);
            const existingWorkflow = await prisma.documentWorkflow.findUnique({
                where: { id: workflowId },
                include: {
                    document: {
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
                    }
                }
            });
            if (!existingWorkflow) {
                throw (0, errorHandler_1.createError)('Workflow not found', 404);
            }
            const hasAccess = await this.checkDocumentAccess(existingWorkflow.document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to update this workflow', 403);
            }
            if (existingWorkflow.startedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Only workflow starter or admin can update workflow', 403);
            }
            const updatedWorkflow = await prisma.documentWorkflow.update({
                where: { id: workflowId },
                data: {
                    ...validatedData,
                    dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined
                },
                include: {
                    document: {
                        select: {
                            id: true,
                            filename: true,
                            originalName: true
                        }
                    },
                    startedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    steps: {
                        orderBy: { order: 'asc' },
                        include: {
                            assignedToUser: {
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
            res.json({
                success: true,
                data: updatedWorkflow,
                message: 'Workflow updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteWorkflow(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: workflowId } = req.params;
            const existingWorkflow = await prisma.documentWorkflow.findUnique({
                where: { id: workflowId },
                include: {
                    document: {
                        include: {
                            case: {
                                include: {
                                    attorney: {
                                        select: { userId: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!existingWorkflow) {
                throw (0, errorHandler_1.createError)('Workflow not found', 404);
            }
            const hasAccess = await this.checkDocumentAccess(existingWorkflow.document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to delete this workflow', 403);
            }
            if (existingWorkflow.startedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Only workflow starter or admin can delete workflow', 403);
            }
            await prisma.documentWorkflowStep.deleteMany({
                where: { workflowId }
            });
            await prisma.documentWorkflow.delete({
                where: { id: workflowId }
            });
            res.json({
                success: true,
                message: 'Workflow deleted successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async addWorkflowStep(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: workflowId } = req.params;
            const validatedData = addWorkflowStepSchema.parse(req.body);
            const workflow = await prisma.documentWorkflow.findUnique({
                where: { id: workflowId },
                include: {
                    document: {
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
                    }
                }
            });
            if (!workflow) {
                throw (0, errorHandler_1.createError)('Workflow not found', 404);
            }
            const hasAccess = await this.checkDocumentAccess(workflow.document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to modify this workflow', 403);
            }
            if (workflow.startedBy !== req.user.id && !['ADMIN', 'MANAGER'].includes(req.user.role)) {
                throw (0, errorHandler_1.createError)('Only workflow starter or admin can add steps', 403);
            }
            const stepData = {
                workflowId,
                name: validatedData.name,
                description: validatedData.description,
                assignedTo: validatedData.assignedTo,
                dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
                order: validatedData.order
            };
            const step = await prisma.documentWorkflowStep.create({
                data: stepData,
                include: {
                    assignedToUser: {
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
                data: step,
                message: 'Workflow step added successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async updateWorkflowStep(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: workflowId, stepId } = req.params;
            const validatedData = updateWorkflowStepSchema.parse(req.body);
            const step = await prisma.documentWorkflowStep.findUnique({
                where: { id: stepId },
                include: {
                    workflow: {
                        include: {
                            document: {
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
                            }
                        }
                    }
                }
            });
            if (!step) {
                throw (0, errorHandler_1.createError)('Workflow step not found', 404);
            }
            if (step.workflowId !== workflowId) {
                throw (0, errorHandler_1.createError)('Workflow step does not belong to this workflow', 400);
            }
            const hasAccess = await this.checkDocumentAccess(step.workflow.document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to modify this workflow step', 403);
            }
            const canUpdate = step.workflow.startedBy === req.user.id ||
                step.assignedTo === req.user.id ||
                ['ADMIN', 'MANAGER'].includes(req.user.role);
            if (!canUpdate) {
                throw (0, errorHandler_1.createError)('Access denied to update this workflow step', 403);
            }
            const updatedStep = await prisma.documentWorkflowStep.update({
                where: { id: stepId },
                data: {
                    ...validatedData,
                    dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined,
                    completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : undefined
                },
                include: {
                    assignedToUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });
            if (validatedData.status === 'COMPLETED') {
                await this.checkAndUpdateWorkflowStatus(step.workflowId);
            }
            res.json({
                success: true,
                data: updatedStep,
                message: 'Workflow step updated successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    async getDocumentWorkflows(req, res, next) {
        try {
            if (!req.user) {
                throw (0, errorHandler_1.createError)('Authentication required', 401);
            }
            const { id: documentId } = req.params;
            const validatedQuery = workflowQuerySchema.parse(req.query);
            const document = await prisma.document.findUnique({
                where: { id: documentId },
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
            if (!document) {
                throw (0, errorHandler_1.createError)('Document not found', 404);
            }
            const hasAccess = await this.checkDocumentAccess(document, req.user.id, req.user.role);
            if (!hasAccess) {
                throw (0, errorHandler_1.createError)('Access denied to view workflows for this document', 403);
            }
            const where = { documentId };
            if (validatedQuery.status) {
                where.status = validatedQuery.status;
            }
            if (validatedQuery.priority) {
                where.priority = validatedQuery.priority;
            }
            if (validatedQuery.assignedTo) {
                where.steps = {
                    some: {
                        assignedTo: validatedQuery.assignedTo
                    }
                };
            }
            const [workflows, total] = await Promise.all([
                prisma.documentWorkflow.findMany({
                    where,
                    include: {
                        document: {
                            select: {
                                id: true,
                                filename: true,
                                originalName: true
                            }
                        },
                        startedByUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true
                            }
                        },
                        steps: {
                            orderBy: { order: 'asc' },
                            include: {
                                assignedToUser: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        [validatedQuery.sortBy]: validatedQuery.sortOrder
                    },
                    skip: validatedQuery.offset,
                    take: validatedQuery.limit
                }),
                prisma.documentWorkflow.count({ where })
            ]);
            res.json({
                success: true,
                data: {
                    workflows,
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
    async checkDocumentAccess(document, userId, userRole) {
        if (userRole === 'ADMIN') {
            return true;
        }
        if (document.uploadedBy === userId) {
            return true;
        }
        if (document.case) {
            const caseAccess = await prisma.case.findFirst({
                where: {
                    id: document.case.id,
                    OR: [
                        { attorney: { userId } },
                        { client: { userId } }
                    ]
                }
            });
            if (caseAccess) {
                return true;
            }
        }
        return false;
    }
    async checkAndUpdateWorkflowStatus(workflowId) {
        const steps = await prisma.documentWorkflowStep.findMany({
            where: { workflowId }
        });
        const allCompleted = steps.every(step => step.status === 'COMPLETED');
        const anyInProgress = steps.some(step => step.status === 'IN_PROGRESS');
        let newStatus = 'PENDING';
        if (allCompleted) {
            newStatus = 'COMPLETED';
        }
        else if (anyInProgress) {
            newStatus = 'IN_PROGRESS';
        }
        await prisma.documentWorkflow.update({
            where: { id: workflowId },
            data: { status: newStatus }
        });
    }
}
exports.WorkflowController = WorkflowController;
exports.workflowController = new WorkflowController();
//# sourceMappingURL=workflowController.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = void 0;
const contentManagementService_1 = require("./contentManagementService");
const auth_1 = require("../../auth");
class WorkflowEngine {
    constructor(prisma) {
        this.prisma = prisma;
        this.contentService = new contentManagementService_1.ContentManagementService(prisma);
        this.authService = new auth_1.AuthService(prisma);
    }
    async createWorkflow(input) {
        const workflow = await this.prisma.contentWorkflow.create({
            data: {
                name: input.name,
                description: input.description,
                contentType: input.contentType,
                isDefault: input.isDefault || false,
                isActive: true,
                createdBy: input.createdBy,
                stages: {
                    create: input.stages.map((stage, index) => ({
                        name: stage.name,
                        description: stage.description,
                        type: stage.type,
                        requiredRole: stage.requiredRole,
                        assignedTo: stage.assignedTo,
                        dueDays: stage.dueDays,
                        autoApproveAfterDays: stage.autoApproveAfterDays,
                        sortOrder: index,
                        conditions: stage.conditions,
                        actions: stage.actions,
                        isActive: true
                    }))
                }
            },
            include: {
                stages: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
        return workflow;
    }
    async getWorkflows(query = {}) {
        const where = {};
        if (query.id)
            where.id = query.id;
        if (query.name)
            where.name = { contains: query.name, mode: 'insensitive' };
        if (query.contentType)
            where.contentType = { has: query.contentType };
        if (query.isDefault !== undefined)
            where.isDefault = query.isDefault;
        if (query.isActive !== undefined)
            where.isActive = query.isActive;
        return await this.prisma.contentWorkflow.findMany({
            where,
            include: {
                stages: {
                    orderBy: { sortOrder: 'asc' }
                },
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    async getWorkflowById(id) {
        return await this.prisma.contentWorkflow.findUnique({
            where: { id },
            include: {
                stages: {
                    orderBy: { sortOrder: 'asc' }
                },
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                instances: {
                    include: {
                        stages: {
                            include: {
                                assignedToUser: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    async updateWorkflow(id, updates) {
        return await this.prisma.contentWorkflow.update({
            where: { id },
            data: { ...updates, updatedAt: new Date() },
            include: {
                stages: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
    }
    async startWorkflow(contentId, workflowId, startedBy) {
        const workflow = await this.getWorkflowById(workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        const instance = await this.prisma.contentWorkflowInstance.create({
            data: {
                workflowId,
                contentId,
                currentStage: workflow.stages[0].id,
                status: 'in_progress',
                startedBy,
                startedAt: new Date(),
                stages: {
                    create: workflow.stages.map(stage => ({
                        stageId: stage.id,
                        status: stage.id === workflow.stages[0].id ? 'in_progress' : 'pending',
                        assignedTo: stage.assignedTo,
                        assignedAt: stage.id === workflow.stages[0].id ? new Date() : undefined
                    }))
                }
            },
            include: {
                stages: {
                    include: {
                        assignedToUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });
        await this.executeStageActions(instance, workflow.stages[0]);
        return instance;
    }
    async getWorkflowInstance(id) {
        return await this.prisma.contentWorkflowInstance.findUnique({
            where: { id },
            include: {
                workflow: true,
                content: true,
                startedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                stages: {
                    include: {
                        stage: true,
                        assignedToUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
    }
    async getWorkflowInstancesForContent(contentId) {
        return await this.prisma.contentWorkflowInstance.findMany({
            where: { contentId },
            include: {
                workflow: true,
                startedByUser: {
                    select: {
                        id: true,
                        firstName: lastName, true: 
                    }
                },
                stages: {
                    include: {
                        stage: true,
                        assignedToUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { startedAt: 'desc' }
        });
    }
    async advanceWorkflowStage(instanceId, stageId, userId, notes) {
        const instance = await this.getWorkflowInstance(instanceId);
        if (!instance) {
            throw new Error('Workflow instance not found');
        }
        const currentStage = instance.stages.find(s => s.stageId === stageId);
        if (!currentStage || currentStage.status !== 'in_progress') {
            throw new Error('Stage is not currently in progress');
        }
        const stage = await this.prisma.workflowStage.findUnique({
            where: { id: stageId },
            include: { workflow: true }
        });
        if (!stage) {
            throw new Error('Stage not found');
        }
        const hasPermission = await this.checkUserPermission(userId, stage);
        if (!hasPermission) {
            throw new Error('User does not have permission to complete this stage');
        }
        await this.prisma.workflowStageInstance.update({
            where: { id: currentStage.id },
            data: {
                status: 'completed',
                completedAt: new Date(),
                notes
            }
        });
        const workflow = await this.getWorkflowById(instance.workflowId);
        const currentStageIndex = workflow.stages.findIndex(s => s.id === stageId);
        const nextStage = workflow.stages[currentStageIndex + 1];
        if (nextStage) {
            const nextStageInstance = instance.stages.find(s => s.stageId === nextStage.id);
            if (nextStageInstance) {
                await this.prisma.workflowStageInstance.update({
                    where: { id: nextStageInstance.id },
                    data: {
                        status: 'in_progress',
                        assignedTo: nextStage.assignedTo,
                        assignedAt: new Date()
                    }
                });
                const updatedInstance = await this.prisma.contentWorkflowInstance.update({
                    where: { id: instanceId },
                    data: { currentStage: nextStage.id }
                });
                await this.executeStageActions(updatedInstance, nextStage);
                return updatedInstance;
            }
        }
        else {
            const completedInstance = await this.prisma.contentWorkflowInstance.update({
                where: { id: instanceId },
                data: {
                    status: 'completed',
                    completedAt: new Date()
                }
            });
            await this.executeWorkflowCompletionActions(completedInstance);
            return completedInstance;
        }
        return instance;
    }
    async rejectWorkflow(instanceId, stageId, userId, reason) {
        const instance = await this.getWorkflowInstance(instanceId);
        if (!instance) {
            throw new Error('Workflow instance not found');
        }
        const currentStage = instance.stages.find(s => s.stageId === stageId);
        if (!currentStage || currentStage.status !== 'in_progress') {
            throw new Error('Stage is not currently in progress');
        }
        const stage = await this.prisma.workflowStage.findUnique({
            where: { id: stageId }
        });
        if (!stage) {
            throw new Error('Stage not found');
        }
        const hasPermission = await this.checkUserPermission(userId, stage);
        if (!hasPermission) {
            throw new Error('User does not have permission to reject this workflow');
        }
        await this.prisma.workflowStageInstance.update({
            where: { id: currentStage.id },
            data: {
                status: 'rejected',
                completedAt: new Date(),
                notes: reason
            }
        });
        const rejectedInstance = await this.prisma.contentWorkflowInstance.update({
            where: { id: instanceId },
            data: {
                status: 'rejected',
                completedAt: new Date()
            }
        });
        await this.executeWorkflowRejectionActions(rejectedInstance, reason);
        return rejectedInstance;
    }
    async evaluateConditions(conditions, context) {
        for (const condition of conditions) {
            const fieldValue = this.getFieldValue(context, condition.field);
            const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);
            if (!conditionResult) {
                return false;
            }
        }
        return true;
    }
    getFieldValue(context, field) {
        const parts = field.split('.');
        let value = context;
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            }
            else {
                return undefined;
            }
        }
        return value;
    }
    evaluateCondition(fieldValue, operator, value) {
        switch (operator) {
            case 'equals':
                return fieldValue === value;
            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.includes(value);
            case 'greater_than':
                return fieldValue > value;
            case 'less_than':
                return fieldValue < value;
            case 'in':
                return Array.isArray(value) && value.includes(fieldValue);
            default:
                return false;
        }
    }
    async executeStageActions(instance, stage) {
        const context = {
            contentId: instance.contentId,
            workflowId: instance.workflowId,
            instanceId: instance.id,
            stage: stage,
            user: instance.startedByUser
        };
        for (const action of stage.actions) {
            await this.executeAction(action, context);
        }
    }
    async executeWorkflowCompletionActions(instance) {
        const workflow = await this.getWorkflowById(instance.workflowId);
        const finalStage = workflow.stages[workflow.stages.length - 1];
        const context = {
            contentId: instance.contentId,
            workflowId: instance.workflowId,
            instanceId: instance.id,
            workflow: workflow,
            user: instance.startedByUser
        };
        for (const action of finalStage.actions) {
            await this.executeAction(action, context);
        }
    }
    async executeWorkflowRejectionActions(instance, reason) {
        const context = {
            contentId: instance.contentId,
            workflowId: instance.workflowId,
            instanceId: instance.id,
            reason: reason,
            user: instance.startedByUser
        };
    }
    async executeAction(action, context) {
        switch (action.type) {
            case 'notify':
                await this.executeNotificationAction(action, context);
                break;
            case 'update_status':
                await this.executeUpdateStatusAction(action, context);
                break;
            case 'assign_user':
                await this.executeAssignUserAction(action, context);
                break;
            case 'send_email':
                await this.executeSendEmailAction(action, context);
                break;
            case 'create_task':
                await this.executeCreateTaskAction(action, context);
                break;
        }
    }
    async executeNotificationAction(action, context) {
        console.log(`Executing notification action: ${JSON.stringify(action.config)}`);
    }
    async executeUpdateStatusAction(action, context) {
        const { status, contentId } = action.config;
        if (status && contentId) {
            await this.contentService.updateContent(contentId, { status }, context.user.id);
        }
    }
    async executeAssignUserAction(action, context) {
        console.log(`Executing assign user action: ${JSON.stringify(action.config)}`);
    }
    async executeSendEmailAction(action, context) {
        console.log(`Executing send email action: ${JSON.stringify(action.config)}`);
    }
    async executeCreateTaskAction(action, context) {
        console.log(`Executing create task action: ${JSON.stringify(action.config)}`);
    }
    async checkUserPermission(userId, stage) {
        if (stage.requiredRole && stage.requiredRole.length > 0) {
            const userRoles = await this.authService.getUserRoles(userId);
            const hasRequiredRole = stage.requiredRole.some(role => userRoles.includes(role));
            if (!hasRequiredRole) {
                return false;
            }
        }
        if (stage.assignedTo && stage.assignedTo !== userId) {
            return false;
        }
        return true;
    }
    async processAutoApprovals() {
        const overdueStages = await this.prisma.workflowStageInstance.findMany({
            where: {
                status: 'in_progress',
                stage: {
                    autoApproveAfterDays: {
                        not: null
                    }
                },
                assignedAt: {
                    lte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            },
            include: {
                stage: true,
                instance: true
            }
        });
        for (const stageInstance of overdueStages) {
            const autoApproveAfterDays = stageInstance.stage.autoApproveAfterDays;
            const dueDate = new Date(stageInstance.assignedAt.getTime() + autoApproveAfterDays * 24 * 60 * 60 * 1000);
            if (new Date() > dueDate) {
                await this.advanceWorkflowStage(stageInstance.instance.id, stageInstance.stageId, 'system', 'Auto-approved due to timeout');
            }
        }
    }
    async getDueWorkflowInstances() {
        const instances = await this.prisma.contentWorkflowInstance.findMany({
            where: {
                status: 'in_progress',
                stages: {
                    some: {
                        status: 'in_progress',
                        stage: {
                            dueDays: {
                                not: null
                            }
                        }
                    }
                }
            },
            include: {
                workflow: true,
                content: true,
                startedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                stages: {
                    include: {
                        stage: true,
                        assignedToUser: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });
        return instances.filter(instance => {
            const currentStage = instance.stages.find(s => s.stageId === instance.currentStage);
            if (!currentStage || !currentStage.stage.dueDays) {
                return false;
            }
            const dueDate = new Date(currentStage.assignedAt.getTime() + currentStage.stage.dueDays * 24 * 60 * 60 * 1000);
            return new Date() > dueDate;
        });
    }
    async createWorkflowTemplate(name, description, contentType) {
        const defaultStages = [
            {
                name: 'Review',
                description: 'Content review stage',
                type: 'review',
                requiredRole: ['editor', 'admin'],
                dueDays: 3,
                autoApproveAfterDays: 7,
                conditions: [],
                actions: [
                    {
                        type: 'notify',
                        config: { message: 'Content is ready for review' }
                    }
                ]
            },
            {
                name: 'Approval',
                description: 'Content approval stage',
                type: 'approval',
                requiredRole: ['admin'],
                dueDays: 2,
                autoApproveAfterDays: 5,
                conditions: [],
                actions: [
                    {
                        type: 'notify',
                        config: { message: 'Content is ready for approval' }
                    }
                ]
            },
            {
                name: 'Publishing',
                description: 'Content publishing stage',
                type: 'publishing',
                requiredRole: ['admin'],
                conditions: [],
                actions: [
                    {
                        type: 'update_status',
                        config: { status: 'published' }
                    },
                    {
                        type: 'notify',
                        config: { message: 'Content has been published' }
                    }
                ]
            }
        ];
        return await this.createWorkflow({
            name,
            description,
            contentType: [contentType],
            stages: defaultStages,
            isDefault: true,
            createdBy: 'system'
        });
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=workflowEngine.js.map
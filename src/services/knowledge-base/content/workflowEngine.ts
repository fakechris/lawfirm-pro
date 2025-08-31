import { PrismaClient } from '@prisma/client';
import { 
  ContentWorkflow,
  WorkflowStage,
  WorkflowCondition,
  WorkflowAction,
  ContentWorkflowInstance,
  WorkflowStageInstance,
  CreateWorkflowInput,
  WorkflowQuery
} from '../../../models/knowledge-base';
import { ContentManagementService } from './contentManagementService';
import { AuthService } from '../../auth';

export class WorkflowEngine {
  private prisma: PrismaClient;
  private contentService: ContentManagementService;
  private authService: AuthService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.contentService = new ContentManagementService(prisma);
    this.authService = new AuthService(prisma);
  }

  // Workflow Management
  async createWorkflow(input: CreateWorkflowInput): Promise<ContentWorkflow> {
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

  async getWorkflows(query: WorkflowQuery = {}): Promise<ContentWorkflow[]> {
    const where: any = {};
    
    if (query.id) where.id = query.id;
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };
    if (query.contentType) where.contentType = { has: query.contentType };
    if (query.isDefault !== undefined) where.isDefault = query.isDefault;
    if (query.isActive !== undefined) where.isActive = query.isActive;

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

  async getWorkflowById(id: string): Promise<ContentWorkflow | null> {
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

  async updateWorkflow(id: string, updates: any): Promise<ContentWorkflow> {
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

  // Workflow Instance Management
  async startWorkflow(contentId: string, workflowId: string, startedBy: string): Promise<ContentWorkflowInstance> {
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

    // Execute actions for the first stage
    await this.executeStageActions(instance, workflow.stages[0]);

    return instance;
  }

  async getWorkflowInstance(id: string): Promise<ContentWorkflowInstance | null> {
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

  async getWorkflowInstancesForContent(contentId: string): Promise<ContentWorkflowInstance[]> {
    return await this.prisma.contentWorkflowInstance.findMany({
      where: { contentId },
      include: {
        workflow: true,
        startedByUser: {
          select: {
            id: true,
            firstName:            lastName: true
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

  async advanceWorkflowStage(instanceId: string, stageId: string, userId: string, notes?: string): Promise<ContentWorkflowInstance> {
    const instance = await this.getWorkflowInstance(instanceId);
    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    const currentStage = instance.stages.find(s => s.stageId === stageId);
    if (!currentStage || currentStage.status !== 'in_progress') {
      throw new Error('Stage is not currently in progress');
    }

    // Check if user has permission to complete this stage
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

    // Complete current stage
    await this.prisma.workflowStageInstance.update({
      where: { id: currentStage.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        notes
      }
    });

    // Find next stage
    const workflow = await this.getWorkflowById(instance.workflowId);
    const currentStageIndex = workflow.stages.findIndex(s => s.id === stageId);
    const nextStage = workflow.stages[currentStageIndex + 1];

    if (nextStage) {
      // Move to next stage
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

        // Update instance current stage
        const updatedInstance = await this.prisma.contentWorkflowInstance.update({
          where: { id: instanceId },
          data: { currentStage: nextStage.id }
        });

        // Execute actions for next stage
        await this.executeStageActions(updatedInstance, nextStage);

        return updatedInstance;
      }
    } else {
      // Complete workflow
      const completedInstance = await this.prisma.contentWorkflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      // Execute workflow completion actions
      await this.executeWorkflowCompletionActions(completedInstance);

      return completedInstance;
    }

    return instance;
  }

  async rejectWorkflow(instanceId: string, stageId: string, userId: string, reason: string): Promise<ContentWorkflowInstance> {
    const instance = await this.getWorkflowInstance(instanceId);
    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    const currentStage = instance.stages.find(s => s.stageId === stageId);
    if (!currentStage || currentStage.status !== 'in_progress') {
      throw new Error('Stage is not currently in progress');
    }

    // Check user permissions
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

    // Update stage and instance
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

    // Execute rejection actions
    await this.executeWorkflowRejectionActions(rejectedInstance, reason);

    return rejectedInstance;
  }

  // Condition Evaluation
  private async evaluateConditions(conditions: WorkflowCondition[], context: any): Promise<boolean> {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(context, condition.field);
      const conditionResult = this.evaluateCondition(fieldValue, condition.operator, condition.value);
      
      if (!conditionResult) {
        return false;
      }
    }
    return true;
  }

  private getFieldValue(context: any, field: string): any {
    const parts = field.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, value: any): boolean {
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

  // Action Execution
  private async executeStageActions(instance: ContentWorkflowInstance, stage: WorkflowStage): Promise<void> {
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

  private async executeWorkflowCompletionActions(instance: ContentWorkflowInstance): Promise<void> {
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

  private async executeWorkflowRejectionActions(instance: ContentWorkflowInstance, reason: string): Promise<void> {
    const context = {
      contentId: instance.contentId,
      workflowId: instance.workflowId,
      instanceId: instance.id,
      reason: reason,
      user: instance.startedByUser
    };

    // Execute rejection-specific actions
    // This could include sending notifications, updating content status, etc.
  }

  private async executeAction(action: WorkflowAction, context: any): Promise<void> {
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

  private async executeNotificationAction(action: WorkflowAction, context: any): Promise<void> {
    // Implement notification logic
    console.log(`Executing notification action: ${JSON.stringify(action.config)}`);
  }

  private async executeUpdateStatusAction(action: WorkflowAction, context: any): Promise<void> {
    const { status, contentId } = action.config;
    if (status && contentId) {
      await this.contentService.updateContent(contentId, { status }, context.user.id);
    }
  }

  private async executeAssignUserAction(action: WorkflowAction, context: any): Promise<void> {
    // Implement user assignment logic
    console.log(`Executing assign user action: ${JSON.stringify(action.config)}`);
  }

  private async executeSendEmailAction(action: WorkflowAction, context: any): Promise<void> {
    // Implement email sending logic
    console.log(`Executing send email action: ${JSON.stringify(action.config)}`);
  }

  private async executeCreateTaskAction(action: WorkflowAction, context: any): Promise<void> {
    // Implement task creation logic
    console.log(`Executing create task action: ${JSON.stringify(action.config)}`);
  }

  // Permission Checking
  private async checkUserPermission(userId: string, stage: WorkflowStage): Promise<boolean> {
    // Check if user has required role
    if (stage.requiredRole && stage.requiredRole.length > 0) {
      const userRoles = await this.authService.getUserRoles(userId);
      const hasRequiredRole = stage.requiredRole.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        return false;
      }
    }

    // Check if user is specifically assigned
    if (stage.assignedTo && stage.assignedTo !== userId) {
      return false;
    }

    return true;
  }

  // Auto-approval and Due Date Management
  async processAutoApprovals(): Promise<void> {
    const overdueStages = await this.prisma.workflowStageInstance.findMany({
      where: {
        status: 'in_progress',
        stage: {
          autoApproveAfterDays: {
            not: null
          }
        },
        assignedAt: {
          lte: new Date(Date.now() - 24 * 60 * 60 * 1000) // More than 1 day ago
        }
      },
      include: {
        stage: true,
        instance: true
      }
    });

    for (const stageInstance of overdueStages) {
      const autoApproveAfterDays = stageInstance.stage.autoApproveAfterDays!;
      const dueDate = new Date(stageInstance.assignedAt!.getTime() + autoApproveAfterDays * 24 * 60 * 60 * 1000);
      
      if (new Date() > dueDate) {
        // Auto-approve the stage
        await this.advanceWorkflowStage(
          stageInstance.instance.id,
          stageInstance.stageId,
          'system', // System user
          'Auto-approved due to timeout'
        );
      }
    }
  }

  async getDueWorkflowInstances(): Promise<ContentWorkflowInstance[]> {
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

    // Filter instances with due stages
    return instances.filter(instance => {
      const currentStage = instance.stages.find(s => s.stageId === instance.currentStage);
      if (!currentStage || !currentStage.stage.dueDays) {
        return false;
      }

      const dueDate = new Date(currentStage.assignedAt!.getTime() + currentStage.stage.dueDays * 24 * 60 * 60 * 1000);
      return new Date() > dueDate;
    });
  }

  // Workflow Templates
  async createWorkflowTemplate(name: string, description: string, contentType: string): Promise<ContentWorkflow> {
    // Create a default workflow for the content type
    const defaultStages = [
      {
        name: 'Review',
        description: 'Content review stage',
        type: 'review' as const,
        requiredRole: ['editor', 'admin'],
        dueDays: 3,
        autoApproveAfterDays: 7,
        conditions: [],
        actions: [
          {
            type: 'notify' as const,
            config: { message: 'Content is ready for review' }
          }
        ]
      },
      {
        name: 'Approval',
        description: 'Content approval stage',
        type: 'approval' as const,
        requiredRole: ['admin'],
        dueDays: 2,
        autoApproveAfterDays: 5,
        conditions: [],
        actions: [
          {
            type: 'notify' as const,
            config: { message: 'Content is ready for approval' }
          }
        ]
      },
      {
        name: 'Publishing',
        description: 'Content publishing stage',
        type: 'publishing' as const,
        requiredRole: ['admin'],
        conditions: [],
        actions: [
          {
            type: 'update_status' as const,
            config: { status: 'published' }
          },
          {
            type: 'notify' as const,
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
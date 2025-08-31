import { PrismaClient } from '@prisma/client';
import { ContentWorkflow, ContentWorkflowInstance, CreateWorkflowInput, WorkflowQuery } from '../../../models/knowledge-base';
export declare class WorkflowEngine {
    private prisma;
    private contentService;
    private authService;
    constructor(prisma: PrismaClient);
    createWorkflow(input: CreateWorkflowInput): Promise<ContentWorkflow>;
    getWorkflows(query?: WorkflowQuery): Promise<ContentWorkflow[]>;
    getWorkflowById(id: string): Promise<ContentWorkflow | null>;
    updateWorkflow(id: string, updates: any): Promise<ContentWorkflow>;
    startWorkflow(contentId: string, workflowId: string, startedBy: string): Promise<ContentWorkflowInstance>;
    getWorkflowInstance(id: string): Promise<ContentWorkflowInstance | null>;
    getWorkflowInstancesForContent(contentId: string): Promise<ContentWorkflowInstance[]>;
    advanceWorkflowStage(instanceId: string, stageId: string, userId: string, notes?: string): Promise<ContentWorkflowInstance>;
    rejectWorkflow(instanceId: string, stageId: string, userId: string, reason: string): Promise<ContentWorkflowInstance>;
    private evaluateConditions;
    private getFieldValue;
    private evaluateCondition;
    private executeStageActions;
    private executeWorkflowCompletionActions;
    private executeWorkflowRejectionActions;
    private executeAction;
    private executeNotificationAction;
    private executeUpdateStatusAction;
    private executeAssignUserAction;
    private executeSendEmailAction;
    private executeCreateTaskAction;
    private checkUserPermission;
    processAutoApprovals(): Promise<void>;
    getDueWorkflowInstances(): Promise<ContentWorkflowInstance[]>;
    createWorkflowTemplate(name: string, description: string, contentType: string): Promise<ContentWorkflow>;
}
//# sourceMappingURL=workflowEngine.d.ts.map
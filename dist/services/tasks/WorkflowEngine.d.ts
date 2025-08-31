import { CasePhase, CaseType, TaskStatus, TaskPriority, UserRole } from '@prisma/client';
export interface TaskRule {
    id: string;
    name: string;
    description: string;
    conditions: TaskCondition[];
    actions: TaskAction[];
    priority: number;
    active: boolean;
}
export interface TaskCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than';
    value: any;
}
export interface TaskAction {
    type: 'create_task' | 'update_task' | 'assign_task' | 'escalate_task' | 'notify';
    parameters: Record<string, any>;
}
export interface TaskTemplate {
    id: string;
    name: string;
    description: string;
    caseType: CaseType;
    phase: CasePhase;
    titleTemplate: string;
    descriptionTemplate?: string;
    defaultPriority: TaskPriority;
    defaultAssigneeRole?: UserRole;
    dueDateOffset?: number;
    requiredFields?: string[];
    conditions?: TaskCondition[];
    autoCreate: boolean;
}
export interface WorkflowContext {
    caseId: string;
    caseType: CaseType;
    currentPhase: CasePhase;
    previousPhase?: CasePhase;
    metadata: Record<string, any>;
    userId: string;
    userRole: UserRole;
    timestamp: Date;
}
export interface WorkflowResult {
    success: boolean;
    createdTasks: CreatedTask[];
    updatedTasks: UpdatedTask[];
    notifications: Notification[];
    errors: string[];
}
export interface CreatedTask {
    id: string;
    title: string;
    description?: string;
    caseId: string;
    assignedTo: string;
    assignedBy: string;
    dueDate?: Date;
    priority: TaskPriority;
    status: TaskStatus;
    metadata?: Record<string, any>;
}
export interface UpdatedTask {
    id: string;
    changes: Record<string, any>;
    previousValues: Record<string, any>;
}
export interface Notification {
    id: string;
    type: 'email' | 'in_app' | 'sms';
    recipient: string;
    subject: string;
    message: string;
    metadata?: Record<string, any>;
}
export declare class WorkflowEngine {
    private stateMachine;
    private taskRules;
    private taskTemplates;
    private workflowHistory;
    constructor();
    private initializeTaskRules;
    private initializeTaskTemplates;
    processPhaseTransition(caseId: string, fromPhase: CasePhase, toPhase: CasePhase, caseType: CaseType, userRole: UserRole, userId: string, metadata: Record<string, any>): Promise<WorkflowResult>;
    evaluateTaskRules(context: WorkflowContext): Promise<WorkflowResult>;
    private processTaskCreationRules;
    private processTaskUpdateRules;
    private createTaskFromTemplate;
    private findTasksToUpdate;
    private evaluateRuleConditions;
    private evaluateConditions;
    private evaluateCondition;
    private getNestedValue;
    private executeRuleActions;
    private handleCreateTaskAction;
    private handleUpdateTaskAction;
    private handleAssignTaskAction;
    private handleEscalateTaskAction;
    private handleNotifyAction;
    private generateNotifications;
    private interpolateTemplate;
    private addToWorkflowHistory;
    getTaskTemplates(caseType?: CaseType, phase?: CasePhase): TaskTemplate[];
    getTaskRules(activeOnly?: boolean): TaskRule[];
    getWorkflowHistory(caseId: string): WorkflowContext[];
    addTaskTemplate(template: TaskTemplate): void;
    addTaskRule(rule: TaskRule): void;
    updateTaskRule(ruleId: string, updates: Partial<TaskRule>): boolean;
    removeTaskRule(ruleId: string): boolean;
    removeTaskTemplate(templateId: string): boolean;
}
//# sourceMappingURL=WorkflowEngine.d.ts.map
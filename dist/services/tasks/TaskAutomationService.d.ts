import { CaseType, CasePhase, TaskStatus } from '@prisma/client';
import { WorkflowEngine, CreatedTask, UpdatedTask, Notification } from './WorkflowEngine';
import { TaskTemplateService } from './TaskTemplateService';
export interface AutomationTrigger {
    id: string;
    name: string;
    type: 'case_phase_change' | 'task_status_change' | 'date_based' | 'condition_based' | 'external_event';
    condition: Record<string, any>;
    isActive: boolean;
    priority: number;
}
export interface AutomationRule {
    id: string;
    name: string;
    description: string;
    triggers: AutomationTrigger[];
    conditions: AutomationCondition[];
    actions: AutomationAction[];
    isActive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
    lastTriggered?: Date;
    triggerCount: number;
}
export interface AutomationCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than' | 'in' | 'not_in';
    value: any;
    logicalOperator?: 'AND' | 'OR';
}
export interface AutomationAction {
    type: 'create_task' | 'update_task' | 'assign_task' | 'escalate_task' | 'send_notification' | 'create_reminder' | 'update_case_phase' | 'create_dependency';
    parameters: Record<string, any>;
    delay?: number;
    onFailure?: 'continue' | 'stop';
}
export interface AutomationContext {
    triggerEvent: AutomationTrigger;
    caseId?: string;
    taskId?: string;
    userId?: string;
    timestamp: Date;
    metadata: Record<string, any>;
}
export interface AutomationResult {
    success: boolean;
    actionsExecuted: AutomationAction[];
    createdTasks: CreatedTask[];
    updatedTasks: UpdatedTask[];
    notifications: Notification[];
    errors: string[];
    warnings: string[];
}
export interface TaskGenerationRequest {
    caseId: string;
    caseType: CaseType;
    currentPhase: CasePhase;
    previousPhase?: CasePhase;
    trigger: 'phase_change' | 'manual' | 'condition_met';
    metadata: Record<string, any>;
}
export interface TaskDependency {
    taskId: string;
    dependsOnTaskId: string;
    dependencyType: 'blocking' | 'sequential' | 'parallel' | 'suggested';
    autoCreate: boolean;
}
export declare class TaskAutomationService {
    private workflowEngine;
    private taskTemplateService;
    private automationRules;
    private pendingAutomations;
    private automationHistory;
    constructor(workflowEngine: WorkflowEngine, taskTemplateService: TaskTemplateService);
    private initializeDefaultAutomationRules;
    processCasePhaseChange(request: TaskGenerationRequest): Promise<AutomationResult>;
    processTaskStatusChange(taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus, caseId: string, userId: string, metadata: Record<string, any>): Promise<AutomationResult>;
    processDateBasedTrigger(eventType: string, metadata: Record<string, any>): Promise<AutomationResult[]>;
    private processAutomation;
    private findMatchingAutomationRules;
    private doesTriggerMatch;
    private evaluateConditions;
    private evaluateCondition;
    private executeAutomationRule;
    private executeAutomationAction;
    private handleCreateTaskAction;
    private handleUpdateTaskAction;
    private handleAssignTaskAction;
    private handleEscalateTaskAction;
    private handleSendNotificationAction;
    private handleCreateReminderAction;
    private handleUpdateCasePhaseAction;
    private handleCreateDependencyAction;
    private scheduleDelayedAction;
    processPendingAutomations(): Promise<AutomationResult[]>;
    private getNestedValue;
    addAutomationRule(rule: AutomationRule): void;
    getAutomationRule(id: string): AutomationRule | undefined;
    getAutomationRules(activeOnly?: boolean): AutomationRule[];
    updateAutomationRule(id: string, updates: Partial<AutomationRule>): boolean;
    deleteAutomationRule(id: string): boolean;
    activateAutomationRule(id: string): boolean;
    deactivateAutomationRule(id: string): boolean;
    getAutomationHistory(limit?: number): Array<{
        id: string;
        ruleId: string;
        ruleName: string;
        context: AutomationContext;
        result: AutomationResult;
        timestamp: Date;
    }>;
    getPendingAutomations(): Array<{
        id: string;
        rule: AutomationRule;
        context: AutomationContext;
        scheduledTime: Date;
    }>;
    getAutomationStats(): {
        totalRules: number;
        activeRules: number;
        totalTriggers: number;
        pendingAutomations: number;
        recentHistory: number;
    };
}
//# sourceMappingURL=TaskAutomationService.d.ts.map
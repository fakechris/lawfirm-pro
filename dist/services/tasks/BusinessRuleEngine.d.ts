import { UserRole } from '@prisma/client';
export interface BusinessRule {
    id: string;
    name: string;
    description: string;
    category: 'task_assignment' | 'escalation' | 'deadline_management' | 'workload_balance' | 'compliance' | 'quality_control';
    priority: number;
    isActive: boolean;
    conditions: BusinessCondition[];
    actions: BusinessAction[];
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    lastTriggered?: Date;
    triggerCount: number;
    successCount: number;
    failureCount: number;
}
export interface BusinessCondition {
    id: string;
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'matches_pattern';
    value: any;
    logicalOperator?: 'AND' | 'OR';
    weight?: number;
}
export interface BusinessAction {
    id: string;
    type: 'assign_task' | 'escalate_task' | 'change_priority' | 'set_deadline' | 'send_notification' | 'create_dependency' | 'update_status' | 'request_review' | 'reassign_task';
    parameters: Record<string, any>;
    failureStrategy: 'continue' | 'stop' | 'rollback';
    weight?: number;
}
export interface RuleEvaluationContext {
    caseId?: string;
    taskId?: string;
    userId?: string;
    timestamp: Date;
    metadata: Record<string, any>;
    triggerEvent: {
        type: 'task_created' | 'task_updated' | 'phase_changed' | 'deadline_approaching' | 'user_action' | 'system_event';
        details: Record<string, any>;
    };
}
export interface RuleEvaluationResult {
    ruleId: string;
    ruleName: string;
    matched: boolean;
    score: number;
    confidence: number;
    actionsExecuted: BusinessAction[];
    results: ActionResult[];
    errors: string[];
    warnings: string[];
    executionTime: number;
}
export interface ActionResult {
    actionId: string;
    actionType: string;
    success: boolean;
    result: any;
    error?: string;
    executionTime: number;
}
export interface TaskAssignmentCandidate {
    userId: string;
    userName: string;
    role: UserRole;
    score: number;
    factors: AssignmentFactor[];
    available: boolean;
    currentWorkload: number;
    expertise: string[];
}
export interface AssignmentFactor {
    name: string;
    value: number;
    weight: number;
    description: string;
}
export interface EscalationPath {
    level: number;
    fromRole: UserRole;
    toRole: UserRole;
    conditions: EscalationCondition[];
    notificationRules: NotificationRule[];
    approvalRequired: boolean;
}
export interface EscalationCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than';
    value: any;
}
export interface NotificationRule {
    type: 'email' | 'in_app' | 'sms';
    recipients: string[];
    template: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    delay?: number;
}
export interface BusinessRuleStats {
    totalRules: number;
    activeRules: number;
    totalEvaluations: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    topPerformingRules: Array<{
        ruleId: string;
        ruleName: string;
        successRate: number;
        executionCount: number;
    }>;
    ruleCategories: Array<{
        category: string;
        ruleCount: number;
        executionCount: number;
    }>;
}
export declare class BusinessRuleEngine {
    private rules;
    private escalationPaths;
    private assignmentMatrix;
    private evaluationHistory;
    private performanceMetrics;
    constructor();
    private initializeDefaultRules;
    private initializeEscalationPaths;
    private initializeAssignmentMatrix;
    evaluateRules(context: RuleEvaluationContext): Promise<RuleEvaluationResult[]>;
    private evaluateRule;
    private evaluateConditions;
    private evaluateCondition;
    private executeAction;
    private handleAssignTaskAction;
    private handleEscalateTaskAction;
    private handleChangePriorityAction;
    private handleSetDeadlineAction;
    private handleSendNotificationAction;
    private handleCreateDependencyAction;
    private handleUpdateStatusAction;
    private handleRequestReviewAction;
    private handleReassignTaskAction;
    private findAssignmentCandidates;
    private selectByExpertise;
    private selectByWorkload;
    private selectByPriority;
    private calculateComplexityBasedDeadline;
    private calculateDependencyBasedDeadline;
    private getNestedValue;
    private updatePerformanceMetrics;
    addRule(rule: BusinessRule): void;
    getRule(id: string): BusinessRule | undefined;
    getRules(category?: string, activeOnly?: boolean): BusinessRule[];
    updateRule(id: string, updates: Partial<BusinessRule>): boolean;
    deleteRule(id: string): boolean;
    activateRule(id: string): boolean;
    deactivateRule(id: string): boolean;
    getStats(): BusinessRuleStats;
    getEvaluationHistory(limit?: number): Array<{
        id: string;
        context: RuleEvaluationContext;
        results: RuleEvaluationResult[];
        timestamp: Date;
    }>;
    getEscalationPaths(role?: UserRole): EscalationPath[];
    addEscalationPath(role: UserRole, path: EscalationPath): void;
    testRule(ruleId: string, context: RuleEvaluationContext): Promise<RuleEvaluationResult>;
}
//# sourceMappingURL=BusinessRuleEngine.d.ts.map
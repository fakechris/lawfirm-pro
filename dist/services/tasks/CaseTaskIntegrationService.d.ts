import { CaseType, CasePhase, UserRole } from '@prisma/client';
import { WorkflowResult } from './WorkflowEngine';
export interface CaseTaskIntegration {
    caseId: string;
    caseType: CaseType;
    currentPhase: CasePhase;
    previousPhase?: CasePhase;
    userId: string;
    userRole: UserRole;
    metadata: Record<string, any>;
}
export interface PhaseTransitionResult {
    success: boolean;
    phaseTransitionValid: boolean;
    tasksCreated: number;
    tasksUpdated: number;
    notificationsSent: number;
    errors: string[];
    warnings: string[];
    workflowResults: WorkflowResult[];
}
export interface TaskWorkflowOrchestration {
    caseId: string;
    phase: CasePhase;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    upcomingDeadlines: number;
    automationRulesTriggered: number;
    businessRulesEvaluated: number;
    workloadBalance: number;
}
export declare class CaseTaskIntegrationService {
    private workflowEngine;
    private taskAutomationService;
    private taskTemplateService;
    private taskSchedulingService;
    private businessRuleEngine;
    private caseStateMachine;
    constructor();
    handleCasePhaseTransition(integration: CaseTaskIntegration): Promise<PhaseTransitionResult>;
    private validatePhaseTransition;
    private scheduleCreatedTask;
    private calculateDefaultDueDate;
    getTaskWorkflowOrchestration(caseId: string): Promise<TaskWorkflowOrchestration>;
    getAvailablePhaseTransitions(caseId: string, currentPhase: CasePhase, caseType: CaseType, userRole: UserRole): CasePhase[];
    getPhaseRequirements(phase: CasePhase, caseType: CaseType): string[];
    handleTaskCompletion(taskId: string, caseId: string, userId: string, metadata?: Record<string, any>): Promise<{
        success: boolean;
        followUpTasks: any[];
        notifications: any[];
        errors: string[];
    }>;
    getCaseTaskTemplates(caseType: CaseType, phase?: CasePhase): any[];
    getCaseWorkflowHistory(caseId: string): any[];
    getCaseAutomationHistory(caseId: string): any[];
    getCaseScheduleHistory(caseId: string): any[];
    getCaseTaskStatistics(caseId: string): {
        totalTasks: number;
        activeTasks: number;
        completedTasks: number;
        overdueTasks: number;
        highPriorityTasks: number;
        automationEfficiency: number;
        averageCompletionTime: number;
        workflowHealth: number;
    };
    processScheduledAutomations(): Promise<{
        recurringTasksProcessed: number;
        pendingAutomationsProcessed: number;
        errors: string[];
    }>;
    getIntegrationHealth(): {
        workflowEngine: {
            status: string;
            rulesCount: number;
            templatesCount: number;
        };
        taskAutomation: {
            status: string;
            activeRules: number;
            pendingAutomations: number;
        };
        taskScheduling: {
            status: string;
            scheduledTasks: number;
            conflicts: number;
        };
        businessRules: {
            status: string;
            activeRules: number;
            evaluationRate: number;
        };
        caseIntegration: {
            status: string;
            supportedCaseTypes: number;
            phaseTransitions: number;
        };
        overall: string;
    };
}
//# sourceMappingURL=CaseTaskIntegrationService.d.ts.map
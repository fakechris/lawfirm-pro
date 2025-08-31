import { Database } from '../../utils/database';
import { CasePhase, CaseType, CaseStatus, UserRole } from '@prisma/client';
export interface PhaseRequirements {
    phase: CasePhase;
    requirements: string[];
    estimatedDuration?: number;
    criticalTasks: string[];
    deliverables: string[];
}
export interface LifecycleEvent {
    eventType: 'PHASE_ENTERED' | 'PHASE_COMPLETED' | 'STATUS_CHANGED' | 'MILESTONE_REACHED';
    phase: CasePhase;
    status?: CaseStatus;
    timestamp: Date;
    userId: string;
    description: string;
    metadata?: Record<string, any>;
}
export interface CaseProgress {
    currentPhase: CasePhase;
    currentStatus: CaseStatus;
    progressPercentage: number;
    completedPhases: CasePhase[];
    upcomingMilestones: string[];
    overdueTasks: string[];
    estimatedCompletion?: Date;
}
export declare class CaseLifecycleService {
    private db;
    private stateMachine;
    private phaseValidator;
    private caseTypeValidator;
    constructor(db: Database);
    initializeCaseLifecycle(caseId: string, caseType: CaseType, userId: string): Promise<LifecycleEvent[]>;
    transitionToPhase(caseId: string, targetPhase: CasePhase, userId: string, userRole: UserRole, metadata?: Record<string, any>): Promise<{
        success: boolean;
        events: LifecycleEvent[];
        errors?: string[];
    }>;
    updateCaseStatus(caseId: string, newStatus: CaseStatus, userId: string, reason?: string): Promise<LifecycleEvent>;
    getCaseProgress(caseId: string): Promise<CaseProgress>;
    getPhaseRequirements(phase: CasePhase, caseType: CaseType): Promise<PhaseRequirements>;
    private getCaseState;
    private logLifecycleEvent;
    private updateCasePhase;
    private executePhaseEntryLogic;
    private executeIntakePhaseLogic;
    private executePreparationPhaseLogic;
    private executeProceedingsPhaseLogic;
    private executeResolutionPhaseLogic;
    private executeClosurePhaseLogic;
    private getUpcomingMilestones;
    private getOverdueTasks;
    private calculateEstimatedCompletion;
    private getCaseTypeSpecificRequirements;
}
//# sourceMappingURL=CaseLifecycleService.d.ts.map
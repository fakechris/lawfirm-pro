import { CasePhase, CaseType, CaseStatus, UserRole } from '@prisma/client';
export interface StateTransition {
    from: CasePhase;
    to: CasePhase;
    allowedRoles: UserRole[];
    conditions?: TransitionCondition[];
    requiredFields?: string[];
}
export interface TransitionCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists';
    value: any;
}
export interface TransitionResult {
    success: boolean;
    message?: string;
    errors?: string[];
}
export interface CaseState {
    phase: CasePhase;
    status: CaseStatus;
    caseType: CaseType;
    metadata?: Record<string, any>;
}
export declare class StateMachine {
    private transitions;
    private caseTypeWorkflows;
    constructor();
    private initializeTransitions;
    private initializeCaseTypeWorkflows;
    canTransition(currentState: CaseState, targetPhase: CasePhase, userRole: UserRole, metadata?: Record<string, any>): TransitionResult;
    private evaluateCondition;
    getAvailableTransitions(currentState: CaseState, userRole: UserRole): CasePhase[];
    getPhaseRequirements(phase: CasePhase, caseType: CaseType): string[];
    getCaseTypeWorkflow(caseType: CaseType): StateTransition[];
    getAllTransitions(): StateTransition[];
}
//# sourceMappingURL=StateMachine.d.ts.map
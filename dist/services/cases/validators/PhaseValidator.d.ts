import { CasePhase, CaseStatus, CaseType, Case } from '@prisma/client';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}
export interface PhaseValidationRule {
    phase: CasePhase;
    requiredFields: string[];
    conditionalRules?: PhaseConditionalRule[];
    statusRules?: StatusRule[];
}
export interface PhaseConditionalRule {
    condition: string;
    requiredFields: string[];
    errorMessage: string;
}
export interface StatusRule {
    fromStatus: CaseStatus[];
    toStatus: CaseStatus[];
    allowed: boolean;
    reason?: string;
}
export declare class PhaseValidator {
    private phaseRules;
    constructor();
    private initializePhaseRules;
    validatePhaseTransition(currentCase: Case, targetPhase: CasePhase, metadata?: Record<string, any>): Promise<ValidationResult>;
    validateStatusTransition(currentStatus: CaseStatus, targetStatus: CaseStatus, currentPhase: CasePhase): Promise<ValidationResult>;
    validatePhaseCompletion(currentCase: Case, metadata?: Record<string, any>): Promise<ValidationResult>;
    getPhaseRequirements(phase: CasePhase, caseType: CaseType): string[];
    getPhaseProgress(phase: CasePhase, metadata?: Record<string, any>): number;
    private checkRequiredFields;
    private checkConditionalRules;
    private validatePhaseTransitionOrder;
    private getPhaseWarnings;
    private checkPhaseCompletion;
    private getPhaseCompletionWarnings;
    private evaluateCondition;
}
//# sourceMappingURL=PhaseValidator.d.ts.map
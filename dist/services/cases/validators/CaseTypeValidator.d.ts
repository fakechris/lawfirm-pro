import { CaseType, CasePhase } from '@prisma/client';
export interface CaseTypeValidationRule {
    caseType: CaseType;
    requiredFields: string[];
    prohibitedFields?: string[];
    phaseSpecificRules: PhaseSpecificRule[];
    documentRequirements: DocumentRequirement[];
    timelineConstraints?: TimelineConstraint[];
    feeStructures?: string[];
}
export interface PhaseSpecificRule {
    phase: CasePhase;
    additionalRequiredFields: string[];
    conditionalRules: string[];
    validationFunctions: string[];
}
export interface DocumentRequirement {
    documentType: string;
    required: boolean;
    phase: CasePhase;
    description: string;
}
export interface TimelineConstraint {
    phase: CasePhase;
    maxDuration: number;
    criticalMilestones: string[];
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
    recommendations?: string[];
}
export declare class CaseTypeValidator {
    private caseTypeRules;
    constructor();
    private initializeCaseTypeRules;
    validateCaseTypeTransition(caseType: CaseType, fromPhase: CasePhase, toPhase: CasePhase, metadata?: Record<string, any>): Promise<ValidationResult>;
    validateCaseTypeInitialization(caseType: CaseType, metadata?: Record<string, any>): Promise<ValidationResult>;
    getCaseTypeRequirements(caseType: CaseType, phase?: CasePhase): string[];
    getCaseTypeDocumentRequirements(caseType: CaseType, phase?: CasePhase): DocumentRequirement[];
    getCaseTypeTimelineConstraints(caseType: CaseType): TimelineConstraint[];
    getSupportedFeeStructures(caseType: CaseType): string[];
    private checkRequiredFields;
    private checkProhibitedFields;
    private checkConditionalRules;
    private checkTimelineConstraints;
    private checkDocumentRequirements;
    private getCaseTypeRecommendations;
    private getInitializationWarnings;
}
//# sourceMappingURL=CaseTypeValidator.d.ts.map
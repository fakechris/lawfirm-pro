"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhaseValidator = void 0;
const client_1 = require("@prisma/client");
class PhaseValidator {
    constructor() {
        this.phaseRules = new Map();
        this.initializePhaseRules();
    }
    initializePhaseRules() {
        const rules = {
            [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: {
                phase: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                requiredFields: ['clientInformation', 'caseDescription', 'initialContactDate'],
                conditionalRules: [
                    {
                        condition: 'caseType === CRIMINAL_DEFENSE',
                        requiredFields: ['arrestDate', 'charges', 'policeReportNumber'],
                        errorMessage: 'Criminal defense cases require arrest information and police report number'
                    },
                    {
                        condition: 'caseType === MEDICAL_MALPRACTICE',
                        requiredFields: ['incidentDate', 'healthcareProvider', 'injuryDescription'],
                        errorMessage: 'Medical malpractice cases require incident details and healthcare provider information'
                    },
                    {
                        condition: 'caseType === DIVORCE_FAMILY',
                        requiredFields: ['marriageDate', 'spouseInformation', 'childrenInformation'],
                        errorMessage: 'Divorce/Family cases require marriage and family information'
                    }
                ],
                statusRules: [
                    {
                        fromStatus: [client_1.CaseStatus.INTAKE],
                        toStatus: [client_1.CaseStatus.ACTIVE, client_1.CaseStatus.PENDING],
                        allowed: true
                    },
                    {
                        fromStatus: [client_1.CaseStatus.INTAKE],
                        toStatus: [client_1.CaseStatus.CLOSED],
                        allowed: true,
                        reason: 'Case can be rejected during intake'
                    }
                ]
            },
            [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: {
                phase: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                requiredFields: ['legalResearchCompleted', 'documentPreparationStarted', 'strategyDefined'],
                conditionalRules: [
                    {
                        condition: 'caseType === CRIMINAL_DEFENSE',
                        requiredFields: ['bailHearingScheduled', 'evidenceSecured', 'witnessList'],
                        errorMessage: 'Criminal defense requires bail hearing and evidence securing'
                    },
                    {
                        condition: 'caseType === MEDICAL_MALPRACTICE',
                        requiredFields: ['expertConsultationCompleted', 'medicalRecordsReviewed', 'violationAnalysis'],
                        errorMessage: 'Medical malpractice requires expert consultation and medical record review'
                    },
                    {
                        condition: 'caseType === CONTRACT_DISPUTE',
                        requiredFields: ['contractAnalyzed', 'breachIdentified', 'damagesCalculated'],
                        errorMessage: 'Contract disputes require contract analysis and breach identification'
                    }
                ],
                statusRules: [
                    {
                        fromStatus: [client_1.CaseStatus.INTAKE, client_1.CaseStatus.PENDING],
                        toStatus: [client_1.CaseStatus.ACTIVE],
                        allowed: true
                    }
                ]
            },
            [client_1.CasePhase.FORMAL_PROCEEDINGS]: {
                phase: client_1.CasePhase.FORMAL_PROCEEDINGS,
                requiredFields: ['courtDocumentsFiled', 'hearingScheduled', 'evidenceSubmitted'],
                conditionalRules: [
                    {
                        condition: 'caseType === CRIMINAL_DEFENSE',
                        requiredFields: ['arraignmentCompleted', 'pleaEntered', 'trialDateSet'],
                        errorMessage: 'Criminal defense requires arraignment and plea entry'
                    },
                    {
                        condition: 'caseType === DIVORCE_FAMILY',
                        requiredFields: ['mediationCompleted', 'custodyAgreement', 'assetDivision'],
                        errorMessage: 'Divorce cases require mediation and custody agreements'
                    },
                    {
                        condition: 'caseType === ADMINISTRATIVE_CASE',
                        requiredFields: ['administrativeHearingScheduled', 'evidencePackageSubmitted'],
                        errorMessage: 'Administrative cases require hearing scheduling and evidence submission'
                    }
                ],
                statusRules: [
                    {
                        fromStatus: [client_1.CaseStatus.ACTIVE],
                        toStatus: [client_1.CaseStatus.PENDING],
                        allowed: true,
                        reason: 'Case may be pending during proceedings'
                    }
                ]
            },
            [client_1.CasePhase.RESOLUTION_POST_PROCEEDING]: {
                phase: client_1.CasePhase.RESOLUTION_POST_PROCEEDING,
                requiredFields: ['judgmentReceived', 'resolutionDocumented', 'appealPeriodStarted'],
                conditionalRules: [
                    {
                        condition: 'caseType === CRIMINAL_DEFENSE',
                        requiredFields: ['sentencingCompleted', 'appealConsidered', 'probationTerms'],
                        errorMessage: 'Criminal defense requires sentencing completion and appeal consideration'
                    },
                    {
                        condition: 'caseType === CONTRACT_DISPUTE',
                        requiredFields: ['judgmentEnforced', 'settlementReceived', 'damagesCollected'],
                        errorMessage: 'Contract disputes require judgment enforcement and settlement'
                    },
                    {
                        condition: 'caseType === INHERITANCE_DISPUTE',
                        requiredFields: ['willProbated', 'assetsDistributed', 'taxesPaid'],
                        errorMessage: 'Inheritance disputes require will probate and asset distribution'
                    }
                ],
                statusRules: [
                    {
                        fromStatus: [client_1.CaseStatus.ACTIVE, client_1.CaseStatus.PENDING],
                        toStatus: [client_1.CaseStatus.COMPLETED],
                        allowed: true
                    }
                ]
            },
            [client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING]: {
                phase: client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING,
                requiredFields: ['finalDocumentation', 'clientNotified', 'feesSettled'],
                conditionalRules: [
                    {
                        condition: 'caseType === CRIMINAL_DEFENSE',
                        requiredFields: ['recordExpunged', 'probationCompleted', 'restrictionsLifted'],
                        errorMessage: 'Criminal defense requires record handling and probation completion'
                    },
                    {
                        condition: 'caseType === DIVORCE_FAMILY',
                        requiredFields: ['childSupportArranged', 'visitationSchedule', 'nameChangeProcessed'],
                        errorMessage: 'Divorce cases require child support and visitation arrangements'
                    },
                    {
                        condition: 'caseType === MEDICAL_MALPRACTICE',
                        requiredFields: ['medicalBillsPaid', 'insuranceClaimsSettled', 'followUpCare'],
                        errorMessage: 'Medical malpractice requires medical billing and insurance settlement'
                    }
                ],
                statusRules: [
                    {
                        fromStatus: [client_1.CaseStatus.COMPLETED],
                        toStatus: [client_1.CaseStatus.CLOSED],
                        allowed: true
                    },
                    {
                        fromStatus: [client_1.CaseStatus.ACTIVE, client_1.CaseStatus.PENDING],
                        toStatus: [client_1.CaseStatus.CLOSED],
                        allowed: true,
                        reason: 'Case can be closed directly from active status'
                    }
                ]
            }
        };
        Object.entries(rules).forEach(([phase, rule]) => {
            this.phaseRules.set(phase, rule);
        });
    }
    async validatePhaseTransition(currentCase, targetPhase, metadata) {
        const errors = [];
        const warnings = [];
        const targetPhaseRules = this.phaseRules.get(targetPhase);
        if (!targetPhaseRules) {
            errors.push(`No validation rules found for phase: ${targetPhase}`);
            return { isValid: false, errors };
        }
        const missingFields = this.checkRequiredFields(targetPhaseRules.requiredFields, metadata);
        if (missingFields.length > 0) {
            errors.push(`Missing required fields for ${targetPhase}: ${missingFields.join(', ')}`);
        }
        const conditionalErrors = this.checkConditionalRules(targetPhaseRules, currentCase.caseType, metadata);
        errors.push(...conditionalErrors);
        const transitionErrors = this.validatePhaseTransitionOrder(currentCase.phase, targetPhase);
        errors.push(...transitionErrors);
        const phaseWarnings = this.getPhaseWarnings(targetPhase, currentCase.caseType, metadata);
        warnings.push(...phaseWarnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
    async validateStatusTransition(currentStatus, targetStatus, currentPhase) {
        const errors = [];
        const phaseRules = this.phaseRules.get(currentPhase);
        if (!phaseRules || !phaseRules.statusRules) {
            return { isValid: true, errors: [] };
        }
        const applicableRule = phaseRules.statusRules.find(rule => rule.fromStatus.includes(currentStatus) && rule.toStatus.includes(targetStatus));
        if (!applicableRule) {
            errors.push(`Status transition from ${currentStatus} to ${targetStatus} is not defined for phase ${currentPhase}`);
            return { isValid: false, errors };
        }
        if (!applicableRule.allowed) {
            errors.push(applicableRule.reason || `Status transition from ${currentStatus} to ${targetStatus} is not allowed`);
        }
        return { isValid: errors.length === 0, errors };
    }
    async validatePhaseCompletion(currentCase, metadata) {
        const errors = [];
        const warnings = [];
        const phaseRules = this.phaseRules.get(currentCase.phase);
        if (!phaseRules) {
            errors.push(`No validation rules found for phase: ${currentCase.phase}`);
            return { isValid: false, errors };
        }
        const missingFields = this.checkRequiredFields(phaseRules.requiredFields, metadata);
        if (missingFields.length > 0) {
            errors.push(`Cannot complete phase ${currentCase.phase}. Missing required fields: ${missingFields.join(', ')}`);
        }
        const conditionalErrors = this.checkConditionalRules(phaseRules, currentCase.caseType, metadata);
        errors.push(...conditionalErrors);
        const completionErrors = this.checkPhaseCompletion(currentCase.phase, currentCase.caseType, metadata);
        errors.push(...completionErrors);
        const completionWarnings = this.getPhaseCompletionWarnings(currentCase.phase, currentCase.caseType, metadata);
        warnings.push(...completionWarnings);
        return {
            isValid: errors.length === 0,
            errors,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
    getPhaseRequirements(phase, caseType) {
        const phaseRules = this.phaseRules.get(phase);
        if (!phaseRules)
            return [];
        const requirements = [...phaseRules.requiredFields];
        const conditionalRule = phaseRules.conditionalRules?.find(rule => this.evaluateCondition(rule.condition, { caseType }));
        if (conditionalRule) {
            requirements.push(...conditionalRule.requiredFields);
        }
        return requirements;
    }
    getPhaseProgress(phase, metadata) {
        const phaseRules = this.phaseRules.get(phase);
        if (!phaseRules || !metadata)
            return 0;
        const requiredFields = [...phaseRules.requiredFields];
        const conditionalRule = phaseRules.conditionalRules?.find(rule => this.evaluateCondition(rule.condition, metadata));
        if (conditionalRule) {
            requiredFields.push(...conditionalRule.requiredFields);
        }
        const completedFields = requiredFields.filter(field => metadata[field] !== undefined && metadata[field] !== null);
        return requiredFields.length > 0 ? Math.round((completedFields.length / requiredFields.length) * 100) : 0;
    }
    checkRequiredFields(requiredFields, metadata) {
        if (!metadata)
            return requiredFields;
        return requiredFields.filter(field => {
            const value = metadata[field];
            return value === undefined || value === null || value === '';
        });
    }
    checkConditionalRules(phaseRules, caseType, metadata) {
        const errors = [];
        if (!phaseRules.conditionalRules || !metadata) {
            return errors;
        }
        for (const rule of phaseRules.conditionalRules) {
            if (this.evaluateCondition(rule.condition, { ...metadata, caseType })) {
                const missingFields = this.checkRequiredFields(rule.requiredFields, metadata);
                if (missingFields.length > 0) {
                    errors.push(rule.errorMessage);
                }
            }
        }
        return errors;
    }
    validatePhaseTransitionOrder(currentPhase, targetPhase) {
        const errors = [];
        const phaseOrder = [
            client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
            client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
            client_1.CasePhase.FORMAL_PROCEEDINGS,
            client_1.CasePhase.RESOLUTION_POST_PROCEEDING,
            client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING
        ];
        const currentIndex = phaseOrder.indexOf(currentPhase);
        const targetIndex = phaseOrder.indexOf(targetPhase);
        if (currentIndex === -1 || targetIndex === -1) {
            errors.push('Invalid phase specified');
            return errors;
        }
        if (targetIndex <= currentIndex && targetPhase !== client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING) {
            errors.push(`Cannot transition from ${currentPhase} to ${targetPhase}. Phases must progress forward.`);
        }
        return errors;
    }
    getPhaseWarnings(phase, caseType, metadata) {
        const warnings = [];
        switch (caseType) {
            case client_1.CaseType.CRIMINAL_DEFENSE:
                if (phase === client_1.CasePhase.FORMAL_PROCEEDINGS && (!metadata || !metadata['bailPosted'])) {
                    warnings.push('Bail has not been posted for criminal defense case');
                }
                break;
            case client_1.CaseType.MEDICAL_MALPRACTICE:
                if (phase === client_1.CasePhase.PRE_PROCEEDING_PREPARATION && (!metadata || !metadata['statuteOfLimitationsChecked'])) {
                    warnings.push('Statute of limitations should be verified for medical malpractice case');
                }
                break;
            case client_1.CaseType.DIVORCE_FAMILY:
                if (phase === client_1.CasePhase.FORMAL_PROCEEDINGS && (!metadata || !metadata['minorChildrenInvolved'])) {
                    warnings.push('Child custody arrangements should be confirmed for divorce cases');
                }
                break;
        }
        return warnings;
    }
    checkPhaseCompletion(phase, caseType, metadata) {
        const errors = [];
        switch (phase) {
            case client_1.CasePhase.INTAKE_RISK_ASSESSMENT:
                if (!metadata || !metadata['conflictCheckCompleted']) {
                    errors.push('Conflict check must be completed before ending intake phase');
                }
                break;
            case client_1.CasePhase.PRE_PROCEEDING_PREPARATION:
                if (!metadata || !metadata['clientAgreementSigned']) {
                    errors.push('Client agreement must be signed before ending preparation phase');
                }
                break;
            case client_1.CasePhase.FORMAL_PROCEEDINGS:
                if (!metadata || !metadata['allHearingsAttended']) {
                    errors.push('All required hearings must be attended before ending proceedings phase');
                }
                break;
            case client_1.CasePhase.RESOLUTION_POST_PROCEEDING:
                if (!metadata || !metadata['finalJudgmentReceived']) {
                    errors.push('Final judgment must be received before ending resolution phase');
                }
                break;
        }
        return errors;
    }
    getPhaseCompletionWarnings(phase, caseType, metadata) {
        const warnings = [];
        switch (phase) {
            case client_1.CasePhase.PRE_PROCEEDING_PREPARATION:
                if (!metadata || !metadata['deadlinesMet']) {
                    warnings.push('Some preparation deadlines may not have been met');
                }
                break;
            case client_1.CasePhase.FORMAL_PROCEEDINGS:
                if (!metadata || !metadata['allEvidenceSubmitted']) {
                    warnings.push('Not all evidence has been submitted in court');
                }
                break;
        }
        return warnings;
    }
    evaluateCondition(condition, context) {
        try {
            const safeCondition = condition
                .replace(/caseType/g, 'context.caseType')
                .replace(/===/g, '===')
                .replace(/&&/g, '&&')
                .replace(/||/g, '||');
            return new Function('context', `return ${safeCondition}`)(context);
        }
        catch (error) {
            console.warn(`Error evaluating condition: ${condition}`, error);
            return false;
        }
    }
}
exports.PhaseValidator = PhaseValidator;
//# sourceMappingURL=PhaseValidator.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachine = void 0;
const client_1 = require("@prisma/client");
class StateMachine {
    constructor() {
        this.transitions = new Map();
        this.caseTypeWorkflows = new Map();
        this.initializeTransitions();
        this.initializeCaseTypeWorkflows();
    }
    initializeTransitions() {
        const phaseTransitions = {
            [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: [
                {
                    from: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                    to: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'riskAssessmentCompleted', operator: 'equals', value: true }
                    ],
                    requiredFields: ['clientInformation', 'caseDescription', 'initialEvidence']
                },
                {
                    from: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                    to: client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'caseRejected', operator: 'equals', value: true }
                    ]
                }
            ],
            [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: [
                {
                    from: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                    to: client_1.CasePhase.FORMAL_PROCEEDINGS,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'preparationCompleted', operator: 'equals', value: true }
                    ],
                    requiredFields: ['legalResearch', 'documentPreparation', 'witnessPreparation']
                },
                {
                    from: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                    to: client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'caseSettled', operator: 'equals', value: true }
                    ]
                }
            ],
            [client_1.CasePhase.FORMAL_PROCEEDINGS]: [
                {
                    from: client_1.CasePhase.FORMAL_PROCEEDINGS,
                    to: client_1.CasePhase.RESOLUTION_POST_PROCEEDING,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'proceedingsCompleted', operator: 'equals', value: true }
                    ]
                },
                {
                    from: client_1.CasePhase.FORMAL_PROCEEDINGS,
                    to: client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'caseDismissed', operator: 'equals', value: true }
                    ]
                }
            ],
            [client_1.CasePhase.RESOLUTION_POST_PROCEEDING]: [
                {
                    from: client_1.CasePhase.RESOLUTION_POST_PROCEEDING,
                    to: client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING,
                    allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                    conditions: [
                        { field: 'resolutionCompleted', operator: 'equals', value: true }
                    ],
                    requiredFields: ['finalJudgment', 'settlementAgreement', 'appealPeriod']
                }
            ],
            [client_1.CasePhase.CLOSURE_REVIEW_ARCHIVING]: []
        };
        Object.entries(phaseTransitions).forEach(([phase, transitions]) => {
            this.transitions.set(phase, transitions);
        });
    }
    initializeCaseTypeWorkflows() {
        const caseTypeSpecificWorkflows = {
            [client_1.CaseType.CRIMINAL_DEFENSE]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: [
                    {
                        from: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                        to: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'bailHearingScheduled', operator: 'equals', value: true },
                            { field: 'evidenceSecured', operator: 'equals', value: true }
                        ],
                        requiredFields: ['arrestRecords', 'policeReports', 'witnessStatements']
                    }
                ]
            },
            [client_1.CaseType.DIVORCE_FAMILY]: {
                [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: [
                    {
                        from: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        to: client_1.CasePhase.FORMAL_PROCEEDINGS,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'mediationAttempted', operator: 'equals', value: true },
                            { field: 'custodyAgreement', operator: 'exists', value: null }
                        ],
                        requiredFields: ['marriageCertificate', 'financialDisclosures', 'childCustodyPlan']
                    }
                ]
            },
            [client_1.CaseType.MEDICAL_MALPRACTICE]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: [
                    {
                        from: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                        to: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'medicalRecordsReviewed', operator: 'equals', value: true },
                            { field: 'expertConsultationCompleted', operator: 'equals', value: true }
                        ],
                        requiredFields: ['medicalRecords', 'expertReports', 'hospitalDocumentation']
                    }
                ]
            },
            [client_1.CaseType.CONTRACT_DISPUTE]: {
                [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: [
                    {
                        from: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        to: client_1.CasePhase.FORMAL_PROCEEDINGS,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'contractAnalyzed', operator: 'equals', value: true },
                            { field: 'breachDocumented', operator: 'equals', value: true }
                        ],
                        requiredFields: ['contractDocument', 'breachEvidence', 'correspondence']
                    }
                ]
            },
            [client_1.CaseType.LABOR_DISPUTE]: {
                [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: [
                    {
                        from: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        to: client_1.CasePhase.FORMAL_PROCEEDINGS,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'laborBoardNotified', operator: 'equals', value: true },
                            { field: 'employmentHistoryVerified', operator: 'equals', value: true }
                        ],
                        requiredFields: ['employmentContract', 'payrollRecords', 'grievanceDocumentation']
                    }
                ]
            },
            [client_1.CaseType.INHERITANCE_DISPUTE]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: [
                    {
                        from: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                        to: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'willLocated', operator: 'exists', value: null },
                            { field: 'heirsIdentified', operator: 'equals', value: true }
                        ],
                        requiredFields: ['deathCertificate', 'willDocument', 'probateCourtFiling']
                    }
                ]
            },
            [client_1.CaseType.ADMINISTRATIVE_CASE]: {
                [client_1.CasePhase.FORMAL_PROCEEDINGS]: [
                    {
                        from: client_1.CasePhase.FORMAL_PROCEEDINGS,
                        to: client_1.CasePhase.RESOLUTION_POST_PROCEEDING,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'administrativeHearingCompleted', operator: 'equals', value: true },
                            { field: 'evidenceSubmitted', operator: 'equals', value: true }
                        ],
                        requiredFields: ['agencyDecision', 'appealDocumentation', 'complianceReport']
                    }
                ]
            },
            [client_1.CaseType.DEMOLITION_CASE]: {
                [client_1.CasePhase.PRE_PROCEEDING_PREPARATION]: [
                    {
                        from: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        to: client_1.CasePhase.FORMAL_PROCEEDINGS,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'propertyInspectionCompleted', operator: 'equals', value: true },
                            { field: 'noticesServed', operator: 'equals', value: true }
                        ],
                        requiredFields: ['propertySurvey', 'demolitionPermit', 'environmentalAssessment']
                    }
                ]
            },
            [client_1.CaseType.SPECIAL_MATTERS]: {
                [client_1.CasePhase.INTAKE_RISK_ASSESSMENT]: [
                    {
                        from: client_1.CasePhase.INTAKE_RISK_ASSESSMENT,
                        to: client_1.CasePhase.PRE_PROCEEDING_PREPARATION,
                        allowedRoles: [client_1.UserRole.ATTORNEY, client_1.UserRole.ADMIN],
                        conditions: [
                            { field: 'specializedAssessmentCompleted', operator: 'equals', value: true },
                            { field: 'expertConsultationScheduled', operator: 'equals', value: true }
                        ],
                        requiredFields: ['caseAssessment', 'expertReferral', 'specializedDocumentation']
                    }
                ]
            }
        };
        Object.entries(caseTypeSpecificWorkflows).forEach(([caseType, workflows]) => {
            this.caseTypeWorkflows.set(caseType, []);
            Object.entries(workflows).forEach(([phase, transitions]) => {
                if (transitions) {
                    const existingTransitions = this.transitions.get(phase) || [];
                    this.caseTypeWorkflows.get(caseType)?.push(...transitions);
                }
            });
        });
    }
    canTransition(currentState, targetPhase, userRole, metadata) {
        if (!this.transitions.has(currentState.phase)) {
            return {
                success: false,
                message: `Invalid current phase: ${currentState.phase}`,
                errors: [`Invalid current phase: ${currentState.phase}`]
            };
        }
        const availableTransitions = this.transitions.get(currentState.phase) || [];
        const caseTypeTransitions = this.caseTypeWorkflows.get(currentState.caseType) || [];
        const allTransitions = [...availableTransitions, ...caseTypeTransitions];
        const matchingTransition = allTransitions.find(transition => transition.to === targetPhase);
        if (!matchingTransition) {
            return {
                success: false,
                message: `Cannot transition from ${currentState.phase} to ${targetPhase}`,
                errors: [`Invalid transition from ${currentState.phase} to ${targetPhase}`]
            };
        }
        if (!matchingTransition.allowedRoles.includes(userRole)) {
            return {
                success: false,
                message: `User role ${userRole} is not authorized for this transition`,
                errors: [`Insufficient permissions for transition`]
            };
        }
        if (matchingTransition.requiredFields) {
            const missingFields = matchingTransition.requiredFields.filter(field => {
                return !metadata || !(field in metadata);
            });
            if (missingFields.length > 0) {
                return {
                    success: false,
                    message: `Missing required fields: ${missingFields.join(', ')}`,
                    errors: [`Missing required fields: ${missingFields.join(', ')}`]
                };
            }
        }
        if (matchingTransition.conditions) {
            const failedConditions = matchingTransition.conditions.filter(condition => {
                return !this.evaluateCondition(condition, metadata || {});
            });
            if (failedConditions.length > 0) {
                return {
                    success: false,
                    message: `Transition conditions not met`,
                    errors: failedConditions.map(condition => `Condition failed: ${condition.field} ${condition.operator} ${condition.value}`)
                };
            }
        }
        return {
            success: true,
            message: `Transition from ${currentState.phase} to ${targetPhase} is allowed`
        };
    }
    evaluateCondition(condition, metadata) {
        const fieldValue = metadata[condition.field];
        switch (condition.operator) {
            case 'equals':
                return fieldValue === condition.value;
            case 'not_equals':
                return fieldValue !== condition.value;
            case 'contains':
                return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
            case 'exists':
                return fieldValue !== undefined && fieldValue !== null;
            case 'not_exists':
                return fieldValue === undefined || fieldValue === null;
            default:
                return false;
        }
    }
    getAvailableTransitions(currentState, userRole) {
        const availableTransitions = this.transitions.get(currentState.phase) || [];
        const caseTypeTransitions = this.caseTypeWorkflows.get(currentState.caseType) || [];
        const allTransitions = [...availableTransitions, ...caseTypeTransitions];
        return allTransitions
            .filter(transition => transition.allowedRoles.includes(userRole))
            .map(transition => transition.to);
    }
    getPhaseRequirements(phase, caseType) {
        const transitions = this.transitions.get(phase) || [];
        const caseTypeTransitions = this.caseTypeWorkflows.get(caseType) || [];
        const allTransitions = [...transitions, ...caseTypeTransitions];
        const requirements = new Set();
        allTransitions.forEach(transition => {
            if (transition.requiredFields) {
                transition.requiredFields.forEach(field => requirements.add(field));
            }
        });
        return Array.from(requirements);
    }
    getCaseTypeWorkflow(caseType) {
        return this.caseTypeWorkflows.get(caseType) || [];
    }
    getAllTransitions() {
        const allTransitions = [];
        this.transitions.forEach(transitions => {
            allTransitions.push(...transitions);
        });
        this.caseTypeWorkflows.forEach(transitions => {
            allTransitions.push(...transitions);
        });
        return allTransitions;
    }
}
exports.StateMachine = StateMachine;
//# sourceMappingURL=StateMachine.js.map
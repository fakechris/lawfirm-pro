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

export class StateMachine {
  private transitions: Map<string, StateTransition[]>;
  private caseTypeWorkflows: Map<CaseType, StateTransition[]>;

  constructor() {
    this.transitions = new Map();
    this.caseTypeWorkflows = new Map();
    this.initializeTransitions();
    this.initializeCaseTypeWorkflows();
  }

  private initializeTransitions(): void {
    // Define all possible transitions for each phase
    const phaseTransitions: Record<CasePhase, StateTransition[]> = {
      [CasePhase.INTAKE_RISK_ASSESSMENT]: [
        {
          from: CasePhase.INTAKE_RISK_ASSESSMENT,
          to: CasePhase.PRE_PROCEEDING_PREPARATION,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'riskAssessmentCompleted', operator: 'equals', value: true }
          ],
          requiredFields: ['clientInformation', 'caseDescription', 'initialEvidence']
        },
        {
          from: CasePhase.INTAKE_RISK_ASSESSMENT,
          to: CasePhase.CLOSURE_REVIEW_ARCHIVING,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'caseRejected', operator: 'equals', value: true }
          ]
        }
      ],
      [CasePhase.PRE_PROCEEDING_PREPARATION]: [
        {
          from: CasePhase.PRE_PROCEEDING_PREPARATION,
          to: CasePhase.FORMAL_PROCEEDINGS,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'preparationCompleted', operator: 'equals', value: true }
          ],
          requiredFields: ['legalResearch', 'documentPreparation', 'witnessPreparation']
        },
        {
          from: CasePhase.PRE_PROCEEDING_PREPARATION,
          to: CasePhase.CLOSURE_REVIEW_ARCHIVING,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'caseSettled', operator: 'equals', value: true }
          ]
        }
      ],
      [CasePhase.FORMAL_PROCEEDINGS]: [
        {
          from: CasePhase.FORMAL_PROCEEDINGS,
          to: CasePhase.RESOLUTION_POST_PROCEEDING,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'proceedingsCompleted', operator: 'equals', value: true }
          ]
        },
        {
          from: CasePhase.FORMAL_PROCEEDINGS,
          to: CasePhase.CLOSURE_REVIEW_ARCHIVING,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'caseDismissed', operator: 'equals', value: true }
          ]
        }
      ],
      [CasePhase.RESOLUTION_POST_PROCEEDING]: [
        {
          from: CasePhase.RESOLUTION_POST_PROCEEDING,
          to: CasePhase.CLOSURE_REVIEW_ARCHIVING,
          allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
          conditions: [
            { field: 'resolutionCompleted', operator: 'equals', value: true }
          ],
          requiredFields: ['finalJudgment', 'settlementAgreement', 'appealPeriod']
        }
      ],
      [CasePhase.CLOSURE_REVIEW_ARCHIVING]: [
        // Terminal state - no outgoing transitions
      ]
    };

    // Store transitions in map for quick lookup
    Object.entries(phaseTransitions).forEach(([phase, transitions]) => {
      this.transitions.set(phase, transitions);
    });
  }

  private initializeCaseTypeWorkflows(): void {
    // Define case type-specific workflow modifications
    const caseTypeSpecificWorkflows: Record<CaseType, Partial<Record<CasePhase, StateTransition[]>>> = {
      [CaseType.CRIMINAL_DEFENSE]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: [
          {
            from: CasePhase.INTAKE_RISK_ASSESSMENT,
            to: CasePhase.PRE_PROCEEDING_PREPARATION,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'bailHearingScheduled', operator: 'equals', value: true },
              { field: 'evidenceSecured', operator: 'equals', value: true }
            ],
            requiredFields: ['arrestRecords', 'policeReports', 'witnessStatements']
          }
        ]
      },
      [CaseType.DIVORCE_FAMILY]: {
        [CasePhase.PRE_PROCEEDING_PREPARATION]: [
          {
            from: CasePhase.PRE_PROCEEDING_PREPARATION,
            to: CasePhase.FORMAL_PROCEEDINGS,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'mediationAttempted', operator: 'equals', value: true },
              { field: 'custodyAgreement', operator: 'exists', value: null }
            ],
            requiredFields: ['marriageCertificate', 'financialDisclosures', 'childCustodyPlan']
          }
        ]
      },
      [CaseType.MEDICAL_MALPRACTICE]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: [
          {
            from: CasePhase.INTAKE_RISK_ASSESSMENT,
            to: CasePhase.PRE_PROCEEDING_PREPARATION,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'medicalRecordsReviewed', operator: 'equals', value: true },
              { field: 'expertConsultationCompleted', operator: 'equals', value: true }
            ],
            requiredFields: ['medicalRecords', 'expertReports', 'hospitalDocumentation']
          }
        ]
      },
      [CaseType.CONTRACT_DISPUTE]: {
        [CasePhase.PRE_PROCEEDING_PREPARATION]: [
          {
            from: CasePhase.PRE_PROCEEDING_PREPARATION,
            to: CasePhase.FORMAL_PROCEEDINGS,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'contractAnalyzed', operator: 'equals', value: true },
              { field: 'breachDocumented', operator: 'equals', value: true }
            ],
            requiredFields: ['contractDocument', 'breachEvidence', 'correspondence']
          }
        ]
      },
      [CaseType.LABOR_DISPUTE]: {
        [CasePhase.PRE_PROCEEDING_PREPARATION]: [
          {
            from: CasePhase.PRE_PROCEEDING_PREPARATION,
            to: CasePhase.FORMAL_PROCEEDINGS,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'laborBoardNotified', operator: 'equals', value: true },
              { field: 'employmentHistoryVerified', operator: 'equals', value: true }
            ],
            requiredFields: ['employmentContract', 'payrollRecords', 'grievanceDocumentation']
          }
        ]
      },
      [CaseType.INHERITANCE_DISPUTE]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: [
          {
            from: CasePhase.INTAKE_RISK_ASSESSMENT,
            to: CasePhase.PRE_PROCEEDING_PREPARATION,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'willLocated', operator: 'exists', value: null },
              { field: 'heirsIdentified', operator: 'equals', value: true }
            ],
            requiredFields: ['deathCertificate', 'willDocument', 'probateCourtFiling']
          }
        ]
      },
      [CaseType.ADMINISTRATIVE_CASE]: {
        [CasePhase.FORMAL_PROCEEDINGS]: [
          {
            from: CasePhase.FORMAL_PROCEEDINGS,
            to: CasePhase.RESOLUTION_POST_PROCEEDING,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'administrativeHearingCompleted', operator: 'equals', value: true },
              { field: 'evidenceSubmitted', operator: 'equals', value: true }
            ],
            requiredFields: ['agencyDecision', 'appealDocumentation', 'complianceReport']
          }
        ]
      },
      [CaseType.DEMOLITION_CASE]: {
        [CasePhase.PRE_PROCEEDING_PREPARATION]: [
          {
            from: CasePhase.PRE_PROCEEDING_PREPARATION,
            to: CasePhase.FORMAL_PROCEEDINGS,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'propertyInspectionCompleted', operator: 'equals', value: true },
              { field: 'noticesServed', operator: 'equals', value: true }
            ],
            requiredFields: ['propertySurvey', 'demolitionPermit', 'environmentalAssessment']
          }
        ]
      },
      [CaseType.SPECIAL_MATTERS]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: [
          {
            from: CasePhase.INTAKE_RISK_ASSESSMENT,
            to: CasePhase.PRE_PROCEEDING_PREPARATION,
            allowedRoles: [UserRole.ATTORNEY, UserRole.ADMIN],
            conditions: [
              { field: 'specializedAssessmentCompleted', operator: 'equals', value: true },
              { field: 'expertConsultationScheduled', operator: 'equals', value: true }
            ],
            requiredFields: ['caseAssessment', 'expertReferral', 'specializedDocumentation']
          }
        ]
      }
    };

    // Apply case type-specific workflows
    Object.entries(caseTypeSpecificWorkflows).forEach(([caseType, workflows]) => {
      this.caseTypeWorkflows.set(caseType as CaseType, []);
      
      Object.entries(workflows).forEach(([phase, transitions]) => {
        if (transitions) {
          const existingTransitions = this.transitions.get(phase as CasePhase) || [];
          this.caseTypeWorkflows.get(caseType as CaseType)?.push(...transitions);
        }
      });
    });
  }

  public canTransition(
    currentState: CaseState,
    targetPhase: CasePhase,
    userRole: UserRole,
    metadata?: Record<string, any>
  ): TransitionResult {
    // Check if current phase exists
    if (!this.transitions.has(currentState.phase)) {
      return {
        success: false,
        message: `Invalid current phase: ${currentState.phase}`,
        errors: [`Invalid current phase: ${currentState.phase}`]
      };
    }

    // Get available transitions for current phase
    const availableTransitions = this.transitions.get(currentState.phase) || [];
    
    // Add case type-specific transitions
    const caseTypeTransitions = this.caseTypeWorkflows.get(currentState.caseType) || [];
    const allTransitions = [...availableTransitions, ...caseTypeTransitions];

    // Find matching transition
    const matchingTransition = allTransitions.find(
      transition => transition.to === targetPhase
    );

    if (!matchingTransition) {
      return {
        success: false,
        message: `Cannot transition from ${currentState.phase} to ${targetPhase}`,
        errors: [`Invalid transition from ${currentState.phase} to ${targetPhase}`]
      };
    }

    // Check role permissions
    if (!matchingTransition.allowedRoles.includes(userRole)) {
      return {
        success: false,
        message: `User role ${userRole} is not authorized for this transition`,
        errors: [`Insufficient permissions for transition`]
      };
    }

    // Check required fields
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

    // Check conditions
    if (matchingTransition.conditions) {
      const failedConditions = matchingTransition.conditions.filter(condition => {
        return !this.evaluateCondition(condition, metadata || {});
      });

      if (failedConditions.length > 0) {
        return {
          success: false,
          message: `Transition conditions not met`,
          errors: failedConditions.map(condition => 
            `Condition failed: ${condition.field} ${condition.operator} ${condition.value}`
          )
        };
      }
    }

    return {
      success: true,
      message: `Transition from ${currentState.phase} to ${targetPhase} is allowed`
    };
  }

  private evaluateCondition(condition: TransitionCondition, metadata: Record<string, any>): boolean {
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

  public getAvailableTransitions(currentState: CaseState, userRole: UserRole): CasePhase[] {
    const availableTransitions = this.transitions.get(currentState.phase) || [];
    const caseTypeTransitions = this.caseTypeWorkflows.get(currentState.caseType) || [];
    const allTransitions = [...availableTransitions, ...caseTypeTransitions];

    return allTransitions
      .filter(transition => transition.allowedRoles.includes(userRole))
      .map(transition => transition.to);
  }

  public getPhaseRequirements(phase: CasePhase, caseType: CaseType): string[] {
    const transitions = this.transitions.get(phase) || [];
    const caseTypeTransitions = this.caseTypeWorkflows.get(caseType) || [];
    const allTransitions = [...transitions, ...caseTypeTransitions];

    const requirements = new Set<string>();
    
    allTransitions.forEach(transition => {
      if (transition.requiredFields) {
        transition.requiredFields.forEach(field => requirements.add(field));
      }
    });

    return Array.from(requirements);
  }

  public getCaseTypeWorkflow(caseType: CaseType): StateTransition[] {
    return this.caseTypeWorkflows.get(caseType) || [];
  }

  public getAllTransitions(): StateTransition[] {
    const allTransitions: StateTransition[] = [];
    
    this.transitions.forEach(transitions => {
      allTransitions.push(...transitions);
    });

    this.caseTypeWorkflows.forEach(transitions => {
      allTransitions.push(...transitions);
    });

    return allTransitions;
  }
}
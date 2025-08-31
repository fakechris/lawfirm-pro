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

export class PhaseValidator {
  private phaseRules: Map<CasePhase, PhaseValidationRule>;

  constructor() {
    this.phaseRules = new Map();
    this.initializePhaseRules();
  }

  private initializePhaseRules(): void {
    const rules: Record<CasePhase, PhaseValidationRule> = {
      [CasePhase.INTAKE_RISK_ASSESSMENT]: {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
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
            fromStatus: [CaseStatus.INTAKE],
            toStatus: [CaseStatus.ACTIVE, CaseStatus.PENDING],
            allowed: true
          },
          {
            fromStatus: [CaseStatus.INTAKE],
            toStatus: [CaseStatus.CLOSED],
            allowed: true,
            reason: 'Case can be rejected during intake'
          }
        ]
      },
      [CasePhase.PRE_PROCEEDING_PREPARATION]: {
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
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
            fromStatus: [CaseStatus.INTAKE, CaseStatus.PENDING],
            toStatus: [CaseStatus.ACTIVE],
            allowed: true
          }
        ]
      },
      [CasePhase.FORMAL_PROCEEDINGS]: {
        phase: CasePhase.FORMAL_PROCEEDINGS,
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
            fromStatus: [CaseStatus.ACTIVE],
            toStatus: [CaseStatus.PENDING],
            allowed: true,
            reason: 'Case may be pending during proceedings'
          }
        ]
      },
      [CasePhase.RESOLUTION_POST_PROCEEDING]: {
        phase: CasePhase.RESOLUTION_POST_PROCEEDING,
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
            fromStatus: [CaseStatus.ACTIVE, CaseStatus.PENDING],
            toStatus: [CaseStatus.COMPLETED],
            allowed: true
          }
        ]
      },
      [CasePhase.CLOSURE_REVIEW_ARCHIVING]: {
        phase: CasePhase.CLOSURE_REVIEW_ARCHIVING,
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
            fromStatus: [CaseStatus.COMPLETED],
            toStatus: [CaseStatus.CLOSED],
            allowed: true
          },
          {
            fromStatus: [CaseStatus.ACTIVE, CaseStatus.PENDING],
            toStatus: [CaseStatus.CLOSED],
            allowed: true,
            reason: 'Case can be closed directly from active status'
          }
        ]
      }
    };

    Object.entries(rules).forEach(([phase, rule]) => {
      this.phaseRules.set(phase as CasePhase, rule);
    });
  }

  async validatePhaseTransition(
    currentCase: Case,
    targetPhase: CasePhase,
    metadata?: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get validation rules for target phase
    const targetPhaseRules = this.phaseRules.get(targetPhase);
    if (!targetPhaseRules) {
      errors.push(`No validation rules found for phase: ${targetPhase}`);
      return { isValid: false, errors };
    }

    // Check required fields
    const missingFields = this.checkRequiredFields(targetPhaseRules.requiredFields, metadata);
    if (missingFields.length > 0) {
      errors.push(`Missing required fields for ${targetPhase}: ${missingFields.join(', ')}`);
    }

    // Check conditional rules
    const conditionalErrors = this.checkConditionalRules(targetPhaseRules, currentCase.caseType, metadata);
    errors.push(...conditionalErrors);

    // Check phase transition validity
    const transitionErrors = this.validatePhaseTransitionOrder(currentCase.phase, targetPhase);
    errors.push(...transitionErrors);

    // Add warnings for potential issues
    const phaseWarnings = this.getPhaseWarnings(targetPhase, currentCase.caseType, metadata);
    warnings.push(...phaseWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async validateStatusTransition(
    currentStatus: CaseStatus,
    targetStatus: CaseStatus,
    currentPhase: CasePhase
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    const phaseRules = this.phaseRules.get(currentPhase);
    if (!phaseRules || !phaseRules.statusRules) {
      // No specific status rules defined for this phase
      return { isValid: true, errors: [] };
    }

    const applicableRule = phaseRules.statusRules.find(rule =>
      rule.fromStatus.includes(currentStatus) && rule.toStatus.includes(targetStatus)
    );

    if (!applicableRule) {
      errors.push(`Status transition from ${currentStatus} to ${targetStatus} is not defined for phase ${currentPhase}`);
      return { isValid: false, errors };
    }

    if (!applicableRule.allowed) {
      errors.push(applicableRule.reason || `Status transition from ${currentStatus} to ${targetStatus} is not allowed`);
    }

    return { isValid: errors.length === 0, errors };
  }

  async validatePhaseCompletion(
    currentCase: Case,
    metadata?: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const phaseRules = this.phaseRules.get(currentCase.phase);
    if (!phaseRules) {
      errors.push(`No validation rules found for phase: ${currentCase.phase}`);
      return { isValid: false, errors };
    }

    // Check if all required fields are completed
    const missingFields = this.checkRequiredFields(phaseRules.requiredFields, metadata);
    if (missingFields.length > 0) {
      errors.push(`Cannot complete phase ${currentCase.phase}. Missing required fields: ${missingFields.join(', ')}`);
    }

    // Check conditional rules
    const conditionalErrors = this.checkConditionalRules(phaseRules, currentCase.caseType, metadata);
    errors.push(...conditionalErrors);

    // Add phase-specific completion checks
    const completionErrors = this.checkPhaseCompletion(currentCase.phase, currentCase.caseType, metadata);
    errors.push(...completionErrors);

    // Add warnings for potential issues
    const completionWarnings = this.getPhaseCompletionWarnings(currentCase.phase, currentCase.caseType, metadata);
    warnings.push(...completionWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  getPhaseRequirements(phase: CasePhase, caseType: CaseType): string[] {
    const phaseRules = this.phaseRules.get(phase);
    if (!phaseRules) return [];

    const requirements = [...phaseRules.requiredFields];

    // Add case type specific requirements
    const conditionalRule = phaseRules.conditionalRules?.find(rule =>
      this.evaluateCondition(rule.condition, { caseType })
    );

    if (conditionalRule) {
      requirements.push(...conditionalRule.requiredFields);
    }

    return requirements;
  }

  getPhaseProgress(phase: CasePhase, metadata?: Record<string, any>): number {
    const phaseRules = this.phaseRules.get(phase);
    if (!phaseRules || !metadata) return 0;

    const requiredFields = [...phaseRules.requiredFields];

    // Add conditional requirements
    const conditionalRule = phaseRules.conditionalRules?.find(rule =>
      this.evaluateCondition(rule.condition, metadata)
    );

    if (conditionalRule) {
      requiredFields.push(...conditionalRule.requiredFields);
    }

    const completedFields = requiredFields.filter(field => metadata[field] !== undefined && metadata[field] !== null);
    
    return requiredFields.length > 0 ? Math.round((completedFields.length / requiredFields.length) * 100) : 0;
  }

  private checkRequiredFields(requiredFields: string[], metadata?: Record<string, any>): string[] {
    if (!metadata) return requiredFields;

    return requiredFields.filter(field => {
      const value = metadata[field];
      return value === undefined || value === null || value === '';
    });
  }

  private checkConditionalRules(
    phaseRules: PhaseValidationRule,
    caseType: CaseType,
    metadata?: Record<string, any>
  ): string[] {
    const errors: string[] = [];

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

  private validatePhaseTransitionOrder(currentPhase: CasePhase, targetPhase: CasePhase): string[] {
    const errors: string[] = [];
    
    const phaseOrder = [
      CasePhase.INTAKE_RISK_ASSESSMENT,
      CasePhase.PRE_PROCEEDING_PREPARATION,
      CasePhase.FORMAL_PROCEEDINGS,
      CasePhase.RESOLUTION_POST_PROCEEDING,
      CasePhase.CLOSURE_REVIEW_ARCHIVING
    ];

    const currentIndex = phaseOrder.indexOf(currentPhase);
    const targetIndex = phaseOrder.indexOf(targetPhase);

    if (currentIndex === -1 || targetIndex === -1) {
      errors.push('Invalid phase specified');
      return errors;
    }

    // Allow only forward transitions or closure from any phase
    if (targetIndex <= currentIndex && targetPhase !== CasePhase.CLOSURE_REVIEW_ARCHIVING) {
      errors.push(`Cannot transition from ${currentPhase} to ${targetPhase}. Phases must progress forward.`);
    }

    return errors;
  }

  private getPhaseWarnings(phase: CasePhase, caseType: CaseType, metadata?: Record<string, any>): string[] {
    const warnings: string[] = [];

    // Add case type specific warnings
    switch (caseType) {
      case CaseType.CRIMINAL_DEFENSE:
        if (phase === CasePhase.FORMAL_PROCEEDINGS && (!metadata || !metadata['bailPosted'])) {
          warnings.push('Bail has not been posted for criminal defense case');
        }
        break;
      case CaseType.MEDICAL_MALPRACTICE:
        if (phase === CasePhase.PRE_PROCEEDING_PREPARATION && (!metadata || !metadata['statuteOfLimitationsChecked'])) {
          warnings.push('Statute of limitations should be verified for medical malpractice case');
        }
        break;
      case CaseType.DIVORCE_FAMILY:
        if (phase === CasePhase.FORMAL_PROCEEDINGS && (!metadata || !metadata['minorChildrenInvolved'])) {
          warnings.push('Child custody arrangements should be confirmed for divorce cases');
        }
        break;
    }

    return warnings;
  }

  private checkPhaseCompletion(phase: CasePhase, caseType: CaseType, metadata?: Record<string, any>): string[] {
    const errors: string[] = [];

    // Phase specific completion checks
    switch (phase) {
      case CasePhase.INTAKE_RISK_ASSESSMENT:
        if (!metadata || !metadata['conflictCheckCompleted']) {
          errors.push('Conflict check must be completed before ending intake phase');
        }
        break;
      case CasePhase.PRE_PROCEEDING_PREPARATION:
        if (!metadata || !metadata['clientAgreementSigned']) {
          errors.push('Client agreement must be signed before ending preparation phase');
        }
        break;
      case CasePhase.FORMAL_PROCEEDINGS:
        if (!metadata || !metadata['allHearingsAttended']) {
          errors.push('All required hearings must be attended before ending proceedings phase');
        }
        break;
      case CasePhase.RESOLUTION_POST_PROCEEDING:
        if (!metadata || !metadata['finalJudgmentReceived']) {
          errors.push('Final judgment must be received before ending resolution phase');
        }
        break;
    }

    return errors;
  }

  private getPhaseCompletionWarnings(phase: CasePhase, caseType: CaseType, metadata?: Record<string, any>): string[] {
    const warnings: string[] = [];

    // Add warnings for potential issues before phase completion
    switch (phase) {
      case CasePhase.PRE_PROCEEDING_PREPARATION:
        if (!metadata || !metadata['deadlinesMet']) {
          warnings.push('Some preparation deadlines may not have been met');
        }
        break;
      case CasePhase.FORMAL_PROCEEDINGS:
        if (!metadata || !metadata['allEvidenceSubmitted']) {
          warnings.push('Not all evidence has been submitted in court');
        }
        break;
    }

    return warnings;
  }

  private evaluateCondition(condition: string, context: Record<string, any>): boolean {
    try {
      // Simple condition evaluation - in production, use a proper expression evaluator
      const safeCondition = condition
        .replace(/caseType/g, 'context.caseType')
        .replace(/===/g, '===')
        .replace(/&&/g, '&&')
        .replace(/||/g, '||');

      // eslint-disable-next-line no-new-func
      return new Function('context', `return ${safeCondition}`)(context);
    } catch (error) {
      console.warn(`Error evaluating condition: ${condition}`, error);
      return false;
    }
  }
}
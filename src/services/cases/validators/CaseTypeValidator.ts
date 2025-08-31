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
  maxDuration: number; // in days
  criticalMilestones: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  recommendations?: string[];
}

export class CaseTypeValidator {
  private caseTypeRules: Map<CaseType, CaseTypeValidationRule>;

  constructor() {
    this.caseTypeRules = new Map();
    this.initializeCaseTypeRules();
  }

  private initializeCaseTypeRules(): void {
    const rules: Record<CaseType, CaseTypeValidationRule> = {
      [CaseType.LABOR_DISPUTE]: {
        caseType: CaseType.LABOR_DISPUTE,
        requiredFields: [
          'employerInformation',
          'employeeInformation',
          'employmentContract',
          'disputeDetails',
          'employmentDates'
        ],
        prohibitedFields: ['criminalRecord', 'medicalHistory'],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['laborContract', 'payRecords', 'workHistory'],
            conditionalRules: ['ifUnionMember === true, require unionContract'],
            validationFunctions: ['validateEmploymentDates', 'checkStatuteOfLimitations']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['witnessStatements', 'expertReports', 'damageCalculations'],
            conditionalRules: ['ifSeverancePay === true, require severanceAgreement'],
            validationFunctions: ['calculateBackPay', 'assessEmotionalDamages']
          }
        ],
        documentRequirements: [
          { documentType: 'EmploymentContract', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Original employment contract' },
          { documentType: 'PayStubs', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Recent pay statements' },
          { documentType: 'TerminationLetter', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Notice of termination' },
          { documentType: 'LaborComplaint', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Filed labor complaint' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 30, criticalMilestones: ['File complaint with labor bureau'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 60, criticalMilestones: ['Mediation attempt'] }
        ],
        feeStructures: ['CONTINGENCY', 'HOURLY']
      },
      [CaseType.MEDICAL_MALPRACTICE]: {
        caseType: CaseType.MEDICAL_MALPRACTICE,
        requiredFields: [
          'patientInformation',
          'healthcareProvider',
          'incidentDate',
          'injuryDescription',
          'medicalRecords'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['medicalRecords', 'expertConsultation', 'injuryDocumentation'],
            conditionalRules: ['ifEmergencyTreatment === true, require emergencyRecords'],
            validationFunctions: ['verifyMedicalLicense', 'checkStandardOfCare']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['expertReports', 'violationAnalysis', 'damagesAssessment'],
            conditionalRules: ['ifPermanentInjury === true, require lifeCarePlan'],
            validationFunctions: ['calculateEconomicDamages', 'assessNonEconomicDamages']
          }
        ],
        documentRequirements: [
          { documentType: 'MedicalRecords', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Complete medical history' },
          { documentType: 'ExpertReport', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Medical expert analysis' },
          { documentType: 'IncidentReport', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Medical incident report' },
          { documentType: 'ConsentForms', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Patient consent forms' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 90, criticalMilestones: ['Statute of limitations check'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 180, criticalMilestones: ['Expert review completed'] }
        ],
        feeStructures: ['CONTINGENCY']
      },
      [CaseType.CRIMINAL_DEFENSE]: {
        caseType: CaseType.CRIMINAL_DEFENSE,
        requiredFields: [
          'defendantInformation',
          'charges',
          'arrestDate',
          'courtInformation',
          'policeReports'
        ],
        prohibitedFields: ['plaintiffDemands', 'settlementAmount'],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['arrestRecords', 'policeReports', 'bailInformation'],
            conditionalRules: ['ifFelony === true, require preliminaryHearingDate'],
            validationFunctions: ['verifyCharges', 'checkBailEligibility']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['evidenceList', 'witnessList', 'defenseStrategy'],
            conditionalRules: ['ifPleaBargain === true, require pleaAgreement'],
            validationFunctions: ['assessEvidenceStrength', 'evaluateWitnessCredibility']
          }
        ],
        documentRequirements: [
          { documentType: 'ArrestRecords', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Arrest and booking records' },
          { documentType: 'PoliceReports', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Official police reports' },
          { documentType: 'ChargingDocuments', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Formal charges' },
          { documentType: 'BailDocuments', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Bail and bond documents' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 14, criticalMilestones: ['Arraignment'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 90, criticalMilestones: ['Preliminary hearing', 'Trial preparation'] }
        ],
        feeStructures: ['FLAT', 'HOURLY', 'RETAINER']
      },
      [CaseType.DIVORCE_FAMILY]: {
        caseType: CaseType.DIVORCE_FAMILY,
        requiredFields: [
          'marriageInformation',
          'spouseInformation',
          'childrenInformation',
          'assetInformation',
          'incomeInformation'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['marriageCertificate', 'childrenDetails', 'residencyInformation'],
            conditionalRules: ['ifMinorChildren === true, require childCustodyPreferences'],
            validationFunctions: ['verifyResidency', 'checkWaitingPeriod']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['assetValuation', 'incomeDocumentation', 'custodyAgreement'],
            conditionalRules: ['ifHighConflict === true, require parentingCoordinator'],
            validationFunctions: ['calculateChildSupport', 'divideMaritalAssets']
          }
        ],
        documentRequirements: [
          { documentType: 'MarriageCertificate', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Official marriage certificate' },
          { documentType: 'BirthCertificates', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Children\'s birth certificates' },
          { documentType: 'FinancialStatements', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Financial disclosure statements' },
          { documentType: 'PropertyDeeds', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Real property documentation' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 30, criticalMilestones: ['Residency verification'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 120, criticalMilestones: ['Mediation completion', 'Financial disclosure'] }
        ],
        feeStructures: ['FLAT', 'HOURLY', 'RETAINER']
      },
      [CaseType.INHERITANCE_DISPUTE]: {
        caseType: CaseType.INHERITANCE_DISPUTE,
        requiredFields: [
          'deceasedInformation',
          'willInformation',
          'beneficiaryInformation',
          'assetInventory',
          'executorInformation'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['deathCertificate', 'willDocument', 'probateCourtInformation'],
            conditionalRules: ['ifNoWill === true, require intestacyInformation'],
            validationFunctions: ['validateWill', 'verifyProbateJurisdiction']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['assetAppraisal', 'creditorClaims', 'beneficiaryNotices'],
            conditionalRules: ['ifContested === true, require contestGrounds'],
            validationFunctions: ['assessClaimValidity', 'calculateEstateValue']
          }
        ],
        documentRequirements: [
          { documentType: 'DeathCertificate', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Official death certificate' },
          { documentType: 'WillDocument', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Last will and testament' },
          { documentType: 'AssetInventory', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Complete asset inventory' },
          { documentType: 'ProbateDocuments', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Probate court filings' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 60, criticalMilestones: ['Will probate'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 365, criticalMilestones: ['Creditor notification', 'Asset distribution'] }
        ],
        feeStructures: ['HOURLY', 'FLAT']
      },
      [CaseType.CONTRACT_DISPUTE]: {
        caseType: CaseType.CONTRACT_DISPUTE,
        requiredFields: [
          'contractInformation',
          'partiesInvolved',
          'breachDetails',
          'damagesClaimed',
          'contractValue'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['contractDocument', 'breachEvidence', 'correspondence'],
            conditionalRules: ['ifInternational === true, require jurisdictionAnalysis'],
            validationFunctions: ['analyzeContractTerms', 'assessBreachValidity']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['damageCalculations', 'expertReports', 'settlementDemand'],
            conditionalRules: ['ifLiquidatedDamages === true, verify enforceability'],
            validationFunctions: ['calculateDamages', 'assessRemedies']
          }
        ],
        documentRequirements: [
          { documentType: 'ContractDocument', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Signed contract agreement' },
          { documentType: 'BreachEvidence', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Evidence of breach' },
          { documentType: 'Correspondence', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Related correspondence' },
          { documentType: 'ExpertReport', required: false, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Expert analysis if needed' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 45, criticalMilestones: ['Statute of limitations check'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 90, criticalMilestones: ['Demand letter sent'] }
        ],
        feeStructures: ['HOURLY', 'CONTINGENCY', 'FLAT']
      },
      [CaseType.ADMINISTRATIVE_CASE]: {
        caseType: CaseType.ADMINISTRATIVE_CASE,
        requiredFields: [
          'agencyInformation',
          'caseNumber',
          'violationDetails',
          'hearingInformation',
          'regulatoryCitations'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['agencyNotice', 'violationDetails', 'responseDeadline'],
            conditionalRules: ['ifLicenseSuspension === true, require licenseDetails'],
            validationFunctions: ['checkAppealDeadline', 'verifyAgencyJurisdiction']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['legalArguments', 'evidencePackage', 'witnessList'],
            conditionalRules: ['ifEmergencyHearing === true, prepare emergencyMotion'],
            validationFunctions: ['prepareDefenseStrategy', 'assessPenalties']
          }
        ],
        documentRequirements: [
          { documentType: 'AgencyNotice', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Official agency notice' },
          { documentType: 'ViolationReport', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Violation details report' },
          { documentType: 'Regulations', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Applicable regulations' },
          { documentType: 'HearingNotice', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Hearing notice' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 30, criticalMilestones: ['Response deadline'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 60, criticalMilestones: ['Hearing preparation'] }
        ],
        feeStructures: ['HOURLY', 'FLAT']
      },
      [CaseType.DEMOLITION_CASE]: {
        caseType: CaseType.DEMOLITION_CASE,
        requiredFields: [
          'propertyInformation',
          'demolitionOrder',
          'ownerInformation',
          'contractorInformation',
          'safetyPlan'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['demolitionPermit', 'propertySurvey', 'environmentalAssessment'],
            conditionalRules: ['ifHistoricProperty === true, require heritageApproval'],
            validationFunctions: ['verifyPermits', 'checkSafetyRegulations']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['contractorLicenses', 'insuranceDocumentation', 'neighborhoodNotices'],
            conditionalRules: ['ifAsbestos === true, require abatementPlan'],
            validationFunctions: ['reviewContract', 'assessLiability']
          }
        ],
        documentRequirements: [
          { documentType: 'DemolitionPermit', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Official demolition permit' },
          { documentType: 'PropertySurvey', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Property site survey' },
          { documentType: 'SafetyPlan', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Demolition safety plan' },
          { documentType: 'ContractorLicense', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Contractor license documentation' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 45, criticalMilestones: ['Permit approval'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 30, criticalMilestones: ['Contractor selection'] }
        ],
        feeStructures: ['FLAT', 'HOURLY']
      },
      [CaseType.SPECIAL_MATTERS]: {
        caseType: CaseType.SPECIAL_MATTERS,
        requiredFields: [
          'matterDescription',
          'partiesInvolved',
          'jurisdiction',
          'legalBasis',
          'reliefSought'
        ],
        phaseSpecificRules: [
          {
            phase: CasePhase.INTAKE_RISK_ASSESSMENT,
            additionalRequiredFields: ['legalResearch', 'precedentCases', 'jurisdictionAnalysis'],
            conditionalRules: ['ifClassAction === true, require classCertification'],
            validationFunctions: ['assessNovelty', 'checkJurisdiction']
          },
          {
            phase: CasePhase.PRE_PROCEEDING_PREPARATION,
            additionalRequiredFields: ['legalArguments', 'evidenceStrategy', 'expertConsultation'],
            conditionalRules: ['ifConstitutionalIssue === true, require constitutionalAnalysis'],
            validationFunctions: ['developStrategy', 'assessSuccessProbability']
          }
        ],
        documentRequirements: [
          { documentType: 'LegalMemorandum', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Legal research memorandum' },
          { documentType: 'JurisdictionAnalysis', required: true, phase: CasePhase.INTAKE_RISK_ASSESSMENT, description: 'Jurisdiction analysis' },
          { documentType: 'ExpertReport', required: false, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Expert consultation if needed' },
          { documentType: 'StrategyDocument', required: true, phase: CasePhase.PRE_PROCEEDING_PREPARATION, description: 'Case strategy document' }
        ],
        timelineConstraints: [
          { phase: CasePhase.INTAKE_RISK_ASSESSMENT, maxDuration: 60, criticalMilestones: ['Research completion'] },
          { phase: CasePhase.PRE_PROCEEDING_PREPARATION, maxDuration: 90, criticalMilestones: ['Strategy finalization'] }
        ],
        feeStructures: ['HOURLY', 'CONTINGENCY', 'FLAT', 'RETAINER']
      }
    };

    Object.entries(rules).forEach(([caseType, rule]) => {
      this.caseTypeRules.set(caseType as CaseType, rule);
    });
  }

  async validateCaseTypeTransition(
    caseType: CaseType,
    fromPhase: CasePhase,
    toPhase: CasePhase,
    metadata?: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const caseTypeRule = this.caseTypeRules.get(caseType);
    if (!caseTypeRule) {
      errors.push(`No validation rules found for case type: ${caseType}`);
      return { isValid: false, errors };
    }

    // Check required fields for target phase
    const phaseRule = caseTypeRule.phaseSpecificRules.find(rule => rule.phase === toPhase);
    if (phaseRule) {
      const allRequiredFields = [...caseTypeRule.requiredFields, ...phaseRule.additionalRequiredFields];
      const missingFields = this.checkRequiredFields(allRequiredFields, metadata);
      
      if (missingFields.length > 0) {
        errors.push(`Missing required fields for ${caseType} case in ${toPhase}: ${missingFields.join(', ')}`);
      }

      // Check conditional rules
      const conditionalErrors = this.checkConditionalRules(phaseRule, metadata);
      errors.push(...conditionalErrors);
    }

    // Check timeline constraints
    const timelineWarnings = this.checkTimelineConstraints(caseType, fromPhase, toPhase, metadata);
    warnings.push(...timelineWarnings);

    // Check document requirements
    const documentWarnings = this.checkDocumentRequirements(caseType, toPhase, metadata);
    warnings.push(...documentWarnings);

    // Add recommendations
    const caseTypeRecommendations = this.getCaseTypeRecommendations(caseType, fromPhase, toPhase);
    recommendations.push(...caseTypeRecommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined
    };
  }

  async validateCaseTypeInitialization(
    caseType: CaseType,
    metadata?: Record<string, any>
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const caseTypeRule = this.caseTypeRules.get(caseType);
    if (!caseTypeRule) {
      errors.push(`No validation rules found for case type: ${caseType}`);
      return { isValid: false, errors };
    }

    // Check required fields
    const missingFields = this.checkRequiredFields(caseTypeRule.requiredFields, metadata);
    if (missingFields.length > 0) {
      errors.push(`Missing required fields for ${caseType} case initialization: ${missingFields.join(', ')}`);
    }

    // Check prohibited fields
    const prohibitedFieldsPresent = this.checkProhibitedFields(caseTypeRule.prohibitedFields || [], metadata);
    if (prohibitedFieldsPresent.length > 0) {
      errors.push(`Prohibited fields present for ${caseType} case: ${prohibitedFieldsPresent.join(', ')}`);
    }

    // Check initial phase requirements
    const initialPhaseRule = caseTypeRule.phaseSpecificRules.find(rule => rule.phase === CasePhase.INTAKE_RISK_ASSESSMENT);
    if (initialPhaseRule) {
      const missingInitialFields = this.checkRequiredFields(initialPhaseRule.additionalRequiredFields, metadata);
      if (missingInitialFields.length > 0) {
        errors.push(`Missing initial phase requirements for ${caseType} case: ${missingInitialFields.join(', ')}`);
      }
    }

    // Add warnings for common issues
    const initializationWarnings = this.getInitializationWarnings(caseType, metadata);
    warnings.push(...initializationWarnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  getCaseTypeRequirements(caseType: CaseType, phase?: CasePhase): string[] {
    const caseTypeRule = this.caseTypeRules.get(caseType);
    if (!caseTypeRule) return [];

    let requirements = [...caseTypeRule.requiredFields];

    if (phase) {
      const phaseRule = caseTypeRule.phaseSpecificRules.find(rule => rule.phase === phase);
      if (phaseRule) {
        requirements.push(...phaseRule.additionalRequiredFields);
      }
    }

    return requirements;
  }

  getCaseTypeDocumentRequirements(caseType: CaseType, phase?: CasePhase): DocumentRequirement[] {
    const caseTypeRule = this.caseTypeRules.get(caseType);
    if (!caseTypeRule) return [];

    if (phase) {
      return caseTypeRule.documentRequirements.filter(req => req.phase === phase);
    }

    return caseTypeRule.documentRequirements;
  }

  getCaseTypeTimelineConstraints(caseType: CaseType): TimelineConstraint[] {
    const caseTypeRule = this.caseTypeRules.get(caseType);
    return caseTypeRule?.timelineConstraints || [];
  }

  getSupportedFeeStructures(caseType: CaseType): string[] {
    const caseTypeRule = this.caseTypeRules.get(caseType);
    return caseTypeRule?.feeStructures || [];
  }

  private checkRequiredFields(requiredFields: string[], metadata?: Record<string, any>): string[] {
    if (!metadata) return requiredFields;

    return requiredFields.filter(field => {
      const value = metadata[field];
      return value === undefined || value === null || value === '';
    });
  }

  private checkProhibitedFields(prohibitedFields: string[], metadata?: Record<string, any>): string[] {
    if (!metadata) return [];

    return prohibitedFields.filter(field => metadata[field] !== undefined && metadata[field] !== null);
  }

  private checkConditionalRules(phaseRule: PhaseSpecificRule, metadata?: Record<string, any>): string[] {
    const errors: string[] = [];

    if (!metadata) return errors;

    for (const condition of phaseRule.conditionalRules) {
      // Simple conditional rule checking
      if (condition.includes('if') && condition.includes('===')) {
        const matches = condition.match(/if(\w+) === (\w+), require (\w+)/);
        if (matches) {
          const [, field, expectedValue, requiredField] = matches;
          if (metadata[field] === expectedValue && !metadata[requiredField]) {
            errors.push(`Conditional requirement not met: ${condition}`);
          }
        }
      }
    }

    return errors;
  }

  private checkTimelineConstraints(
    caseType: CaseType,
    fromPhase: CasePhase,
    toPhase: CasePhase,
    metadata?: Record<string, any>
  ): string[] {
    const warnings: string[] = [];

    const caseTypeRule = this.caseTypeRules.get(caseType);
    if (!caseTypeRule || !caseTypeRule.timelineConstraints) return warnings;

    const fromConstraint = caseTypeRule.timelineConstraints.find(c => c.phase === fromPhase);
    if (fromConstraint && metadata?.phaseStartDate) {
      const phaseDuration = Math.floor((Date.now() - new Date(metadata.phaseStartDate).getTime()) / (1000 * 60 * 60 * 24));
      if (phaseDuration > fromConstraint.maxDuration) {
        warnings.push(`${fromPhase} phase has exceeded maximum duration of ${fromConstraint.maxDuration} days`);
      }
    }

    return warnings;
  }

  private checkDocumentRequirements(
    caseType: CaseType,
    phase: CasePhase,
    metadata?: Record<string, any>
  ): string[] {
    const warnings: string[] = [];

    const caseTypeRule = this.caseTypeRules.get(caseType);
    if (!caseTypeRule) return warnings;

    const requiredDocuments = caseTypeRule.documentRequirements.filter(req => req.phase === phase && req.required);
    
    if (!metadata?.documents) return warnings;

    const missingDocuments = requiredDocuments.filter(req => 
      !metadata.documents.some((doc: any) => doc.type === req.documentType)
    );

    if (missingDocuments.length > 0) {
      warnings.push(`Missing required documents for ${phase}: ${missingDocuments.map(d => d.documentType).join(', ')}`);
    }

    return warnings;
  }

  private getCaseTypeRecommendations(
    caseType: CaseType,
    fromPhase: CasePhase,
    toPhase: CasePhase
  ): string[] {
    const recommendations: string[] = [];

    // Add case type specific recommendations
    switch (caseType) {
      case CaseType.MEDICAL_MALPRACTICE:
        if (toPhase === CasePhase.PRE_PROCEEDING_PREPARATION) {
          recommendations.push('Consider consulting with medical experts early in the preparation phase');
        }
        break;
      case CaseType.CRIMINAL_DEFENSE:
        if (fromPhase === CasePhase.INTAKE_RISK_ASSESSMENT && toPhase === CasePhase.PRE_PROCEEDING_PREPARATION) {
          recommendations.push('Consider plea bargain options before proceeding to formal proceedings');
        }
        break;
      case CaseType.DIVORCE_FAMILY:
        if (toPhase === CasePhase.PRE_PROCEEDING_PREPARATION) {
          recommendations.push('Mediation should be attempted before formal proceedings');
        }
        break;
    }

    return recommendations;
  }

  private getInitializationWarnings(caseType: CaseType, metadata?: Record<string, any>): string[] {
    const warnings: string[] = [];

    // Add case type specific warnings
    switch (caseType) {
      case CaseType.MEDICAL_MALPRACTICE:
        if (!metadata?.statuteOfLimitationsChecked) {
          warnings.push('Statute of limitations should be verified immediately for medical malpractice cases');
        }
        break;
      case CaseType.CONTRACT_DISPUTE:
        if (!metadata?.contractAnalyzed) {
          warnings.push('Contract should be thoroughly analyzed for all potential claims and defenses');
        }
        break;
      case CaseType.CRIMINAL_DEFENSE:
        if (!metadata?.constitutionalRightsReviewed) {
          warnings.push('Constitutional rights should be reviewed immediately');
        }
        break;
    }

    return warnings;
  }
}
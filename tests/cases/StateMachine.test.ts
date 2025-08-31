import { StateMachine, CaseState, TransitionResult } from '../../src/services/cases/StateMachine';
import { CasePhase, CaseType, CaseStatus, UserRole } from '@prisma/client';

describe('StateMachine', () => {
  let stateMachine: StateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine();
  });

  describe('Constructor', () => {
    it('should initialize with all required transitions', () => {
      expect(stateMachine).toBeInstanceOf(StateMachine);
      
      // Test that we can get transitions for each phase
      const phases = Object.values(CasePhase);
      phases.forEach(phase => {
        const transitions = stateMachine.getAvailableTransitions(
          { phase, status: CaseStatus.INTAKE, caseType: CaseType.CONTRACT_DISPUTE },
          UserRole.ATTORNEY
        );
        expect(Array.isArray(transitions)).toBe(true);
      });
    });
  });

  describe('canTransition', () => {
    describe('Valid transitions', () => {
      it('should allow transition from INTAKE_RISK_ASSESSMENT to PRE_PROCEEDING_PREPARATION', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('allowed');
      });

      it('should allow transition from PRE_PROCEEDING_PREPARATION to FORMAL_PROCEEDINGS', () => {
        const currentState: CaseState = {
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            preparationCompleted: true,
            legalResearch: 'complete',
            documentPreparation: 'complete',
            witnessPreparation: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.FORMAL_PROCEEDINGS,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('allowed');
      });

      it('should allow transition from FORMAL_PROCEEDINGS to RESOLUTION_POST_PROCEEDING', () => {
        const currentState: CaseState = {
          phase: CasePhase.FORMAL_PROCEEDINGS,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            proceedingsCompleted: true
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.RESOLUTION_POST_PROCEEDING,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('allowed');
      });

      it('should allow transition from RESOLUTION_POST_PROCEEDING to CLOSURE_REVIEW_ARCHIVING', () => {
        const currentState: CaseState = {
          phase: CasePhase.RESOLUTION_POST_PROCEEDING,
          status: CaseStatus.COMPLETED,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            resolutionCompleted: true,
            finalJudgment: 'complete',
            settlementAgreement: 'complete',
            appealPeriod: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.CLOSURE_REVIEW_ARCHIVING,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('allowed');
      });

      it('should allow direct transition to CLOSURE_REVIEW_ARCHIVING from any phase when case is rejected', () => {
        const phases = [CasePhase.INTAKE_RISK_ASSESSMENT, CasePhase.PRE_PROCEEDING_PREPARATION, CasePhase.FORMAL_PROCEEDINGS];
        
        phases.forEach(phase => {
          const currentState: CaseState = {
            phase,
            status: CaseStatus.INTAKE,
            caseType: CaseType.CONTRACT_DISPUTE,
            metadata: {
              caseRejected: true
            }
          };

          const result = stateMachine.canTransition(
            currentState,
            CasePhase.CLOSURE_REVIEW_ARCHIVING,
            UserRole.ATTORNEY
          );

          expect(result.success).toBe(true);
        });
      });
    });

    describe('Invalid transitions', () => {
      it('should reject backward transitions', () => {
        const currentState: CaseState = {
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {}
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.INTAKE_RISK_ASSESSMENT,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Invalid transition from PRE_PROCEEDING_PREPARATION to INTAKE_RISK_ASSESSMENT');
      });

      it('should reject transitions from CLOSURE_REVIEW_ARCHIVING (terminal state)', () => {
        const currentState: CaseState = {
          phase: CasePhase.CLOSURE_REVIEW_ARCHIVING,
          status: CaseStatus.CLOSED,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {}
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.INTAKE_RISK_ASSESSMENT,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
      });

      it('should reject transitions when required fields are missing', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            riskAssessmentCompleted: true,
            // Missing required fields: clientInformation, caseDescription, initialEvidence
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Missing required fields: clientInformation, caseDescription, initialEvidence');
      });

      it('should reject transitions when conditions are not met', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete',
            // Missing condition: riskAssessmentCompleted
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Condition failed: riskAssessmentCompleted equals true');
      });
    });

    describe('Role-based permissions', () => {
      it('should allow ATTORNEY and ADMIN roles to make transitions', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete'
          }
        };

        const attorneyResult = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        const adminResult = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ADMIN
        );

        expect(attorneyResult.success).toBe(true);
        expect(adminResult.success).toBe(true);
      });

      it('should reject CLIENT role from making transitions', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.CLIENT
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Insufficient permissions for transition');
      });

      it('should reject ASSISTANT role from making transitions', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ASSISTANT
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Insufficient permissions for transition');
      });
    });
  });

  describe('Case type specific workflows', () => {
    describe('Criminal Defense', () => {
      it('should enforce criminal defense specific requirements for INTAKE to PRE_PROCEEDING_PREPARATION', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CRIMINAL_DEFENSE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete',
            // Missing criminal defense specific requirements
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Missing required fields: bailHearingScheduled, evidenceSecured, witnessStatements');
      });

      it('should allow transition when criminal defense requirements are met', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.CRIMINAL_DEFENSE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete',
            bailHearingScheduled: true,
            evidenceSecured: true,
            witnessStatements: 'complete',
            arrestRecords: 'complete',
            policeReports: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
      });
    });

    describe('Medical Malpractice', () => {
      it('should enforce medical malpractice specific requirements for INTAKE to PRE_PROCEEDING_PREPARATION', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.MEDICAL_MALPRACTICE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete',
            // Missing medical malpractice specific requirements
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Missing required fields: medicalRecordsReviewed, expertConsultationCompleted');
      });

      it('should allow transition when medical malpractice requirements are met', () => {
        const currentState: CaseState = {
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          caseType: CaseType.MEDICAL_MALPRACTICE,
          metadata: {
            riskAssessmentCompleted: true,
            clientInformation: 'complete',
            caseDescription: 'complete',
            initialEvidence: 'complete',
            medicalRecordsReviewed: true,
            expertConsultationCompleted: true,
            medicalRecords: 'complete',
            expertReports: 'complete',
            hospitalDocumentation: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.PRE_PROCEEDING_PREPARATION,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
      });
    });

    describe('Divorce/Family', () => {
      it('should enforce divorce/family specific requirements for PRE_PROCEEDING_PREPARATION to FORMAL_PROCEEDINGS', () => {
        const currentState: CaseState = {
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.DIVORCE_FAMILY,
          metadata: {
            preparationCompleted: true,
            legalResearch: 'complete',
            documentPreparation: 'complete',
            witnessPreparation: 'complete',
            // Missing divorce specific requirements
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.FORMAL_PROCEEDINGS,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Missing required fields: mediationAttempted, custodyAgreement');
      });

      it('should allow transition when divorce/family requirements are met', () => {
        const currentState: CaseState = {
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.DIVORCE_FAMILY,
          metadata: {
            preparationCompleted: true,
            legalResearch: 'complete',
            documentPreparation: 'complete',
            witnessPreparation: 'complete',
            mediationAttempted: true,
            custodyAgreement: 'complete',
            marriageCertificate: 'complete',
            financialDisclosures: 'complete',
            childCustodyPlan: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.FORMAL_PROCEEDINGS,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
      });
    });

    describe('Contract Dispute', () => {
      it('should enforce contract dispute specific requirements for PRE_PROCEEDING_PREPARATION to FORMAL_PROCEEDINGS', () => {
        const currentState: CaseState = {
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            preparationCompleted: true,
            legalResearch: 'complete',
            documentPreparation: 'complete',
            witnessPreparation: 'complete',
            // Missing contract dispute specific requirements
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.FORMAL_PROCEEDINGS,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Missing required fields: contractAnalyzed, breachDocumented');
      });

      it('should allow transition when contract dispute requirements are met', () => {
        const currentState: CaseState = {
          phase: CasePhase.PRE_PROCEEDING_PREPARATION,
          status: CaseStatus.ACTIVE,
          caseType: CaseType.CONTRACT_DISPUTE,
          metadata: {
            preparationCompleted: true,
            legalResearch: 'complete',
            documentPreparation: 'complete',
            witnessPreparation: 'complete',
            contractAnalyzed: true,
            breachDocumented: true,
            contractDocument: 'complete',
            breachEvidence: 'complete',
            correspondence: 'complete'
          }
        };

        const result = stateMachine.canTransition(
          currentState,
          CasePhase.FORMAL_PROCEEDINGS,
          UserRole.ATTORNEY
        );

        expect(result.success).toBe(true);
      });
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return available transitions for a given state and role', () => {
      const currentState: CaseState = {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {}
      };

      const transitions = stateMachine.getAvailableTransitions(currentState, UserRole.ATTORNEY);

      expect(Array.isArray(transitions)).toBe(true);
      expect(transitions).toContain(CasePhase.PRE_PROCEEDING_PREPARATION);
      expect(transitions).toContain(CasePhase.CLOSURE_REVIEW_ARCHIVING);
    });

    it('should return empty array for terminal state', () => {
      const currentState: CaseState = {
        phase: CasePhase.CLOSURE_REVIEW_ARCHIVING,
        status: CaseStatus.CLOSED,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {}
      };

      const transitions = stateMachine.getAvailableTransitions(currentState, UserRole.ATTORNEY);

      expect(transitions).toEqual([]);
    });

    it('should filter transitions based on user role', () => {
      const currentState: CaseState = {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {}
      };

      const attorneyTransitions = stateMachine.getAvailableTransitions(currentState, UserRole.ATTORNEY);
      const clientTransitions = stateMachine.getAvailableTransitions(currentState, UserRole.CLIENT);

      expect(attorneyTransitions.length).toBeGreaterThan(0);
      expect(clientTransitions.length).toBe(0);
    });
  });

  describe('getPhaseRequirements', () => {
    it('should return requirements for a specific phase and case type', () => {
      const requirements = stateMachine.getPhaseRequirements(
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CaseType.CRIMINAL_DEFENSE
      );

      expect(Array.isArray(requirements)).toBe(true);
      expect(requirements).toContain('clientInformation');
      expect(requirements).toContain('caseDescription');
      expect(requirements).toContain('initialEvidence');
      expect(requirements).toContain('arrestRecords');
      expect(requirements).toContain('policeReports');
      expect(requirements).toContain('witnessStatements');
    });

    it('should return general requirements for case types without specific rules', () => {
      const requirements = stateMachine.getPhaseRequirements(
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CaseType.LABOR_DISPUTE
      );

      expect(Array.isArray(requirements)).toBe(true);
      expect(requirements).toContain('clientInformation');
      expect(requirements).toContain('caseDescription');
      expect(requirements).toContain('initialEvidence');
    });
  });

  describe('getCaseTypeWorkflow', () => {
    it('should return case type specific transitions', () => {
      const workflow = stateMachine.getCaseTypeWorkflow(CaseType.CRIMINAL_DEFENSE);

      expect(Array.isArray(workflow)).toBe(true);
      
      // Should contain criminal defense specific transitions
      const hasCriminalDefenseTransition = workflow.some(transition => 
        transition.requiredFields?.includes('bailHearingScheduled')
      );
      expect(hasCriminalDefenseTransition).toBe(true);
    });

    it('should return empty array for case types without specific workflows', () => {
      const workflow = stateMachine.getCaseTypeWorkflow(CaseType.LABOR_DISPUTE);
      
      expect(Array.isArray(workflow)).toBe(true);
      expect(workflow).toEqual([]);
    });
  });

  describe('getAllTransitions', () => {
    it('should return all defined transitions', () => {
      const allTransitions = stateMachine.getAllTransitions();

      expect(Array.isArray(allTransitions)).toBe(true);
      expect(allTransitions.length).toBeGreaterThan(0);

      // Should contain transitions for all phases
      const phases = new Set(allTransitions.map(t => t.from));
      Object.values(CasePhase).forEach(phase => {
        expect(phases.has(phase)).toBe(true);
      });
    });
  });

  describe('Condition evaluation', () => {
    it('should evaluate equals condition correctly', () => {
      const currentState: CaseState = {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {
          riskAssessmentCompleted: true
        }
      };

      const result = stateMachine.canTransition(
        currentState,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        UserRole.ATTORNEY
      );

      expect(result.success).toBe(true);
    });

    it('should evaluate not_equals condition correctly', () => {
      const currentState: CaseState = {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {
          caseRejected: false
        }
      };

      const result = stateMachine.canTransition(
        currentState,
        CasePhase.CLOSURE_REVIEW_ARCHIVING,
        UserRole.ATTORNEY
      );

      expect(result.success).toBe(false);
    });

    it('should evaluate exists condition correctly', () => {
      const currentState: CaseState = {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {
          clientInformation: 'exists'
        }
      };

      const result = stateMachine.canTransition(
        currentState,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        UserRole.ATTORNEY
      );

      // Should fail because other required fields are missing
      expect(result.success).toBe(false);
    });

    it('should evaluate not_exists condition correctly', () => {
      const currentState: CaseState = {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        caseType: CaseType.CONTRACT_DISPUTE,
        metadata: {
          riskAssessmentCompleted: true,
          clientInformation: 'complete',
          caseDescription: 'complete',
          initialEvidence: 'complete'
        }
      };

      const result = stateMachine.canTransition(
        currentState,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        UserRole.ATTORNEY
      );

      expect(result.success).toBe(true);
    });
  });
});
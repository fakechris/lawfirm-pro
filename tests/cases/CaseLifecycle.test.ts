import { CaseLifecycleService, LifecycleEvent, PhaseRequirements, CaseProgress } from '../../src/services/cases/CaseLifecycleService';
import { Database } from '../../src/utils/database';
import { CasePhase, CaseType, CaseStatus, UserRole, Case } from '@prisma/client';

// Mock Database
jest.mock('../../src/utils/database');

describe('CaseLifecycleService', () => {
  let caseLifecycleService: CaseLifecycleService;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    mockDb = {
      client: {
        case: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        caseLifecycleEvent: {
          create: jest.fn(),
        },
        task: {
          create: jest.fn(),
          createMany: jest.fn(),
          findMany: jest.fn(),
        },
        appointment: {
          create: jest.fn(),
        }
      }
    } as any;

    caseLifecycleService = new CaseLifecycleService(mockDb);
  });

  describe('initializeCaseLifecycle', () => {
    it('should create initial lifecycle event for new case', async () => {
      const caseId = 'test-case-id';
      const caseType = CaseType.CONTRACT_DISPUTE;
      const userId = 'test-user-id';

      mockDb.client.caseLifecycleEvent.create.mockResolvedValue({
        id: 'event-id',
        caseId,
        eventType: 'PHASE_ENTERED',
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        status: CaseStatus.INTAKE,
        timestamp: new Date(),
        userId,
        description: `Case ${caseId} initialized in ${CasePhase.INTAKE_RISK_ASSESSMENT} phase`
      });

      const events = await caseLifecycleService.initializeCaseLifecycle(caseId, caseType, userId);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('PHASE_ENTERED');
      expect(events[0].phase).toBe(CasePhase.INTAKE_RISK_ASSESSMENT);
      expect(events[0].status).toBe(CaseStatus.INTAKE);
      expect(mockDb.client.caseLifecycleEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId,
          eventType: 'PHASE_ENTERED',
          phase: CasePhase.INTAKE_RISK_ASSESSMENT,
          status: CaseStatus.INTAKE,
          userId,
          description: expect.stringContaining('initialized in INTAKE_RISK_ASSESSMENT phase')
        })
      });
    });
  });

  describe('transitionToPhase', () => {
    const mockCase = {
      id: 'test-case-id',
      phase: CasePhase.INTAKE_RISK_ASSESSMENT,
      status: CaseStatus.INTAKE,
      caseType: CaseType.CONTRACT_DISPUTE,
      metadata: {
        riskAssessmentCompleted: true,
        clientInformation: 'complete',
        caseDescription: 'complete',
        initialEvidence: 'complete'
      }
    } as Case;

    beforeEach(() => {
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.case.update.mockResolvedValue({
        ...mockCase,
        phase: CasePhase.PRE_PROCEEDING_PREPARATION
      });
      mockDb.client.caseLifecycleEvent.create.mockResolvedValue({
        id: 'event-id',
        caseId: mockCase.id,
        eventType: 'PHASE_ENTERED',
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
        timestamp: new Date(),
        userId: 'test-user-id',
        description: `Case ${mockCase.id} entered ${CasePhase.PRE_PROCEEDING_PREPARATION} phase`
      });
    });

    it('should successfully transition case to next phase', async () => {
      const result = await caseLifecycleService.transitionToPhase(
        mockCase.id,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        'test-user-id',
        UserRole.ATTORNEY,
        mockCase.metadata
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2); // PHASE_COMPLETED and PHASE_ENTERED
      expect(result.events[0].eventType).toBe('PHASE_COMPLETED');
      expect(result.events[1].eventType).toBe('PHASE_ENTERED');
      expect(mockDb.client.case.update).toHaveBeenCalledWith({
        where: { id: mockCase.id },
        data: { phase: CasePhase.PRE_PROCEEDING_PREPARATION }
      });
    });

    it('should return error when case is not found', async () => {
      mockDb.client.case.findUnique.mockResolvedValue(null);

      const result = await caseLifecycleService.transitionToPhase(
        'non-existent-case',
        CasePhase.PRE_PROCEEDING_PREPARATION,
        'test-user-id',
        UserRole.ATTORNEY
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Case not found');
    });

    it('should return error when state machine validation fails', async () => {
      const result = await caseLifecycleService.transitionToPhase(
        mockCase.id,
        CasePhase.CLOSURE_REVIEW_ARCHIVING,
        'test-user-id',
        UserRole.ATTORNEY,
        { caseRejected: false } // Should have caseRejected: true for this transition
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should execute phase-specific logic after transition', async () => {
      await caseLifecycleService.transitionToPhase(
        mockCase.id,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        'test-user-id',
        UserRole.ATTORNEY,
        mockCase.metadata
      );

      // Should create tasks for the new phase
      expect(mockDb.client.task.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Complete legal research',
            caseId: mockCase.id,
            status: 'PENDING'
          }),
          expect.objectContaining({
            title: 'Prepare necessary documents',
            caseId: mockCase.id,
            status: 'PENDING'
          })
        ])
      });
    });
  });

  describe('updateCaseStatus', () => {
    const mockCase = {
      id: 'test-case-id',
      phase: CasePhase.INTAKE_RISK_ASSESSMENT,
      status: CaseStatus.INTAKE,
      caseType: CaseType.CONTRACT_DISPUTE
    } as Case;

    beforeEach(() => {
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.case.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.ACTIVE
      });
      mockDb.client.caseLifecycleEvent.create.mockResolvedValue({
        id: 'event-id',
        caseId: mockCase.id,
        eventType: 'STATUS_CHANGED',
        phase: mockCase.phase,
        status: CaseStatus.ACTIVE,
        timestamp: new Date(),
        userId: 'test-user-id',
        description: `Case ${mockCase.id} status changed from ${mockCase.status} to ${CaseStatus.ACTIVE}`
      });
    });

    it('should update case status successfully', async () => {
      const event = await caseLifecycleService.updateCaseStatus(
        mockCase.id,
        CaseStatus.ACTIVE,
        'test-user-id',
        'Case accepted'
      );

      expect(event.eventType).toBe('STATUS_CHANGED');
      expect(event.status).toBe(CaseStatus.ACTIVE);
      expect(event.description).toContain('status changed from INTAKE to ACTIVE');
      expect(mockDb.client.case.update).toHaveBeenCalledWith({
        where: { id: mockCase.id },
        data: { status: CaseStatus.ACTIVE }
      });
    });

    it('should throw error when case is not found', async () => {
      mockDb.client.case.findUnique.mockResolvedValue(null);

      await expect(
        caseLifecycleService.updateCaseStatus(
          'non-existent-case',
          CaseStatus.ACTIVE,
          'test-user-id'
        )
      ).rejects.toThrow('Case not found');
    });

    it('should throw error when status transition is invalid', async () => {
      // Mock phase validator to return validation error
      jest.spyOn(caseLifecycleService as any, 'phaseValidator').mockReturnValue({
        validateStatusTransition: jest.fn().mockResolvedValue({
          isValid: false,
          errors: ['Invalid status transition']
        })
      });

      await expect(
        caseLifecycleService.updateCaseStatus(
          mockCase.id,
          CaseStatus.CLOSED,
          'test-user-id'
        )
      ).rejects.toThrow('Invalid status transition');
    });
  });

  describe('getCaseProgress', () => {
    const mockCase = {
      id: 'test-case-id',
      phase: CasePhase.PRE_PROCEEDING_PREPARATION,
      status: CaseStatus.ACTIVE,
      caseType: CaseType.CONTRACT_DISPUTE
    } as Case;

    beforeEach(() => {
      mockDb.client.case.findUnique.mockResolvedValue(mockCase);
      mockDb.client.task.findMany.mockImplementation((args: any) => {
        if (args.where.status?.in?.includes('PENDING')) {
          return Promise.resolve([
            { title: 'Task 1', dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
            { title: 'Task 2', dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }
          ]);
        }
        if (args.where.dueDate?.lt) {
          return Promise.resolve([
            { title: 'Overdue Task 1' }
          ]);
        }
        return Promise.resolve([]);
      });
    });

    it('should calculate case progress correctly', async () => {
      const progress = await caseLifecycleService.getCaseProgress(mockCase.id);

      expect(progress.currentPhase).toBe(CasePhase.PRE_PROCEEDING_PREPARATION);
      expect(progress.currentStatus).toBe(CaseStatus.ACTIVE);
      expect(progress.progressPercentage).toBe(25); // 1/4 phases completed
      expect(progress.completedPhases).toEqual([CasePhase.INTAKE_RISK_ASSESSMENT]);
      expect(progress.upcomingMilestones).toHaveLength(2);
      expect(progress.overdueTasks).toHaveLength(1);
    });

    it('should return 100% progress for closure phase', async () => {
      mockDb.client.case.findUnique.mockResolvedValue({
        ...mockCase,
        phase: CasePhase.CLOSURE_REVIEW_ARCHIVING
      });

      const progress = await caseLifecycleService.getCaseProgress(mockCase.id);

      expect(progress.progressPercentage).toBe(100);
      expect(progress.completedPhases).toEqual([
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CasePhase.PRE_PROCEEDING_PREPARATION,
        CasePhase.FORMAL_PROCEEDINGS,
        CasePhase.RESOLUTION_POST_PROCEEDING
      ]);
    });

    it('should throw error when case is not found', async () => {
      mockDb.client.case.findUnique.mockResolvedValue(null);

      await expect(
        caseLifecycleService.getCaseProgress('non-existent-case')
      ).rejects.toThrow('Case not found');
    });
  });

  describe('getPhaseRequirements', () => {
    it('should return requirements for intake phase', async () => {
      const requirements = await caseLifecycleService.getPhaseRequirements(
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CaseType.CONTRACT_DISPUTE
      );

      expect(requirements.phase).toBe(CasePhase.INTAKE_RISK_ASSESSMENT);
      expect(requirements.requirements).toContain('clientInformation');
      expect(requirements.requirements).toContain('caseDescription');
      expect(requirements.requirements).toContain('initialEvidence');
      expect(requirements.estimatedDuration).toBe(7);
      expect(requirements.criticalTasks).toContain('Initial consultation');
      expect(requirements.deliverables).toContain('Client intake form');
    });

    it('should return requirements for preparation phase', async () => {
      const requirements = await caseLifecycleService.getPhaseRequirements(
        CasePhase.PRE_PROCEEDING_PREPARATION,
        CaseType.CONTRACT_DISPUTE
      );

      expect(requirements.phase).toBe(CasePhase.PRE_PROCEEDING_PREPARATION);
      expect(requirements.requirements).toContain('legalResearch');
      expect(requirements.requirements).toContain('documentPreparation');
      expect(requirements.estimatedDuration).toBe(30);
    });

    it('should include case type specific requirements', async () => {
      const requirements = await caseLifecycleService.getPhaseRequirements(
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CaseType.CRIMINAL_DEFENSE
      );

      expect(requirements.requirements).toContain('arrestRecords');
      expect(requirements.requirements).toContain('policeReports');
      expect(requirements.requirements).toContain('witnessStatements');
    });

    it('should include medical malpractice specific requirements', async () => {
      const requirements = await caseLifecycleService.getPhaseRequirements(
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CaseType.MEDICAL_MALPRACTICE
      );

      expect(requirements.requirements).toContain('medicalRecords');
      expect(requirements.requirements).toContain('expertReports');
      expect(requirements.requirements).toContain('hospitalDocumentation');
    });

    it('should include divorce specific requirements', async () => {
      const requirements = await caseLifecycleService.getPhaseRequirements(
        CasePhase.INTAKE_RISK_ASSESSMENT,
        CaseType.DIVORCE_FAMILY
      );

      expect(requirements.requirements).toContain('marriageDate');
      expect(requirements.requirements).toContain('spouseInformation');
      expect(requirements.requirements).toContain('childrenInformation');
    });
  });

  describe('Phase-specific logic execution', () => {
    const mockCase = {
      id: 'test-case-id',
      phase: CasePhase.INTAKE_RISK_ASSESSMENT,
      status: CaseStatus.INTAKE,
      caseType: CaseType.CONTRACT_DISPUTE
    } as Case;

    beforeEach(() => {
      mockDb.client.task.createMany.mockResolvedValue([]);
      mockDb.client.task.create.mockResolvedValue({});
      mockDb.client.appointment.create.mockResolvedValue({});
    });

    it('should create intake phase tasks', async () => {
      await (caseLifecycleService as any).executeIntakePhaseLogic(mockCase.id, 'test-user-id');

      expect(mockDb.client.task.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Complete client intake form',
            caseId: mockCase.id,
            priority: 'HIGH'
          }),
          expect.objectContaining({
            title: 'Conduct risk assessment',
            caseId: mockCase.id,
            priority: 'HIGH'
          })
        ])
      });
    });

    it('should create preparation phase tasks', async () => {
      await (caseLifecycleService as any).executePreparationPhaseLogic(mockCase.id, 'test-user-id');

      expect(mockDb.client.task.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'Complete legal research',
            caseId: mockCase.id,
            priority: 'MEDIUM'
          }),
          expect.objectContaining({
            title: 'Prepare necessary documents',
            caseId: mockCase.id,
            priority: 'MEDIUM'
          })
        ])
      });
    });

    it('should create proceedings phase task', async () => {
      await (caseLifecycleService as any).executeProceedingsPhaseLogic(mockCase.id, 'test-user-id');

      expect(mockDb.client.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Monitor court proceedings',
          caseId: mockCase.id,
          priority: 'MEDIUM'
        })
      });
    });

    it('should create resolution phase task', async () => {
      await (caseLifecycleService as any).executeResolutionPhaseLogic(mockCase.id, 'test-user-id');

      expect(mockDb.client.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Finalize case resolution',
          caseId: mockCase.id,
          priority: 'MEDIUM'
        })
      });
    });

    it('should update case status and create closure phase task', async () => {
      await (caseLifecycleService as any).executeClosurePhaseLogic(mockCase.id, 'test-user-id');

      expect(mockDb.client.case.update).toHaveBeenCalledWith({
        where: { id: mockCase.id },
        data: {
          status: CaseStatus.CLOSED,
          closedAt: expect.any(Date)
        }
      });

      expect(mockDb.client.task.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Archive case file',
          caseId: mockCase.id,
          priority: 'LOW'
        })
      });
    });
  });

  describe('getUpcomingMilestones', () => {
    it('should return upcoming milestones from tasks', async () => {
      mockDb.client.task.findMany.mockResolvedValue([
        { title: 'Task 1' },
        { title: 'Task 2' },
        { title: 'Task 3' }
      ]);

      const milestones = await (caseLifecycleService as any).getUpcomingMilestones('test-case-id');

      expect(milestones).toEqual(['Task 1', 'Task 2', 'Task 3']);
      expect(mockDb.client.task.findMany).toHaveBeenCalledWith({
        where: {
          caseId: 'test-case-id',
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        orderBy: { dueDate: 'asc' },
        take: 5
      });
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const overdueDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      mockDb.client.task.findMany.mockResolvedValue([
        { title: 'Overdue Task 1' },
        { title: 'Overdue Task 2' }
      ]);

      const overdueTasks = await (caseLifecycleService as any).getOverdueTasks('test-case-id');

      expect(overdueTasks).toEqual(['Overdue Task 1', 'Overdue Task 2']);
      expect(mockDb.client.task.findMany).toHaveBeenCalledWith({
        where: {
          caseId: 'test-case-id',
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: expect.any(Date) }
        }
      });
    });
  });

  describe('calculateEstimatedCompletion', () => {
    it('should calculate estimated completion date', async () => {
      const mockCase = {
        id: 'test-case-id',
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
        status: CaseStatus.ACTIVE,
        caseType: CaseType.CONTRACT_DISPUTE
      } as Case;

      mockDb.client.case.findUnique.mockResolvedValue(mockCase);

      const estimatedCompletion = await (caseLifecycleService as any).calculateEstimatedCompletion(mockCase.id);

      expect(estimatedCompletion).toBeInstanceOf(Date);
      expect(estimatedCompletion?.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return undefined when case is not found', async () => {
      mockDb.client.case.findUnique.mockResolvedValue(null);

      const estimatedCompletion = await (caseLifecycleService as any).calculateEstimatedCompletion('non-existent-case');

      expect(estimatedCompletion).toBeUndefined();
    });
  });

  describe('getCaseTypeSpecificRequirements', () => {
    it('should return criminal defense specific requirements', () => {
      const requirements = (caseLifecycleService as any).getCaseTypeSpecificRequirements(
        CaseType.CRIMINAL_DEFENSE,
        CasePhase.INTAKE_RISK_ASSESSMENT
      );

      expect(requirements).toContain('bailHearing');
      expect(requirements).toContain('policeReports');
      expect(requirements).toContain('witnessStatements');
    });

    it('should return medical malpractice specific requirements', () => {
      const requirements = (caseLifecycleService as any).getCaseTypeSpecificRequirements(
        CaseType.MEDICAL_MALPRACTICE,
        CasePhase.INTAKE_RISK_ASSESSMENT
      );

      expect(requirements).toContain('medicalRecords');
      expect(requirements).toContain('expertReports');
    });

    it('should return divorce specific requirements', () => {
      const requirements = (caseLifecycleService as any).getCaseTypeSpecificRequirements(
        CaseType.DIVORCE_FAMILY,
        CasePhase.INTAKE_RISK_ASSESSMENT
      );

      expect(requirements).toContain('marriageCertificate');
      expect(requirements).toContain('childrenInformation');
    });

    it('should return empty array for case types without specific requirements', () => {
      const requirements = (caseLifecycleService as any).getCaseTypeSpecificRequirements(
        CaseType.LABOR_DISPUTE,
        CasePhase.INTAKE_RISK_ASSESSMENT
      );

      expect(requirements).toEqual([]);
    });
  });
});
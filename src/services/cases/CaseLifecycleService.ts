import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  CasePhase, 
  CaseType, 
  CaseStatus, 
  UserRole,
  Case,
  User
} from '@prisma/client';
import { StateMachine, CaseState, TransitionResult } from './StateMachine';
import { PhaseValidator } from './validators/PhaseValidator';
import { CaseTypeValidator } from './validators/CaseTypeValidator';

export interface PhaseRequirements {
  phase: CasePhase;
  requirements: string[];
  estimatedDuration?: number; // in days
  criticalTasks: string[];
  deliverables: string[];
}

export interface LifecycleEvent {
  eventType: 'PHASE_ENTERED' | 'PHASE_COMPLETED' | 'STATUS_CHANGED' | 'MILESTONE_REACHED';
  phase: CasePhase;
  status?: CaseStatus;
  timestamp: Date;
  userId: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface CaseProgress {
  currentPhase: CasePhase;
  currentStatus: CaseStatus;
  progressPercentage: number;
  completedPhases: CasePhase[];
  upcomingMilestones: string[];
  overdueTasks: string[];
  estimatedCompletion?: Date;
}

@injectable()
export class CaseLifecycleService {
  private stateMachine: StateMachine;
  private phaseValidator: PhaseValidator;
  private caseTypeValidator: CaseTypeValidator;

  constructor(@inject(Database) private db: Database) {
    this.stateMachine = new StateMachine();
    this.phaseValidator = new PhaseValidator();
    this.caseTypeValidator = new CaseTypeValidator();
  }

  async initializeCaseLifecycle(
    caseId: string,
    caseType: CaseType,
    userId: string
  ): Promise<LifecycleEvent[]> {
    const events: LifecycleEvent[] = [];

    // Create initial lifecycle event
    const initialEvent: LifecycleEvent = {
      eventType: 'PHASE_ENTERED',
      phase: CasePhase.INTAKE_RISK_ASSESSMENT,
      status: CaseStatus.INTAKE,
      timestamp: new Date(),
      userId,
      description: `Case ${caseId} initialized in ${CasePhase.INTAKE_RISK_ASSESSMENT} phase`
    };

    events.push(initialEvent);

    // Log the event to database
    await this.logLifecycleEvent(caseId, initialEvent);

    return events;
  }

  async transitionToPhase(
    caseId: string,
    targetPhase: CasePhase,
    userId: string,
    userRole: UserRole,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; events: LifecycleEvent[]; errors?: string[] }> {
    // Get current case state
    const currentCase = await this.getCaseState(caseId);
    if (!currentCase) {
      return {
        success: false,
        events: [],
        errors: ['Case not found']
      };
    }

    const currentState: CaseState = {
      phase: currentCase.phase,
      status: currentCase.status,
      caseType: currentCase.caseType,
      metadata: currentCase.metadata as Record<string, any> || {}
    };

    // Validate transition using state machine
    const transitionResult = this.stateMachine.canTransition(
      currentState,
      targetPhase,
      userRole,
      metadata
    );

    if (!transitionResult.success) {
      return {
        success: false,
        events: [],
        errors: transitionResult.errors
      };
    }

    // Validate phase-specific requirements
    const phaseValidation = await this.phaseValidator.validatePhaseTransition(
      currentCase,
      targetPhase,
      metadata
    );

    if (!phaseValidation.isValid) {
      return {
        success: false,
        events: [],
        errors: phaseValidation.errors
      };
    }

    // Validate case type requirements
    const caseTypeValidation = await this.caseTypeValidator.validateCaseTypeTransition(
      currentCase.caseType,
      currentCase.phase,
      targetPhase,
      metadata
    );

    if (!caseTypeValidation.isValid) {
      return {
        success: false,
        events: [],
        errors: caseTypeValidation.errors
      };
    }

    // Perform the transition
    const events: LifecycleEvent[] = [];

    // Log phase exit event
    const exitEvent: LifecycleEvent = {
      eventType: 'PHASE_COMPLETED',
      phase: currentCase.phase,
      timestamp: new Date(),
      userId,
      description: `Case ${caseId} completed ${currentCase.phase} phase`,
      metadata
    };

    events.push(exitEvent);
    await this.logLifecycleEvent(caseId, exitEvent);

    // Update case phase
    await this.updateCasePhase(caseId, targetPhase);

    // Log phase entry event
    const entryEvent: LifecycleEvent = {
      eventType: 'PHASE_ENTERED',
      phase: targetPhase,
      timestamp: new Date(),
      userId,
      description: `Case ${caseId} entered ${targetPhase} phase`,
      metadata
    };

    events.push(entryEvent);
    await this.logLifecycleEvent(caseId, entryEvent);

    // Execute phase-specific logic
    await this.executePhaseEntryLogic(caseId, targetPhase, userId);

    return {
      success: true,
      events
    };
  }

  async updateCaseStatus(
    caseId: string,
    newStatus: CaseStatus,
    userId: string,
    reason?: string
  ): Promise<LifecycleEvent> {
    const currentCase = await this.getCaseState(caseId);
    if (!currentCase) {
      throw new Error('Case not found');
    }

    // Validate status transition
    const statusValidation = await this.phaseValidator.validateStatusTransition(
      currentCase.status,
      newStatus,
      currentCase.phase
    );

    if (!statusValidation.isValid) {
      throw new Error(`Invalid status transition: ${statusValidation.errors.join(', ')}`);
    }

    // Update case status
    await this.db.client.case.update({
      where: { id: caseId },
      data: { status: newStatus }
    });

    // Log status change event
    const event: LifecycleEvent = {
      eventType: 'STATUS_CHANGED',
      phase: currentCase.phase,
      status: newStatus,
      timestamp: new Date(),
      userId,
      description: `Case ${caseId} status changed from ${currentCase.status} to ${newStatus}${reason ? `: ${reason}` : ''}`
    };

    await this.logLifecycleEvent(caseId, event);
    return event;
  }

  async getCaseProgress(caseId: string): Promise<CaseProgress> {
    const currentCase = await this.getCaseState(caseId);
    if (!currentCase) {
      throw new Error('Case not found');
    }

    const allPhases = Object.values(CasePhase);
    const currentPhaseIndex = allPhases.indexOf(currentCase.phase);
    const completedPhases = allPhases.slice(0, currentPhaseIndex);
    
    const progressPercentage = Math.round((currentPhaseIndex / (allPhases.length - 1)) * 100);

    // Get upcoming milestones
    const upcomingMilestones = await this.getUpcomingMilestones(caseId);
    
    // Get overdue tasks
    const overdueTasks = await this.getOverdueTasks(caseId);

    // Calculate estimated completion
    const estimatedCompletion = await this.calculateEstimatedCompletion(caseId);

    return {
      currentPhase: currentCase.phase,
      currentStatus: currentCase.status,
      progressPercentage,
      completedPhases,
      upcomingMilestones,
      overdueTasks,
      estimatedCompletion
    };
  }

  async getPhaseRequirements(phase: CasePhase, caseType: CaseType): Promise<PhaseRequirements> {
    const requirements = this.stateMachine.getPhaseRequirements(phase, caseType);
    
    const phaseConfig: Record<CasePhase, PhaseRequirements> = {
      [CasePhase.INTAKE_RISK_ASSESSMENT]: {
        phase: CasePhase.INTAKE_RISK_ASSESSMENT,
        requirements: ['clientInformation', 'caseDescription', 'initialEvidence', 'riskAssessment'],
        estimatedDuration: 7,
        criticalTasks: ['Initial consultation', 'Risk assessment', 'Document collection'],
        deliverables: ['Client intake form', 'Risk assessment report', 'Case file setup']
      },
      [CasePhase.PRE_PROCEEDING_PREPARATION]: {
        phase: CasePhase.PRE_PROCEEDING_PREPARATION,
        requirements: ['legalResearch', 'documentPreparation', 'witnessPreparation'],
        estimatedDuration: 30,
        criticalTasks: ['Legal research', 'Document preparation', 'Witness interviews'],
        deliverables: ['Legal research memo', 'Prepared documents', 'Witness statements']
      },
      [CasePhase.FORMAL_PROCEEDINGS]: {
        phase: CasePhase.FORMAL_PROCEEDINGS,
        requirements: ['courtFiling', 'evidenceSubmission', 'hearingPreparation'],
        estimatedDuration: 90,
        criticalTasks: ['File court documents', 'Submit evidence', 'Prepare for hearings'],
        deliverables: ['Court filings', 'Evidence packages', 'Hearing preparation']
      },
      [CasePhase.RESOLUTION_POST_PROCEEDING]: {
        phase: CasePhase.RESOLUTION_POST_PROCEEDING,
        requirements: ['judgmentAnalysis', 'settlementNegotiation', 'appealConsideration'],
        estimatedDuration: 30,
        criticalTasks: ['Analyze judgment', 'Negotiate settlement', 'Consider appeals'],
        deliverables: ['Judgment analysis', 'Settlement agreement', 'Appeal decision']
      },
      [CasePhase.CLOSURE_REVIEW_ARCHIVING]: {
        phase: CasePhase.CLOSURE_REVIEW_ARCHIVING,
        requirements: ['finalDocumentation', 'clientNotification', 'archivalPreparation'],
        estimatedDuration: 14,
        criticalTasks: ['Final documentation', 'Client notification', 'Case archival'],
        deliverables: ['Final case report', 'Client notification', 'Archived case file']
      }
    };

    // Apply case type-specific modifications
    const baseConfig = phaseConfig[phase];
    const caseTypeSpecificRequirements = this.getCaseTypeSpecificRequirements(caseType, phase);
    
    return {
      ...baseConfig,
      requirements: [...baseConfig.requirements, ...caseTypeSpecificRequirements]
    };
  }

  private async getCaseState(caseId: string): Promise<Case | null> {
    return await this.db.client.case.findUnique({
      where: { id: caseId }
    });
  }

  private async logLifecycleEvent(caseId: string, event: LifecycleEvent): Promise<void> {
    await this.db.client.caseLifecycleEvent.create({
      data: {
        caseId,
        eventType: event.eventType,
        phase: event.phase,
        status: event.status,
        timestamp: event.timestamp,
        userId: event.userId,
        description: event.description,
        metadata: event.metadata
      }
    });
  }

  private async updateCasePhase(caseId: string, newPhase: CasePhase): Promise<void> {
    await this.db.client.case.update({
      where: { id: caseId },
      data: { phase: newPhase }
    });
  }

  private async executePhaseEntryLogic(caseId: string, phase: CasePhase, userId: string): Promise<void> {
    switch (phase) {
      case CasePhase.INTAKE_RISK_ASSESSMENT:
        await this.executeIntakePhaseLogic(caseId, userId);
        break;
      case CasePhase.PRE_PROCEEDING_PREPARATION:
        await this.executePreparationPhaseLogic(caseId, userId);
        break;
      case CasePhase.FORMAL_PROCEEDINGS:
        await this.executeProceedingsPhaseLogic(caseId, userId);
        break;
      case CasePhase.RESOLUTION_POST_PROCEEDING:
        await this.executeResolutionPhaseLogic(caseId, userId);
        break;
      case CasePhase.CLOSURE_REVIEW_ARCHIVING:
        await this.executeClosurePhaseLogic(caseId, userId);
        break;
    }
  }

  private async executeIntakePhaseLogic(caseId: string, userId: string): Promise<void> {
    // Create initial tasks for intake phase
    await this.db.client.task.createMany({
      data: [
        {
          title: 'Complete client intake form',
          description: 'Gather all necessary client information and documentation',
          caseId,
          assignedTo: userId,
          assignedBy: userId,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          status: 'PENDING',
          priority: 'HIGH'
        },
        {
          title: 'Conduct risk assessment',
          description: 'Assess case risks and determine viability',
          caseId,
          assignedTo: userId,
          assignedBy: userId,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
          status: 'PENDING',
          priority: 'HIGH'
        }
      ]
    });
  }

  private async executePreparationPhaseLogic(caseId: string, userId: string): Promise<void> {
    // Create tasks for preparation phase
    await this.db.client.task.createMany({
      data: [
        {
          title: 'Complete legal research',
          description: 'Research relevant laws and precedents',
          caseId,
          assignedTo: userId,
          assignedBy: userId,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
          status: 'PENDING',
          priority: 'MEDIUM'
        },
        {
          title: 'Prepare necessary documents',
          description: 'Draft and prepare all required legal documents',
          caseId,
          assignedTo: userId,
          assignedBy: userId,
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
          status: 'PENDING',
          priority: 'MEDIUM'
        }
      ]
    });
  }

  private async executeProceedingsPhaseLogic(caseId: string, userId: string): Promise<void> {
    // Create tasks for proceedings phase
    await this.db.client.task.create({
      data: {
        title: 'Monitor court proceedings',
        description: 'Track and manage all court appearances and filings',
        caseId,
        assignedTo: userId,
        assignedBy: userId,
        dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        status: 'PENDING',
        priority: 'MEDIUM'
      }
    });
  }

  private async executeResolutionPhaseLogic(caseId: string, userId: string): Promise<void> {
    // Create tasks for resolution phase
    await this.db.client.task.create({
      data: {
        title: 'Finalize case resolution',
        description: 'Complete all post-proceeding requirements and documentation',
        caseId,
        assignedTo: userId,
        assignedBy: userId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'PENDING',
        priority: 'MEDIUM'
      }
    });
  }

  private async executeClosurePhaseLogic(caseId: string, userId: string): Promise<void> {
    // Update case status to closed
    await this.db.client.case.update({
      where: { id: caseId },
      data: { 
        status: CaseStatus.CLOSED,
        closedAt: new Date()
      }
    });

    // Create closure task
    await this.db.client.task.create({
      data: {
        title: 'Archive case file',
        description: 'Complete case archival and final documentation',
        caseId,
        assignedTo: userId,
        assignedBy: userId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'PENDING',
        priority: 'LOW'
      }
    });
  }

  private async getUpcomingMilestones(caseId: string): Promise<string[]> {
    const tasks = await this.db.client.task.findMany({
      where: { 
        caseId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      orderBy: { dueDate: 'asc' },
      take: 5
    });

    return tasks.map(task => task.title);
  }

  private async getOverdueTasks(caseId: string): Promise<string[]> {
    const overdueTasks = await this.db.client.task.findMany({
      where: { 
        caseId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: new Date() }
      }
    });

    return overdueTasks.map(task => task.title);
  }

  private async calculateEstimatedCompletion(caseId: string): Promise<Date | undefined> {
    const currentCase = await this.getCaseState(caseId);
    if (!currentCase) return undefined;

    const allPhases = Object.values(CasePhase);
    const currentPhaseIndex = allPhases.indexOf(currentCase.phase);
    const remainingPhases = allPhases.slice(currentPhaseIndex + 1);

    let totalDays = 0;
    for (const phase of remainingPhases) {
      const requirements = await this.getPhaseRequirements(phase, currentCase.caseType);
      totalDays += requirements.estimatedDuration || 0;
    }

    return new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000);
  }

  private getCaseTypeSpecificRequirements(caseType: CaseType, phase: CasePhase): string[] {
    const caseTypeRequirements: Record<CaseType, Record<CasePhase, string[]>> = {
      [CaseType.CRIMINAL_DEFENSE]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: ['bailHearing', 'policeReports', 'witnessStatements'],
        [CasePhase.FORMAL_PROCEEDINGS]: ['courtAppearances', 'evidencePresentation']
      },
      [CaseType.DIVORCE_FAMILY]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: ['marriageCertificate', 'childrenInformation'],
        [CasePhase.PRE_PROCEEDING_PREPARATION]: ['mediationAttempts', 'custodyAgreement']
      },
      [CaseType.MEDICAL_MALPRACTICE]: {
        [CasePhase.INTAKE_RISK_ASSESSMENT]: ['medicalRecords', 'expertReports'],
        [CasePhase.FORMAL_PROCEEDINGS]: ['expertTestimony', 'medicalEvidence']
      }
    };

    return caseTypeRequirements[caseType]?.[phase] || [];
  }
}
import { injectable, inject } from 'tsyringe';
import { Database } from '../../utils/database';
import { 
  CasePhase, 
  CaseType, 
  CaseStatus, 
  UserRole,
  Case,
  User,
  AuditLog
} from '@prisma/client';
import { StateMachine, CaseState, TransitionResult } from './StateMachine';
import { CaseLifecycleService, LifecycleEvent } from './CaseLifecycleService';
import { PhaseValidator } from './validators/PhaseValidator';
import { CaseTypeValidator } from './validators/CaseTypeValidator';

export interface TransitionRequest {
  caseId: string;
  targetPhase: CasePhase;
  targetStatus?: CaseStatus;
  userId: string;
  userRole: UserRole;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TransitionResult {
  success: boolean;
  message: string;
  transitionId?: string;
  events?: LifecycleEvent[];
  errors?: string[];
  warnings?: string[];
  recommendations?: string[];
}

export interface TransitionHistory {
  id: string;
  caseId: string;
  fromPhase: CasePhase;
  toPhase: CasePhase;
  fromStatus: CaseStatus;
  toStatus: CaseStatus;
  userId: string;
  userRole: UserRole;
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TransitionApproval {
  id: string;
  transitionId: string;
  caseId: string;
  requestedBy: string;
  requestedByRole: UserRole;
  approvedBy?: string;
  approvedByRole?: UserRole;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  createdAt: Date;
  decidedAt?: Date;
}

export interface TransitionNotification {
  id: string;
  caseId: string;
  transitionId: string;
  recipientId: string;
  recipientRole: UserRole;
  message: string;
  type: 'PHASE_CHANGE' | 'STATUS_CHANGE' | 'APPROVAL_REQUIRED' | 'TRANSITION_COMPLETED';
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
}

@injectable()
export class CaseTransitionService {
  private stateMachine: StateMachine;
  private lifecycleService: CaseLifecycleService;
  private phaseValidator: PhaseValidator;
  private caseTypeValidator: CaseTypeValidator;

  constructor(@inject(Database) private db: Database) {
    this.stateMachine = new StateMachine();
    this.lifecycleService = new CaseLifecycleService(db);
    this.phaseValidator = new PhaseValidator();
    this.caseTypeValidator = new CaseTypeValidator();
  }

  async requestTransition(request: TransitionRequest): Promise<TransitionResult> {
    try {
      // Get current case state
      const currentCase = await this.getCurrentCase(request.caseId);
      if (!currentCase) {
        return {
          success: false,
          message: 'Case not found',
          errors: ['Case not found']
        };
      }

      // Check if transition requires approval
      const requiresApproval = await this.requiresApproval(currentCase, request.targetPhase, request.userRole);
      
      if (requiresApproval) {
        return await this.createApprovalRequest(currentCase, request);
      }

      // Execute transition directly
      return await this.executeTransition(currentCase, request);
    } catch (error) {
      console.error('Error in requestTransition:', error);
      return {
        success: false,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async executeTransition(currentCase: Case, request: TransitionRequest): Promise<TransitionResult> {
    const currentState: CaseState = {
      phase: currentCase.phase,
      status: currentCase.status,
      caseType: currentCase.caseType,
      metadata: currentCase.metadata as Record<string, any> || {}
    };

    // Validate transition using state machine
    const stateMachineResult = this.stateMachine.canTransition(
      currentState,
      request.targetPhase,
      request.userRole,
      request.metadata
    );

    if (!stateMachineResult.success) {
      return {
        success: false,
        message: stateMachineResult.message || 'Transition not allowed',
        errors: stateMachineResult.errors
      };
    }

    // Validate phase-specific requirements
    const phaseValidation = await this.phaseValidator.validatePhaseTransition(
      currentCase,
      request.targetPhase,
      request.metadata
    );

    if (!phaseValidation.isValid) {
      return {
        success: false,
        message: 'Phase validation failed',
        errors: phaseValidation.errors,
        warnings: phaseValidation.warnings
      };
    }

    // Validate case type requirements
    const caseTypeValidation = await this.caseTypeValidator.validateCaseTypeTransition(
      currentCase.caseType,
      currentCase.phase,
      request.targetPhase,
      request.metadata
    );

    if (!caseTypeValidation.isValid) {
      return {
        success: false,
        message: 'Case type validation failed',
        errors: caseTypeValidation.errors,
        warnings: caseTypeValidation.warnings,
        recommendations: caseTypeValidation.recommendations
      };
    }

    // Execute phase transition
    const lifecycleResult = await this.lifecycleService.transitionToPhase(
      request.caseId,
      request.targetPhase,
      request.userId,
      request.userRole,
      request.metadata
    );

    if (!lifecycleResult.success) {
      return {
        success: false,
        message: 'Phase transition failed',
        errors: lifecycleResult.errors
      };
    }

    // Handle status change if requested
    if (request.targetStatus && request.targetStatus !== currentCase.status) {
      try {
        await this.lifecycleService.updateCaseStatus(
          request.caseId,
          request.targetStatus,
          request.userId,
          request.reason
        );
      } catch (error) {
        return {
          success: false,
          message: 'Status update failed',
          errors: [error instanceof Error ? error.message : 'Status update failed']
        };
      }
    }

    // Record transition history
    const transitionRecord = await this.recordTransitionHistory(currentCase, request);

    // Create notifications
    await this.createTransitionNotifications(currentCase, request, transitionRecord.id);

    // Execute post-transition business logic
    await this.executePostTransitionLogic(currentCase, request);

    return {
      success: true,
      message: `Successfully transitioned case from ${currentCase.phase} to ${request.targetPhase}`,
      transitionId: transitionRecord.id,
      events: lifecycleResult.events,
      warnings: [
        ...(phaseValidation.warnings || []),
        ...(caseTypeValidation.warnings || [])
      ],
      recommendations: caseTypeValidation.recommendations
    };
  }

  async approveTransition(transitionId: string, approvedBy: string, approvedByRole: UserRole, reason?: string): Promise<TransitionResult> {
    try {
      // Get approval request
      const approvalRequest = await this.db.client.transitionApproval.findUnique({
        where: { id: transitionId },
        include: {
          case: true
        }
      });

      if (!approvalRequest) {
        return {
          success: false,
          message: 'Approval request not found',
          errors: ['Approval request not found']
        };
      }

      if (approvalRequest.status !== 'PENDING') {
        return {
          success: false,
          message: `Approval request already ${approvalRequest.status.toLowerCase()}`,
          errors: [`Approval request already ${approvalRequest.status.toLowerCase()}`]
        };
      }

      // Update approval status
      await this.db.client.transitionApproval.update({
        where: { id: transitionId },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedByRole,
          reason,
          decidedAt: new Date()
        }
      });

      // Execute the transition
      const transitionRequest: TransitionRequest = {
        caseId: approvalRequest.caseId,
        targetPhase: approvalRequest.targetPhase as CasePhase,
        targetStatus: approvalRequest.targetStatus as CaseStatus,
        userId: approvalRequest.requestedBy,
        userRole: approvalRequest.requestedByRole as UserRole,
        reason: approvalRequest.reason,
        metadata: approvalRequest.metadata as Record<string, any>
      };

      return await this.executeTransition(approvalRequest.case, transitionRequest);
    } catch (error) {
      console.error('Error in approveTransition:', error);
      return {
        success: false,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async rejectTransition(transitionId: string, approvedBy: string, approvedByRole: UserRole, reason: string): Promise<TransitionResult> {
    try {
      // Get approval request
      const approvalRequest = await this.db.client.transitionApproval.findUnique({
        where: { id: transitionId }
      });

      if (!approvalRequest) {
        return {
          success: false,
          message: 'Approval request not found',
          errors: ['Approval request not found']
        };
      }

      if (approvalRequest.status !== 'PENDING') {
        return {
          success: false,
          message: `Approval request already ${approvalRequest.status.toLowerCase()}`,
          errors: [`Approval request already ${approvalRequest.status.toLowerCase()}`]
        };
      }

      // Update approval status
      await this.db.client.transitionApproval.update({
        where: { id: transitionId },
        data: {
          status: 'REJECTED',
          approvedBy,
          approvedByRole,
          reason,
          decidedAt: new Date()
        }
      });

      // Create notification
      await this.db.client.transitionNotification.create({
        data: {
          caseId: approvalRequest.caseId,
          transitionId,
          recipientId: approvalRequest.requestedBy,
          recipientRole: approvalRequest.requestedByRole as UserRole,
          message: `Your transition request was rejected: ${reason}`,
          type: 'APPROVAL_REQUIRED',
          isRead: false
        }
      });

      return {
        success: true,
        message: 'Transition request rejected successfully'
      };
    } catch (error) {
      console.error('Error in rejectTransition:', error);
      return {
        success: false,
        message: 'Internal server error',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async getTransitionHistory(caseId: string): Promise<TransitionHistory[]> {
    const transitions = await this.db.client.caseTransition.findMany({
      where: { caseId },
      include: {
        user: true
      },
      orderBy: { timestamp: 'desc' }
    });

    return transitions.map(transition => ({
      id: transition.id,
      caseId: transition.caseId,
      fromPhase: transition.fromPhase,
      toPhase: transition.toPhase,
      fromStatus: transition.fromStatus,
      toStatus: transition.toStatus,
      userId: transition.userId,
      userRole: transition.userRole,
      reason: transition.reason,
      timestamp: transition.timestamp,
      metadata: transition.metadata as Record<string, any>
    }));
  }

  async getAvailableTransitions(caseId: string, userRole: UserRole): Promise<CasePhase[]> {
    const currentCase = await this.getCurrentCase(caseId);
    if (!currentCase) {
      return [];
    }

    const currentState: CaseState = {
      phase: currentCase.phase,
      status: currentCase.status,
      caseType: currentCase.caseType,
      metadata: currentCase.metadata as Record<string, any> || {}
    };

    return this.stateMachine.getAvailableTransitions(currentState, userRole);
  }

  async getPendingApprovals(userId: string, userRole: UserRole): Promise<TransitionApproval[]> {
    const approvals = await this.db.client.transitionApproval.findMany({
      where: {
        status: 'PENDING',
        // Only show approvals that this user can approve
        // This would need to be customized based on your approval workflow
      },
      include: {
        case: {
          include: {
            client: { include: { user: true } },
            attorney: { include: { user: true } }
          }
        },
        requestedByUser: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return approvals.map(approval => ({
      id: approval.id,
      transitionId: approval.id,
      caseId: approval.caseId,
      requestedBy: approval.requestedBy,
      requestedByRole: approval.requestedByRole as UserRole,
      approvedBy: approval.approvedBy,
      approvedByRole: approval.approvedByRole as UserRole,
      status: approval.status,
      reason: approval.reason,
      createdAt: approval.createdAt,
      decidedAt: approval.decidedAt
    }));
  }

  async getNotifications(userId: string, userRole: UserRole): Promise<TransitionNotification[]> {
    const notifications = await this.db.client.transitionNotification.findMany({
      where: {
        recipientId: userId,
        recipientRole: userRole
      },
      orderBy: { createdAt: 'desc' }
    });

    return notifications.map(notification => ({
      id: notification.id,
      caseId: notification.caseId,
      transitionId: notification.transitionId,
      recipientId: notification.recipientId,
      recipientRole: notification.recipientRole,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      readAt: notification.readAt
    }));
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    await this.db.client.transitionNotification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() }
    });
  }

  private async getCurrentCase(caseId: string): Promise<Case | null> {
    return await this.db.client.case.findUnique({
      where: { id: caseId }
    });
  }

  private async requiresApproval(
    currentCase: Case,
    targetPhase: CasePhase,
    userRole: UserRole
  ): Promise<boolean> {
    // Define approval requirements based on case type and phase
    const approvalRules: Record<CaseType, Partial<Record<CasePhase, UserRole[]>>> = {
      [CaseType.CRIMINAL_DEFENSE]: {
        [CasePhase.FORMAL_PROCEEDINGS]: [UserRole.ADMIN],
        [CasePhase.RESOLUTION_POST_PROCEEDING]: [UserRole.ADMIN]
      },
      [CaseType.MEDICAL_MALPRACTICE]: {
        [CasePhase.PRE_PROCEEDING_PREPARATION]: [UserRole.ADMIN],
        [CasePhase.FORMAL_PROCEEDINGS]: [UserRole.ADMIN]
      },
      [CaseType.DIVORCE_FAMILY]: {
        [CasePhase.FORMAL_PROCEEDINGS]: [UserRole.ADMIN]
      }
    };

    const caseTypeRules = approvalRules[currentCase.caseType];
    if (!caseTypeRules) return false;

    const requiredRoles = caseTypeRules[targetPhase];
    if (!requiredRoles) return false;

    // If user's role is not in the required roles, approval is needed
    return !requiredRoles.includes(userRole);
  }

  private async createApprovalRequest(currentCase: Case, request: TransitionRequest): Promise<TransitionResult> {
    const approval = await this.db.client.transitionApproval.create({
      data: {
        caseId: request.caseId,
        targetPhase: request.targetPhase,
        targetStatus: request.targetStatus,
        requestedBy: request.userId,
        requestedByRole: request.userRole,
        reason: request.reason,
        metadata: request.metadata,
        status: 'PENDING'
      }
    });

    // Create notification for approvers
    await this.createApprovalNotifications(currentCase, approval.id);

    return {
      success: true,
      message: 'Transition approval request created successfully',
      transitionId: approval.id
    };
  }

  private async createApprovalNotifications(currentCase: Case, approvalId: string): Promise<void> {
    // Find users who can approve this transition
    // This is a simplified example - you'd want to customize based on your organization structure
    const approvers = await this.db.client.user.findMany({
      where: {
        role: UserRole.ADMIN
      }
    });

    for (const approver of approvers) {
      await this.db.client.transitionNotification.create({
        data: {
          caseId: currentCase.id,
          transitionId: approvalId,
          recipientId: approver.id,
          recipientRole: approver.role,
          message: `Transition approval required for case ${currentCase.title}`,
          type: 'APPROVAL_REQUIRED',
          isRead: false
        }
      });
    }
  }

  private async recordTransitionHistory(currentCase: Case, request: TransitionRequest): Promise<any> {
    return await this.db.client.caseTransition.create({
      data: {
        caseId: request.caseId,
        fromPhase: currentCase.phase,
        toPhase: request.targetPhase,
        fromStatus: currentCase.status,
        toStatus: request.targetStatus || currentCase.status,
        userId: request.userId,
        userRole: request.userRole,
        reason: request.reason,
        metadata: request.metadata
      }
    });
  }

  private async createTransitionNotifications(
    currentCase: Case,
    request: TransitionRequest,
    transitionId: string
  ): Promise<void> {
    // Notify case attorney
    if (currentCase.attorneyId !== request.userId) {
      await this.db.client.transitionNotification.create({
        data: {
          caseId: currentCase.id,
          transitionId,
          recipientId: currentCase.attorneyId,
          recipientRole: UserRole.ATTORNEY,
          message: `Case ${currentCase.title} transitioned to ${request.targetPhase}`,
          type: 'PHASE_CHANGE',
          isRead: false
        }
      });
    }

    // Notify case client
    if (currentCase.clientId !== request.userId) {
      await this.db.client.transitionNotification.create({
        data: {
          caseId: currentCase.id,
          transitionId,
          recipientId: currentCase.clientId,
          recipientRole: UserRole.CLIENT,
          message: `Your case ${currentCase.title} has moved to ${request.targetPhase}`,
          type: 'PHASE_CHANGE',
          isRead: false
        }
      });
    }
  }

  private async executePostTransitionLogic(currentCase: Case, request: TransitionRequest): Promise<void> {
    // Update case metadata with transition information
    const updatedMetadata = {
      ...(currentCase.metadata as Record<string, any> || {}),
      lastTransition: {
        timestamp: new Date(),
        fromPhase: currentCase.phase,
        toPhase: request.targetPhase,
        by: request.userId
      }
    };

    await this.db.client.case.update({
      where: { id: currentCase.id },
      data: {
        metadata: updatedMetadata
      }
    });

    // Execute case type specific post-transition logic
    await this.executeCaseTypePostTransitionLogic(currentCase, request);
  }

  private async executeCaseTypePostTransitionLogic(currentCase: Case, request: TransitionRequest): Promise<void> {
    switch (currentCase.caseType) {
      case CaseType.CRIMINAL_DEFENSE:
        if (request.targetPhase === CasePhase.FORMAL_PROCEEDINGS) {
          // Schedule court appearances
          await this.scheduleCriminalDefenseAppointments(currentCase.id);
        }
        break;
      case CaseType.MEDICAL_MALPRACTICE:
        if (request.targetPhase === CasePhase.PRE_PROCEEDING_PREPARATION) {
          // Schedule expert consultations
          await this.scheduleMedicalExpertConsultations(currentCase.id);
        }
        break;
      case CaseType.DIVORCE_FAMILY:
        if (request.targetPhase === CasePhase.PRE_PROCEEDING_PREPARATION) {
          // Schedule mediation
          await this.scheduleMediationSession(currentCase.id);
        }
        break;
    }
  }

  private async scheduleCriminalDefenseAppointments(caseId: string): Promise<void> {
    // Create appointments for criminal defense case
    await this.db.client.appointment.create({
      data: {
        caseId,
        title: 'Court Appearance - Arraignment',
        description: 'Initial court appearance for arraignment',
        startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours
        status: 'SCHEDULED',
        attorneyId: (await this.db.client.case.findUnique({ where: { id: caseId } }))?.attorneyId || '',
        clientId: (await this.db.client.case.findUnique({ where: { id: caseId } }))?.clientId || ''
      }
    });
  }

  private async scheduleMedicalExpertConsultations(caseId: string): Promise<void> {
    // Create task for medical expert consultation
    const caseData = await this.db.client.case.findUnique({ where: { id: caseId } });
    if (!caseData) return;

    await this.db.client.task.create({
      data: {
        title: 'Schedule Medical Expert Consultation',
        description: 'Arrange consultation with medical expert for case evaluation',
        caseId,
        assignedTo: caseData.attorneyId,
        assignedBy: caseData.attorneyId,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        status: 'PENDING',
        priority: 'HIGH'
      }
    });
  }

  private async scheduleMediationSession(caseId: string): Promise<void> {
    // Create appointment for mediation session
    const caseData = await this.db.client.case.findUnique({ where: { id: caseId } });
    if (!caseData) return;

    await this.db.client.appointment.create({
      data: {
        caseId,
        title: 'Mediation Session',
        description: 'Court-ordered mediation session',
        startTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        endTime: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // 3 hours
        status: 'SCHEDULED',
        attorneyId: caseData.attorneyId,
        clientId: caseData.clientId
      }
    });
  }
}
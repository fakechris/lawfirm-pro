import { Database } from '../../utils/database';
import { CasePhase, CaseStatus, UserRole, Case } from '@prisma/client';
import { TransitionResult } from './StateMachine';
import { LifecycleEvent } from './CaseLifecycleService';
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
export declare class CaseTransitionService {
    private db;
    private stateMachine;
    private lifecycleService;
    private phaseValidator;
    private caseTypeValidator;
    constructor(db: Database);
    requestTransition(request: TransitionRequest): Promise<TransitionResult>;
    executeTransition(currentCase: Case, request: TransitionRequest): Promise<TransitionResult>;
    approveTransition(transitionId: string, approvedBy: string, approvedByRole: UserRole, reason?: string): Promise<TransitionResult>;
    rejectTransition(transitionId: string, approvedBy: string, approvedByRole: UserRole, reason: string): Promise<TransitionResult>;
    getTransitionHistory(caseId: string): Promise<TransitionHistory[]>;
    getAvailableTransitions(caseId: string, userRole: UserRole): Promise<CasePhase[]>;
    getPendingApprovals(userId: string, userRole: UserRole): Promise<TransitionApproval[]>;
    getNotifications(userId: string, userRole: UserRole): Promise<TransitionNotification[]>;
    markNotificationAsRead(notificationId: string): Promise<void>;
    private getCurrentCase;
    private requiresApproval;
    private createApprovalRequest;
    private createApprovalNotifications;
    private recordTransitionHistory;
    private createTransitionNotifications;
    private executePostTransitionLogic;
    private executeCaseTypePostTransitionLogic;
    private scheduleCriminalDefenseAppointments;
    private scheduleMedicalExpertConsultations;
    private scheduleMediationSession;
}
//# sourceMappingURL=CaseTransitionService.d.ts.map
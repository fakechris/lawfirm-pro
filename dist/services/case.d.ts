import { Database } from '../utils/database';
import { CaseStatus, CasePhase, UserRole } from '@prisma/client';
import { CaseResponse, CreateCaseRequest, ClientDashboard, AttorneyDashboard } from '../types';
import { TransitionRequest, TransitionResult } from './cases/CaseTransitionService';
import { CaseProgress } from './cases/CaseLifecycleService';
export declare class CaseService {
    private db;
    private transitionService;
    private lifecycleService;
    constructor(db: Database);
    createCase(caseRequest: CreateCaseRequest, attorneyId: string): Promise<CaseResponse>;
    getCasesByClientId(clientId: string): Promise<CaseResponse[]>;
    getCasesByAttorneyId(attorneyId: string): Promise<CaseResponse[]>;
    getCaseById(caseId: string, userId: string, userRole: UserRole): Promise<CaseResponse>;
    updateCaseStatus(caseId: string, status: CaseStatus, userId: string, userRole: UserRole): Promise<CaseResponse>;
    updateCasePhase(caseId: string, phase: CasePhase, userId: string, userRole: UserRole): Promise<CaseResponse>;
    getClientDashboard(clientId: string): Promise<ClientDashboard>;
    getAttorneyDashboard(attorneyId: string): Promise<AttorneyDashboard>;
    requestCaseTransition(transitionRequest: TransitionRequest): Promise<TransitionResult>;
    getCaseProgress(caseId: string): Promise<CaseProgress>;
    getAvailableTransitions(caseId: string, userId: string, userRole: UserRole): Promise<CasePhase[]>;
    getCaseTransitionHistory(caseId: string, userId: string, userRole: UserRole): Promise<any[]>;
    getPendingApprovals(userId: string, userRole: UserRole): Promise<any[]>;
    approveTransition(transitionId: string, approvedBy: string, approvedByRole: UserRole, reason?: string): Promise<TransitionResult>;
    rejectTransition(transitionId: string, approvedBy: string, approvedByRole: UserRole, reason: string): Promise<TransitionResult>;
    private verifyCaseAccess;
    private transformCaseResponse;
}
//# sourceMappingURL=case.d.ts.map
import { Database } from '../utils/database';
import { CaseStatus, CasePhase, UserRole } from '@prisma/client';
import { CaseResponse, CreateCaseRequest, ClientDashboard, AttorneyDashboard } from '../types';
export declare class CaseService {
    private db;
    constructor(db: Database);
    createCase(caseRequest: CreateCaseRequest, attorneyId: string): Promise<CaseResponse>;
    getCasesByClientId(clientId: string): Promise<CaseResponse[]>;
    getCasesByAttorneyId(attorneyId: string): Promise<CaseResponse[]>;
    getCaseById(caseId: string, userId: string, userRole: UserRole): Promise<CaseResponse>;
    updateCaseStatus(caseId: string, status: CaseStatus, userId: string, userRole: UserRole): Promise<CaseResponse>;
    updateCasePhase(caseId: string, phase: CasePhase, userId: string, userRole: UserRole): Promise<CaseResponse>;
    getClientDashboard(clientId: string): Promise<ClientDashboard>;
    getAttorneyDashboard(attorneyId: string): Promise<AttorneyDashboard>;
    private verifyCaseAccess;
    private transformCaseResponse;
}
//# sourceMappingURL=case.d.ts.map
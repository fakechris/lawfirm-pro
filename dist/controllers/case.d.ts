import { Request, Response } from 'express';
export declare class CaseController {
    private caseService;
    createCase(req: Request, res: Response): Promise<void>;
    getClientCases(req: Request, res: Response): Promise<void>;
    getAttorneyCases(req: Request, res: Response): Promise<void>;
    getCaseById(req: Request, res: Response): Promise<void>;
    updateCaseStatus(req: Request, res: Response): Promise<void>;
    updateCasePhase(req: Request, res: Response): Promise<void>;
    getClientDashboard(req: Request, res: Response): Promise<void>;
    getAttorneyDashboard(req: Request, res: Response): Promise<void>;
    getCaseStats(req: Request, res: Response): Promise<void>;
    private getClientCaseStats;
    private getAttorneyCaseStats;
}
//# sourceMappingURL=case.d.ts.map
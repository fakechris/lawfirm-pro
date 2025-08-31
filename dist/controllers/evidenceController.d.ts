import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class EvidenceController {
    createEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    updateEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    deleteEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    searchEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    addToChainOfCustody(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getChainOfCustody(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    downloadEvidence(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    private checkEvidenceAccess;
    private getUserAccessibleCases;
}
export declare const evidenceController: EvidenceController;
//# sourceMappingURL=evidenceController.d.ts.map
import { Request, Response } from 'express';
export declare class AuditLogController {
    static getAllAuditLogs(req: Request, res: Response): Promise<void>;
    static getAuditLogById(req: Request, res: Response): Promise<void>;
    static getUserActivity(req: Request, res: Response): Promise<void>;
    static getResourceActivity(req: Request, res: Response): Promise<void>;
    static getActionStats(req: Request, res: Response): Promise<void>;
    static getResourceStats(req: Request, res: Response): Promise<void>;
    static getUserStats(req: Request, res: Response): Promise<void>;
    static getAuditDashboard(req: Request, res: Response): Promise<void>;
    static cleanupAuditLogs(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=AuditLogController.d.ts.map
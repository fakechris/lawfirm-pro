import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
export interface AuditedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: UserRole;
    };
}
export declare class AuditMiddleware {
    private static db;
    static logAction(action: string, entityType: string, entityId?: string, oldValues?: any, newValues?: any): Promise<(req: AuditedRequest, res: Response, next: NextFunction) => Promise<void>>;
    static createAuditLog(req: AuditedRequest, action: string, entityType: string, entityId?: string, oldValues?: any, newValues?: any): Promise<void>;
    static logUserAction(action: string, entityType: string): (req: AuditedRequest, res: Response, next: NextFunction) => Promise<void>;
    static logDataModification(action: string, entityType: string): (req: AuditedRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=audit.d.ts.map
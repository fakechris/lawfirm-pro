import { AuditLog } from '../types';
export declare class AuditLogModel {
    static create(data: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;
    static findById(id: string): Promise<AuditLog | null>;
    static findAll(page?: number, limit?: number, filters?: {
        userId?: string;
        action?: string;
        resource?: string;
        resourceId?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        auditLogs: AuditLog[];
        total: number;
    }>;
    static getUserActivity(userId: string, limit?: number): Promise<AuditLog[]>;
    static getResourceActivity(resource: string, resourceId: string, limit?: number): Promise<AuditLog[]>;
    static getActionStats(startDate?: Date, endDate?: Date): Promise<{
        action: string;
        count: number;
    }[]>;
    static getResourceStats(startDate?: Date, endDate?: Date): Promise<{
        resource: string;
        count: number;
    }[]>;
    static getUserStats(startDate?: Date, endDate?: Date): Promise<{
        user: {
            id: string;
            username: string;
            email: string;
        };
        count: number;
    }[]>;
    static cleanup(olderThanDays?: number): Promise<number>;
}
//# sourceMappingURL=AuditLogModel.d.ts.map
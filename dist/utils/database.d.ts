import { PrismaClient } from '@prisma/client';
export declare class Database {
    private prisma;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    healthCheck(): Promise<{
        status: string;
        message?: string;
    }>;
    get client(): PrismaClient;
}
//# sourceMappingURL=database.d.ts.map
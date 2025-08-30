"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const client_1 = require("@prisma/client");
class Database {
    constructor() {
        this.isConnected = false;
        this.prisma = new client_1.PrismaClient({
            log: ['query', 'info', 'warn', 'error'],
        });
    }
    async connect() {
        try {
            await this.prisma.$connect();
            this.isConnected = true;
            console.log('✅ Database connected successfully');
        }
        catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }
    async disconnect() {
        if (this.isConnected) {
            await this.prisma.$disconnect();
            this.isConnected = false;
            console.log('✅ Database disconnected');
        }
    }
    async healthCheck() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return { status: 'healthy' };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    get client() {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        return this.prisma;
    }
}
exports.Database = Database;
//# sourceMappingURL=database.js.map